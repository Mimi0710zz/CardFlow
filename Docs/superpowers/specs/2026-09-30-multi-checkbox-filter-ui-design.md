# Thiết kế bộ lọc nhiều điều kiện bằng checkbox

## Mục tiêu

Nâng cấp các bộ lọc của CardFlow Client để người dùng chọn đồng thời nhiều giá trị trong một thuộc tính và kết hợp nhiều thuộc tính, đồng thời giữ giao diện gọn, trạng thái ổn định và kết quả tổng hợp chính xác theo dữ liệu đã lọc.

## Phạm vi

Áp dụng cho sáu khu vực:

- Thẻ.
- Giao dịch, gồm tab Đánh đơn và Chi tiêu cá nhân.
- Phí thẻ.
- Thanh toán thẻ.
- Theo dõi đơn.
- Lời nhắc.

Giữ nguyên tập thuộc tính lọc hiện có của từng khu vực. Không thay đổi nghiệp vụ giao dịch, cashback, MB Platinum, kỳ sao kê, Card ID, master data, repository schema hoặc Google Drive synchronization.

## Kiến trúc

Tạo helper thuần dùng chung trong tầng service để quản lý hành vi multi-filter, thay vì sao chép logic tại từng bảng. Helper chịu trách nhiệm:

- Chuẩn hóa giá trị lựa chọn thành `Set`.
- Sao chép và xóa filter state mà không chia sẻ mutable state ngoài ý muốn.
- Kiểm tra một giá trị theo quy tắc không chọn là không giới hạn.
- Đếm tổng số giá trị đang được chọn; không tính checkbox “Tất cả”.
- Suy ra trạng thái `checked` và `indeterminate` của “Tất cả”.
- Chọn hoặc xóa toàn bộ option hiện có trong một nhóm.

Renderer dùng chung tạo nhóm checkbox compact từ danh sách `{value, label}`. `app.js` và `services/tracking-matrix-ui.js` tái sử dụng helper/renderer này nhưng tiếp tục sở hữu việc lấy dữ liệu, render bảng và nối event của khu vực tương ứng.

## Filter state

Các thuộc tính nhiều lựa chọn dùng `Set`, ví dụ:

```js
{
  bankId: new Set(),
  cardId: new Set(),
  status: new Set(),
  orderType: new Set()
}
```

Date range tiếp tục dùng chuỗi ngày và cờ boolean tiếp tục dùng boolean. Filter state chỉ tồn tại trong runtime UI như hiện tại, không đưa vào persisted repository hoặc Drive schema.

Mỗi panel có hai trạng thái:

- Applied state: bộ lọc đang tác động lên bảng.
- Draft state: bản sao dùng khi panel đang mở.

`Áp dụng` thay applied state bằng draft state. `Huỷ` hoặc click ngoài bỏ draft và giữ applied state. Mở lại panel luôn khởi tạo draft từ applied state. Render lại bảng không được xóa applied state.

## Quy tắc lọc

- OR giữa các giá trị trong cùng một thuộc tính.
- AND giữa các thuộc tính khác nhau.
- `Set` rỗng không giới hạn kết quả.
- Search dùng AND với toàn bộ filter groups.
- Date range và cờ boolean tiếp tục kết hợp bằng AND như hành vi hiện hữu.

Ví dụ:

```js
matches(bankId, filters.bankId)
  && matches(cardId, filters.cardId)
  && matches(status, filters.status)
  && matchesSearch(row, searchTerm)
```

Các totals/summary phải nhận đúng mảng rows sau cả multi-filter và search. Không tính totals trực tiếp từ nguồn chưa lọc.

## Dữ liệu option

- Sinh option động từ application data hoặc master data hiện hữu.
- Không hardcode Card ID, ngân hàng, khách hàng, MCC hoặc dữ liệu động khác.
- Các enum nghiệp vụ hiện đã hardcode có chủ đích như trạng thái, loại thẻ và loại phí tiếp tục là nguồn option.
- Loại trùng theo value ổn định.
- Sắp xếp label theo tiếng Việt A→Z và natural number khi phù hợp.
- “Tất cả” là control của nhóm, không phải một option nghiệp vụ và không được lưu trong filter state.

## UI và tương tác

Mỗi thuộc tính hiển thị thành một nhóm/dropdown checkbox compact gồm tiêu đề, phần tóm tắt lựa chọn và danh sách option:

