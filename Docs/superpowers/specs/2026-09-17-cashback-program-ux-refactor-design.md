# Cashback Program UX Refactor Design

## Mục tiêu

Thay tab `Chương trình cashback` từ bảng tổng hợp lớn thành luồng cấu hình tập trung:

`Card -> Program -> Package (nếu có) -> Conditions`

Mỗi thời điểm UI chỉ hiển thị một Card, một Program và tối đa một Package. Việc thay đổi chủ yếu nằm ở UI/UX và lớp adapter; engine hiện có, dữ liệu legacy và runtime package phải được bảo toàn tối đa.

## Phạm vi

- Thay màn hình bảng cashback hiện tại bằng selector/detail workflow.
- Hỗ trợ nhiều Program có tên độc lập trên cùng một Card.
- Thêm `conditionMode` cấp Program.
- Giữ rule tổng doanh số cấp Program độc lập với `conditionMode`.
- Hiển thị Conditions theo danh sách dọc, không lộ Group.
- Duy trì package runtime trong `services/cashback-packages.js`.
- Mở rộng engine và import/export chỉ ở mức cần thiết.
- Không thay đổi các tab không liên quan.

## Kiến trúc dữ liệu

### Nguồn dữ liệu chính

`cashbackProgramGroups` tiếp tục là collection Program chính để tránh phá persistence và đồng bộ hiện tại. Không tạo collection cashback thứ hai.

Program chuẩn hóa có thể chứa:

```js
{
  id,
  cardId,
  name,
  year,
  month,
  conditionMode: "independent" | "first_match" | "all_required",
  totalSpendMinimum,
  maxCashbackPerPeriod,
  conditions,
  packages,
  packageHistory
}
```

Program đơn giản dùng `conditions` hoặc cấu trúc Group tương thích hiện hữu. Program có package tiếp tục dùng `packages[].groups[].conditions` để không làm hỏng runtime package và Group legacy.

### Adapter Group legacy

Group là chi tiết tương thích nội bộ, không xuất hiện trong UI mới.

- Group có một Condition được hiển thị thành một Condition UI.
- Group có nhiều Conditions được hiển thị thành nhiều Condition UI riêng biệt.
- Mỗi Condition UI giữ định danh Program, Package, Group và Condition để lưu ngược đúng vị trí.
- `conditionCombination`, `totalSpendMinimum`, cap và ghi chú Group legacy được giữ nguyên và tiếp tục làm cổng tính toán nội bộ.
- Chỉnh sửa một Condition không được ghi đè hoặc xóa Conditions cùng Group.
- Condition mới được đặt trong một Group tương thích riêng chứa một Condition.
- Khi xóa Condition cuối cùng của Group tương thích, Group rỗng được loại bỏ. Group legacy vẫn còn Condition khác phải được giữ.

Không migration phá hủy hoặc làm phẳng vĩnh viễn Group legacy.

### Thứ tự Condition

Thứ tự mảng là nguồn thứ tự duy nhất. Adapter trả Conditions theo thứ tự xác định và thao tác lên/xuống cập nhật thứ tự lưu trữ tương ứng. Trường `order` chỉ được dùng ở biên import/export nếu cần biểu diễn thứ tự, không trở thành nguồn trạng thái thứ hai.

## UI và tương tác

### Selector

Phần đầu tab gồm:

- Dropdown `Thẻ` lấy từ danh sách Card hiện có.
- Dropdown `Chương trình` chỉ chứa Program thuộc Card đang chọn.
- Nút `+ Thêm chương trình`.
- Thao tác đổi tên/chỉnh sửa và xóa Program hiện được đặt cạnh selector hoặc trong cụm action gọn.

Khi đổi Card, UI xóa Program và Package selection cũ, nạp Program của Card mới rồi chọn Program đầu tiên nếu có. Card đang chọn được giữ trong state giao diện khi người dùng còn ở tab nếu thực tế phù hợp với vòng render hiện tại.

### Chi tiết Program

`THÔNG TIN CHUNG` gồm:

- Tên chương trình.
- Max cashback toàn chương trình.

Không thêm chu kỳ cashback ở Program; chu kỳ tiếp tục lấy từ Card.

`CÁCH TÍNH CASHBACK` dùng một radio group:

