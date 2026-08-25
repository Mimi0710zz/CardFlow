# CARDFLOW TABLET UI IMPLEMENTATION REPORT

## Phạm vi và file chỉnh sửa

- `styles.css`: dedicated tablet responsive rules.
- `Docs/CARDFLOW_TABLET_UI_IMPLEMENTATION_REPORT.md`: báo cáo triển khai và kiểm thử.

Không thay đổi HTML, JavaScript, business logic, dữ liệu, Google Drive sync, CRUD, tính toán, định dạng, shared-limit, cashback hoặc Import/Export trong phase tablet này.

## Breakpoint strategy

- Tablet: `768px–1199px`.
- Tablet portrait/narrow: `768px–900px`.
- Tablet landscape/wide: `901px–1199px`.
- Desktop `>=1200px` và smartphone `<768px` tiếp tục dùng rules hiện có.

## Navigation và page layout

- Cả portrait và landscape tablet đều dùng hamburger và off-canvas drawer 320px.
- Tái sử dụng nguyên DOM, class và JavaScript drawer của smartphone: backdrop, nút đóng, Escape và tự đóng khi chọn tab.
- Nội dung dùng toàn viewport với padding 18px portrait và 20px landscape.

## Portrait và landscape

- Portrait/narrow: filters xuống dưới title; Drive actions wrap dưới status; form một cột; modal rộng tối đa 90vw.
- Landscape/wide: title, description và filters cùng hàng khi đủ chỗ; Drive panel giữ bố cục ngang; form hai cột; modal rộng 82vw với max-width desktop hiện có.
- Modal có max-height theo `dvh`, body cuộn nội bộ và footer luôn truy cập được.

## KPI

- Portrait/narrow: 3 cột.
- Landscape/wide: 4 cột.
- Desktop giữ 7 cột; smartphone giữ rules đã duyệt.

## Table strategy

- Dashboard cashback progress: card-row ở portrait/narrow; compact horizontal-scroll table ở landscape.
- Giao dịch và Thẻ tín dụng: card-row ở portrait/narrow; table có controlled horizontal scroll ở landscape.
- Chương trình cashback: horizontal-scroll table.
- Cashback thực nhận, Thanh toán thẻ: compact horizontal-scroll table.
- Hosts, Nhóm MCC, Mã ngân hàng: table đơn giản, chỉ cuộn trong container nếu cần.
- Không có cột dữ liệu nào bị loại bỏ; dùng cùng DOM/data source và calculation hiện có.

## Touch, form và shared limit

- Navigation, toolbar, Drive actions và form controls có chiều cao tối thiểu 44px.
- Shared-limit vẫn là dropdown compact; option cao tối thiểu 44px, checkbox 20px và tên dài được wrap theo CSS hiện có.
- Toolbar giữ cùng hàng khi đủ chỗ; search chiếm full row ở portrait khi cần.

## Kiểm thử viewport

Đã chạy browser layout test trên source thực tế. Login gate được ẩn tạm bằng CSS override chỉ trong quá trình kiểm thử phần sau đăng nhập; override đã được gỡ khỏi source bàn giao.

- Portrait 768x1024, 820x1180, 834x1194: hamburger/drawer 320px; padding 18px; KPI 3 cột; Giao dịch, Thẻ tín dụng và Dashboard cashback dùng card mode; không global horizontal overflow.
- Landscape 1024x768, 1180x820, 1194x834: hamburger/drawer 320px; padding 20px; KPI 4 cột; các bảng giữ table mode trong scroll container; không global horizontal overflow.
- Drawer tại 820x1180: mở đúng cùng backdrop, tap backdrop đóng drawer, chọn tab Giao dịch đóng drawer và chuyển đúng view.
- Portrait modal tại 820x1180: rộng 738px, form 1 cột, input cao 45px, không vượt viewport.
- Landscape modal tại 1180x820: rộng 880px, form 2 cột, internal scroll; toolbar button cao 44px.
- Desktop regression 1440x900 và 1920x1080: sidebar tĩnh 250px, không hamburger, padding 28px, KPI 7 cột, tables giữ table mode, không overflow.
- Smartphone regression 390x844 và 430x932: padding 12px, hamburger/drawer và mobile card mode giữ nguyên, không overflow.

## Kiểm thử thiết bị thật còn lại

- Safari iPadOS và Chrome/Android tablet: safe-area, browser chrome, bàn phím ảo, native date picker và scroll momentum.
- Drawer với thao tác touch/gesture và shared-limit dropdown có tên thẻ production dài.

## GitHub Pages

Giữ tương thích: chỉ bổ sung static CSS và tài liệu; không thêm dependency, build step, backend hoặc route.
