# Đặc tả sản phẩm WireGuard Web Manager

**Trạng thái:** Bản nháp để duyệt trước khi triển khai  
**Mục tiêu:** Xây dựng một công cụ quản trị WireGuard trên MikroTik RouterOS dành cho một system administrator, triển khai ứng dụng trên Vercel.

## 1. Mục tiêu sản phẩm

Ứng dụng cung cấp giao diện web tập trung để quản lý nhiều công ty, địa điểm, MikroTik router, WireGuard interface và peer. System administrator có thể đọc cấu hình thực tế từ RouterOS qua SSH, tạo hoặc chỉnh sửa peer, xem trước RouterOS CLI, áp dụng thay đổi lên router, và xuất cấu hình client dưới dạng text, file `.conf` hoặc QR code.

Sản phẩm phải đủ ổn định và an toàn để sử dụng trong môi trường production nội bộ của system administrator.

## 2. Phạm vi phiên bản đầu tiên

### Trong phạm vi

- Một system administrator duy nhất.
- Đăng nhập bằng username và password cấu hình qua environment variables.
- Quản lý Company, Network, Router, WireGuard Interface và Peer.
- Kết nối MikroTik bằng SSH qua IPv4 hostname/DDNS hoặc địa chỉ IP.
- Hỗ trợ SSH private key và SSH password; ưu tiên private key.
- Kiểm tra kết nối và xác nhận SSH host fingerprint khi thêm router.
- Đồng bộ thủ công cấu hình WireGuard từ MikroTik vào database.
- Tạo, sửa, khóa, mở khóa, soft-delete và khôi phục peer.
- Xem trước và sao chép RouterOS CLI.
- Áp dụng từng thay đổi qua SSH và trả kết quả riêng cho từng peer.
- Sinh WireGuard client key pair và preshared key.
- Nhập private key có sẵn, suy ra public key và kiểm tra tính khớp.
- Xuất cấu hình client dạng text, `.conf` và QR code.
- Theo dõi last handshake, current endpoint, RX/TX và trạng thái router khi trang đang mở.
- Giao diện tiếng Việt, giữ nguyên thuật ngữ kỹ thuật tiếng Anh.
- Responsive cho desktop/mobile và hỗ trợ light/dark mode.
- Chuẩn bị điểm mở rộng cho notification nhưng chưa gửi email, Telegram, Slack hoặc webhook.

### Ngoài phạm vi

- Multi-user, role hoặc phân quyền theo công ty.
- Tạo WireGuard interface, firewall, NAT hoặc route trên MikroTik.
- Cài đặt RouterOS/WireGuard lên thiết bị mới.
- IPv6.
- Tự động đồng bộ cấu hình định kỳ khi không có người mở ứng dụng.
- Audit log cấp người dùng.
- Giới hạn bandwidth hoặc quota traffic.
- Xóa vĩnh viễn peer khỏi database.
- Chạy Vercel như một WireGuard peer hoặc duy trì VPN tunnel từ Vercel.

## 3. Khái niệm và quan hệ dữ liệu

```text
Company
└── Network (địa điểm của công ty)
    └── Router (MikroTik)
        └── WireGuard Interface
            └── Peer
```

- Một Company có nhiều Network.
- Một Network thuộc đúng một Company và có nhiều Router.
- Một Router thuộc đúng một Network và có nhiều WireGuard Interface.
- Một WireGuard Interface thuộc đúng một Router và có nhiều Peer.
- Một Peer thuộc đúng một WireGuard Interface; không triển khai cùng một peer lên nhiều router/interface.

## 4. Thuật ngữ khóa WireGuard

Mỗi đầu WireGuard có một cặp private/public key riêng:

### Khóa của WireGuard server trên MikroTik

- RouterOS giữ private key của WireGuard interface.
- `WG_SERVER_PUBLIC_KEY` là public key của interface đó.
- Ứng dụng chỉ cần đọc và lưu `WG_SERVER_PUBLIC_KEY`; không đọc hoặc lưu server private key.
- Client dùng `WG_SERVER_PUBLIC_KEY` trong phần `[Peer]` của file `.conf` để xác thực router.

### Khóa của client peer

