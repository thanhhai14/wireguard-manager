# 05 — Đặc tả UI/UX đích

## 1. Định hướng

Tái tạo mật độ thông tin, cấu trúc điều hướng và khả năng thao tác của mikr, nhưng dùng component React/Next.js và nhận diện của WireGuard Web. Không pixel-copy logo, SVG mark, nội dung license hay branding mikr.

UI bằng tiếng Việt; thuật ngữ kỹ thuật giữ tiếng Anh. Kiến trúc i18n phải có key từ đầu để thêm English mà không sửa component.

## 2. Desktop information architecture

Sidebar rộng khoảng 240px, header 56px, nội dung cuộn độc lập. Nhóm và thứ tự:

- **Tổng quan**: Dashboard, Routers, Companies/Networks.
- **Thao tác**: Commands, Templates, Upgrades, Scan Network, Topology, Backups, Logs, Security.
- **WireGuard**: Interfaces/Peers toàn cục, Pending Apply, Allocations. Các trang này là phần mở rộng của sản phẩm hiện tại.
- **Hệ thống**: Activity, Webhooks, Users, API Keys, Settings.

Footer sidebar: user/role, Guide WireGuard, theme, logout, app version, số router, DB/worker uptime và realtime status. Không có License mikr; nếu cần licensing nội bộ phải là yêu cầu riêng.

## 3. Route đích

| Route đề xuất | Nội dung |
|---|---|
| `/dashboard` | Tổng quan fleet, alerts, versions, sites, recent tasks |
| `/routers` | List/filter/group/bulk/import/export |
| `/routers/:id` | Device detail responsive |
| `/companies`, `/companies/:id` | Company và networks |
| `/networks/:id` | Network/site detail, routers, topology, policy |
| `/commands`, `/commands/runs/:id` | Command composer/history/live output |
| `/templates` | Template library/deployment |
| `/upgrades` | Check, queue, schedules, presets |
| `/scan` | Network discovery/import |
| `/topology` | Graph theo network, saved positions |
| `/backups` | Artifacts, schedule, diff, health |
| `/logs` | Syslog search/live tail |
| `/security` | CVE, patch gap, IDS |
| `/wireguard/peers` | Cross-router peer inventory/status |
| `/wireguard/pending` | Desired changes chờ apply |
| `/activity` | Audit/activity |
| `/webhooks`, `/api-keys`, `/users`, `/settings` | Administration |
| `/login` | Auth/MFA/passkey |

Có redirect/alias từ route hiện tại trong giai đoạn migration để bookmark không hỏng.

## 4. Dashboard

Dashboard phải trả lời ngay:

- Bao nhiêu router online/offline/disabled, theo company/network.
- Health hiện tại và các router vượt threshold.
- RouterOS versions và thiết bị cần upgrade.
- Task đang chạy/thất bại gần đây.
- Security findings theo severity.
- WireGuard peers: active/stale/missing/pending/drifted.
- Backup health và schedule bị lỗi.

Cards hỗ trợ drill-down bằng cùng filter. Không dùng số liệu trang trí không mở được nguồn dữ liệu.

## 5. Router list và detail

Router list có search, company/network, tag, status, RouterOS version, connection method, security/upgrade state; table trên desktop và cards trên mobile. Bulk action chỉ xuất hiện khi có selection và quyền phù hợp.

Desktop router detail:

- Header: tên, company/network, host, online/disabled, tags; Test/Edit/Duplicate/Upgrade/Reboot theo quyền.
- Overview facts và health tiles.
- Metrics chart, interfaces/physical map, live traffic/SFP.
- Routes summary + IPv4/IPv6 routing table/filter.
- Capability tabs: Command, History, DHCP, Wi-Fi, Logs, IPsec, WireGuard, IPv6 neighbors, LTE, STP, Routing.
- Backups/export/diff, security findings và recent tasks.

Các tab theo capability chỉ hiện sau khi capability snapshot tải xong. Poll interval tương thích baseline: 30 giây cho tab trạng thái đang mở; BGP history 5 phút; realtime traffic qua WS. Khi trang ẩn, dừng polling.

WireGuard tab mở giao diện quản lý hiện tại theo router/interface: sync thủ công, peer list/status, create/edit/soft-delete/restore, drift/pending/apply, config/QR/terminal và Guide. Không rút gọn thành form Add client của mikr.

## 6. Mobile

Mobile dùng topbar với page title và realtime pill; bottom nav:

- Dashboard
- Upgrades
- Logs nếu feature bật
- More

Router detail có tối đa bốn tab chính: Overview, Interfaces, Logs, More. More liệt kê DHCP, Wi-Fi, IPsec, WireGuard, Routing, IPv6, LTE, STP và command history theo capability. Các action destructive dùng bottom confirmation sheet phù hợp thao tác ngón tay.

Hỗ trợ safe area, pull-to-refresh, touch target tối thiểu 44px và không có table bắt buộc cuộn ngang cho tác vụ chính.

## 7. Design tokens và component

Giữ tinh thần dark-first, primary blue, semantic success/warning/danger/info. Có `dark`, `light`, `system`. Token bắt buộc: surface levels, text primary/muted, border, focus ring, overlay, chart palette, spacing, radius 4/8/12, shadow và motion duration.

Component dùng chung:

- App shell/sidebar/mobile shell/breadcrumb.
- Data table/card list/filter bar/pagination.
- Form field, secret field, IP/CIDR editor, tag selector.
- Modal/drawer/confirmation sheet.
- Toast và inline error summary.
- Status badge, realtime pill, stale indicator.
- Task tray/progress/log viewer.
- Terminal/output stream/code-copy.
- Metrics chart, port map, topology graph, VLAN editor.
- QR/config/terminal and Guide panels cho WireGuard.

## 8. Loading và phản hồi thao tác

Mọi navigation có route-level skeleton. Mọi mutation có trạng thái `idle → submitting/queued → running → success/error`:

- Nút disable và có spinner khi submit; chống double-click/idempotency.
- Tác vụ nhanh hiển thị toast + cập nhật màn hình.
- Tác vụ router dài trả task ID, mở task tray và tiếp tục chạy khi đổi trang.
- List/detail dùng skeleton ổn định kích thước, không flash empty state.
- Refresh nền giữ dữ liệu cũ và hiển thị “Đang cập nhật”, không che toàn màn hình.
- Lỗi có message hành động được, correlation/task ID và Retry khi an toàn.
- Confirm ghi rõ số router/peer bị ảnh hưởng.

Các vị trí bắt buộc: login, mọi route transition, dashboard cards, router/network/company CRUD, connect/test/sync/apply, peer/config/QR, commands, templates, scan, topology refresh, backup/diff, upgrades/queue, logs, security, users, settings, webhooks và API keys.

## 9. Accessibility và i18n

- Điều khiển dùng keyboard, focus visible, Escape/return focus đúng với modal.
- Không truyền trạng thái chỉ bằng màu; badge có text/icon.
- `aria-live` cho toast/progress quan trọng, terminal không spam screen reader.
- Form label/error liên kết đúng; contrast WCAG AA.
- Date/number/bytes/timezone format qua formatter chung.
- Chuỗi UI không hard-code trong component mới; thuật ngữ RouterOS/WireGuard/BGP giữ nguyên.
