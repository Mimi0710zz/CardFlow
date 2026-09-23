# Thiết kế tái cấu trúc Cashback Program và MB Platinum

## Mục tiêu

Tái cấu trúc Cashback Program thành danh sách chương trình trực tiếp theo Card ID, loại bỏ lớp tên/chương trình tổng dư thừa trên UI, giữ nguyên hành vi của thẻ thường và bổ sung quy trình cashback riêng cho MB Platinum theo kỳ sao kê.

## Phạm vi

- Đổi toàn bộ thuật ngữ người dùng từ “Điều kiện” sang “Chương trình” trong Cashback Program.
- Chuẩn hóa dữ liệu cashback cũ khi tải mà không làm mất quy tắc, MCC, Card ID hoặc lịch sử.
- Bổ sung Package, Program và trạng thái slot cho giao dịch MB Platinum.
- Tính cashback MB Platinum theo kỳ sao kê, luân phiên gói và điều kiện tổng chi toàn kỳ.
- Cập nhật local persistence, Google Drive sync, Excel import/export và kiểm thử.
- Không thay đổi nghiệp vụ hoặc giao diện của module không liên quan.

## Nhận diện MB Platinum

- Card ID ổn định: `MB Pla`.
- Không dùng tên hiển thị, tên ngân hàng hoặc phép tìm kiếm chuỗi để nhận diện.
- Package ID nghiệp vụ:
  - `DAILY`: Hàng ngày
  - `LIFESTYLE`: Phong cách sống

## Mô hình dữ liệu đích

Giữ `cashbackProgramGroups` làm khóa persisted hiện hữu để hạn chế ảnh hưởng Drive và các consumer, nhưng mỗi phần tử sau chuẩn hóa là một chương trình cashback trực tiếp:

```js
{
  id,
  cardId,
  year,
  month,
  name,
  packageId, // chỉ MB Platinum
  allMcc,
  mccCategoryIds,
  channel,
  rate,
  max,
  maxCashbackUnlimited,
  eligibleSpendMinimum,
  conditionMode,
  conditionCombination,
  note
}
```

Cấu hình cấp thẻ tách riêng khỏi chương trình:

```js
{
  cardId: "MB Pla",
  statementMinSpend: 5000000,
  rotationAnchorPeriodKey,
  rotationAnchorPrimaryPackageId: "LIFESTYLE"
}
```

Giao dịch MB Platinum có thể lưu:

```js
{
  cashbackPackageId: "DAILY" | "LIFESTYLE" | "",
  cashbackProgramId: string | ""
}
```

Tên chương trình không phải khóa. Hai chương trình cùng tên ở hai package có ID khác nhau.

## Migration và tương thích ngược

- Tăng `schemaVersion`.
- Dữ liệu phẳng hiện tại được giữ nguyên ID nếu đã biểu diễn một chương trình trực tiếp.
- Cấu trúc cũ `program -> conditions` được tách thành một chương trình cho mỗi condition. ID condition hiện hữu được ưu tiên làm ID chương trình; nếu thiếu thì sinh ID xác định từ ID cha và vị trí, đồng thời xử lý trùng.
- Cấu trúc cũ `program -> packages -> groups -> conditions` được tách tương tự và giữ Package ID.
- Thuộc tính tổng/chung của lớp cha được sao chép vào chương trình con khi còn ý nghĩa; dữ liệu legacy chưa ánh xạ được được bảo tồn trong metadata migration thay vì loại bỏ.
- Migration phải idempotent: canonicalize lần hai không thay đổi dữ liệu.
- Drive tiếp tục canonicalize qua cùng một nguồn migration với local storage.
- Excel mới xuất Program ID, Package ID và cấu hình MB cấp thẻ. Import tiếp tục hiểu các cột legacy hiện hữu.

## UI Cashback Program

- Cây chính: Card ID → Cashback Program.
- Không hiển thị lớp “Chương trình/Tên chương trình” tổng cũ.
- Mỗi chương trình chỉnh trực tiếp tên, MCC, hình thức giao dịch, tỷ lệ, max cashback, chi tối thiểu và các thuộc tính kết hợp còn áp dụng.
- Tất cả nhãn “Điều kiện” đổi thành “Chương trình”.
- Khi chọn MB Platinum, editor bổ sung dropdown Package và khu vực cấu hình `statementMinSpend` toàn kỳ.
- Giữ styling/helper nút hiện tại; không tạo palette hoặc kiểu nút mới.

## Kỳ sao kê và luân phiên package

- Dùng kỳ sao kê từ service dùng chung; không suy luận theo tháng lịch.
- Mỗi kỳ được nhận diện bằng khóa gồm loại kỳ, ngày bắt đầu và ngày kết thúc.
- Cấu hình lưu một kỳ neo và package chính tại kỳ neo.
- Khoảng cách số kỳ sao kê giữa kỳ cần tính và kỳ neo quyết định chẵn/lẻ; kỳ kế tiếp luôn đảo package chính.
- Lưu mốc neo giúp kết quả ổn định sau reload, sync, import/export và sửa giao dịch cũ.
- Không phụ thuộc thứ tự array hoặc trạng thái lựa chọn UI.

