# 09 — Rủi ro, quyết định và tiêu chí nghiệm thu

## 1. Các quyết định đã chốt

| ID | Quyết định | Lý do |
|---|---|---|
| ADR-001 | Chạy VPS qua Cloudflare Tunnel | Cần process lâu dài và origin không mở web port công khai |
| ADR-002 | Giữ Next.js/React/TypeScript | Không có lợi ích đủ lớn khi viết lại Vanilla JS |
| ADR-003 | Giữ PostgreSQL/Drizzle | Phù hợp web+worker, queue, lock, metrics hơn SQLite |
| ADR-004 | Modular monolith + web/worker | Đủ tách trách nhiệm nhưng tránh phức tạp microservice |
| ADR-005 | Network tương đương Site, Company là tầng trên | Giữ đúng domain đã thống nhất và dữ liệu hiện tại |
| ADR-006 | RouterOS observed, DB desired/metadata | Bảo toàn quy tắc sync/apply WireGuard |
| ADR-007 | Task bền vững cho router write/long ops | Chống timeout, lock giả và mất trạng thái |
| ADR-008 | Functional parity, không sao chép branding/license | Tránh phụ thuộc tài sản thương mại/mã nguồn đóng |
| ADR-009 | Syslog có ingress riêng | HTTP Cloudflare Tunnel không phải UDP syslog transport |

## 2. Rủi ro chính

### R1 — Backend mikr không đọc được

168 module `.jsc` che implementation. Giảm thiểu bằng contract frontend, README, module inventory, black-box test trên container tương thích nếu có license/quyền chạy, và test trực tiếp RouterOS. Không tuyên bố thuật toán tương đương chỉ từ tên module.

### R2 — Phạm vi rất lớn

“Toàn bộ mikr + WireGuard hiện tại” là sản phẩm nhiều release. Giảm thiểu bằng roadmap vertical slice, parity matrix, feature flag và tiêu chí hoàn thành. Không gom thành một lần rewrite.

### R3 — Thao tác RouterOS gây mất kết nối

VLAN/IP services/upgrade/reboot/command có thể khóa admin khỏi router. Cần preview/diff, confirmation, maintenance window, timed rollback nơi khả thi, serial lock và audit. Lab test trước production.

### R4 — Secret exposure

Router key/password và WG private key có giá trị cao. Cần envelope encryption, redaction, permission reveal, audit, key rotation, backup key riêng. Tuyệt đối không đặt secret trong task logs/WS.

### R5 — Dữ liệu tăng vô hạn

Metrics, traffic, task log và syslog có thể lấp disk. Cần partition, retention, rollup, capacity alert và query pagination ngay từ schema đầu.

### R6 — Cloudflare tạo cảm giác an toàn giả

Tunnel chỉ bảo vệ web ingress. Router ports, syslog, VPS SSH và outbound webhook vẫn cần firewall/allowlist/TLS/SSRF controls.

### R7 — Khác biệt RouterOS/version/model

Output CLI và capability không đồng nhất. Cần normalized adapter, capability probe, golden fixtures nhiều version và xử lý missing/invalid values; mọi number parser phải từ chối `NaN` trước DB.

### R8 — Upgrade và job recovery

Reboot làm mất kết nối là bình thường. Task phải có trạng thái waiting/reprobe/verify, không coi socket close là failure cuối cùng. Worker restart phải resume an toàn.

## 3. Definition of Done cho từng feature

Một feature chỉ Done khi:

- Có validation, permission và network/company scope phía server.
- Có success/loading/empty/error/retry state desktop và mobile.
- Mutation router là task nếu có thể dài/mất kết nối; có idempotency và audit.
- Secret được mã hóa/redact; log không lộ dữ liệu nhạy cảm.
- Unit test domain/parser và integration test DB/API/RouterOS fixture.
- Migration/backfill/rollback được mô tả và kiểm thử.
- Metrics/log vận hành đủ để chẩn đoán.
- Docs/API/i18n keys được cập nhật.

## 4. Nghiệm thu parity tổng thể

### Functional

- Tất cả dòng không bị `Loại` trong ma trận feature đã đạt Definition of Done.
- Bốn role và network scope vượt permission test.
- 33 semantic realtime events hoặc mapping tương đương có test UI.
- API adapter/feature mới đáp ứng toàn bộ luồng UI đã liệt kê trong tài liệu 05/06.
- Toàn bộ WireGuard regression hiện tại xanh, gồm sync/apply/drift/delete/restore/config/QR/terminal/Guide.

### Reliability

- Worker kill/restart, DB reconnect, tunnel reconnect và router reboot không làm mất task hoặc ghi trùng.
- Hai thao tác đồng thời cùng router serialize; khác router có thể song song.
- Allocation peer đồng thời không cấp trùng IP.
- Backup production đã restore thành công trong môi trường cô lập.

### Performance

- Có load test theo fleet mục tiêu và polling thực tế.
- Dashboard/router list không tạo N+1 router calls; chỉ đọc snapshot DB.
- Queue age, DB growth và WS fanout nằm trong budget được chốt trước go-live.

### Security

- Auth/MFA/session rotation, rate-limit, CSRF/XSS/SSRF và authorization được test.
- Dependency/container scan không còn lỗ hổng P0/P1 chưa có chấp thuận.
- Private key/password không xuất hiện trong logs, audit diff, API list hoặc WS.
- Cloudflare, firewall, router allowlist và secret rotation có runbook.

### UX

- Không có mutation “bấm mà không phản hồi”.
- Responsive đạt các breakpoint phone/tablet/desktop chính.
- Keyboard/focus/contrast và screen reader kiểm tra trên các flow quan trọng.
- Offline/reconnecting/stale data được phân biệt rõ với router offline.

## 5. Các câu hỏi cần chốt trước từng phase, không chặn tài liệu hiện tại

- Số router/users dự kiến, polling interval và retention để sizing.
- RouterOS versions/models lab tối thiểu.
- Cloudflare Access có bắt buộc hay chỉ tùy chọn.
- Syslog sẽ dùng public allowlist hay private WireGuard network.
- Object storage cho backups hay VPS volume + offsite copy.
- RPO/RTO và maintenance window.
- Những integration nào (Zabbix/MCP/GeoIP/OpenCelliD) phải có ở release đầu.
