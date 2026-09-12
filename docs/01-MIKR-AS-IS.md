# 01 — Hiện trạng mikr 1.86.0

## 1. Độ tin cậy và khả năng tái lập

Khảo sát được thực hiện trên release local `/home/thanhhai14/Data/Code/mikrotik-mgr`.

| Tệp | SHA-256 |
|---|---|
| `package.json` | `f64fc0fd31935e6ddcbfc3c7c77c75ba342b1f6bd5c1fc68c51c3ddf9ad2e95d` |
| `server.js` | `b10fdb22c6bac4fa76d5ce7f59ece2df5aea80a027502c666890f68ae4311ff5` |
| `public/js/app.js` | `293e1a9c59c67713b2fb56af45a0b620a08651425337429b48eb110d22a080d2` |
| `public/js/api.js` | `a80c56f13855b9e724dc35bb683e258be9afa3c9f33a912a6fb389ed28539a42` |
| `public/js/websocket.js` | `ec897e9373039bffc2bd0e029d3f470c0f323566aa37d13602c3905514b7833f` |
| `public/js/views/device-detail.js` | `5f72827881ed197b06b578f2fa3599ac6f952f7af9422b056133b332b048e18f` |
| `public/js/views/device-detail.mobile.js` | `eb70fb2151dcceaf36c2ebc86f96d1d6fabf5adf9907d5782698b3373f634756` |

Thử chạy bytecode bằng Node 22.22.1 thất bại với `cachedDataRejected`, nghĩa là cache V8 được tạo bởi một build Node/V8 khác. Do đó không thể dùng runtime reflection để khôi phục chính xác implementation backend từ gói này. Điều này không ảnh hưởng tới việc xác minh frontend contract, dependency, tên route/module và tài liệu upstream.

## 2. Stack và cách vận hành

Đã xác minh từ `package.json` và cây tệp:

- Node.js 22, Express 5.
- SQLite qua `better-sqlite3`.
- SPA bằng Vanilla JavaScript ES modules và CSS thuần.
- REST API, WebSocket qua `ws`.
- SSH qua `node-ssh`, SNMP qua `net-snmp`; README xác nhận thêm RouterOS REST/HTTPS.
- JWT, bcrypt, rate limit, Helmet, CORS, cookie parser.
- TOTP và WebAuthn/passkey.
- QR WireGuard qua `qrcode`.
- Backend release được biên dịch thành bytecode bằng `bytenode`.

README upstream mô tả Docker `node:22-alpine`, dữ liệu bền vững trong volume và các cổng HTTP/HTTPS/syslog. Đây là mô tả triển khai upstream, không phải kiến trúc bắt buộc của sản phẩm đích.

## 3. Phân lớp backend quan sát được

Tên module `.jsc` cho thấy một modular monolith với các lớp sau:

- `config`: cấu hình và settings schema.
- `routes`: auth, users, devices, sites, commands, templates, upgrades, backups, syslog, webhooks, API keys, license, scan, topology, CVE, IDS, metrics, MCP/OAuth.
- `controllers`: điều phối request cho các domain tương ứng.
- `services`: SSH/REST/SNMP MikroTik, monitor, health/metrics, command/task, backup, upgrade, syslog, webhook, WireGuard, IPsec, LTE, BGP, VLAN, PoE, CVE/IDS, TOTP/WebAuthn, MCP.
- `data/repositories`: repository theo domain, SQLite store và store abstraction.
- `websocket`: xác thực, subscription và phát sự kiện realtime.
- `utils`: crypto/secrets, parser RouterOS, schedule, TLS, ZIP và trợ giúp hệ thống.

Đây là **xác minh cấu trúc**, không phải xác minh thuật toán bên trong các `.jsc`.

## 4. Điều hướng giao diện

Các route SPA được xác minh trực tiếp từ `public/js/app.js`:

| Nhóm desktop | Route | Màn hình |
|---|---|---|
| Overview | `dashboard` | Dashboard |
| Overview | `devices`, `devices/:id` | Danh sách và chi tiết device |
| Overview | `sites` | Sites |
| Actions | `commands`, `devices/:id/command` | Lệnh và output trực tiếp |
| Actions | `templates` | Command templates |
| Actions | `upgrades` | Upgrade, queue, schedule |
| Actions | `scan` | Scan network |
| Actions | `topology` | Topology |
| Actions | `backups` | Backup và diff |
| Actions | `logs` | Syslog, phụ thuộc feature flag |
| Actions | `security` | CVE/IDS, phụ thuộc feature flag |
| System | `activity` | Audit/activity |
| System | `license` | License upstream |
| System | `webhooks` | Webhooks, admin trở lên |
| System | `users` | Users, superadmin |
| System | `api-keys` | API keys/MCP clients, superadmin |
| System | `settings` | Settings |
| Mobile | `more` | Menu chức năng còn lại |
| Auth | `login` | Đăng nhập |

