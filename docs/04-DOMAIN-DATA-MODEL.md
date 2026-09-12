# 04 — Domain và mô hình dữ liệu đích

## 1. Cây sở hữu

```text
Company
└── Network (tương đương Site/địa điểm)
    ├── Network membership / policy
    └── Router (Device)
        ├── Connection profiles
        ├── Interfaces / addresses / observations
        ├── WireGuard interfaces
        │   └── Peers / subnet selections / revisions
        ├── Backups / metrics / logs / findings
        └── Tasks / commands / upgrades
```

Không đổi Network thành Site trong DB chỉ để giống mikr. UI có thể dùng nhãn “Network/Site”; `company_id` vẫn là ranh giới dữ liệu cấp cao. Network tiếp tục là địa điểm có nhiều router.

## 2. Identity và access

| Entity | Trường chính |
|---|---|
| `users` | username, password_hash, display_name, role, status, last_login_at |
| `user_network_access` | user_id, network_id, permission override |
| `sessions` | hashed refresh/session token, expiry, revoked_at, client metadata |
| `mfa_totp` | encrypted secret, enabled_at, recovery code hashes |
| `webauthn_credentials` | credential_id, public_key, counter, transports, label |
| `api_keys` | prefix, secret_hash, role/scopes, network scope, last_used_at, revoked_at |

Role mặc định: superadmin, admin, operator, viewer. Permission được định nghĩa theo action (`device.write`, `command.execute`, `wireguard.apply`, `upgrade.run`, …), không hard-code phân nhánh role trong component.

## 3. Organization và device

| Entity | Trường chính |
|---|---|
| `companies` | giữ schema hiện tại, thêm status/metadata khi cần |
| `networks` | company_id, name, location, contact, notes, timezone |
| `routers` | network_id, name, host/DDNS, enabled, preferred method, RouterOS facts |
| `router_connection_profiles` | router_id, method SSH/REST/SNMP, port, username, encrypted credential, TLS/host-key policy, priority |
| `tags`, `router_tags` | label/color và quan hệ nhiều-nhiều |
| `router_capabilities` | capability key, supported, observed_at, source/version |
| `router_snapshots` | normalized facts/status, observed_at, source |

Credentials không được copy vào task payload. Task chỉ tham chiếu connection profile; worker giải mã ngay trước khi dùng.

## 4. Inventory, monitoring và retention

| Entity | Mục đích |
|---|---|
| `router_interfaces` | identity ổn định, type, MAC, running/disabled, PoE/SFP metadata |
| `interface_observations` | RX/TX/rate/error/optical theo thời gian |
| `health_observations` | CPU, RAM, temp, voltage, fan, uptime |
| `routing_observations` | BGP/OSPF peer/status aggregate/history |
| `neighbor_observations` | LLDP/MNDP/CDP relation phục vụ topology |
| `topology_positions` | network_id + node key + x/y |
| `device_findings` | CVE/patch-gap/IDS finding, severity/status/evidence |

Raw high-volume data phải có retention policy. Khuyến nghị: live samples chi tiết 7–30 ngày, rollup 5 phút 90 ngày, rollup giờ 1 năm; giá trị thực tế cấu hình trong Settings.

## 5. WireGuard: giữ semantics hiện tại

Các bảng hiện tại `wireguard_interfaces`, `interface_addresses`, `internal_subnets`, `peers`, `peer_internal_subnets`, `peer_remote_subnets` được giữ và migrate không mất dữ liệu.

Bổ sung:

- `peer_revisions`: desired/applied snapshot, actor, task và diff.
- `wireguard_observations`: handshake, endpoint, RX/TX, observed_at.
- `allocation_reservations`: chống hai request chọn cùng IP.
- `secret_key_version` trên ciphertext để rotate master key.

Quy tắc nguồn dữ liệu:

- RouterOS là nguồn sự thật cho **observed state**.
- DB là nguồn sự thật cho metadata quản trị và **desired state**.
- Sync từ router chỉ cập nhật observed snapshot/status; không tự apply DB xuống router.
- UI edit cập nhật desired state thành `pending_apply`; worker chỉ ghi router khi admin bấm Apply.
- Delete là soft delete + desired delete; apply xóa khỏi router nhưng record vẫn restore được.
- Revision/hash quyết định `synced`, `drifted`, `missing_on_router`, `reappeared`, không suy ra chỉ từ timestamp.

## 6. Task, command và event

| Entity | Trường chính |
|---|---|
| `tasks` | type, status, priority, progress, creator, scope, idempotency_key, attempts, timestamps |
| `task_steps` | ordered step, status, attempt, start/end, safe result summary |
| `task_logs` | level, message, structured metadata, sequence |
| `router_leases` | router_id, task_id, owner, heartbeat/expires; hoặc advisory lock runtime |
| `commands` | command text/redacted form, device, actor, task, exit/result summary |
| `command_templates` | name, content, variables/schema, tags, version |
| `outbox_events` | type, aggregate, payload, sequence, published_at |
| `audit_events` | actor, action, target, before/after redacted, source IP/client, result |

Task status chuẩn: `queued`, `running`, `waiting_reboot`, `succeeded`, `partially_succeeded`, `failed`, `cancel_requested`, `cancelled`. Không dùng trạng thái UI tự phát ngoài enum này.

## 7. Backup và upgrade

| Entity | Mục đích |
|---|---|
| `backups` | device, type, artifact reference, checksum, size, RouterOS version, result |
| `backup_schedules` | scope device/network, recurrence, retention, enabled |
| `backup_diffs` | left/right checksum, normalized diff cache |
| `upgrade_presets` | channel/version/firmware strategy/pre-check policy |
| `upgrade_schedules` | scope, maintenance window, preset, enabled |
| `upgrade_runs` | task, old/new version, phase, verification, rollback notes |
| `upgrade_queue_items` | queue, device, order/dependency/PoE relation, status |

Artifact backup nên lưu filesystem volume hoặc S3-compatible object storage; DB chỉ giữ metadata/checksum, không nhồi file lớn vào PostgreSQL.

## 8. Syslog và integrations

| Entity | Mục đích |
|---|---|
| `syslog_messages` | received_at, source/device, facility, severity, topic, message, structured fields |
| `webhooks` | URL, encrypted signing secret, subscribed events, enabled |
| `webhook_deliveries` | event, attempt, status/code, next_retry_at, response summary |
| `settings` | typed key/value, scope global/company/network, source and updated_by |
| `secret_values` | encrypted secret reference, key version; tách khỏi setting thường |

Syslog dùng partition theo thời gian và retention job. Webhook phát từ outbox, ký HMAC, retry có giới hạn và chống SSRF bằng URL policy.

## 9. Migration dữ liệu hiện tại

1. Snapshot và checksum database trước migration.
2. Tạo identity/RBAC và bootstrap user từ env, không xóa cơ chế cũ ngay.
3. Giữ nguyên primary key Company/Network/Router/WireGuard để không đứt liên kết.
4. Tách credential router thành connection profile bằng migration idempotent.
5. Backfill desired/applied revision từ các cột peer hiện có.
6. Chuyển router operation lock cũ sang task/lease; chỉ drop bảng cũ sau một release ổn định.
7. Mỗi migration có forward check, rollback hoặc restore procedure và kiểm đếm records.