- Ứng dụng sinh `CLIENT_PRIVATE_KEY` và suy ra `CLIENT_PUBLIC_KEY`.
- `CLIENT_PUBLIC_KEY` được cấu hình trên MikroTik peer.
- `CLIENT_PRIVATE_KEY` chỉ nằm trong phần `[Interface]` của cấu hình client và được lưu mã hóa trong database để có thể tải lại.
- Private key không bao giờ được gửi hoặc cài lên MikroTik.

### Preshared key

- Mặc định ứng dụng sinh thêm một preshared key cho mỗi peer.
- Cùng một preshared key được cấu hình trên MikroTik và trong phần `[Peer]` của client.
- Preshared key được lưu mã hóa trong database.

Ví dụ cấu hình client:

```ini
[Interface]
PrivateKey = CLIENT_PRIVATE_KEY
Address = 10.20.0.2/32
DNS = 192.168.10.1

[Peer]
PublicKey = WG_SERVER_PUBLIC_KEY
PresharedKey = PRESHARED_KEY
Endpoint = example.sn.mynetname.net:13231
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
```

## 5. Dữ liệu nghiệp vụ

### Company

- Name: bắt buộc.
- Code: tùy chọn.
- Address: tùy chọn.
- Description: tùy chọn.
- Created at, updated at.

### Network

Network biểu diễn một địa điểm, ví dụ `Văn phòng A` hoặc `Văn phòng Q12`.

- Company: bắt buộc.
- Name: bắt buộc.
- Address: tùy chọn.
- Description: tùy chọn.
- Created at, updated at.

### Router

- Network: bắt buộc.
- Name: bắt buộc.
- Host: IPv4, hostname hoặc MikroTik Cloud DDNS; bắt buộc.
- SSH port: bắt buộc, mặc định 22.
- SSH username: bắt buộc.
- SSH authentication type: `private_key` hoặc `password`.
- SSH credential: mã hóa trước khi lưu.
- SSH host key fingerprint: lưu sau khi admin xác nhận.
- RouterOS version gần nhất.
- Connection status.
- Số lần kết nối thất bại liên tiếp.
- Last successful connection.
- Last configuration sync.
- Description: tùy chọn.

Hostname được truyền trực tiếp cho SSH client và được phân giải DNS tại mỗi lần kết nối. Không lưu cứng IP được phân giải, nhờ đó MikroTik Cloud DDNS tiếp tục hoạt động khi WAN IP thay đổi.

### WireGuard Interface

Cấu hình gốc của interface được đọc từ RouterOS. Ứng dụng không tạo hoặc xóa interface trong phiên bản đầu tiên.

- Router.
- RouterOS internal ID.
- Interface name.
- Listen port.
- Public key (`WG_SERVER_PUBLIC_KEY`).
- MTU.
- Running/disabled status.
- Danh sách IPv4 address đọc từ `/ip/address`.
- Subnet được admin chọn để cấp IP peer.
- Allocation start và allocation end tùy chọn.
- Client endpoint host; mặc định lấy Router host/DDNS.
- Client endpoint port; mặc định lấy interface listen port.
- Client DNS, tùy chọn.
- Danh sách internal subnet.
- Last synced at.

Nếu interface có nhiều IPv4 address, admin phải chọn đúng một subnet làm peer allocation subnet.

### Internal subnet

- Thuộc một WireGuard Interface.
- Nhập nhiều giá trị bằng tag hoặc dán chuỗi phân cách bằng dấu phẩy.
- Phải là IPv4 CIDR hợp lệ.
- Phải thuộc private IPv4: `10.0.0.0/8`, `172.16.0.0/12` hoặc `192.168.0.0/16`.
- Không được trùng hoặc chồng lấn với subnet khác trong cùng interface.
- Cảnh báo hoặc từ chối nếu xung đột với WireGuard allocation subnet.

### Peer

- WireGuard Interface.
- Name: tên hiển thị, không yêu cầu duy nhất.
- Comment: bắt buộc, không yêu cầu duy nhất.
- Mode: `internet`, `internal` hoặc `site_to_site`.
- Client public key.
- Client private key đã mã hóa, có thể thiếu đối với peer import.
- Preshared key đã mã hóa, nếu có.
- Assigned tunnel IPv4/CIDR.
- Các internal subnet được chọn khi mode là `internal`.
- Các remote LAN subnet khi mode là `site_to_site`.
- Remote endpoint host/port tùy chọn cho site-to-site.
- Persistent keepalive; mặc định 25 giây.
- Enabled/disabled.
- Origin: `application` hoặc `router_import`.
- RouterOS internal ID, nếu đã tồn tại trên router.
- Trạng thái đồng bộ.
- Revision/hash của cấu hình router gần nhất.
- Last handshake.
- Current endpoint.
- RX/TX bytes.
- Last status refresh.
- Deleted at cho soft-delete.
- Created at, updated at.

