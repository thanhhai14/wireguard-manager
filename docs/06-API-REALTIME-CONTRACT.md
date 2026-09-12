# 06 — API và realtime contract

## 1. Baseline quan sát từ mikr

Static extraction trên 54 module frontend của mikr 1.86.0 tìm thấy **177 call-site pattern**: 84 GET, 56 POST, 15 PUT và 22 DELETE. Một số pattern là cùng endpoint nhưng khác biến nội suy/query. Đây là contract mà UI đang tiêu thụ, không chứng minh toàn bộ API backend vì backend là bytecode.

Các nhóm endpoint đã xác minh:

| Domain | Endpoint/pattern chính |
|---|---|
| Auth | `/auth/login`, `/auth/me`, `/auth/refresh`, `/auth/verify-2fa`, `/auth/2fa/*`, `/webauthn/*` |
| Users/access | `/users`, `/users/:id`, password, 2FA, passkeys; `/api-keys`, `/api-keys/mcp-clients` |
| Device | `/devices`, `/devices/:id`, defaults, PSU catalog, grouped, bulk, duplicate, test, refresh, import/export |
| Device state | `/devices/:id/interfaces`, `health-history`, `traffic-history`, `sfp-history`, `routes`, `routes/list`, `tunnel-caps` |
| Network features | DHCP leases, wireless clients/Wi-Fi config/password, IP services, IPsec, WireGuard, IPv6 neighbors, LTE/SMS/usage, STP, routing/BGP history, VLAN preview/apply/confirm/revert |
| Site/topology | `/sites`, `/sites/:id`, `/topology`, `/topology/refresh`, `/topology/positions/:siteId` |
| Commands/templates | `/commands/execute`, `/commands/history`, `/command-templates`, import, execute, deploy |
| Backups | `/backups`, artifact, device history, export, health, device/site/bulk schedules |
| Upgrades | `/upgrade/check`, firmware/routeros/full/reboot, operations, queue/cancel/PoE sort, schedules, presets, latest versions, release notes |
| Syslog/security | `/syslog`, `/cve/summary`, `/cve/devices/:id`, `/cve/patch-gaps`, `/ids/candidates`, block, whitelist |
| Admin/integration | `/activity`, `/config`, `/settings/opencellid*`, `/webhooks`, `/health`, `/changelog`, `/version-check` |

License endpoints của mikr được quan sát nhưng không đưa vào API đích.

## 2. API đích

API đích dùng `/api/v1`. Contract resource rõ ràng và task-based cho operation dài:

- CRUD đồng bộ trả `data`, `meta`, `requestId`.
- Operation dài trả HTTP 202: `{ data: { taskId, status: "queued" }, requestId }`.
- Validation trả 422 với danh sách `{ path, code, message }`.
- Conflict desired/applied revision trả 409 và revision hiện tại.
- Router unavailable/gateway failure được lưu vào task result; không giữ request chờ tùy ý.
- Pagination dùng cursor cho logs/tasks/metrics; filter/sort có whitelist.
- Mutation hỗ trợ `Idempotency-Key`.

Response error chuẩn:

```json
{
  "error": {
    "code": "ROUTER_UNREACHABLE",
    "message": "Không thể kết nối RouterOS qua SSH.",
    "details": {},
    "retryable": true
  },
  "requestId": "req_..."
}
```

## 3. Resource map đích

| Resource | Operation tối thiểu |
|---|---|
| `/companies`, `/networks` | CRUD, membership/summary |
| `/routers` | CRUD, test, duplicate, capability refresh, bulk, import/export |
| `/routers/:id/observations` | health/interfaces/traffic/routes/network features |
| `/routers/:id/wireguard/interfaces` | list/sync/status |
| `/wireguard/peers` | CRUD/restore/config/QR/terminal/revisions |
| `/wireguard/peers/:id/apply` | task apply/delete/restore desired state |
| `/commands`, `/command-templates` | execute/history/CRUD/deploy/import/export |
| `/tasks` | list/detail/log/cancel/retry |
| `/backups`, `/backup-schedules` | create/list/download/diff/CRUD schedule |
| `/upgrade-runs`, `/upgrade-queues`, `/upgrade-schedules`, `/upgrade-presets` | lifecycle đầy đủ |
| `/topology` | snapshot/refresh/positions |
| `/syslog` | query/stream/retention/admin clear |
| `/security/findings`, `/security/ids/*` | query/action |
| `/webhooks`, `/api-keys`, `/users`, `/settings`, `/audit-events` | administration |

OpenAPI phải được sinh từ validation schema hoặc kiểm tra đồng bộ trong CI. Secrets dùng endpoint reveal/download riêng, permission và audit riêng; response list không chứa ciphertext.

## 4. WebSocket baseline

33 loại event đã xác minh từ `ws.on(...)` trong frontend mikr:

```text
audit:event
backup:complete                 backup:progress
check:complete                  check:progress                  check:result
command:complete                command:output
cve:updated                     patch-gap:updated
device:status                   device:status:batch             interface:traffic
log:entry
queue:cancelled                 queue:complete                  queue:device-complete
queue:device-start
scan:complete                   scan:found                      scan:progress
task:changed                    task:log                        task:update
template:complete               template:deploy:complete        template:deploy:result
template:output
upgrade:complete                upgrade:log                     upgrade:operation-complete
upgrade:progress                upgrade:verified
```

Baseline client kết nối `/ws`, auth sau khi connect, subscribe các channel mặc định và reconnect theo exponential backoff 1–30 giây.

## 5. Envelope event đích

```json
{
  "id": "evt_...",
  "type": "task:update",
  "version": 1,
  "occurredAt": "2026-09-12T00:00:00.000Z",
  "companyId": "...",
  "networkId": "...",
  "routerId": "...",
  "taskId": "...",
  "sequence": 42,
  "payload": {}
}
```

Server authorize subscription theo role/network scope. Client bỏ event trùng theo `id`, phát hiện gap theo `sequence`, rồi fetch snapshot/cursor. Không gửi credential, raw private key, PSK hoặc unredacted command secret qua event.

## 6. Contract WireGuard quan trọng

- `POST peer` chỉ tạo desired state và reservation; không ngầm apply nếu UI không yêu cầu rõ.
- `POST /apply` bắt buộc revision expected để ngăn ghi đè thay đổi mới hơn.
- `POST /sync` đọc RouterOS, cập nhật observed state và drift; không sửa router.
- Sync/apply là task và serialize theo router.
- Config/QR/terminal chỉ tạo cho peer có đủ key material và audit mỗi lần reveal/download.
- Status handshake/RX/TX là observation, không làm thay đổi desired revision.
- Soft delete không xóa key/config khỏi DB cho tới khi retention/purge policy riêng được phê duyệt.

## 7. Kiểm thử contract

- Golden tests cho parser output RouterOS 6/7 và giá trị thiếu/`NaN`.
- API schema tests cho mọi status/error/pagination.
- Permission matrix tests cho bốn role và network scope.
- WS reconnect/replay/duplicate/gap tests.
- Task idempotency/cancellation/retry/lock tests.
- Contract adapters cho route frontend cũ trong thời gian migration.
