import assert from "node:assert/strict";
import {
  buildStatementPaymentRows,
  deriveStatementPeriod,
  formatDayMonth,
  normalizeStatementPayment,
  paymentReminderForRow,
  paymentStatusForAmounts,
  paymentStatusLabel,
  statementPaymentDueDate,
  summarizeStatementPaymentRows
} from "../services/payment-statement.js";

const card={id:"CARD-1",bankId:"BANK",cardType:"credit",statementDay:20,paymentDueDay:5};

assert.deepEqual(deriveStatementPeriod(card,2026,9),{
  cycle:"2026-09",
  startDate:"2026-08-20",
  endDate:"2026-09-20",
  label:"20/08 - 20/09"
});

assert.deepEqual(deriveStatementPeriod(card,2026,1),{
  cycle:"2026-01",
  startDate:"2025-12-20",
  endDate:"2026-01-20",
  label:"20/12 - 20/01"
});

assert.equal(statementPaymentDueDate(card,2026,9),"2026-10-05");
assert.equal(statementPaymentDueDate(card,2026,12),"2027-01-05");
assert.equal(formatDayMonth("2027-01-05"),"05/01");

assert.equal(paymentStatusForAmounts(10000000,10000000),"paid");
assert.equal(paymentStatusForAmounts(10000000,12000000),"paid");
assert.equal(paymentStatusForAmounts(10000000,5000000),"unpaid");
assert.equal(paymentStatusForAmounts(0,0),"unpaid");
assert.equal(paymentStatusLabel("paid"),"Đã thanh toán");
assert.equal(paymentStatusLabel("unpaid"),"Chưa thanh toán");
assert.deepEqual(paymentReminderForRow({status:"paid",billAmount:10000000,dueDate:"2026-09-01",today:"2026-09-04"}),{text:"Đã hoàn tất",tone:"paid",daysUntilDue:null});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billAmount:10000000,dueDate:"2026-09-13",today:"2026-09-01"}),{text:"Còn 12 ngày đến hạn thanh toán",tone:"normal",daysUntilDue:12});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billAmount:10000000,dueDate:"2026-09-03",today:"2026-09-01"}),{text:"Còn 2 ngày đến hạn thanh toán",tone:"urgent",daysUntilDue:2});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billAmount:10000000,dueDate:"2026-09-01",today:"2026-09-01"}),{text:"Đến hạn thanh toán hôm nay",tone:"overdue",daysUntilDue:0});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billAmount:10000000,dueDate:"2026-08-29",today:"2026-09-01"}),{text:"Quá hạn 3 ngày",tone:"overdue",daysUntilDue:-3});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billAmount:0,dueDate:"2026-09-01",today:"2026-09-01"}),{text:"Chưa có Bill sao kê",tone:"neutral",daysUntilDue:null});

assert.equal(normalizeStatementPayment({cardId:"CARD-1",statementYear:2026,statementMonth:9,statementBillAmount:10000000,paidAmount:7000000}).outstandingAmount,-3000000);
assert.equal(normalizeStatementPayment({cardId:"CARD-1",statementYear:2026,statementMonth:9,statementBillAmount:10000000,paidAmount:10000000}).outstandingAmount,0);
assert.equal(normalizeStatementPayment({cardId:"CARD-1",statementYear:2026,statementMonth:9,statementBillAmount:10000000,paidAmount:12000000}).outstandingAmount,2000000);

const rows=buildStatementPaymentRows(
  [
    card,
    {id:"CARD-2",bankId:"BANK",cardType:"credit",statementDay:20,paymentDueDay:5},
    {id:"DEBIT",bankId:"BANK",cardType:"debit",statementDay:"",paymentDueDay:null}
  ],
  [
    {cardId:"CARD-1",statementYear:2026,statementMonth:9,statementBillAmount:10000000,paidAmount:7000000,paymentDate:"2026-10-01"},
    {cardId:"CARD-1",statementYear:2026,statementMonth:10,statementBillAmount:5000000,paidAmount:5000000,paymentDate:"2026-11-01"},
    {cardId:"CARD-2",statementYear:2026,statementMonth:9,statementBillAmount:3000000,paidAmount:4000000,paymentDate:"2026-10-02"}
  ],
  2026,
  9
);

assert.deepEqual(rows.map(row=>row.cardId),["CARD-1","CARD-2"]);
assert.equal(rows[0].statementBillAmount,10000000);
assert.equal(rows[0].paidAmount,7000000);
assert.equal(rows[0].paymentDate,"2026-10-01");
assert.equal(rows[0].outstandingAmount,-3000000);
assert.equal(rows[0].paymentStatusCode,"unpaid");
assert.equal(rows[1].paymentStatusCode,"paid");
assert.equal(rows[1].outstandingAmount,1000000);
assert.deepEqual(summarizeStatementPaymentRows(rows),{
  count:2,
  statementBillAmount:13000000,
  paidAmount:11000000,
  outstandingAmount:-2000000
});

const octoberRows=buildStatementPaymentRows([card],[
  {cardId:"CARD-1",statementYear:2026,statementMonth:9,statementBillAmount:10000000,paidAmount:7000000},
  {cardId:"CARD-1",statementYear:2026,statementMonth:10,statementBillAmount:5000000,paidAmount:5000000}
],2026,10);
assert.equal(octoberRows[0].statementBillAmount,5000000);
assert.equal(octoberRows[0].paidAmount,5000000);
assert.equal(octoberRows[0].outstandingAmount,0);
assert.equal(octoberRows[0].paymentStatusCode,"paid");

const paidRows=buildStatementPaymentRows([card],[
  {cardId:"CARD-1",statementYear:2026,statementMonth:9,statementBillAmount:10000000,paidAmount:10000000}
],2026,9,{status:"paid"},{today:"2026-09-01"});
assert.deepEqual(paidRows.map(row=>row.cardId),["CARD-1"]);
const unpaidRows=buildStatementPaymentRows([card],[
  {cardId:"CARD-1",statementYear:2026,statementMonth:9,statementBillAmount:10000000,paidAmount:5000000}
],2026,9,{status:"paid"},{today:"2026-09-01"});
assert.equal(unpaidRows.length,0);

const rolloverRow=buildStatementPaymentRows([card],[
  {cardId:"CARD-1",statementYear:2026,statementMonth:1,statementBillAmount:10000000,paidAmount:5000000}
],2026,1,{}, {today:"2026-02-01"})[0];
assert.equal(rolloverRow.dueDate,"2026-02-05");
assert.equal(rolloverRow.paymentDaysUntilDue,4);

console.log("payment-statement tests passed");
