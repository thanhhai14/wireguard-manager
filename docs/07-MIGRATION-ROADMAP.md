# 07 — Lộ trình chuyển đổi

## Chiến lược

Chuyển đổi theo vertical slice, luôn giữ bản WireGuard hiện tại deploy được. Mỗi phase gồm schema migration, API, worker nếu cần, UI desktop/mobile, permission, audit, loading/error và test. Feature flag dùng để đưa chức năng mới vào dần.

## Phase 0 — Baseline và safety net

- Pin dependency versions, chuẩn hóa lint/typecheck/test/build.
- Viết smoke test cho login, company/network/router, WG sync/create/edit/delete/restore/apply/config/QR/terminal/Guide.
- Lưu fixture RouterOS đã gặp: field thiếu, `NaN`, hostname/DDNS, nhiều interface/subnet.
- Snapshot schema và procedure restore production.
- Tạo feature flags và correlation/request ID.

**Hoàn thành khi:** CI xanh, rollback được, WireGuard regression suite chạy trên test DB và router lab.

## Phase 1 — VPS runtime

- Docker image multi-stage, process web và worker.
- PostgreSQL production, migration job một lần, health/readiness.
- Docker Compose cho app/worker/postgres/cloudflared.
- Structured logging, graceful shutdown, backup/restore runbook.
- Deploy staging qua Cloudflare Tunnel.

**Hoàn thành khi:** restart/redeploy không mất task/data, WS qua tunnel ổn định, restore staging đã diễn tập.

## Phase 2 — Identity, RBAC và app shell

- Users/sessions, superadmin bootstrap, refresh rotation.
- Roles/permissions/network scoping.
- TOTP, backup codes, WebAuthn.
- Desktop sidebar, mobile shell, dark/light/system, i18n skeleton.
- Audit auth/admin actions.

**Hoàn thành khi:** bốn role qua permission matrix; user ngoài scope không đọc được dữ liệu bằng API trực tiếp.

## Phase 3 — Durable task platform

- Tasks/steps/logs/outbox, worker claim/retry/cancel.
- Router advisory lock/heartbeat và idempotency.
- Task tray, live progress, reconnect/replay.
- Chuyển WG sync/apply và router test sang task.

**Hoàn thành khi:** không còn lock TTL 30 giây; kill worker giữa task không gây apply trùng hoặc task treo vô hạn.

## Phase 4 — Fleet, company/network/site

- Router connection profiles SSH/REST/SNMP và capability probe.
- Company/Network/Router UI mới, tags, filters, bulk edit, duplicate.
- Import/export encrypted bundle và network discovery.
- Device enable/disable, test và status.

**Hoàn thành khi:** quản lý nhiều company/network/router; hostname/DDNS, host fingerprint và credential encryption đều được kiểm thử.

## Phase 5 — Monitoring và router detail

- Scheduler polling, offline delay, health and interface snapshots.
- Dashboard fleet/version/health/task cards.
- Router detail desktop/mobile, metrics/traffic/SFP history, port map/PoE.
- WS device status batch và interface traffic.
- Retention/rollup jobs.

**Hoàn thành khi:** offline/reconnect đúng threshold; biểu đồ và realtime không polling khi tab/browser ẩn; DB growth có giới hạn.

## Phase 6 — Commands và templates

- Quick/multi-device command, streaming output và history.
- Template CRUD/import/export/variables/deploy/quick actions.
- Redaction, permission, confirmation và full task audit.

**Hoàn thành khi:** partial failure từng router hiển thị rõ; cancel/reconnect không mất output; secrets không lọt log.

## Phase 7 — Backup và upgrade

- Backup artifact/history/diff/health, device/network schedule, retention.
- Upgrade check, RouterOS/firmware/full, reboot/verify.
- Presets, maintenance schedule, multi-device queue và PoE-aware ordering.
- Release notes/changelog.

**Hoàn thành khi:** upgrade có preflight và confirmation; reboot/reconnect tiếp tục task; backup checksum/download/restore test đạt.

## Phase 8 — Network feature parity

- DHCP, Wi-Fi, IP services, routes/BGP/OSPF history.
- IPsec, IPv6 neighbors, LTE/SMS/usage/firmware, STP.
- Topology/positions.
- VLAN preview/apply/confirm/revert với timed rollback.

**Hoàn thành khi:** capability gating chính xác; write operation có diff/confirm/audit; VLAN mất kết nối tự rollback theo policy đã test.

## Phase 9 — WireGuard hợp nhất hoàn chỉnh

- Đưa toàn bộ UI hiện tại vào router detail + inventory/pending pages.
- Peer revision/reservation và worker monitoring.
- Giữ config/QR/Linux/macOS/Windows/Auto Start/Guide.
- Thêm IPv6 allocation sau khi IPv4 regression xanh.
- Cập nhật permission/audit/reveal secret.

**Hoàn thành khi:** không mất bất kỳ tính năng WireGuard hiện tại; sync không bao giờ tự apply; concurrency allocation và desired revision được test.

Phase này có thể thực hiện từng phần từ Phase 3; số thứ tự là mốc nghiệm thu hợp nhất, không có nghĩa WireGuard bị tạm ngừng.

## Phase 10 — Logs, security và integrations

- Syslog UDP/TCP collector, retention/search/live tail.
- CVE/vendor patch gap, IDS candidate/block/whitelist.
- Webhooks + delivery history, API keys, Prometheus.
- MCP/OAuth, Zabbix, GeoIP/OpenCelliD theo feature flag.

**Hoàn thành khi:** ingress syslog được harden; webhook có HMAC/retry/SSRF protection; API key scoped; security finding có provenance.

## Phase 11 — PWA, hardening và cutover

- PWA/offline shell, accessibility, responsive/device matrix.
- Load/soak/failure tests, security review, dependency/image scan.
- Operational dashboards/alerts/runbooks.
- Data migration rehearsal, production cutover và rollback window.
- Xóa compatibility layer chỉ sau ít nhất một release ổn định.

**Hoàn thành khi:** đạt toàn bộ checklist trong tài liệu 09 và không còn blocker P0/P1.

## Thứ tự ưu tiên thực tế

Nền tảng bắt buộc: Phase 0–3. Giá trị vận hành cao: Phase 4–7 và WireGuard integration song hành. Các tính năng đặc thù LTE/VLAN/security/integration triển khai sau khi task/monitor nền tảng ổn định. Không cho phép UI gọi router trực tiếp như giải pháp tạm vì sẽ tạo thêm nợ cần viết lại.
