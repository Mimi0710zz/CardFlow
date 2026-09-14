import assert from "node:assert/strict";
import {
  buildStatementPaymentRows,
  deriveStatementPeriod,
  formatDayMonth,
  normalizeStatementPayment,
  paymentReminderForRow,
  reminderUrgencyTone,
  paymentStatusForAmounts,
  paymentStatusLabel,
  getStatementPeriod,
  statementPaymentDueDate,
  summarizeStatementPaymentRows
} from "../services/payment-statement.js";
import { normalizePaymentTermDays } from "../services/payment-due.js";
import { canonicalizeData, canonicalizeDataWithMigration } from "../services/local-repository.js";

const card={id:"CARD-1",bankId:"BANK",cardType:"credit",statementDay:20,paymentDueDay:5,paymentTermDays:15};

assert.equal(normalizePaymentTermDays(45),45);
assert.equal(normalizePaymentTermDays("55 ngày"),55);
assert.equal(normalizePaymentTermDays("50"),50);
assert.equal(normalizePaymentTermDays("50 ngày"),50);
assert.equal(normalizePaymentTermDays(1),1);
assert.equal(normalizePaymentTermDays(0),null);
assert.equal(normalizePaymentTermDays(-10),null);
assert.equal(normalizePaymentTermDays(45.5),null);
assert.equal(normalizePaymentTermDays("abc"),null);
assert.equal(normalizePaymentTermDays(""),null);
const persisted=canonicalizeData({schemaVersion:13,banks:[{id:"BANK",code:"BANK",name:"Bank"}],cards:[
  {id:"CONFIGURED",bankId:"BANK",cardType:"credit",statementDay:10,paymentTermDays:"45"},
  {id:"LEGACY-55",bankId:"BANK",cardType:"credit",statementDay:10,paymentTermDays:"55 ngày"},
  {id:"CUSTOM",bankId:"BANK",cardType:"credit",statementDay:10,paymentTermDays:"50 ngày"},
  {id:"LEGACY",bankId:"BANK",cardType:"credit",statementDay:10}
]});
assert.equal(persisted.cards.find(item=>item.id==="CONFIGURED").paymentTermDays,15);
assert.equal(persisted.cards.find(item=>item.id==="LEGACY-55").paymentTermDays,25);
assert.equal(persisted.cards.find(item=>item.id==="CUSTOM").paymentTermDays,50);
assert.equal(persisted.cards.find(item=>item.id==="LEGACY").paymentTermDays,null);
const persistedAgain=canonicalizeData(persisted);
assert.equal(persistedAgain.cards.find(item=>item.id==="CONFIGURED").paymentTermDays,15);
assert.equal(persistedAgain.cards.find(item=>item.id==="LEGACY-55").paymentTermDays,25);

assert.deepEqual(getStatementPeriod({...card,statementDay:10},2026,9),{
  cycle:"2026-09",
  startDate:"2026-08-11",
  endDate:"2026-09-10",
  label:"11/08 - 10/09"
});
assert.deepEqual(getStatementPeriod({statementDay:31},2026,3),{
  cycle:"2026-03",
  startDate:"2026-03-01",
  endDate:"2026-03-31",
  label:"01/03 - 31/03"
});

assert.deepEqual(deriveStatementPeriod(card,2026,9),{
  cycle:"2026-09",
  startDate:"2026-08-21",
  endDate:"2026-09-20",
  label:"21/08 - 20/09"
});

assert.deepEqual(deriveStatementPeriod(card,2026,1),{
  cycle:"2026-01",
  startDate:"2025-12-21",
  endDate:"2026-01-20",
  label:"21/12 - 20/01"
});

assert.equal(statementPaymentDueDate({...card,statementDay:10,paymentTermDays:15},2026,9),"2026-09-25");
assert.equal(statementPaymentDueDate({...card,statementDay:20,paymentTermDays:15},2026,9),"2026-10-05");
assert.equal(statementPaymentDueDate({...card,statementDay:10,paymentTermDays:50},2026,9),"2026-10-30");
assert.equal(statementPaymentDueDate({...card,statementDay:10,paymentTermDays:25},2026,9),"2026-10-05");
assert.equal(statementPaymentDueDate({...card,statementDay:10,paymentTermDays:1},2026,9),"2026-09-11");
assert.equal(statementPaymentDueDate(card,2026,12),"2027-01-04");
assert.equal(statementPaymentDueDate({...card,paymentTermDays:null},2026,9),"");
const mbPlaRow=buildStatementPaymentRows([{id:"MB Pla",bankId:"BANK",cardType:"credit",statementDay:10,paymentTermDays:15}],[],2026,9,{}, {today:"2026-09-01"})[0];
assert.equal(mbPlaRow.statementPeriodLabel,"11/08 - 10/09");
assert.equal(mbPlaRow.dueDate,"2026-09-25");
assert.equal(mbPlaRow.dueDateLabel,"25/09");
assert.equal(formatDayMonth("2027-01-05"),"05/01");

