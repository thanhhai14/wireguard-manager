# 08 — Triển khai VPS qua Cloudflare Tunnel

## 1. Topology đề xuất

Một VPS Linux x86_64/arm64 chạy Docker Compose:

| Service | Public port | Persistent data | Vai trò |
|---|---:|---|---|
| `web` | Không | Không | Next.js/API/WS, chỉ nghe internal network |
| `worker` | Không | Có thể dùng temp volume | Router jobs/monitor/scheduler |
| `postgres` | Không | PostgreSQL volume | Dữ liệu chính |
| `cloudflared` | Outbound only | Tunnel credential/file | HTTPS/WSS ingress |
| `syslog` | 5514 UDP/TCP nếu bật | Buffer tùy chọn | Collector riêng |

Cloudflare DNS trỏ hostname application vào named tunnel. Ingress của tunnel forward tới `http://web:3000` (hoặc cổng app đã cấu hình). WebSocket đi cùng route này.

## 2. Giới hạn quan trọng của Tunnel

- Named HTTP Tunnel phù hợp web/API/WebSocket.
- Router SSH là kết nối **từ worker trên VPS ra router**, không đi qua Cloudflare Tunnel. VPS phải resolve DDNS và kết nối được port SSH/REST/SNMP của router; router nên whitelist public IP của VPS.
- Syslog UDP/TCP từ RouterOS không tự đi qua HTTP Tunnel. Phương án chuẩn là mở duy nhất cổng syslog trên firewall VPS, tốt hơn là gửi qua WireGuard/private network; Cloudflare Spectrum là phương án riêng có điều kiện/gói dịch vụ và không được mặc định giả định.
- Cloudflare Tunnel không thay network firewall, TLS trust tới router, app auth hoặc database backup.

## 3. Cloudflare policy

- TLS ở edge, Always HTTPS, HSTS sau khi xác minh hostname.
- Cloudflare Access tùy chọn với identity/MFA và nhóm admin; service token cho automation nếu cần.
- Không cache `/api/*`, `/ws`, download config/backup và nội dung authenticated.
- Rate-limit login và endpoint nhạy cảm; tránh challenge trên WebSocket/API nội bộ gây reconnect loop.
- Origin web chỉ nằm trong Docker network hoặc bind loopback; chặn public app port ở VPS firewall.

## 4. Secrets và environment

Tối thiểu:

- `DATABASE_URL` dùng user riêng, không phải PostgreSQL superuser.
- `APP_BASE_URL` là HTTPS hostname bên ngoài.
- Session/JWT keys có version và entropy đủ cao.
- Master encryption key cho router/WireGuard secrets, tách khỏi DB backup.
- Bootstrap admin username/password hash chỉ dùng lần đầu.
- Cloudflare tunnel token/credential.
- Object storage credential nếu backup artifact không nằm local.

Không commit `.env`, private SSH key hay cloudflared credentials. Secret production được đặt bằng file permission chặt, Docker secret hoặc secret manager. Document quy trình rotate master/session/tunnel key trước go-live.

## 5. Migration và deploy

1. Backup DB và kiểm tra checksum/restore point.
2. Pull image theo immutable tag/digest.
3. Chạy migration job một lần với advisory lock.
4. Start web/worker mới; readiness chỉ xanh sau DB/migration check.
5. Smoke test login, WS, task, router probe và WG read-only sync.
6. Chuyển tunnel/traffic nếu là blue-green.
7. Theo dõi error/task queue/DB connections.

Không chạy migration đồng thời từ mọi replica. Schema change theo expand → migrate/backfill → switch code → contract, tránh drop column trong cùng release.

## 6. Backup và disaster recovery

- PostgreSQL: backup hằng ngày + WAL/PITR nếu nhà cung cấp hỗ trợ; mã hóa offsite.
- Backup artifacts: volume/object storage riêng và lifecycle.
- Cloudflared config, compose manifest và env key inventory được backup, nhưng secrets tách và kiểm soát truy cập.
- Có restore drill định kỳ, không chỉ kiểm tra file tồn tại.
- Ghi RPO/RTO trước production; baseline đề xuất RPO ≤ 24h nếu chưa có PITR, RTO ≤ 4h.

## 7. Observability và vận hành

- Structured logs theo service/request/task/router, luôn redact secret.
- Metrics: web latency/error, WS clients/reconnect, queue depth/age, worker heartbeat, router success rate, DB pool/storage, syslog drop.
- Alerts: worker không heartbeat, queue oldest age, backup fail, DB near full, tunnel disconnected, router failure burst.
- Health checks không gọi đồng loạt router; readiness chỉ kiểm dependency nội bộ.

## 8. Sizing ban đầu

Không thể chốt CPU/RAM chỉ từ code; phụ thuộc số router, polling interval, metrics/syslog retention và concurrency. Điểm khởi đầu hợp lý cho fleet nhỏ là 2–4 vCPU, 4–8 GB RAM, SSD 40+ GB; PostgreSQL và artifact cần giám sát dung lượng thực tế. Load test bằng số router mô phỏng tương ứng trước khi chọn production size.

## 9. Hardening VPS

- SSH VPS bằng key, disable password/root login nếu chính sách cho phép.
- Firewall deny-by-default; chỉ SSH quản trị và syslog ingress đã quyết định, không mở PostgreSQL/app port.
- Automatic security updates có maintenance policy.
- Docker socket không mount vào web/worker.
- Containers chạy non-root, read-only filesystem nơi phù hợp, drop capabilities.
- Egress policy cho webhook để chống SSRF; router access subnet/ports được giới hạn.
