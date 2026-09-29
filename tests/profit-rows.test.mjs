import assert from "node:assert/strict";
import test from "node:test";
import { getProfitRowsForMonth, getProfitSummaryForMonth } from "../services/dashboard-summary.js";
import { getDashboardSummary } from "../services/dashboard-summary.js";

const cards=[{id:"CARD-C"},{id:"CARD-A"},{id:"CARD-B"}];
const transactions=[
  {id:"TX-A1",date:"2026-09-05",cardId:"CARD-A",amount:1_000_000,hostFeeAmount:100_000,returnAmount:900_000,status:"host_back",orderType:"STANDARD"},
  {id:"TX-A2",date:"2026-09-06",cardId:"CARD-A",amount:2_000_000,hostFeeAmount:200_000,returnAmount:1_800_000,status:"host_back",orderType:"STANDARD"},
  {id:"TX-B-OLD",date:"2026-08-31",cardId:"CARD-B",amount:3_000_000,hostFeeAmount:300_000,returnAmount:2_700_000,status:"host_back",orderType:"STANDARD"},
  {id:"TX-BUG",date:"2026-09-07",cardId:"CARD-B",amount:4_000_000,hostFeeAmount:400_000,returnAmount:3_600_000,status:"host_back",orderType:"BUG-LAZADA"}
];
const receipts=[
  {id:"CB-A1",date:"2026-09-10",cardId:"CARD-A",amount:400_000,notes:"Đợt 1",destination:"cash"},
  {id:"CB-A2",date:"2026-09-20",cardId:"CARD-A",amount:600_000,notes:"Đợt 2",destination:"credit_limit"},
  {id:"CB-B-OLD",date:"2026-08-20",cardId:"CARD-B",amount:900_000,notes:"Tháng trước",destination:"cash"}
];

const build=overrides=>getProfitRowsForMonth({cards,transactions,receipts,year:2026,month:9,...overrides});

test("hiển thị toàn bộ thẻ dù không có cashback",()=>assert.deepEqual(build().map(row=>row.cardId),["CARD-A","CARD-B","CARD-C"]));
test("thẻ không có cashback trả về số tiền 0",()=>assert.equal(build().find(row=>row.cardId==="CARD-B").cashbackAmount,0));
test("phí Host được nhóm đúng theo Card ID",()=>assert.equal(build().find(row=>row.cardId==="CARD-A").hostFeeAmount,300_000));
test("phí Host chỉ lấy giao dịch trong tháng chọn",()=>assert.equal(build().find(row=>row.cardId==="CARD-B").hostFeeAmount,0));
test("cashback chỉ lấy bản ghi thực nhận trong tháng chọn",()=>assert.equal(build().find(row=>row.cardId==="CARD-A").cashbackAmount,1_000_000));
test("mỗi Card ID chỉ xuất hiện một lần",()=>assert.equal(new Set(build().map(row=>row.cardId)).size,build().length));
test("tổng số thẻ bằng số dòng hiển thị",()=>{const rows=build();assert.equal(getProfitSummaryForMonth(rows).cardCount,rows.length);});
test("tổng cashback bằng tổng cashback của từng thẻ",()=>assert.equal(getProfitSummaryForMonth(build()).totalCashback,1_000_000));
test("tổng phí Host bằng tổng phí của từng thẻ",()=>assert.equal(getProfitSummaryForMonth(build()).totalHostFee,300_000));
test("tổng phí Host của tab khớp Dashboard",()=>{
  const rows=build(),tab=getProfitSummaryForMonth(rows),dashboard=getDashboardSummary({cards,cardRows:[],transactions,cashbackReceipts:receipts,year:2026,month:9});
  assert.equal(tab.totalHostFee,dashboard.monthlyHostFee);
});
test("tổng cashback của tab khớp Dashboard",()=>{
  const rows=build(),tab=getProfitSummaryForMonth(rows),dashboard=getDashboardSummary({cards,cardRows:[],transactions,cashbackReceipts:receipts,year:2026,month:9});
  assert.equal(tab.totalCashback,dashboard.monthlyActualCashback);
});
test("thẻ có cashback và phí Host đều bằng 0 vẫn xuất hiện",()=>assert.deepEqual(build().find(row=>row.cardId==="CARD-C"),{cardId:"CARD-C",cashbackAmount:0,hostFeeAmount:0,cashbackDate:"",note:"",receiptIds:[],editableReceiptId:""}));
test("nhiều cashback được cộng, lấy ngày mới nhất và ghép ghi chú theo ngày",()=>{
  assert.deepEqual(build().find(row=>row.cardId==="CARD-A"),{cardId:"CARD-A",cashbackAmount:1_000_000,hostFeeAmount:300_000,cashbackDate:"2026-09-20",note:"Đợt 1 · Đợt 2",receiptIds:["CB-A1","CB-A2"],editableReceiptId:""});
});
test("helper không thay đổi dữ liệu cashback persisted",()=>{
  const snapshot=structuredClone(receipts);build();assert.deepEqual(receipts,snapshot);
});
test("Card ID lịch sử vẫn hiển thị để tổng tab khớp Dashboard",()=>{
  const legacyRows=build({
    transactions:[...transactions,{id:"TX-OLD",date:"2026-09-08",cardId:" CARD-OLD ",amount:1_000_000,hostFeeAmount:123_000,status:"host_back",orderType:"STANDARD"},{id:"TX-UNKNOWN",date:"2026-09-08",cardId:"",amount:500_000,hostFeeAmount:50_000,status:"host_back",orderType:"STANDARD"}],
    receipts:[...receipts,{id:"CB-OLD",date:"2026-09-09",cardId:"CARD-OLD",amount:456_000,notes:"Dữ liệu cũ"},{id:"CB-UNKNOWN",date:"2026-09-09",cardId:" ",amount:44_000,notes:"Thiếu Card ID"}]
  });
  assert.deepEqual(legacyRows.find(row=>row.cardId==="CARD-OLD"),{cardId:"CARD-OLD",cashbackAmount:456_000,hostFeeAmount:123_000,cashbackDate:"2026-09-09",note:"Dữ liệu cũ",receiptIds:["CB-OLD"],editableReceiptId:"CB-OLD"});
  assert.deepEqual(legacyRows.find(row=>row.cardId==="Không xác định"),{cardId:"Không xác định",cashbackAmount:44_000,hostFeeAmount:50_000,cashbackDate:"2026-09-09",note:"Thiếu Card ID",receiptIds:["CB-UNKNOWN"],editableReceiptId:"CB-UNKNOWN"});
  assert.deepEqual(getProfitSummaryForMonth(legacyRows),{cardCount:5,totalCashback:1_500_000,totalHostFee:473_000});
});
