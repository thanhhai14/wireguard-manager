# Hồ sơ chuyển đổi WireGuard Web + mikr

## Mục tiêu

Bộ tài liệu này là baseline để chuyển ứng dụng WireGuard Web hiện tại thành một hệ thống quản trị MikroTik chạy lâu dài trên VPS, có toàn bộ nhóm chức năng đang hiện diện trong mikr 1.86.0 và giữ nguyên các năng lực WireGuard chuyên sâu đã xây dựng.

Hệ thống đích được xuất bản qua Cloudflare Tunnel, nhưng vẫn tự xác thực và phân quyền ở tầng ứng dụng. Đây là dự án tái hiện chức năng và trải nghiệm; không sao chép thương hiệu, mã nguồn đóng, cơ chế license hay tài sản độc quyền của mikr.

## Baseline đã khảo sát

| Thành phần | Vị trí | Mốc |
|---|---|---|
| Ứng dụng hiện tại | `/home/thanhhai14/Data/Code/wireguard-web` | Next.js 16, React 19, TypeScript, Drizzle/PostgreSQL |
| Gói mikr local | `/home/thanhhai14/Data/Code/mikrotik-mgr` | 1.86.0, 2026-09-11 |
| Tài liệu upstream | `hreskiv/mikr`, nhánh `main` | README công khai |

Gói mikr local không có `.git` và backend đã được đóng gói bằng Bytenode: `server.js` chỉ nạp `server.jsc`; 168 module backend là `.jsc`. Phần có thể đọc trực tiếp gồm 54 module frontend JavaScript, 5 stylesheet, `package.json`, cấu trúc module và tài sản tĩnh. Từ call-site frontend đã trích được 177 mẫu gọi API và 33 loại sự kiện WebSocket. Vì vậy tài liệu dùng ba mức bằng chứng:

- **Xác minh**: đọc trực tiếp từ mã frontend, manifest hoặc quan sát cấu trúc module.
- **Đối chiếu**: có đồng thời trong giao diện local và README upstream.
- **Suy luận**: kết luận kiến trúc hợp lý từ tên module/contract, cần test integration trước khi coi là tương thích hoàn toàn.

Không có phần nào được ghi là “đã xác minh” nếu chỉ dựa trên suy đoán từ bytecode.

## Bộ tài liệu

1. [Hiện trạng mikr](./01-MIKR-AS-IS.md)
2. [Ma trận chức năng](./02-FEATURE-PARITY-MATRIX.md)
3. [Kiến trúc đích trên VPS](./03-TARGET-ARCHITECTURE.md)
4. [Mô hình domain và dữ liệu](./04-DOMAIN-DATA-MODEL.md)
5. [Đặc tả UI/UX](./05-UI-UX-SPEC.md)
6. [API và realtime contract](./06-API-REALTIME-CONTRACT.md)
7. [Lộ trình chuyển đổi](./07-MIGRATION-ROADMAP.md)
8. [Triển khai Cloudflare Tunnel](./08-DEPLOYMENT-CLOUDFLARE.md)
9. [Rủi ro, quyết định và tiêu chí nghiệm thu](./09-RISKS-AND-ACCEPTANCE.md)
10. [Bản đồ code hiện tại và điểm chuyển đổi](./10-CURRENT-CODE-MAP.md)

## Nguyên tắc dùng tài liệu

- Mọi thay đổi schema/API lớn phải cập nhật tài liệu tương ứng trước hoặc trong cùng pull request.
- Mỗi phase chỉ hoàn thành khi đạt tiêu chí nghiệm thu, có migration và rollback.
- Không “big bang rewrite”. WireGuard hiện tại phải tiếp tục dùng được trong suốt quá trình.
- Contract trích từ mikr là nguồn để viết test parity, không bắt buộc giữ nguyên URL nội bộ nếu adapter tương thích đã được định nghĩa.
- `PRODUCT_SPEC.md` ở root mô tả sản phẩm Vercel trước đây; bộ `docs/` này thay thế nó cho kiến trúc VPS mới.