assert.equal(paymentStatusForAmounts(10000000,10000000,true),"paid");
assert.equal(paymentStatusForAmounts(10000000,12000000,true),"paid");
assert.equal(paymentStatusForAmounts(10000000,5000000,true),"unpaid");
assert.equal(paymentStatusForAmounts(0,0,false),"unrecorded");
assert.equal(paymentStatusForAmounts(0,0,true),"zero-bill");
assert.equal(paymentStatusLabel("paid"),"Đã thanh toán");
assert.equal(paymentStatusLabel("unpaid"),"Chưa thanh toán");
assert.equal(paymentStatusLabel("unrecorded"),"Chưa có Bill sao kê");
assert.equal(paymentStatusLabel("zero-bill"),"Không phát sinh dư nợ");
assert.equal(reminderUrgencyTone(12),"normal");
assert.equal(reminderUrgencyTone(8),"warning");
assert.equal(reminderUrgencyTone(4),"strong-warning");
assert.equal(reminderUrgencyTone(2),"urgent");
assert.equal(reminderUrgencyTone(0),"overdue");
assert.deepEqual(paymentReminderForRow({status:"paid",billRecorded:true,billAmount:10000000,dueDate:"2026-09-01",today:"2026-09-04"}),{text:"Đã hoàn tất",tone:"paid",daysUntilDue:null});
assert.deepEqual(paymentReminderForRow({status:"zero-bill",billRecorded:true,billAmount:0,dueDate:"2026-09-01",today:"2026-09-04"}),{text:"Đã kiểm tra sao kê - không phát sinh dư nợ",tone:"paid",daysUntilDue:null});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billRecorded:true,billAmount:10000000,paymentTermDays:45,dueDate:"2026-09-13",today:"2026-09-01"}),{text:"Còn 12 ngày đến hạn thanh toán",tone:"normal",daysUntilDue:12});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billRecorded:true,billAmount:10000000,paymentTermDays:45,dueDate:"2026-09-03",today:"2026-09-01"}),{text:"Còn 2 ngày đến hạn thanh toán",tone:"urgent",daysUntilDue:2});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billRecorded:true,billAmount:10000000,paymentTermDays:45,dueDate:"2026-09-01",today:"2026-09-01"}),{text:"Đến hạn thanh toán hôm nay",tone:"overdue",daysUntilDue:0});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billRecorded:true,billAmount:10000000,paymentTermDays:45,dueDate:"2026-08-29",today:"2026-09-01"}),{text:"Quá hạn 3 ngày",tone:"overdue",daysUntilDue:-3});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billAmount:0,statementEndDate:"2026-09-20",paymentTermDays:15,dueDate:"2026-10-05",today:"2026-09-08"}),{text:"Còn 12 ngày đến kỳ sao kê",tone:"normal",daysUntilDue:null});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billAmount:0,statementEndDate:"2026-09-20",paymentTermDays:15,dueDate:"2026-10-05",today:"2026-09-12"}),{text:"Còn 8 ngày đến kỳ sao kê",tone:"warning",daysUntilDue:null});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billAmount:0,statementEndDate:"2026-09-20",paymentTermDays:15,dueDate:"2026-10-05",today:"2026-09-16"}),{text:"Còn 4 ngày đến kỳ sao kê",tone:"strong-warning",daysUntilDue:null});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billAmount:0,statementEndDate:"2026-09-20",paymentTermDays:15,dueDate:"2026-10-05",today:"2026-09-18"}),{text:"Còn 2 ngày đến kỳ sao kê",tone:"urgent",daysUntilDue:null});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billAmount:0,statementEndDate:"2026-09-20",paymentTermDays:15,dueDate:"2026-10-05",today:"2026-09-20"}),{text:"Đến kỳ sao kê - kiểm tra sao kê trên app",tone:"overdue",daysUntilDue:null});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billAmount:0,statementEndDate:"2026-09-20",paymentTermDays:15,dueDate:"2026-10-05",today:"2026-09-22"}),{text:"Quá 2 ngày kỳ sao kê - kiểm tra sao kê trên app",tone:"overdue",daysUntilDue:null});
assert.equal(paymentReminderForRow({status:"unpaid",billRecorded:true,billAmount:4000000,paymentTermDays:15,dueDate:"2026-09-20",today:"2026-09-16"}).tone,"strong-warning");
assert.deepEqual(paymentReminderForRow({status:"unpaid",billAmount:0,paymentTermDays:15,dueDate:"2026-10-05",today:"2026-09-01"}),{text:"Chưa có Bill sao kê",tone:"neutral",daysUntilDue:null});
assert.deepEqual(paymentReminderForRow({status:"unpaid",billRecorded:true,billAmount:10000000,dueDate:"2026-09-01",today:"2026-09-01"}),{text:"Chưa thiết lập số ngày thanh toán",tone:"neutral",daysUntilDue:null});

