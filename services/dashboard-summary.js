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

function cardIdKey(value){
  return String(value??"").trim()||"Không xác định";
}

export function getProfitRowsForMonth({cards=[],transactions=[],receipts=[],year,month}={}){
  const monthlyTransactions=financialTransactions(transactions).filter(transaction=>belongsToMonth(transaction.date,year,month));
  const monthlyReceipts=receipts.filter(receipt=>belongsToMonth(receipt.date,year,month));
  const cardIds=new Set(cards.map(card=>cardIdKey(card?.id)));
  monthlyTransactions.forEach(transaction=>cardIds.add(cardIdKey(transaction?.cardId)));
  monthlyReceipts.forEach(receipt=>cardIds.add(cardIdKey(receipt?.cardId)));
  return [...cardIds].sort((a,b)=>a.localeCompare(b,"vi")).map(cardId=>{
    const cardReceipts=monthlyReceipts.filter(receipt=>cardIdKey(receipt.cardId)===cardId).sort((a,b)=>String(a.date||"").localeCompare(String(b.date||""))||String(a.id||"").localeCompare(String(b.id||"")));
    const cardTransactions=monthlyTransactions.filter(transaction=>cardIdKey(transaction.cardId)===cardId&&isDashboardHostBackTransaction(transaction));
    const receiptIds=cardReceipts.map(receipt=>receipt.id).filter(Boolean);
    return {
      cardId,
      cashbackAmount:sum(cardReceipts,receipt=>receipt.amount),
      hostFeeAmount:sum(cardTransactions,transaction=>transaction.hostFeeAmount),
      profitAmount:sum(cardReceipts,receipt=>receipt.amount)-sum(cardTransactions,transaction=>transaction.hostFeeAmount),
      cashbackDate:cardReceipts.at(-1)?.date||"",
      note:cardReceipts.map(receipt=>String(receipt.notes??receipt.note??"").trim()).filter(Boolean).join(" · "),
      receiptIds,
      editableReceiptId:receiptIds.length===1?receiptIds[0]:""
    };
  });
}

export function getProfitSummaryForMonth(rows=[]){
  const totalCashback=sum(rows,row=>row.cashbackAmount);
  const totalHostFee=sum(rows,row=>row.hostFeeAmount);
  return {
    cardCount:rows.length,
    totalCashback,
    totalHostFee,
    totalProfit:totalCashback-totalHostFee
  };
}

export function updateMonthlyCashbackAmount({receipts=[],cardId,year,month,nextAmount,newReceipt}={}){
  const amount=Number(nextAmount);
  if(!Number.isFinite(amount)||amount<0)throw new Error("Số tiền cashback không hợp lệ.");
  const next=receipts.map(receipt=>({...receipt}));
  const matches=next.map((receipt,index)=>({receipt,index})).filter(item=>cardIdKey(item.receipt.cardId)===cardIdKey(cardId)&&belongsToMonth(item.receipt.date,year,month)).sort((a,b)=>String(a.receipt.date||"").localeCompare(String(b.receipt.date||""))||String(a.receipt.id||"").localeCompare(String(b.receipt.id||"")));
  if(!matches.length){
    if(!newReceipt)throw new Error("Thiếu dữ liệu để tạo khoản cashback.");
    next.push({...newReceipt,cardId,amount});
    return next;
  }
  const currentTotal=sum(matches,item=>item.receipt.amount);
  const latest=matches.at(-1),adjusted=(Number(latest.receipt.amount)||0)+(amount-currentTotal);
  if(adjusted<0)throw new Error("Giá trị mới nhỏ hơn tổng các khoản cashback trước đó.");
  next[latest.index]={...latest.receipt,amount:adjusted};
  return next;
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
