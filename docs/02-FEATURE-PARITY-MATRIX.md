# 02 — Ma trận chức năng parity

## Quy ước

- **Giữ**: đã có trong WireGuard Web, cần bảo toàn.
- **Xây**: cần triển khai mới.
- **Hợp nhất**: mikr có chức năng cơ bản nhưng dùng domain hiện tại làm lõi.
- **Loại**: không đưa vào sản phẩm đích.
- Mức bằng chứng `UI` là đọc trực tiếp frontend; `README` là tài liệu upstream; `MODULE` là xác minh tên module backend.

## Nền tảng và tài khoản

| Chức năng | Bằng chứng | Quyết định |
|---|---|---|
| Login, access/refresh token, session lock | UI + MODULE | Xây |
| RBAC superadmin/admin/operator/viewer | UI + README | Xây |
| Giới hạn người dùng theo site | README + MODULE | Xây |
| TOTP, backup codes | UI + MODULE | Xây |
| WebAuthn/passkey | UI + MODULE | Xây |
| User CRUD/reset password/thu hồi 2FA/passkey | UI | Xây |
| Một admin từ `.env` | Ứng dụng hiện tại | Chỉ dùng bootstrap user đầu tiên, sau đó chuyển DB |
| License/device cap/activation của mikr | UI + README | Loại |
| Branding/report-bug của mikr | UI | Loại hoặc thay bằng branding nội bộ |

## Fleet, site và discovery

| Chức năng | Bằng chứng | Quyết định |
|---|---|---|
| Company → Network → nhiều Router | Hiện tại | Giữ |
| Sites, contact/location/notes | UI + README | Hợp nhất: Network đóng vai Site, Company là tầng cao hơn |
| Device CRUD, enable/disable, duplicate, test | UI | Xây |
| SSH/REST/SNMP connection profile | README + MODULE | Xây |
| Hostname/DDNS, port, key/password, fingerprint | Hiện tại + README | Giữ/mở rộng |
| Tags, filter, sort, group | README + UI | Xây |
| Bulk edit | UI + README | Xây |
| Encrypted device import/export bundle | UI | Xây |
| Scan network và import discovered devices | UI + MODULE | Xây |
| PSU catalog/device defaults | UI | Xây |

## Monitoring và device detail

| Chức năng | Bằng chứng | Quyết định |
|---|---|---|
| Online/offline, delayed offline detection | README + MODULE | Xây bằng worker |
| CPU, RAM, uptime, temperature, voltage, fan | UI + README | Xây |
| Metrics history/range charts | UI + MODULE | Xây |
| Interfaces, live traffic, traffic history | UI + README | Xây |
| SFP optical values/history | UI + README | Xây |
| Physical port map và neighbor map | UI | Xây |
| PoE port state và power budget | UI + README | Xây |
| RouterOS/latest-version status | UI + README | Xây |
| Device status realtime batch | UI | Xây |

## Network inventory và configuration

| Chức năng | Bằng chứng | Quyết định |
|---|---|---|
| IPv4/IPv6 routing table, protocol filters | UI | Xây |
| BGP/OSPF status và BGP history | UI + MODULE | Xây |
| DHCP leases, add/make-static | UI | Xây |
| Wi-Fi clients và đổi PSK | UI | Xây |
| IP services toggle | UI | Xây, cần confirmation/audit |
| IPsec peer status | UI + README | Xây |
| IPv6 neighbors | UI | Xây |
| Bridge STP | UI | Xây |
| LTE status, cell lookup, SMS, usage, firmware | UI + MODULE | Xây |
| VLAN editor preview/apply/confirm/revert | UI + MODULE | Xây theo transaction có rollback |
| Topology và lưu vị trí node theo site | UI | Xây |

## WireGuard

