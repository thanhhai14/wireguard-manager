# 03 — Kiến trúc đích trên VPS

## 1. Quyết định tổng thể

Giữ Next.js/React/TypeScript và PostgreSQL của WireGuard Web. Không chuyển sang Express + Vanilla JS + SQLite chỉ để giống stack mikr. Điều cần tái hiện là chức năng, luồng vận hành và trải nghiệm; stack hiện tại cho type safety, migration và khả năng mở rộng dữ liệu tốt hơn.

Chuyển từ ứng dụng serverless request/response sang **modular monolith có web process và worker process chạy liên tục**:

```text
Internet
   │ HTTPS/WSS
Cloudflare Edge + Access (tùy chọn)
   │ Cloudflare Tunnel
cloudflared ──► web:3000 (Next.js UI + REST + WebSocket gateway)
                    │
                    ├── PostgreSQL (domain, jobs, event outbox, metrics)
                    └── worker (SSH/REST/SNMP, monitor, scheduler, webhook)

RouterOS ── SSH/REST/SNMP ──► worker/web qua mạng outbound của VPS
RouterOS ── Syslog UDP/TCP ──► cổng ingress riêng của VPS/VPN
```

Đây vẫn là một repository và một image ứng dụng; web/worker chạy entrypoint khác nhau. Chưa cần microservice hay Redis ở phase đầu.

## 2. Thành phần runtime

### Web process

- Render UI bằng Next.js App Router.
- REST API/BFF có schema validation, auth và RBAC.
- Tạo job thay vì giữ HTTP request trong suốt thao tác RouterOS dài.
- WebSocket/SSE gateway phát task progress, device status, logs và metrics.
- Health endpoints tách `live`, `ready` và dependency status.

### Worker process

- Claim job bền vững từ PostgreSQL bằng `FOR UPDATE SKIP LOCKED`.
- Scheduler cho monitor, backups, upgrades và housekeeping.
- Kết nối MikroTik qua provider SSH, REST hoặc SNMP.
- Retry có backoff, timeout, cancellation và idempotency key.
- Ghi task log, audit, snapshot và outbox event trong transaction phù hợp.
- Không giữ router lock bằng biến nhớ hay TTL cố định 30 giây.

### PostgreSQL

- Nguồn dữ liệu ứng dụng, RBAC, desired state, snapshots và task history.
- Advisory lock theo `router_id` hoặc lease có heartbeat cho thao tác độc quyền.
- Partition/retention cho metrics, traffic và syslog để tránh tăng vô hạn.
- Có PITR/backup định kỳ ở hạ tầng và export ứng dụng.

### Cloudflared

- Kết nối outbound từ VPS tới Cloudflare; origin không cần mở public port 80/443.
- Proxy HTTP và WebSocket đến web process.
- Cloudflare Access có thể là lớp bảo vệ thứ nhất, nhưng không thay auth/RBAC của app.
- Không đưa PostgreSQL hay Docker socket vào tunnel.

## 3. Ranh giới module trong codebase

```text
src/
  app/                  Next.js routes/layout/pages
  modules/
    auth/               session, token, MFA, WebAuthn, RBAC
    organizations/      company, network/site
    devices/            router inventory, connection profiles, tags
    monitoring/         polling, status, metrics, traffic
    wireguard/          interface, peer, allocation, config, apply/sync
    commands/           command/template/execution
    tasks/              job, queue, log, cancellation, progress
    backups/            export, artifact, diff, schedules
    upgrades/           checks, queue, schedule, verification
    network/            DHCP/Wi-Fi/VLAN/routing/IPsec/LTE/STP
    topology/           neighbor graph, saved position
    syslog/             collectors, query, retention
    security/           CVE, patch gap, IDS
    integrations/       webhook, API key, metrics, MCP
    settings/           typed settings and secret references
  infrastructure/
    db/                 Drizzle schema/repositories/migrations
    routeros/           SSH/REST/SNMP adapters and parsers
    crypto/             envelope encryption/key rotation
    realtime/           WS hub/outbox dispatcher
    worker/             runner/scheduler/leases
```

Mỗi module có application service, repository interface, validation schema và permission policy. Server action/page không được gọi thẳng SSH.

## 4. Provider RouterOS

Một `RouterClient` thống nhất expose các capability thay vì rải câu lệnh CLI trong UI:

- `probe`, `facts`, `interfaces`, `metrics`, `neighbors`.
- `executeCommand` và streaming output.
- WireGuard read/apply/delete.
- Backup/export, reboot, upgrade.
- DHCP/Wi-Fi/IP services/VLAN/LTE/routing.

Adapter:

- **SSH**: mặc định cho command/config và tương thích rộng; hostname/DDNS được hỗ trợ trực tiếp bởi resolver hệ điều hành. Host-key fingerprint bắt buộc sau lần trust đầu.
- **REST HTTPS**: dùng cho read/write có cấu trúc khi RouterOS hỗ trợ, kiểm tra chứng chỉ rõ ràng.
- **SNMP**: ưu tiên read-only monitoring cho thiết bị không cho SSH/REST; không dùng để giả lập các chức năng write không có capability.

Capability detection quyết định tab và action. UI không đoán capability chỉ từ version.

## 5. Task, lock và idempotency

Mọi thao tác có thể kéo dài hơn một request, thay đổi router hoặc chạy nhiều device phải là task:

1. API validate permission/input và tạo task với idempotency key.
2. Worker claim task, acquire router advisory lock và phát `task:update`.
3. Worker thực hiện từng step, ghi log/progress và heartbeat lock.
4. Kết quả được commit vào DB, phát domain event và audit.
5. Retry chỉ chạy step idempotent hoặc có probe xác định trạng thái trước khi lặp.

Các thao tác read ngắn có thể chạy đồng thời. Write trên cùng router được serialize; write khác router chạy song song. Cơ chế này thay lỗi “router đang xử lý thao tác khác” do lock thời gian cứng hiện tại.

## 6. Realtime

WebSocket là kênh UI; PostgreSQL outbox là nguồn event bền vững. Worker không phụ thuộc kết nối trực tiếp tới browser. Nếu WS đứt, client reconnect, re-auth và fetch snapshot/task cursor để không mất kết quả.

Các event giữ tương thích semantic với 33 event quan sát từ mikr, nhưng payload phải có `eventId`, `occurredAt`, `tenant/companyId`, `taskId` hoặc `deviceId`, `version`.

## 7. Bảo mật

- Bootstrap superadmin từ env chỉ ở lần cài đầu; password đổi và users nằm trong DB.
- Cookie session HttpOnly/Secure/SameSite hoặc access token ngắn hạn + refresh rotation; không giữ refresh token lâu dài trong localStorage ở bản đích.
- TOTP/WebAuthn, rate limit và audit cho login/secret/export/command.
- SSH private key, router password, WireGuard private/PSK mã hóa envelope bằng master key ngoài DB; có `key_version` để rotate.
- Không log secret, full Authorization header, private key hoặc config client.
- Command nguy hiểm, reboot, upgrade, VLAN apply và bulk write cần confirm rõ phạm vi.
- Cloudflare Access bật MFA/IP policy nếu phù hợp, nhưng route health nội bộ và callback webhook có policy riêng.

## 8. Không chọn SQLite cho đích

SQLite phù hợp mikr một-node và đơn giản vận hành, nhưng không phù hợp yêu cầu mới về web + worker đồng thời, durable queue, advisory locking, lượng metrics/syslog và khả năng backup/restore có kiểm soát. PostgreSQL đang có sẵn, nên giữ PostgreSQL giảm rủi ro migration ngược và hỗ trợ workload đích tốt hơn.
