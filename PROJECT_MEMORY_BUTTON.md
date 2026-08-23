# PROJECT MEMORY

## UI Button Style

- Anh Minh Minh thích các nút phụ có màu sắc phân biệt theo ý nghĩa thao tác, không dùng nền trắng/viền xám quá nhợt nhạt.
- Dùng style pastel/soft background, chữ đậm màu hơn, viền cùng hue để nhìn rõ nhưng vẫn nhẹ mắt.
- Palette đang hợp ý:
  - Browse source `Chọn...`: xanh dương nhạt.
  - Browse output `Chọn...`: tím nhạt.
  - `Mở file`: xanh dương nhạt.
  - `Mở thư mục`: xanh lá nhạt.
  - `Thêm thư mục`: xanh lá nhạt.
  - `Xóa thư mục`: đỏ nhạt.
  - `Mở rộng tất cả`: xanh dương nhạt.
  - `Thu gọn tất cả`: vàng nhạt.
  - `Chọn tất cả`: xanh ngọc nhạt.
  - `Bỏ chọn tất cả`: xám slate nhạt.
- Khi triển khai tool WinForms sau này, ưu tiên tạo helper kiểu `ApplyButtonPalette()` / overload `ConfigureActionButton()` để gán màu nhất quán và dễ đổi.