| Chức năng | Nguồn ưu tiên | Quyết định |
|---|---|---|
| Nhiều interface trên mỗi router | Hiện tại | Giữ |
| Import/sync RouterOS thủ công | Hiện tại | Giữ |
| DB snapshot, desired state, drift/missing/reappeared | Hiện tại | Giữ |
| Tạo/sửa/xóa mềm/restore peer | Hiện tại | Giữ |
| Apply từng peer lên RouterOS | Hiện tại | Giữ và đưa qua task queue |
| IPv4 allocation start/end, collision validation | Hiện tại | Giữ |
| Internal/remote subnet theo mode | Hiện tại | Giữ |
| Client private key/preshared key mã hóa | Hiện tại | Giữ |
| Config file, text, QR | Hiện tại + mikr | Giữ |
| Linux/macOS/Windows terminal install | Hiện tại | Giữ |
| Windows PowerShell + Auto Start watchdog | Hiện tại | Giữ |
| Realtime handshake/endpoint/RX/TX | Cả hai | Hợp nhất vào monitor worker |
| IPv6 client allocation của mikr | README | Xây sau IPv4 parity, schema chuẩn bị sẵn |

## Command, task và automation

| Chức năng | Bằng chứng | Quyết định |
|---|---|---|
| Quick command và streaming output | UI | Xây |
| Multi-device command | UI + README | Xây |
| Command history | UI | Xây |
| Template CRUD/import/export/quick action | UI | Xây |
| Deploy/execute template theo device/site | UI | Xây |
| Durable task tray, log và progress | UI + MODULE | Xây |
| Queue/cancel/progress/partial result | UI | Xây |
| Backup/upgrade schedule | UI | Xây |

## Upgrade và backup

| Chức năng | Bằng chứng | Quyết định |
|---|---|---|
| RouterOS/firmware/full upgrade | UI | Xây |
| Pre-check, progress, reboot, verify | UI + MODULE | Xây |
| Multi-device upgrade queue | UI | Xây |
| PoE-aware queue ordering | UI + README | Xây |
| Upgrade preset và schedule | UI | Xây |
| Release notes/changelog | UI | Xây |
| RSC/config backup, export/download | UI + MODULE | Xây |
| Per-device/site schedules | UI | Xây |
| Backup diff/compare và health | UI | Xây |

## Log, integration và security

| Chức năng | Bằng chứng | Quyết định |
|---|---|---|
| Syslog UDP/TCP, filter, live tail, clear | UI + README | Xây; ingress riêng, không đi qua HTTP Tunnel |
| Webhook CRUD/test, event selection | UI + MODULE | Xây |
| API keys, site scope, revoke | UI + MODULE | Xây |
| MCP clients/OAuth | UI + MODULE + README | Xây sau REST API ổn định |
| Prometheus metrics | README + MODULE | Xây |
| Zabbix integration | README | Xây phase tích hợp |
| Audit/activity filter/export/live | UI | Xây |
| CVE summary/device findings/patch gap | UI + MODULE | Xây |
| IDS candidates/block/whitelist | UI + MODULE | Xây |
| GeoIP/OpenCelliD | README + UI | Xây dưới dạng integration tùy chọn |

## PWA, responsive và trạng thái UI

| Chức năng | Bằng chứng | Quyết định |
|---|---|---|
| Desktop sidebar theo nhóm | UI | Xây |
| Mobile top bar + bottom nav + More | UI | Xây |
| Mobile device detail riêng | UI | Xây |
| Dark/light/system theme | UI | Xây |
| PWA installable | README + tài sản tĩnh | Xây |
| Pull-to-refresh, swipe actions, confirm sheet | UI | Xây |
| Toast, modal, loading/skeleton/progress/empty/error | UI + yêu cầu hiện tại | Chuẩn hóa toàn hệ thống |
| WS status và stale-data indicator | UI | Xây |

## Điều kiện tuyên bố “đạt parity”

Không dùng số lượng màn hình làm tiêu chí. Một hàng chỉ đạt khi có: quyền đúng, loading/error/empty state, audit, task/retry nếu là thao tác router, desktop/mobile, test integration với RouterOS và tài liệu vận hành. Những mục bị `Loại` không ảnh hưởng tuyên bố parity vì là tài sản thương mại/branding của mikr, không phải năng lực quản trị mạng.