## 6. Quy tắc cấp IP peer

Khi tạo peer, ứng dụng đề xuất IPv4 còn trống đầu tiên trong allocation range. Admin được phép sửa trước khi lưu.

Ứng dụng phải kiểm tra:

- Địa chỉ đúng định dạng IPv4/CIDR.
- Địa chỉ thuộc allocation subnet/range.
- Prefix của client là `/32`.
- Không dùng network address, broadcast address hoặc địa chỉ của router.
- Không trùng peer đang hoạt động hoặc đang chờ áp dụng trong database.
- Không trùng `allowed-address` thực tế trên router; kiểm tra lại ngay trước khi chạy lệnh tạo/khôi phục.

## 7. Các chế độ peer

### Internet

- Client `AllowedIPs = 0.0.0.0/0`.
- Không cần chọn internal subnet vì default route đã bao gồm tất cả IPv4.
- Ứng dụng không tự tạo NAT/firewall; router phải được admin chuẩn bị trước.

### Internal

- Admin chọn một hoặc nhiều internal subnet đã khai báo trên WireGuard Interface.
- Client `AllowedIPs` gồm địa chỉ WireGuard server cần truy cập và các internal subnet đã chọn.
- MikroTik peer `allowed-address` chứa assigned tunnel IP `/32`.

### Site-to-site

- Peer có assigned tunnel IP `/32`.
- Admin khai báo một hoặc nhiều remote LAN subnet.
- MikroTik peer `allowed-address` gồm assigned tunnel IP và remote LAN subnet.
- Cấu hình đầu remote nhận các internal subnet của phía router trong client `AllowedIPs`.
- Remote endpoint host/port là tùy chọn.
- Ứng dụng không tự tạo route, NAT hoặc firewall ngoài WireGuard peer.

## 8. Router onboarding

1. Admin chọn Network và nhập thông tin Router/SSH.
2. Admin bấm `Kiểm tra kết nối`.
3. Backend phân giải hostname, mở SSH session và kiểm tra RouterOS.
4. Ở lần đầu, giao diện hiển thị SSH host key fingerprint để admin xác nhận và pin fingerprint.
5. Ứng dụng đọc RouterOS version; yêu cầu tối thiểu RouterOS 7.15.
6. Ứng dụng liệt kê các WireGuard Interface và IPv4 address tìm thấy.
7. Admin chọn các interface cần quản lý.
8. Admin chọn allocation subnet/range, client endpoint, DNS và khai báo internal subnet.
9. Admin xác nhận import peer hiện có.
10. Ứng dụng lưu dữ liệu và thời điểm sync gần nhất.

Nếu host key thay đổi sau khi đã pin, ứng dụng phải chặn kết nối ghi và cảnh báo admin xác minh lại để giảm nguy cơ man-in-the-middle.

## 9. Đồng bộ và nguồn dữ liệu

MikroTik là nguồn dữ liệu chính cho cấu hình đã áp dụng. Database là nguồn cho metadata, secret của client, bản ghi soft-delete và thay đổi đang chờ áp dụng.

### Đồng bộ từ Router

Chỉ chạy khi admin bấm `Đồng bộ từ Router`:

- Đọc WireGuard Interface, địa chỉ liên quan và peer từ RouterOS.
- Peer mới trên router được import với origin `router_import`.
- Peer import không có client private key được đánh dấu `Thiếu private key` và chưa thể xuất `.conf`/QR hoàn chỉnh.
- Peer biến mất khỏi router được đánh dấu `Không còn trên Router`; không xóa database.
- Peer đã soft-delete nhưng lại xuất hiện trên router được đánh dấu `Xuất hiện lại trên Router`; không tự khôi phục.
- Dữ liệu khác với snapshot gần nhất được đánh dấu `Khác biệt với Router`.
- Không ghi cấu hình xuống router trong thao tác này.