Sidebar footer hiển thị user, đổi theme, logout, version, số device, RAM/DB/uptime, trạng thái WebSocket và report bug.

## 5. Device detail

Desktop dùng trang chi tiết lớn, có overview/health, route summaries, routing table IPv4/IPv6, interface/port map và metrics history. Vùng thao tác theo tab gồm:

- Command và command history.
- DHCP leases.
- Wi-Fi clients/password.
- Logs.
- IPsec.
- WireGuard.
- IPv6 neighbors.
- LTE, SMS và usage.
- STP.
- Routing BGP/OSPF.
- Backups/export/diff.
- CVE, upgrade, reboot, clone/test/edit/delete theo quyền và trạng thái.

Các tab theo capability được gọi từ `/devices/:id/tunnel-caps`. DHCP, wireless, IPsec, WireGuard, IPv6, LTE và routing tự poll 30 giây khi tab đang mở; BGP chart dùng chu kỳ 5 phút. Metrics history có lifecycle riêng.

Mobile không co nhỏ nguyên trang desktop. `device-detail.mobile.js` tạo mô hình riêng, tối đa bốn tab chính: Overview, Interfaces, Logs và More. More chứa DHCP, Wi-Fi, IPsec, WireGuard, Routing, IPv6 neighbors, LTE, STP và command history theo capability.

## 6. Auth, quyền và trạng thái client

Frontend xác minh bốn role: `superadmin`, `admin`, `operator`, `viewer`. README xác nhận site scoping. Quy tắc quan sát được:

- Superadmin quản trị users và API keys.
- Admin/superadmin thay đổi device/site, backup schedule, webhook, security block list và các cấu hình nhạy cảm.
- Operator được chạy command/template và một số tác vụ vận hành.
- Viewer chủ yếu đọc.

Client giữ `accessToken`, `refreshToken`, `user`, `theme` cùng một số preference sắp xếp trong `localStorage`. API mặc định `/api`, gửi Bearer token, tự gọi `/auth/refresh` khi 401 và bật session-lock nếu refresh thất bại.

Theme có `dark`, `light`, `system`; mặc định dark. WebSocket kết nối `/ws`, gửi message auth rồi subscribe channel. Reconnect lũy tiến từ 1 đến 30 giây và có trạng thái Live/Reconnecting/Offline.

## 7. Các domain chức năng đã đối chiếu

- Fleet: devices, sites, tag, bulk edit, import/export bundle, scan/discovery.
- Monitoring: availability, CPU/RAM/temperature/voltage/fan, interface traffic, optical/SFP history, RouterOS version, status batch.
- Network: interfaces, PoE, neighbors/topology, VLAN, DHCP, Wi-Fi, IP services, routes/BGP/OSPF, IPsec, WireGuard, IPv6, LTE/SMS.
- Automation: command, template, multi-device deploy, task tray, queues, schedules.
- Lifecycle: RouterOS/firmware upgrade, queue, PoE-aware ordering, release notes, reboot and verification.
- Backup: export, history, per-device/site schedules, compare/diff, health.
- Observability/integration: syslog, webhooks, API keys, Prometheus/MCP theo README.
- Security: audit, CVE, vendor patch gap, IDS block/whitelist, TOTP, WebAuthn.

## 8. WireGuard của mikr so với sản phẩm hiện tại

Mikr có WireGuard monitor và “Add client”: chọn IP trống IPv4/IPv6, sinh key, ghi peer, trả QR/config và chỉ hiển thị private key một lần. Sản phẩm hiện tại mạnh hơn ở quản trị vòng đời client: Company → Network → Router → Interface → Peer, DB desired state, drift, pending apply, soft-delete/restore, config/text/QR/terminal, Windows auto-start và private key mã hóa để tải lại.

Kiến trúc đích sẽ giữ mô hình WireGuard hiện tại làm nguồn chức năng chính, đồng thời gắn nó vào Device detail và RBAC/task/audit của hệ thống fleet mới. Không thay bằng implementation “Add client” đơn giản của mikr.