assert.equal(normalizeStatementPayment({billAmount:0}).billRecorded,false);
assert.equal(normalizeStatementPayment({billAmount:4000000}).billRecorded,true);
assert.equal(normalizeStatementPayment({billAmount:0,billRecorded:true}).billRecorded,true);
const legacyBillMigration=canonicalizeDataWithMigration({schemaVersion:14,payments:[
  {cardId:"ZERO",statementYear:2026,statementMonth:9,billAmount:0},
  {cardId:"POSITIVE",statementYear:2026,statementMonth:9,billAmount:4000000}
]});
assert.equal(legacyBillMigration.data.payments.find(item=>item.cardId==="ZERO").billRecorded,false);
assert.equal(legacyBillMigration.data.payments.find(item=>item.cardId==="POSITIVE").billRecorded,true);
assert.equal(legacyBillMigration.changed,true);
const migratedBillAgain=canonicalizeDataWithMigration(legacyBillMigration.data);
assert.equal(migratedBillAgain.changed,false);

assert.equal(normalizeStatementPayment({cardId:"CARD-1",statementYear:2026,statementMonth:9,statementBillAmount:10000000,paidAmount:7000000}).outstandingAmount,-3000000);
assert.equal(normalizeStatementPayment({cardId:"CARD-1",statementYear:2026,statementMonth:9,statementBillAmount:10000000,paidAmount:10000000}).outstandingAmount,0);
assert.equal(normalizeStatementPayment({cardId:"CARD-1",statementYear:2026,statementMonth:9,statementBillAmount:10000000,paidAmount:12000000}).outstandingAmount,2000000);

const rows=buildStatementPaymentRows(
  [
    card,
    {id:"CARD-2",bankId:"BANK",cardType:"credit",statementDay:20,paymentDueDay:5,paymentTermDays:55},
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
const unrecordedBillRow=buildStatementPaymentRows([card],[],2026,9,{}, {today:"2026-09-17"})[0];
assert.equal(unrecordedBillRow.billRecorded,false);
assert.equal(unrecordedBillRow.paymentStatusCode,"unrecorded");
assert.equal(unrecordedBillRow.paymentReminder,"Còn 3 ngày đến kỳ sao kê");
assert.equal(unrecordedBillRow.paymentReminderTone,"strong-warning");
const zeroBillRow=buildStatementPaymentRows([card],[
  {cardId:"CARD-1",statementYear:2026,statementMonth:9,billRecorded:true,statementBillAmount:0,paidAmount:0}
],2026,9,{}, {today:"2026-10-10"})[0];
assert.equal(zeroBillRow.billRecorded,true);
assert.equal(zeroBillRow.statementBillAmount,0);
assert.equal(zeroBillRow.paidAmount,0);
assert.equal(zeroBillRow.outstandingAmount,0);
assert.equal(zeroBillRow.paymentStatusCode,"zero-bill");
assert.equal(zeroBillRow.paymentStatusLabel,"Không phát sinh dư nợ");
assert.equal(zeroBillRow.paymentReminder,"Đã kiểm tra sao kê - không phát sinh dư nợ");
const unpaidRows=buildStatementPaymentRows([card],[
  {cardId:"CARD-1",statementYear:2026,statementMonth:9,statementBillAmount:10000000,paidAmount:5000000}
],2026,9,{status:"paid"},{today:"2026-09-01"});
assert.equal(unpaidRows.length,0);

const rolloverRow=buildStatementPaymentRows([card],[
  {cardId:"CARD-1",statementYear:2026,statementMonth:1,statementBillAmount:10000000,paidAmount:5000000}
],2026,1,{}, {today:"2026-02-01"})[0];
assert.equal(rolloverRow.dueDate,"2026-02-04");
assert.equal(rolloverRow.paymentDaysUntilDue,3);

const legacyRow=buildStatementPaymentRows([{...card,paymentTermDays:null}],[
  {cardId:"CARD-1",statementYear:2026,statementMonth:9,statementBillAmount:10000000,paidAmount:5000000}
],2026,9,{}, {today:"2026-09-01"})[0];
assert.equal(legacyRow.dueDate,"");
assert.equal(legacyRow.dueDateLabel,"Chưa thiết lập");
assert.equal(legacyRow.paymentReminder,"Chưa thiết lập số ngày thanh toán");

console.log("payment-statement tests passed");
