# CARDFLOW RESPONSIVE UI IMPLEMENTATION REPORT

## Phạm vi

Triển khai responsive cho cùng một codebase HTML/CSS/JavaScript, không thay đổi business logic, data schema, Google Drive sync, CRUD, tính toán, định dạng tiền/ngày, Card ID, shared limit, cashback hoặc import/export.

## File đã chỉnh sửa

- `index.html`: thêm nút hamburger, nút đóng drawer, backdrop và ARIA cho điều hướng mobile.
- `styles.css`: bổ sung responsive layer cho desktop, tablet, mobile và small mobile.
- `app.js`: đóng drawer khi đổi tab, xử lý mở/đóng bằng hamburger/backdrop/Escape, gắn nhãn cột cho card-row mobile.
- `Docs/CARDFLOW_RESPONSIVE_UI_IMPLEMENTATION_REPORT.md`: báo cáo triển khai và kiểm thử.

## Breakpoint

- Desktop: `>= 1200px` — giữ nguyên sidebar, KPI 7 cột, bảng và kích thước modal hiện tại.
- Tablet: `768px - 1199px` — sidebar 220px, KPI 4 cột, bảng cuộn ngang trong vùng chứa.
- Mobile: `< 768px` — drawer overlay, padding trang 12px, toolbar/form/Drive panel xếp lại.
- Small mobile: `< 480px` — KPI 1 cột, onboarding steps xếp dọc.

## Bảo toàn desktop

Responsive layer chỉ override dưới 1200px. Ở 1920x1080 và 1440x900, sidebar vẫn tĩnh, KPI vẫn 7 cột, bảng vẫn là table và không có hamburger.

## Sidebar mobile

- Ẩn ngoài viewport theo mặc định, không chiếm chiều ngang nội dung.
- Mở bằng hamburger thành drawer có backdrop.
- Đóng bằng nút `×`, backdrop, phím Escape hoặc sau khi chọn tab.
- Giữ nguyên toàn bộ navigation và Import/Export.

## Chiến lược bảng theo tab

- Giao dịch: card-row ở mobile; giữ đủ 12 cột dưới dạng nhãn/giá trị.
- Thẻ tín dụng: card-row ở mobile; giữ đủ 11 cột dưới dạng nhãn/giá trị.
- Chương trình cashback, Cashback thực nhận, Thanh toán thẻ, Hosts, Nhóm MCC, Mã ngân hàng: horizontal scroll có sticky first column ở mobile.
- Dashboard và onboarding tables: horizontal scroll; tablet dùng horizontal scroll cho mọi bảng.
- Riêng bảng Dashboard `Tiến độ Cashback theo rule / Chỉ tiêu`: giữ nguyên table trên desktop/tablet; dưới `768px`, mỗi chương trình trở thành một card-row xếp dọc. Card giữ đủ Thẻ, Chương trình, Đúng nhóm, Tổng chi, Còn thiếu nhóm, Còn thiếu chỉ tiêu, Tiến độ và CB theo rule. Progress bar dùng toàn bộ chiều rộng khả dụng của card và giữ nguyên semantic progress colors.
- Desktop không chuyển table thành card.

## Modal, form và shared limit

- Mobile modal rộng `calc(100vw - 16px)`, cao tối đa `calc(100dvh - 16px)`, body cuộn nội bộ và footer luôn tiếp cận được.
- Input/select/textarea và nút hành động có touch target tối thiểu khoảng 44px; input mobile dùng font 16px để tránh auto-zoom.
- Textarea cao tối thiểu 96px.
- Shared-limit vẫn là dropdown đóng mặc định; popup cuộn, option và checkbox có vùng chạm lớn, tên dài được wrap.
- Desktop giữ kích thước modal hiện tại.

## Google Drive, toolbar, onboarding và About

- Drive status và action buttons xếp dọc trên mobile; nút full-width.
- Search full-width; Thêm/Chỉnh sửa/Xóa nằm trên hàng ba cột, cao tối thiểu 44px.
- Login gate co theo viewport; nút kết nối cao 48px và full-width trên mobile.
- Onboarding card giới hạn theo `dvh`, content cuộn nội bộ, action footer luôn truy cập được.
- About cards, author info và email được wrap trong chiều rộng màn hình.

## Kiểm thử viewport

Đã chạy ứng dụng thật qua local HTTP server trong Chromium, đo layout tại:

- 1920x1080
- 1440x900
- 1024x768
- 768x1024
- 430x932
- 390x844
- 360x800

Kết quả đã xác minh:

- Không có global horizontal overflow tại cả 7 viewport.
- Desktop giữ KPI 7 cột; tablet KPI 4 cột; mobile KPI 1 cột ở các viewport đã đo.
- Login card không tràn ngang ở cả 7 viewport; nút login mobile cao 48px.
- Hamburger chỉ hiển thị dưới 768px; chọn tab Giao dịch đóng drawer và đổi đúng view.
- Toolbar button mobile cao 44px.
- Modal ở 390x844 đo được 374x828px; input cao 45px, font 16px; nút Hủy hoạt động.
- `app.js` vượt qua `node --check`.

### Bổ sung kiểm thử Dashboard cashback progress

- Breakpoint chính xác: `@media (max-width:767px)`.
- Tái sử dụng trực tiếp pattern `.mobile-card-table` và cơ chế `data-label` đang dùng cho Giao dịch; không tạo renderer hay phép tính cashback thứ hai.
- Mobile card: Thẻ làm dòng tiêu đề, Chương trình ngay bên dưới, các chỉ số dùng label/value, Tiến độ có progress bar full-width và phần trăm, CB theo rule là dòng giá trị cuối.
- Đã kiểm tra tại 430x932, 390x844 và 360x800: table chuyển sang block/card mode, vùng chứa có `scrollWidth` bằng `clientWidth` và không có global horizontal overflow. Local test state không có chương trình cashback nên chưa thể visual-QA một card có dữ liệu/progress thực tế; cấu trúc dùng chung với card-row Giao dịch và CSS progress full-width đã được xác minh ở source.
- Đã kiểm tra tại 1920x1080 và 1440x900: phần này vẫn dùng table-row với nguyên 8 cột; CSS card-row mobile không được áp dụng.

Để kiểm thử phần sau login mà không thực hiện OAuth hoặc thay đổi Drive, một CSS override chỉ dùng lúc test đã được thêm tạm thời rồi gỡ khỏi source trước khi hoàn tất.

## Kiểm thử thiết bị thật còn lại

- Cần smoke test trên Safari iOS và Chrome Android thật để xác minh browser chrome/safe-area, native date picker, bàn phím ảo và thao tác cuộn shared-limit popup.
- Cần kiểm tra card-row với bộ dữ liệu production dài (tên thẻ/ghi chú dài); test hiện tại xác minh cấu trúc responsive nhưng local state không có dòng giao dịch mẫu.

## GitHub Pages

Tương thích: chỉ dùng static HTML/CSS/ES module hiện có, không thêm backend, build step, package hoặc route mới. Đường dẫn asset tương đối và luồng GitHub Pages được giữ nguyên.