Peer được đối chiếu theo Router, WireGuard Interface, RouterOS internal ID và public key. Comment không được dùng làm khóa vì không duy nhất.

### Áp dụng lên Router

- Chỉ áp dụng các peer đang `Chờ áp dụng`, `Lỗi áp dụng` hoặc đang khôi phục.
- Luôn đọc lại peer liên quan trước khi ghi để kiểm tra xung đột.
- Hiển thị command RouterOS dự kiến và yêu cầu admin xác nhận.
- Chạy từng peer độc lập; một peer thất bại không rollback các peer đã thành công.
- Sau mỗi command thành công, đọc lại đối tượng để xác minh rồi mới đánh dấu `Đã đồng bộ`.
- Nếu SSH hoặc xác minh thất bại, giữ thay đổi trong database và đánh dấu `Lỗi áp dụng` để thử lại.
- Không cho hai thao tác ghi chạy đồng thời trên cùng một router.

### Operational status refresh

- Khi trang Router/Interface/Peer đang mở, frontend refresh trạng thái khoảng 15 giây một lần.
- Chỉ đọc last handshake, current endpoint, RX/TX và tình trạng kết nối; không import hay sửa cấu hình.
- Router được coi là offline sau hai lần kết nối thất bại liên tiếp hoặc không có kết nối thành công trong 60 giây trong lúc đang theo dõi.
- Peer có handshake gần đây được hiển thị `Online`; mặc định ngưỡng 180 giây. Last handshake chính xác luôn được hiển thị vì khái niệm online của WireGuard chỉ là suy luận.
- Dừng polling khi tab/page không còn hiển thị để tránh tạo SSH connection không cần thiết.

## 10. Vòng đời peer

```text
Nháp/Chờ áp dụng
    ├── áp dụng thành công → Đã đồng bộ
    └── áp dụng thất bại → Lỗi áp dụng

Đã đồng bộ
    ├── sửa/khóa/mở khóa → Chờ áp dụng
    ├── khác Router → Khác biệt với Router
    └── xóa thành công trên Router → Đã xóa

Đã xóa
    └── khôi phục → Chờ áp dụng
```

- Xóa là soft-delete trong database và remove peer khỏi RouterOS.
- Không cung cấp chức năng xóa vĩnh viễn.
- Tab `Đã xóa` cho phép khôi phục.
- Trước khi khôi phục phải kiểm tra lại public key, assigned IP và remote subnet.
- Nếu tài nguyên đã bị dùng, admin phải chỉnh cấu hình trước khi áp dụng lại.

## 11. RouterOS CLI

Ứng dụng có typed command builder; không ghép trực tiếp raw user input vào shell command. Mọi string phải được validate và escape theo cú pháp RouterOS để ngăn command injection.

Ví dụ tạo peer:

```routeros
/interface/wireguard/peers/add interface="wireguard1" public-key="CLIENT_PUBLIC_KEY" preshared-key="PRESHARED_KEY" allowed-address=10.20.0.2/32 persistent-keepalive=25s disabled=no comment="Laptop Admin"
```

Ví dụ site-to-site:

```routeros
/interface/wireguard/peers/add interface="wireguard1" public-key="CLIENT_PUBLIC_KEY" preshared-key="PRESHARED_KEY" allowed-address=10.20.0.2/32,192.168.50.0/24 persistent-keepalive=25s disabled=no comment="Chi nhanh 01"
```

CLI preview phải che các secret theo mặc định. Admin có thể bấm hiển thị secret sau một thao tác xác nhận.

## 12. Màn hình sản phẩm

### Login

- Username, password.
- Thông báo lỗi chung, không tiết lộ username hay password sai.
- Rate limit đăng nhập.
- Session mặc định 8 giờ.

### Dashboard

- Tổng Company, Network, Router và Peer.
- Router online/offline/error.
- Peer enabled/disabled, online/recently active/offline.
- Peer chờ áp dụng, lỗi áp dụng và khác biệt cấu hình.
- Handshake gần nhất.
- Tổng RX/TX theo Router/Network trong snapshot hiện tại.
- Danh sách router cần chú ý và các thao tác gần đây của phiên làm việc.

### Company và Network

- Danh sách dạng card/table tùy kích thước màn hình.
- Tạo, sửa Company/Network.
- Network detail hiển thị Router và tổng trạng thái.

