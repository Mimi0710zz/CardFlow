import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardSummary, getDashboardSummaryRows } from "../services/dashboard-summary.js";

const cards=[{id:"CARD-A",cardType:"credit"},{id:"CARD-B",cardType:"credit"},{id:"CARD-C",cardType:"credit"}];
const cardRows=[
  {id:"CARD-A",cardType:"credit",limitGroupId:"SHARED",groupLimit:100_000_000,debt:20_000_000},
  {id:"CARD-B",cardType:"credit",limitGroupId:"SHARED",groupLimit:100_000_000,debt:10_000_000},
  {id:"CARD-C",cardType:"credit",limitGroupId:"OWN",groupLimit:50_000_000,debt:5_000_000}
];

function summary(overrides={}){
  return getDashboardSummary({cards,cardRows,year:2026,month:9,transactions:[],cashbackReceipts:[],...overrides});
}

test("lợi nhuận tháng bằng cashback thực nhận trừ phí Host đã chuẩn hóa",()=>{
  const result=summary({transactions:[{date:"2026-09-10",amount:5_000_000,hostFeeAmount:450_000,returnAmount:4_000_000,status:"host_back",orderType:"STANDARD"}],cashbackReceipts:[{date:"2026-09-15",amount:2_000_000}]});
  assert.equal(result.monthlyHostFee,450_000,"không suy phí 1.000.000 từ tiền về");
  assert.equal(result.monthlyActualProfit,1_550_000);
});

test("cashback bằng 0 cho lợi nhuận âm bằng phí Host",()=>{
  assert.equal(summary({transactions:[{date:"2026-09-01",amount:1_000_000,hostFeeAmount:100_000,returnAmount:900_000,status:"host_back",orderType:"STANDARD"}]}).monthlyActualProfit,-100_000);
});

test("phí Host bằng 0 giữ nguyên cashback thực nhận",()=>{
  assert.equal(summary({cashbackReceipts:[{date:"2026-09-01",amount:300_000}]}).monthlyActualProfit,300_000);
});

test("lợi nhuận tháng có thể âm",()=>{
  assert.equal(summary({transactions:[{date:"2026-09-02",amount:2_000_000,hostFeeAmount:500_000,returnAmount:1_500_000,status:"host_back",orderType:"STANDARD"}],cashbackReceipts:[{date:"2026-09-03",amount:100_000}]}).monthlyActualProfit,-400_000);
});

test("hạn mức dùng chung không bị đếm hai lần",()=>{
  assert.equal(summary().totalLimit,150_000_000);
});

test("hạn mức khả dụng bằng tổng hạn mức trừ tổng dư nợ",()=>{
  const result=summary();
  assert.equal(result.totalOutstanding,35_000_000);
  assert.equal(result.totalAvailableLimit,115_000_000);
});

test("phí Host chỉ lấy giao dịch thuộc tháng đang tổng hợp",()=>{
  assert.equal(summary({transactions:[{date:"2026-09-30",amount:2_000_000,hostFeeAmount:200_000,status:"host_back",orderType:"STANDARD"},{date:"2026-10-01",amount:3_000_000,hostFeeAmount:300_000,status:"host_back",orderType:"STANDARD"}]}).monthlyHostFee,200_000);
});

test("cashback thực nhận chỉ lấy bản ghi thuộc tháng đang tổng hợp",()=>{
  assert.equal(summary({cashbackReceipts:[{date:"2026-09-30",amount:700_000},{date:"2026-10-01",amount:900_000}]}).monthlyActualCashback,700_000);
});

test("dòng tổng lợi nhuận dùng đúng giá trị của KPI lợi nhuận tháng",()=>{
  const result=summary({transactions:[{date:"2026-09-02",amount:2_000_000,hostFeeAmount:300_000,status:"host_back",orderType:"STANDARD"}],cashbackReceipts:[{date:"2026-09-03",amount:100_000}]});
  const rows=getDashboardSummaryRows(result);
  assert.equal(rows.at(-1).value,result.monthlyActualProfit);
  assert.equal(rows.at(-1).tone,"negative");
  assert.deepEqual(rows.map(row=>row.label),["Tổng số thẻ","Tổng hạn mức","Tổng tiền sao kê kỳ này","Tổng tiền đã thanh toán thẻ","Tổng dư nợ sau thanh toán sao kê","Tổng hạn mức khả dụng","Tổng tiền đơn","Tổng host back","Tổng phí Host trong tháng","Tổng CB thực nhận trong tháng","Tổng lợi nhuận thực tế trong tháng"]);
});

test("quy tắc loại giao dịch hiện có không thay đổi",()=>{
  const result=summary({transactions:[
    {date:"2026-09-02",amount:2_000_000,hostFeeAmount:200_000,returnAmount:1_800_000,status:"host_back",orderType:"STANDARD"},
    {date:"2026-09-03",amount:4_000_000,hostFeeAmount:400_000,returnAmount:3_600_000,status:"host_back",orderType:"BUG-LAZADA"},
    {date:"2026-09-04",amount:1_000_000,returnAmount:500_000,status:"host_back",orderType:"STANDARD"}
  ]});
  assert.equal(result.totalOrderAmount,3_000_000);
  assert.equal(result.totalHostBack,2_300_000);
  assert.equal(result.monthlyHostFee,200_000,"không suy ngược phí khi hostFeeAmount bị thiếu");
});


test("tổng hợp sao kê lấy dữ liệu bảng Thanh toán thẻ và dư nợ sau thanh toán = dư nợ giao dịch - đã thanh toán",()=>{
  const result=getDashboardSummary({
    cards:[{id:"CARD-A",cardType:"credit",statementDay:20},{id:"CARD-B",cardType:"debit",statementDay:""}],
    cardRows:[{id:"CARD-A",cardType:"credit",limitGroupId:"A",groupLimit:50_000_000,debt:0}],
    year:2026,
    month:9,
    transactions:[
      {date:"2026-09-10",cardId:"CARD-A",amount:10_000_000,status:"host_back",orderType:"STANDARD"},
      {date:"2026-09-12",cardId:"CARD-B",amount:7_000_000,status:"host_back",orderType:"STANDARD"}
    ],
    payments:[{cardId:"CARD-A",statementYear:2026,statementMonth:9,statementCycle:"2026-09",statementBillAmount:9_000_000,billRecorded:true,paidAmount:4_000_000}],
    cashbackReceipts:[]
  });
  assert.equal(result.currentStatementTotal,9_000_000);
  assert.equal(result.currentPaidTotal,4_000_000);
  assert.equal(result.transactionDebtTotal,10_000_000,"chỉ tính giao dịch thẻ tín dụng thuộc kỳ sao kê đang tổng hợp");
  assert.equal(result.remainingDebtAfterPayment,6_000_000);
  const labels=getDashboardSummaryRows(result).map(row=>row.label);
  assert.equal(labels.includes("Tổng dư nợ"),false);
});
