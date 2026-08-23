# CardFlow Web Demo

Demo web chạy độc lập bằng dữ liệu trong `localStorage`. Excel **không phải nguồn dữ liệu bắt buộc**.

## Chạy demo

Cách đơn giản nhất:

1. Giải nén thư mục.
2. Mở `index.html` bằng Chrome/Edge.
3. Dashboard, giao dịch, dư nợ, thanh toán, cashback đều lưu trong trình duyệt.

## Import / Export Excel

Demo dùng SheetJS từ CDN để đọc/ghi `.xlsx`.

- App vẫn hoạt động khi không import Excel.
- `Import Excel` là tiện ích để đưa dữ liệu từ workbook V1 vào.
- `Export Excel` xuất Dashboard, Cards, Programs, Transactions, Payments, MCC.
- Nếu máy không có Internet, phần Import/Export Excel có thể không tải được thư viện CDN; production nên bundle dependency vào app.

## Logic đã đưa vào demo

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

## Điểm demo cố ý thử khác Excel V1

Web demo thêm trường `Kênh giao dịch = Online / Offline` để có thể tính rule Online của Techcombank.
Đây là một field nên đánh giá qua vận hành thực tế trước khi đưa ngược vào Excel V2.

## Production roadmap

Demo hiện không có backend và không phù hợp cho dữ liệu nhiều người dùng. Bản production nên tách:
- Web/PWA
- ASP.NET Core backend
- PostgreSQL
- Authentication / phân quyền
- Cashback rule engine
- Excel import/export service
- Backup / audit log