### Router detail

- Thông tin kết nối và trạng thái.
- Nút kiểm tra kết nối.
- Nút đồng bộ từ Router.
- Danh sách WireGuard Interface.
- Last sync, last successful connection và lỗi gần nhất.

### WireGuard Interface detail

- Thông số interface, allocation subnet/range, endpoint, DNS và internal subnet.
- Danh sách peer, tìm kiếm và lọc trạng thái/mode.
- Nút thêm peer và áp dụng các thay đổi đang chờ.
- Tab `Đã xóa`.

### Peer form/detail

- Name, comment, mode, IP, key, preshared key, keepalive và mode-specific routes.
- Nút sinh key pair/preshared key.
- Nút nhập private key và xác minh public key.
- CLI preview và diff trước khi áp dụng.
- Text config, tải `.conf`, QR và copy clipboard.
- Operational status và thời điểm dữ liệu được cập nhật.

## 13. Authentication và bảo mật

Environment variables dự kiến:

```text
ADMIN_USERNAME
ADMIN_PASSWORD_HASH
SESSION_SECRET
DATA_ENCRYPTION_KEY
DATABASE_URL
```

- Không lưu plain-text admin password trong `.env`; chỉ lưu password hash mạnh.
- Session đặt trong cookie `HttpOnly`, `Secure`, `SameSite=Strict`, hết hạn sau 8 giờ.
- Kiểm tra Origin/CSRF cho thao tác ghi.
- Rate limit đăng nhập theo IP và username hash.
- SSH credential, client private key và preshared key mã hóa bằng authenticated encryption trước khi ghi database.
- `DATA_ENCRYPTION_KEY` chỉ nằm trong Vercel Environment Variables.
- Không đưa secret vào client payload, log, error tracking hoặc CLI preview mặc định.
- Không cache response chứa key hoặc file cấu hình.
- Endpoint trả secret yêu cầu session hợp lệ và header `Cache-Control: no-store`.
- Pin SSH host fingerprint sau lần xác nhận đầu tiên.
- Khuyến nghị RouterOS user riêng, SSH key authentication, port không mặc định và quyền tối thiểu cần thiết.
- Vì Vercel egress IP mặc định có thể thay đổi, firewall allowlist theo nguồn cần Vercel Static IP add-on; nếu không, router vẫn phải dùng key-only authentication và firewall/rate limit phù hợp.

## 14. Kiến trúc kỹ thuật

- Next.js phiên bản ổn định mới nhất tại thời điểm bắt đầu code.
- App Router và TypeScript strict mode.
- Node.js runtime cho tất cả Route Handler có SSH hoặc crypto.
- Tailwind CSS và shadcn/ui.
- Neon PostgreSQL provision qua Vercel Marketplace.
- Drizzle ORM và migration được version-control.
- SSH client Node.js với timeout ngắn, host-key verification và bảo đảm đóng connection trong `finally`.
- Server Components cho trang đọc dữ liệu; Client Components chỉ cho tương tác/polling cần thiết.
- Route Handlers/Server Actions cho mutation; logic nghiệp vụ đặt trong service layer độc lập với UI.
- Database lease/lock theo Router để ngăn status poll, sync và apply gây xung đột không an toàn.
- Abstraction `NotificationPublisher` và domain events được chuẩn bị để thêm email/Telegram/Slack/webhook sau này, nhưng phiên bản đầu không gửi ra ngoài.

SQLite không được dùng trên Vercel vì filesystem của function không phải persistent storage.

## 15. Mô hình database dự kiến

Các bảng chính:

- `companies`
- `networks`
- `routers`
- `wireguard_interfaces`
- `interface_addresses`
- `internal_subnets`
- `peers`
- `peer_internal_subnets`
- `peer_remote_subnets`
- `router_operation_locks`
- `auth_rate_limits`

Các secret mã hóa lưu dưới dạng envelope gồm version, IV/nonce, ciphertext và authentication tag để hỗ trợ thay đổi định dạng hoặc xoay khóa sau này.

Không tạo bảng user hoặc role trong phiên bản đầu tiên.

## 16. API/Server actions dự kiến

