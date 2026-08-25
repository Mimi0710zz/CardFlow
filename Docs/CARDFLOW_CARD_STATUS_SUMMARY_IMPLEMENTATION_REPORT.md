# CARDFLOW CARD STATUS SUMMARY IMPLEMENTATION REPORT

## File chỉnh sửa

- `app.js`: active Dashboard renderer và một summary object dùng chung.
- `services/card-status-summary.js`: hàm tổng hợp thuần, có thể kiểm thử độc lập.
- `styles.css`: style nhẹ cho Total row và explanatory note.
- `Docs/CARDFLOW_CARD_STATUS_SUMMARY_IMPLEMENTATION_REPORT.md`: báo cáo triển khai.

## Renderer và thứ tự cột

Renderer được chỉnh là `renderDashboard()` trong `app.js`, card `Tình trạng thẻ`.

Thứ tự cuối: Thẻ, Hạn mức nhóm, Chi tháng, Dư nợ, Còn hạn mức, CB theo rule, Lợi nhuận ước tính.

`Tổng` là dòng đầu tiên trong `tbody`, ngay sau `thead` và trước mọi dòng thẻ.

## Total-row calculation

`summarizeCardStatusRows(cardRows)` nhận đúng các kết quả từng thẻ đã được Dashboard tính theo year/month hiện hành. Hàm chỉ aggregate:

- `monthlySpend`, `outstanding`, `cashback`, `estimatedProfit`: cộng từng thẻ.
- `totalLimit`, `remainingLimit`: cộng một lần cho mỗi `limitGroupId` duy nhất.

`Dư nợ` tiếp tục dùng `allDebt(cardId)` và cộng từng thẻ vì model hiện tại lưu giao dịch/thanh toán theo card. Không tạo debt model mới.

## Shared-limit deduplication

Mỗi Dashboard row được gắn canonical `limitGroupId` từ `groupIdForCard()`. Summary dùng Set để chỉ nhận `groupLimit` và `remaining` từ thành viên đầu tiên của mỗi group. Individual activity không bị deduplicate.

## Estimated profit và note

Estimated profit giữ nguyên công thức đang duyệt: order profit của thẻ cộng cashback theo rule được phân bổ cho thẻ. Chỉ đổi user-facing header thành `Lợi nhuận ước tính`.

Note nằm ngoài `.table-wrap`, dưới toàn bộ rows nên không bị ẩn khi bảng cuộn ngang:

> Lợi nhuận ước tính được tính dựa trên số tiền được hoàn theo chương trình của mỗi thẻ (có thể chưa hoàn về đầy đủ), số tiền đã đi đơn và số tiền Host đã Back về.

## Responsive behavior

- Desktop: giữ table hiện tại; chỉ thêm Total row, header mới và note.
- Tablet: giữ table/scroll behavior đã duyệt; Total row đứng đầu body.
- Smartphone: giữ table/scroll behavior đã duyệt; Total row đứng đầu body và sticky first cell giữ nền summary.

Không tạo responsive calculation riêng.

## Tests

- Shared-limit unit test đã chạy với TCB 82.000.000, hai thẻ Sacombank cùng group 30.000.000 và Cake 50.000.000: `totalLimit = 162.000.000`, không phải 192.000.000.
- Cùng scenario: shared remaining 18.000.000 chỉ tính một lần; `remainingLimit = 135.000.000`.
- Individual metrics cộng bình thường: `monthlySpend = 27.000.000`, `outstanding = 27.000.000`, `cashback = 1.100.000`.
- Negative estimated profit aggregate trả đúng `-2.253.440`; renderer dùng nguyên `formatMoneyDisplay()` và semantic class negative.
- Browser test tại 1920x1080, 1440x900, 820x1180, 1024x768, 390x844 và 430x932: đúng 7 header, Total là `tbody tr:first-child`, nền summary nhẹ, note đúng text và nằm ngoài scroll wrap, không global horizontal overflow.
- Month selector đã kích hoạt Dashboard rerender; Total row vẫn là summary đầu tiên sau rerender và dùng `cardRows` được tính lại từ `periodTx()`/`programMetrics()`.
- `node --check app.js` và `git diff --check` đạt.

Browser test phần sau login sử dụng CSS override tạm thời để không thực hiện OAuth/Drive; override đã được gỡ khỏi source bàn giao.

## Remaining runtime checks

- Physical iOS/Android/tablet smoke test cho horizontal table scroll và sticky Total label.
- Production-length card names và dữ liệu tháng lớn.
