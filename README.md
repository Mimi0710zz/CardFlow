# Quản Lý Thẻ

Ứng dụng web chạy độc lập bằng dữ liệu trong `localStorage`. Excel **không phải nguồn dữ liệu bắt buộc**.

## Chạy ứng dụng

Cách đơn giản nhất:

1. Giải nén thư mục.
2. Mở `index.html` bằng Chrome/Edge.
3. Dashboard, giao dịch, dư nợ, thanh toán, cashback đều lưu trong trình duyệt.

## Export Excel

Ứng dụng dùng SheetJS từ CDN để ghi `.xlsx`.

- `Export Excel` xuất Dashboard, Cards, Programs, Transactions, Payments, MCC.
- Nếu máy không có Internet, Export Excel có thể không tải được thư viện CDN; production nên bundle dependency vào app.

## Logic hiện có

- Techcombank Everyday: 5%, max 500.000, target 10.000.000, rule Online.
- Sacombank Cashback Visa:
  - Siêu thị: 6,8%, target 10.000.000.
  - Đi lại: 16,8%, target khoảng 4.047.619.
  - Shared cashback cap: 680.000.
- Sacombank American Express: 20%, max 1.000.000, target 5.000.000.
- Cake Signature: 20%, max 2.000.000; eligible spend 10.000.000; tổng chỉ tiêu tháng 20.000.000.
- Sacombank Amex + Cashback dùng chung hạn mức 30.000.000.
- Techcombank Everyday hạn mức 82.000.000.
- Cake Signature hạn mức 50.000.000.

## Khác biệt so với Excel V1

Ứng dụng có trường `Hình thức giao dịch = Online / Offline / Quẹt POS` để phục vụ các rule cashback theo phương thức giao dịch.
Đây là một field nên đánh giá qua vận hành thực tế trước khi đưa ngược vào Excel V2.

## Production roadmap

Ứng dụng hiện không có backend và không phù hợp cho dữ liệu nhiều người dùng. Bản production nên tách:
- Web/PWA
- ASP.NET Core backend
- PostgreSQL
- Authentication / phân quyền
- Cashback rule engine
- Excel export service
- Backup / audit log
