# 11 — Backup Neon và chuyển dữ liệu sang VPS

## 1. Nguồn dữ liệu hiện tại

- Provider: Neon PostgreSQL, kết nối từ Vercel qua `DATABASE_URL`.
- Region hostname quan sát: `ap-southeast-1`.
- Database: `neondb`.
- PostgreSQL server lúc backup: 18.6.
- Thời điểm kiểm kê: 2026-09-12 09:49 UTC.
- Kích thước database: 9.134.080 bytes.
- Schema ứng dụng `public`: 11 bảng.

Không ghi hostname đầy đủ, username hay credential production vào Git. `DATABASE_URL` tiếp tục nằm trong `.env.local` bị ignore.

## 2. Các archive đã tạo

Hai file nằm trong `backups/`, đã được thêm vào `.gitignore` và đặt permission `0600`:

| File | Nội dung | Kích thước | SHA-256 |
|---|---|---:|---|
| `vercel-production-20260912T095000Z.dump` | Full database, gồm schema Neon-managed để lưu forensic | 52.726 bytes | `53f80371428398b847fbb57133f332972ffac9653f6f731ad2d4046ba4a1c88c` |
| `wireguard-app-20260912T095000Z.dump` | Chỉ `public` + `drizzle`, dùng để restore trên VPS | 35.686 bytes | `894248d9e2369a9ff4674fffcdf5420c8a9e1b70b8ddd74922c1b410bcc0f1b8` |

Archive được tạo bằng `pg_dump` 18.6, custom format, gzip level 9, `--no-owner --no-acl`. Dùng file `wireguard-app-*` cho migration; file full giữ làm bản sao nguồn, vì schema `neon_auth` có ownership/extension đặc thù Neon và ứng dụng hiện tại không phụ thuộc nó.

## 3. Kiểm chứng restore đã thực hiện

File app archive đã được restore bằng `pg_restore --no-owner --no-acl --exit-on-error` vào container PostgreSQL 18 sạch. Kết quả:

```text
public tables=11
companies=2
networks=2
routers=2
wireguard_interfaces=2
peers=24
```

Container kiểm thử đã được xóa sau khi xác minh. Kiểm tra này chứng minh archive đọc/restore được; trước cutover vẫn phải kiểm đếm toàn bộ bảng và chạy application smoke test trên VPS.

## 4. Chuyển archive lên VPS

Sau khi có VPS và user deploy:

```bash
scp backups/wireguard-app-20260912T095000Z.dump deploy@VPS_HOST:/srv/wireguard-manager/backups/
scp backups/wireguard-app-20260912T095000Z.dump.sha256 deploy@VPS_HOST:/srv/wireguard-manager/backups/
```

Tạo file checksum trước khi chuyển:

```bash
cd backups
sha256sum wireguard-app-20260912T095000Z.dump > wireguard-app-20260912T095000Z.dump.sha256
```

Trên VPS:

```bash
cd /srv/wireguard-manager/backups
sha256sum --check wireguard-app-20260912T095000Z.dump.sha256
chmod 600 wireguard-app-20260912T095000Z.dump
```

Không gửi archive qua chat/email và không đặt nó trong Git repository trên remote.

## 5. Restore vào PostgreSQL VPS

Ví dụ database đích mới và rỗng, chạy bằng PostgreSQL client 18:

```bash
createdb --host=127.0.0.1 --username=postgres wireguard_manager
psql --host=127.0.0.1 --username=postgres --dbname=wireguard_manager \
  --command='DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE;'
pg_restore --host=127.0.0.1 --username=postgres --dbname=wireguard_manager \
  --no-owner --no-acl --exit-on-error \
  /srv/wireguard-manager/backups/wireguard-app-20260912T095000Z.dump
```

Việc drop schema chỉ được làm trên database đích mới đã xác minh đúng tên. Không chạy block này lên Neon production hoặc database VPS đang có dữ liệu.

Sau restore, chuyển ownership cho application role nếu cần và đặt `DATABASE_URL` VPS. Không chạy migration mới cho tới khi xác nhận revision trong `drizzle.__drizzle_migrations` và code version tương ứng.

## 6. Kiểm tra sau restore

```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT count(*) FROM companies;
SELECT count(*) FROM networks;
SELECT count(*) FROM routers;
SELECT count(*) FROM wireguard_interfaces;
SELECT count(*) FROM peers;
```

Sau đó chạy smoke test read-only: login, companies, networks, routers, interfaces, peers, config generation. Chỉ test SSH sync/apply sau khi firewall/VPS egress và bản backup thứ hai ngay trước cutover đã sẵn sàng.

## 7. Cutover cuối cùng

Bản archive hiện tại là baseline phát triển, chưa phải final cutover vì Vercel production vẫn có thể phát sinh dữ liệu. Khi chuyển chính thức:

1. Đưa app Vercel vào maintenance/read-only.
2. Tạo archive mới với timestamp mới bằng đúng quy trình trên.
3. Xác minh checksum và restore thử.
4. Copy/restore lên VPS.
5. So sánh row counts và smoke test.
6. Chuyển Cloudflare hostname/tunnel tới VPS.
7. Giữ Neon read-only trong rollback window, không xóa ngay.

Nếu Vercel vẫn nhận write trong lúc dump/cutover, hai database sẽ phân kỳ; không cố merge thủ công peer/key records nếu chưa có kế hoạch conflict resolution.