- Bấm tiêu đề để mở/đóng danh sách của nhóm.
- Label checkbox có thể click.
- Danh sách có `max-height` và vertical scroll.
- Tick nhiều checkbox không đóng panel cha hoặc dropdown nhóm.
- Click ngoài panel cha đóng panel và bỏ draft chưa áp dụng.
- Giao diện desktop và mobile tái sử dụng breakpoint/panel hiện hữu.

Checkbox “Tất cả”:

- Check chọn mọi option hiện có.
- Uncheck xóa mọi lựa chọn trong nhóm.
- Khi mọi option riêng lẻ được chọn, “Tất cả” ở trạng thái checked.
- Khi chỉ một phần được chọn, control ở trạng thái indeterminate.
- Khi không có option hoặc không có lựa chọn, control không checked và không indeterminate.

Nút `Xóa bộ lọc` xóa mọi `Set`, date range và cờ boolean của khu vực, đóng panel và render lại toàn bộ dataset. Nút filter hiển thị `Bộ lọc (n)` với `n` là tổng số giá trị đã chọn; mỗi date boundary hoặc boolean đang hoạt động tính là một filter, không tính “Tất cả”.

## Tích hợp từng khu vực

- Thẻ: Ngân hàng, Loại thẻ, Phôi và Hình thức thành multi-checkbox.
- Giao dịch: Thẻ, Loại đơn, MCC, Host, Hình thức giao dịch và Trạng thái thành multi-checkbox; date range giữ input ngày. Tab cá nhân giữ filter state độc lập với tab đánh đơn.
- Phí thẻ: Ngân hàng, Thẻ và Loại phí thành multi-checkbox.
- Thanh toán thẻ: Ngân hàng, Thẻ và Trạng thái thành multi-checkbox; bộ chọn kỳ sao kê hiện hữu không đổi.
- Theo dõi đơn: Thẻ, Phôi, Chương trình cashback và Trạng thái thành multi-checkbox; “Chỉ hiện cần xử lý” giữ boolean.
- Lời nhắc: Thẻ và Tình trạng thành multi-checkbox; date range giữ input ngày. Toolbar được đưa vào cùng hành vi Apply/Cancel/reset nhất quán với các khu vực khác.

## Khả năng truy cập

- Dùng `input type="checkbox"` thực và liên kết label có thể click.
- Tiêu đề nhóm là button với `aria-expanded`.
- Trạng thái indeterminate được đặt qua DOM property sau render.
- Keyboard focus không bị mất sau mỗi lần tick; panel không tự đóng.

## Kiểm thử

Kiểm thử helper thuần:

- Không lựa chọn không giới hạn dữ liệu.
- Một giá trị.
- Nhiều giá trị cùng nhóm dùng OR.
- Nhiều nhóm dùng AND.
- Đếm từng giá trị được chọn.
- Select All, clear all và trạng thái partial/indeterminate.
- Clone/reset không làm thay đổi state nguồn.

Kiểm thử tích hợp/UI:

- Option động được loại trùng và sắp xếp.
- Search kết hợp với checkbox filters bằng AND.
- Totals/summary tính từ rows đã lọc.
- Clear filter phục hồi toàn bộ dữ liệu.
- Apply giữ lựa chọn sau render và mở lại panel.
- Cancel/click ngoài bỏ draft nhưng không xóa applied state.
- Các tab giao dịch giữ state độc lập.
- Cả sáu khu vực render nhóm checkbox và filter count đúng.
- Chạy toàn bộ test suite để phát hiện regression ngoài filter UI.

## Rủi ro và giới hạn

- Chuyển state từ string sang `Set` ảnh hưởng mọi predicate và active-count hiện tại; migration runtime phải thực hiện đồng bộ, không để code so sánh string còn sót.
- DOM không cho khai báo `indeterminate` bằng HTML attribute; event wiring phải đồng bộ property sau mỗi render và sau mỗi thay đổi checkbox.
- Option động có thể biến mất khi dữ liệu nguồn thay đổi. Applied state giữ value nhưng UI chỉ hiển thị option hiện có; predicate vẫn an toàn và reset luôn xóa được value cũ.
- Không tái thiết kế bảng, toolbar hoặc nghiệp vụ ngoài sáu khu vực filter đã duyệt.