- Login/logout và kiểm tra session.
- CRUD Company và Network.
- CRUD metadata Router; test SSH; xác nhận host fingerprint.
- Liệt kê và chọn WireGuard Interface.
- Sync Router từ MikroTik.
- Refresh operational status.
- CRUD draft Peer.
- Apply một Peer hoặc batch nhiều Peer theo kết quả độc lập.
- Disable/enable, soft-delete và restore Peer.
- Generate/validate key pair.
- Generate config text, `.conf` và QR.
- Preview RouterOS CLI/diff.

API không được coi là public API trong phiên bản đầu; mọi endpoint yêu cầu admin session ngoại trừ login.

## 17. Xử lý lỗi

- DNS lookup failure.
- SSH timeout/refused/authentication failure.
- SSH host fingerprint changed.
- RouterOS version không được hỗ trợ.
- Interface hoặc peer bị thay đổi/xóa giữa lúc preview và apply.
- Duplicate public key, IP hoặc overlapping allowed-address.
- RouterOS command trả exit/error output.
- Command có thể đã chạy nhưng response bị mất: luôn đọc lại router để reconciliation trước khi retry.
- Database cập nhật thất bại sau khi router đã thay đổi: đánh dấu cần reconciliation ở lần sync tiếp theo.

Thông báo lỗi phải có nội dung hữu ích nhưng không làm lộ credential, private key, preshared key hoặc command chứa secret.

## 18. Tiêu chí nghiệm thu MVP

1. Admin đăng nhập bằng credentials trong environment và session tự hết hạn sau 8 giờ.
2. Tạo được Company, Network và Router theo đúng quan hệ.
3. Kết nối RouterOS qua hostname MikroTik Cloud DDNS bằng SSH private key hoặc password.
4. Phát hiện và yêu cầu xác nhận SSH host fingerprint lần đầu.
5. Đọc được RouterOS version, WireGuard Interface, IPv4 address và peer hiện có.
6. Import peer mà không làm mất hoặc ghi đè cấu hình trên router.
7. Tạo key pair và preshared key hợp lệ; private key được mã hóa trong database.
8. Đề xuất IP chưa dùng và chặn IP trùng/ngoài range.
9. Sinh đúng RouterOS CLI cho Internet, Internal và Site-to-site.
10. Preview và áp dụng từng peer qua SSH, sau đó xác minh kết quả.
11. Sửa, disable/enable, soft-delete và restore peer đúng state machine.
12. Peer import thiếu private key không được xuất cấu hình hoàn chỉnh và có hướng dẫn bổ sung key.
13. Xuất được cấu hình client dạng text, `.conf` và QR.
14. Hiển thị last handshake, endpoint và RX/TX; refresh khoảng 15 giây khi trang mở.
15. Dashboard hiển thị các tổng quan và cảnh báo cần thiết.
16. UI hoạt động trên desktop/mobile và light/dark mode.
17. Không có secret trong application log, browser cache hoặc response không cần thiết.
18. Các luồng quan trọng có automated tests và vượt qua lint, typecheck, unit/integration tests trước khi deploy.

## 19. Giả định cần xác nhận khi duyệt tài liệu

- RouterOS tối thiểu là 7.15.
- Internal subnet chỉ chấp nhận RFC1918 private IPv4.
- Preshared key mặc định được sinh cho peer mới.
- `Online` là last handshake trong vòng 180 giây; vẫn hiển thị timestamp thực để tránh hiểu sai.
- RouterOS private key của WireGuard Interface không bao giờ được lấy về ứng dụng.
- Admin chấp nhận router SSH có thể được truy cập từ Internet; production ưu tiên Vercel Static IP để firewall allowlist.
- Các thao tác tạo/sửa/xóa peer cần preview và xác nhận trước khi thực thi.

## 20. Các giai đoạn triển khai sau khi đặc tả được duyệt

1. Khởi tạo Next.js, UI foundation, database và authentication.
2. Company/Network/Router CRUD và mã hóa credential.
3. SSH connectivity, host fingerprint pinning và RouterOS reader.
4. Interface discovery, manual sync và conflict detection.
5. Peer lifecycle, IP allocation và RouterOS command builder.
6. Apply/reconciliation, soft-delete và restore.
7. Client config, file `.conf` và QR.
8. Operational polling, dashboard và responsive/dark mode.
9. Automated tests, security hardening và Vercel deployment documentation.
