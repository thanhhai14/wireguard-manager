# 10 — Bản đồ code WireGuard Web hiện tại

## 1. Baseline xác minh

Ứng dụng hiện tại là Next.js App Router/React/TypeScript, PostgreSQL qua Drizzle, SSH2, Zod, JOSE/bcrypt và QR. `package.json` vẫn dùng `latest` cho hầu hết dependency; phải pin lockfile/version trước mở rộng.

Các route chính:

- `app/page.tsx`: dashboard hiện tại.
- `app/companies`, `app/networks`, `app/routers`: cây quản lý.
- `app/interfaces/[interfaceId]`: WireGuard interface/peer list.
- `app/peers/[peerId]`: peer detail/config/terminal.
- `app/login`: đăng nhập.
- `app/loading.tsx`, `app/error.tsx`: trạng thái route toàn cục.

Domain/runtime:

- `lib/db/schema.ts`: 10 bảng chính + enums, 175 dòng.
- `app/actions.ts`: Server Actions CRUD/router operation, 266 dòng; đây là điểm cần tách sớm khi scope tăng.
- `lib/routeros`: SSH, parser, commands, service và peer service.
- `lib/wireguard`: key/config/install command/browser PowerShell.
- `lib/auth/session.ts`, `lib/security.ts`: auth và encryption.
- `components/app-shell.tsx`, `submit-button.tsx`, `router-controls.tsx`, `peer-actions.tsx`: shell/action/loading hiện tại.

Test hiện có tập trung vào RouterOS command/parser, IP validation và terminal/PowerShell generator. Chưa có test đủ cho DB migration, permission, durable task, API/realtime, monitoring và toàn flow UI.

## 2. Dữ liệu hiện tại cần bảo toàn

Schema xác minh gồm:

- `companies`, `networks`, `routers`.
- `wireguard_interfaces`, `interface_addresses`, `internal_subnets`.
- `peers`, `peer_internal_subnets`, `peer_remote_subnets`.
- `router_operation_locks`, `auth_rate_limits`.

Các enum quan trọng: SSH private-key/password; router unknown/online/offline/error; peer internet/internal/site-to-site; origin application/router-import; desired create/update/delete/restore/none; sync pending/synced/apply-failed/drifted/missing/reappeared/deleted.

`peers` đã có applied public key, encrypted private/PSK, RouterOS ID/revision, desired action, sync status, handshake, endpoint và RX/TX. Migration không được làm mất những semantics này.

## 3. Khoảng cách kiến trúc

| Hiện tại | Đích | Cách chuyển |
|---|---|---|
| Server actions gọi operation trong request | API + durable task + worker | Bọc service hiện tại bằng job handler trước, rồi chuyển UI |
| Lock record có `expiresAt` | Advisory lock/lease heartbeat theo router | Dual-write tạm, quan sát, sau đó bỏ lock cũ |
| Một admin từ env | Users/RBAC/sessions/MFA | Env chỉ bootstrap superadmin |
| SSH là provider chính | SSH + REST + SNMP capability adapters | Giữ SSH adapter và đặt sau interface |
| Trang theo entity WireGuard | Fleet shell + router detail + cross-router WG pages | Giữ route/redirect trong transition |
| Router status chủ yếu từ thao tác | Worker monitoring/snapshots/history | Backfill snapshot không thay desired state |
| Không task/audit/outbox | Task platform + event history | Xây trước commands/upgrades/backups |
| Không WS process lâu dài | WS gateway/outbox dispatcher | Chỉ bật trên VPS runtime |
| Neon serverless client | PostgreSQL driver/pool cho process dài | Adapter DB theo runtime; tránh serverless-only assumption |
| Dependencies `latest` | Phiên bản pin + update policy | Commit lockfile, renovate/dependabot có test |

## 4. Điểm cắt refactor đầu tiên

1. Tách `app/actions.ts` thành application services theo company/network/router/wireguard.
2. Định nghĩa `RouterClient` interface; bọc `lib/routeros/ssh.ts` và service hiện tại.
3. Đưa encryption/credential access sau `SecretStore` interface.
4. Tạo `TaskService` và chuyển router test, WG sync/apply trước.
5. Thêm repositories thay vì query Drizzle rải trong UI/action.
6. Tạo permission policy server-side trước khi thêm role/UI menu.
7. Chuyển app shell/navigation mà không thay các flow WireGuard đã test.

## 5. Quy tắc chống regression WireGuard

- Mỗi bước refactor chạy lại test parser/command/IP/PowerShell/install command.
- Thêm integration tests cho imported peer với keepalive trống/invalid để ngăn lỗi `NaN` vào PostgreSQL.
- Fixture phải có nhiều router/interface, DDNS hostname, nhiều internal subnet, `/30` site-to-site và soft-deleted peer.
- Snapshot output `.conf`, QR payload và Linux/macOS/Windows commands trước thay UI.
- Không đổi encryption format nếu chưa có migration decrypt/re-encrypt và recovery test.
- Không tự động apply sau sync, create hoặc edit.

## 6. Những phần không nên mang nguyên từ mikr

- Bytecode/closed backend implementation, logo/SVG/branding và license activation.
- Lưu refresh token lâu dài trong `localStorage` nếu có thể dùng secure session rotation.
- SQLite single-process assumptions.
- Vanilla-JS global state/polling rải trong view.
- API URL compatibility không cần thiết nếu UI mới và adapter contract đã test.

Những điểm này không làm giảm functional parity; chúng loại bỏ ràng buộc kỹ thuật/thương mại không phù hợp sản phẩm đích.
