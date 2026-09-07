# WireGuard Web Manager

Ứng dụng quản trị WireGuard peer trên nhiều MikroTik RouterOS, tổ chức theo mô hình Company → Network → Router → WireGuard Interface → Peer.

## Tính năng

- Một system administrator, xác thực bằng credentials trong environment variables.
- Company, Network, Router và WireGuard Interface management.
- SSH tới MikroTik bằng hostname, Cloud DDNS hoặc IPv4.
- SSH private key/password authentication và pin host fingerprint.
- Import/sync WireGuard Interface và peer hiện có từ RouterOS.
- Tạo, sửa, disable, soft-delete, restore và áp dụng từng peer.
- Internet, Internal và Site-to-site mode.
- Sinh WireGuard client key pair và preshared key.
- Mã hóa SSH credential, client private key và preshared key bằng AES-256-GCM.
- RouterOS CLI preview/copy, WireGuard `.conf`, text và QR code.
- Last handshake, endpoint, RX/TX và polling trạng thái khi trang đang mở.
- Responsive UI, tiếng Việt và dark mode.

Đặc tả đầy đủ nằm tại [PRODUCT_SPEC.md](./PRODUCT_SPEC.md).

## Công nghệ

- Next.js 16 App Router, React 19 và TypeScript strict.
- Tailwind CSS 4.
- Neon PostgreSQL và Drizzle ORM.
- `ssh2` cho RouterOS SSH.
- `jose` + bcrypt cho admin session.

## Chạy local

Yêu cầu Node.js 22 trở lên và một PostgreSQL database.

```bash
npm install
cp .env.example .env.local
```

Tạo password hash:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'your-strong-password'
```

Tạo hai secret độc lập:

```bash
openssl rand -base64 32
openssl rand -base64 32
```

Điền `.env.local`, sau đó chạy migration và ứng dụng:

```bash
npm run db:migrate
npm run dev
```

Mở `http://localhost:3000` và đăng nhập bằng `ADMIN_USERNAME` cùng password đã dùng để tạo hash.

## Environment variables

| Biến | Bắt buộc | Mô tả |
|---|---:|---|
| `DATABASE_URL` | Có | Neon pooled PostgreSQL connection string |
| `ADMIN_USERNAME` | Có | Username system administrator |
| `ADMIN_PASSWORD_HASH` | Có | Bcrypt hash, không phải plain-text password |
| `SESSION_SECRET` | Có | Secret ký session, tối thiểu 32 ký tự |
| `DATA_ENCRYPTION_KEY` | Có | Khóa AES-256, đúng 32 byte dạng base64 |
| `SESSION_TTL_HOURS` | Không | Mặc định 8 giờ |
| `PEER_ONLINE_THRESHOLD_SECONDS` | Không | Mặc định 180 giây |

Không thay `DATA_ENCRYPTION_KEY` trực tiếp sau khi đã có dữ liệu. Thay khóa mà không có quy trình re-encryption sẽ khiến SSH credential và WireGuard client key cũ không thể giải mã.

## Chuẩn bị MikroTik

- RouterOS 7.15 trở lên.
- Router có public WAN IP và MikroTik Cloud DDNS/hostname hoạt động.
- SSH service có thể truy cập từ Vercel Function.
- Nên dùng RouterOS user riêng và SSH public-key authentication.
- Nên tắt password authentication sau khi public key đã hoạt động.
- Chỉ cấp các policy cần thiết để đọc interface/address và quản lý WireGuard peer.
- Ứng dụng không tạo firewall, NAT, route hoặc WireGuard Interface.

Ở lần kết nối đầu tiên, ứng dụng hiển thị SSH host fingerprint. Hãy đối chiếu fingerprint bằng một kênh tin cậy trước khi xác nhận. Khi hostname hoặc SSH port thay đổi, fingerprint đã pin sẽ bị xóa và phải xác nhận lại.

## Triển khai Vercel + Neon

1. Import repository vào Vercel.
2. Trong Vercel Marketplace, tạo hoặc liên kết Neon Postgres.
3. Khai báo toàn bộ environment variables cho Production và Preview nếu cần.
4. Chạy `npm run db:migrate` với production `DATABASE_URL` từ máy quản trị hoặc CI trước lần deploy đầu.
5. Deploy dự án và chọn Function region Singapore trong Vercel Project Settings để giảm latency tới router ở Việt Nam.
6. Đăng nhập, tạo Company/Network/Router, kiểm tra SSH và xác nhận fingerprint.
7. Bấm `Đồng bộ từ Router` để import interface/peer.

Vercel mặc định dùng dynamic egress IP. Nếu MikroTik firewall cần allowlist nguồn cố định, bật Vercel Static IP và chỉ cho phép IP được cấp truy cập SSH port. Nếu chưa dùng Static IP, bắt buộc ưu tiên key-only authentication, port riêng và firewall/rate limiting phù hợp.

## Quy trình vận hành

1. `Đồng bộ từ Router` chỉ đọc RouterOS và cập nhật database.
2. Tạo/sửa/disable/xóa một peer tạo thay đổi `Chờ áp dụng`.
3. Bấm `Áp dụng`, kiểm tra CLI đã che secret rồi xác nhận.
4. Backend chạy command thật qua SSH, đọc lại RouterOS để xác minh và cập nhật trạng thái.
5. Mỗi peer có kết quả độc lập; lỗi được giữ để retry.
6. Peer bị xóa chỉ soft-delete trong database và có thể khôi phục.

Peer import từ RouterOS không có client private key. Muốn xuất lại `.conf`/QR, mở màn hình sửa peer và nhập đúng private key; ứng dụng sẽ suy ra public key để xác minh trước khi lưu.

## Kiểm tra chất lượng

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Các migration được version-control trong thư mục `drizzle/`.

## Lưu ý bảo mật

- Không log SSH credential, WireGuard private key hoặc preshared key.
- Response chứa client config dùng `Cache-Control: no-store`.
- CLI preview che preshared key mặc định; thao tác copy CLI thật có cảnh báo.
- Không expose database hoặc secret cho Client Components.
- Không dùng cùng một giá trị cho `SESSION_SECRET` và `DATA_ENCRYPTION_KEY`.
- Sao lưu Neon và giữ an toàn `DATA_ENCRYPTION_KEY`; thiếu khóa này thì backup secret không thể phục hồi.