## Slot MB Platinum

- Package chính: tối đa hai Program ID khác nhau.
- Package phụ: tối đa một Program ID.
- Nhiều giao dịch cùng Program ID chỉ chiếm một slot.
- Slot chỉ bị chiếm nếu giao dịch được gán đúng package/program và đạt MCC, transaction method cùng các điều kiện chương trình.
- Giao dịch không gán hoặc không đạt điều kiện không chiếm slot.
- Trạng thái slot luôn được suy ra từ persisted transactions trong cùng kỳ; không lưu counter.
- Khi sửa/xóa/chuyển thẻ, ngày, MCC, package hoặc program, trạng thái được tính lại.

Nếu một assignment mới tạo slot vượt giới hạn, form trả thông báo tiếng Việt cụ thể và không tự thay lựa chọn. Assignment trùng chương trình đã dùng không tạo slot mới và vẫn có thể đóng góp doanh số/cashback của chương trình đó.

## Form giao dịch

- Thẻ thường giữ nguyên form và hành vi.
- MB Platinum hiện thêm `Gói` và `Chương trình`.
- Cả hai dropdown mặc định rỗng khi tạo mới.
- Chương trình chỉ được tải sau khi chọn package và chỉ gồm chương trình thuộc package đó.
- Option package hiển thị trạng thái đã dùng/tổng slot.
- Option không thể mở slot mới vẫn hiển thị ở trạng thái khóa kèm giải thích.
- Khi edit, giá trị persisted được hiển thị lại, kể cả trường hợp cấu hình chương trình đã thay đổi; UI đánh dấu dữ liệu cũ rõ ràng.

## Tính cashback MB Platinum

Tạo rule handler MB Platinum và gọi từ engine hiện hữu:

1. Xác định kỳ sao kê của giao dịch/reference date.
2. Xác định package chính và phụ từ mốc luân phiên.
3. Lấy giao dịch MB Platinum trong cùng kỳ.
4. Xác thực assignment, MCC, transaction method và điều kiện chương trình.
5. Xác định tối đa hai Program ID hợp lệ của package chính và một Program ID hợp lệ của package phụ theo thứ tự giao dịch xác định (`date`, `transactionTime`, `id`).
6. Gom mọi giao dịch hợp lệ của các program đã chiếm slot để tính doanh số và cashback theo rate/cap riêng.
7. Tính tổng eligible spending toàn kỳ; nếu thấp hơn `statementMinSpend`, cashback toàn kỳ bằng 0 nhưng vẫn trả chi tiết tiến độ/slot cho UI.
8. Trả result theo shape tương thích với summary/tracking hiện tại.

Thẻ thường tiếp tục đi qua engine hiện hữu, không chịu rule slot hoặc rotation.

## Excel và Google Drive

- Google Drive dùng schema canonical giống local storage, không có nguồn sự thật thứ hai.
- Export/import giao dịch phải giữ `cashbackPackageId` và `cashbackProgramId`.
- Export/import chương trình phải giữ Program ID và Package ID.
- Cấu hình MB cấp thẻ được export/import bằng sheet hoặc hàng cấu hình rõ ràng, gồm minimum spend và rotation anchor.
- Import legacy không có các trường mới vẫn hợp lệ và không tự gán package/program cho giao dịch.

## Kiểm thử

- Regression cho thẻ thường.
- Migration cấu trúc cũ, bảo toàn dữ liệu và idempotency.
- Hai slot khác nhau của package chính; program thứ ba bị từ chối.
- Giao dịch lặp cùng program không tăng số slot.
- Một slot package phụ.
- Giao dịch thường/không đủ điều kiện không chiếm slot.
- Cô lập giữa hai kỳ sao kê.
- Luân phiên package qua ba kỳ liên tiếp.
- Sửa/xóa giao dịch giải phóng hoặc tái phân bổ slot.
- Điều kiện tổng chi dưới và đạt 5.000.000 VND.
- Hai program cùng tên khác package vẫn độc lập.
- Round-trip local canonicalization, Drive canonicalization và Excel.
- Kiểm tra UI terminology, dropdown rỗng, filtering, trạng thái và thông báo khóa.

## Rủi ro và giới hạn

- Card ID `MB Pla` được xem là ID ổn định theo dữ liệu/test hiện hữu. Nếu dữ liệu thực tế dùng ID khác, cần bổ sung migration Card ID có chủ đích thay vì dò theo display text.
- Dữ liệu legacy có nhiều condition dưới một program sẽ tạo nhiều program; tên condition được ưu tiên làm tên hiển thị để tránh trùng tên lớp cha.
- Thứ tự giao dịch phải có tie-breaker bằng ID để việc chiếm slot luôn deterministic.
- Không thay đổi lịch sử giao dịch cũ để tự gán package/program; chỉ assignment rõ ràng mới tham gia slot MB Platinum.