- `Các điều kiện hoàn tiền riêng lẻ`.
- `Điều kiện đầu tiên đạt thì dừng`.
- `Tất cả điều kiện đều phải đạt`.

Rule `Yêu cầu tổng doanh số toàn chương trình` là checkbox độc lập. Khi bật mới hiện input `Tổng doanh số tối thiểu`.

### Package

Section `GÓI HOÀN TIỀN` chỉ render khi Program có `packages.length > 0`. Dropdown chỉ chọn một Package và danh sách bên dưới chỉ lấy Conditions của Package đó.

Runtime package, lịch sử đổi gói và active package không được sao chép vào state editor. `services/cashback-packages.js` vẫn là nguồn sự thật duy nhất cho `packageHistory`, active package, switch count và transaction resolution.

### Condition cards

Section `ĐIỀU KIỆN CASHBACK` hiển thị danh sách card dọc, đánh số rõ ràng. Mỗi Condition có:

- Tên điều kiện.
- MCC multi-select hiện có.
- Hình thức giao dịch theo canonical values hiện tại.
- Tỷ lệ hoàn.
- Giới hạn hoàn: `Không giới hạn` hoặc `Có giới hạn`.
- Max hoàn, chỉ bật khi có giới hạn.
- Chi để đạt Max CB, readonly và tính bằng `calculateSpendToMax()`.
- Chi tổng doanh số kèm theo, là rule Condition có thể nhập thủ công.
- Ghi chú.
- Xóa.
- Lên/xuống khi `conditionMode = first_match`.

`Chi để đạt Max CB` chỉ là giá trị suy ra. Nếu không giới hạn hoặc tỷ lệ không hợp lệ, UI hiển thị `Không áp dụng` hoặc để trống. `Chi tổng doanh số kèm theo` là rule thực và phải được persist riêng.

UI tái sử dụng typography, input, modal/confirmation, helper button và bảng màu pastel hiện có. Repository hiện không có `PROJECT_MEMORY.md` hoặc `PROJECT_MEMORY_BUTTON.md`; vì vậy không suy diễn quy tắc mới ngoài style đang tồn tại. Desktop dùng grid gọn; mobile/tablet chuyển về một cột tại breakpoint hiện hữu.

## Logic engine

### `independent`

Mỗi giao dịch có thể đóng góp cho mọi Condition phù hợp. Cashback từng Condition được tính và giới hạn riêng, sau đó cộng vào Program.

### `first_match`

Conditions được xét theo thứ tự persist. Với mỗi giao dịch, Condition phù hợp đầu tiên nhận giao dịch; các Condition sau không xét giao dịch đó. Việc xác định phù hợp dùng MCC, hình thức giao dịch và các điều kiện hiện có.

### `all_required`

Engine vẫn tính mức chi đủ điều kiện của từng Condition. Program chỉ trả cashback khi tất cả Conditions đạt yêu cầu cấu hình. Nếu một Condition không đạt, kết quả Program là `0`.

### Rule kết hợp

- `totalSpendMinimum` cấp Program là cổng chung và kết hợp với mọi `conditionMode`.
- Cap từng Condition áp dụng trước.
- Rule Group legacy áp dụng ở lớp tương thích.
- `maxCashbackPerPeriod` cấp Program áp dụng cuối cùng.
- Với package, giao dịch trước tiên được `resolvePackageForTransaction()` phân vào Package đúng theo runtime history, sau đó mới đánh giá Conditions trong Package đó.
- Không hard-code Card ID, ngân hàng hoặc MB Pla trong engine.

### Default cho legacy

- Program thiếu `conditionMode` được chuẩn hóa thành `independent`.
- Group legacy `OR` giữ hành vi độc lập hiện tại.
- Group legacy `AND` nhiều Conditions vẫn giữ cổng AND ẩn; Program mặc định `independent` để không áp thêm một tầng `all_required` ngoài ý muốn.
- Khi người dùng chủ động chọn mode mới, engine áp `conditionMode` cấp Program ngoài các cổng legacy được bảo toàn.

## Migration và persistence

Dự kiến tăng `schemaVersion` từ `17` lên `18` vì `conditionMode` là field persist mới có tác động engine.

Migration `17 -> 18`:

- Bổ sung `conditionMode: "independent"` nếu thiếu.
- Giữ nguyên tên Program hiện tại; không lấy tên Condition thay thế.
- Giữ thứ tự mảng Conditions hiện hữu.
- Giữ ID Program, Package, Group và Condition.
- Giữ `packageHistory`, cap, tổng chi, MCC, transaction method và notes.
- Chấp nhận các nguồn legacy `cashbackPrograms`, `cashbackProgramGroups` và `programs` như hiện tại.
- Canonicalization phải idempotent: chạy lại dữ liệu schema 18 không tạo thay đổi mới.

Local và Google Drive dùng chung canonicalization; không tạo migration riêng.

## Excel import/export

Luồng Excel hiện có phải được kiểm tra trước khi sửa. Nếu cashback được import/export theo record phẳng, format mới có thể bổ sung:

- Card ID.
- Program ID và tên Program.
- Condition Mode.
- Tổng doanh số tối thiểu Program.
- Max cashback Program.
- Package ID và tên Package.
- Condition ID và tên Condition.
- MCC.
- Hình thức giao dịch.
- Tỷ lệ hoàn.
- Kiểu giới hạn và Max hoàn.
- Chi tổng doanh số kèm theo.
- Ghi chú.
- Thứ tự Condition.

Import cũ phải tiếp tục hoạt động. Không export `packageHistory` như rule configuration. Nếu luồng hiện tại không có import/export cashback riêng và thay đổi không bắt buộc, không mở rộng ngoài phạm vi.

## Trạng thái lỗi và thao tác an toàn

- Không có Card: hiển thị empty state, disable action phụ thuộc Card.
- Card không có Program: hiển thị empty state và cho phép thêm Program.
- Program có package nhưng Package không hợp lệ: chọn Package đầu tiên còn tồn tại và không sửa `packageHistory`.
- Xóa Program dùng confirmation hiện tại và chỉ xóa ID được chọn.
- Xóa Condition chỉ tác động Program/Package/Group chứa nó.
- Validation ngăn lưu Program không tên, Condition không tên, tỷ lệ không hợp lệ hoặc cap có giới hạn không hợp lệ.
- Không tự động xóa dữ liệu legacy không biểu diễn được trực tiếp.

## Chiến lược triển khai

Triển khai theo RED -> GREEN -> REFACTOR:

1. Tạo helpers/adapter thuần cho selection và flatten/update Condition; viết test thất bại trước.
2. Thêm normalization và migration `conditionMode`; kiểm tra idempotence và không mất dữ liệu.
3. Mở rộng engine cho ba mode và program threshold, giữ regression legacy/package.
4. Thay renderer bảng bằng selector/detail UI và nối các action scoped.
5. Cập nhật Excel nếu khảo sát chứng minh cần thiết.
6. Tinh chỉnh CSS responsive trong phạm vi tab cashback.

## Ma trận kiểm thử

- Card selector chỉ trả Program thuộc Card được chọn.
- Một Card lưu/chọn nhiều Program, tên Program độc lập với tên Condition.
- Program đơn giản không hiển thị Package selector.
- Program có package hiển thị selector và chỉ Conditions thuộc Package được chọn.
- Thêm/xóa Condition chỉ tác động scope đang chọn.
- `5%` và `200,000` cho kết quả readonly `4,000,000`.
- Ba `conditionMode` loại trừ lẫn nhau và persist.
- Thứ tự `first_match` persist; Condition hợp lệ đầu tiên thắng.
- Rule tổng chi Program persist và chặn payout khi chưa đạt.
- Dữ liệu legacy mở được và không mất Condition.
- Group legacy nhiều Conditions giữ rule ẩn và cập nhật đúng Condition.
- `packageHistory` giữ nguyên qua canonicalization và edit rule.
- Hành vi cashback không package tương đương trước đây không bị regression.

## Xác minh hoàn tất

- Chạy toàn bộ test cashback mới.
- Chạy toàn bộ test cashback hiện có.
- Chạy toàn bộ `tests/*.test.mjs`.
- Chạy `node --check` trên mọi JS thay đổi.
- Chạy `git diff --check`.
- Kiểm tra source/manual cho Card -> Program -> Conditions và Card -> Program -> Package -> Conditions.
- Báo chính xác số test pass/fail và mọi mục `[Chưa xác minh]`.

