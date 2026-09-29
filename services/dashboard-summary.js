import { summarizeCardStatusRows } from "./card-status-summary.js";
import { calculateDashboardHostBackMetrics, isDashboardHostBackTransaction } from "./dashboard-host-back.js";
import { financialTransactions } from "./financial-totals.js";
import { toStorageDate } from "./date.js";

function belongsToMonth(value,year,month){
  const date=toStorageDate(value);
  return date.slice(0,7)===`${Number(year)}-${String(Number(month)).padStart(2,"0")}`;
}

function sum(rows,value){
  return rows.reduce((total,row)=>total+(Number(value(row))||0),0);
}

export function getDashboardSummary({cards=[],cardRows=[],transactions=[],cashbackReceipts=[],year,month}={}){
  const monthlyTransactions=financialTransactions(transactions).filter(transaction=>belongsToMonth(transaction.date,year,month));
  const monthlyCashbackReceipts=cashbackReceipts.filter(receipt=>belongsToMonth(receipt.date,year,month));
  const cardSummary=summarizeCardStatusRows(cardRows);
  const hostBackMetrics=calculateDashboardHostBackMetrics(monthlyTransactions);
  const monthlyHostFee=sum(monthlyTransactions.filter(isDashboardHostBackTransaction),transaction=>transaction.hostFeeAmount);
  const monthlyActualCashback=sum(monthlyCashbackReceipts,receipt=>receipt.amount);
  const monthlyActualProfit=monthlyActualCashback-monthlyHostFee;

  return {
    cardCount:cards.length,
    totalLimit:cardSummary.totalLimit,
    totalOutstanding:cardSummary.outstanding,
    totalAvailableLimit:cardSummary.totalLimit-cardSummary.outstanding,
    totalOrderAmount:sum(monthlyTransactions,transaction=>transaction.amount),
    totalHostBack:hostBackMetrics.hostBack,
    monthlyHostFee,
    monthlyActualCashback,
    monthlyActualProfit,
    waitingHostBack:hostBackMetrics.waiting,
    waitingHostBackCount:hostBackMetrics.waitingCount
  };
}

export function getDashboardSummaryRows(summary={}){
  const profit=Number(summary.monthlyActualProfit)||0;
  return [
    {label:"Tổng số thẻ",value:Number(summary.cardCount)||0,unit:"card"},
    {label:"Tổng hạn mức",value:Number(summary.totalLimit)||0},
    {label:"Tổng dư nợ",value:Number(summary.totalOutstanding)||0},
    {label:"Tổng hạn mức khả dụng",value:Number(summary.totalAvailableLimit)||0},
    {label:"Tổng tiền đơn",value:Number(summary.totalOrderAmount)||0,divider:true},
    {label:"Tổng host back",value:Number(summary.totalHostBack)||0},
    {label:"Tổng phí Host trong tháng",value:Number(summary.monthlyHostFee)||0,tone:"expense"},
    {label:"Tổng CB thực nhận trong tháng",value:Number(summary.monthlyActualCashback)||0,tone:"positive"},
    {label:"Tổng lợi nhuận thực tế trong tháng",value:profit,tone:profit>0?"positive":profit<0?"negative":"neutral",emphasis:true}
  ];
}
