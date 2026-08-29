import { formatDateDisplay, toStorageDate } from "./date.js";

const DAY_MS=24*60*60*1000;

export function paymentCycleFromDate(value=new Date()){
  return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}`;
}

export function isValidPaymentCycle(value){
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value||""));
}

function cycleDate(cycle){
  if(!isValidPaymentCycle(cycle)) return null;
  const [year,month]=cycle.split("-").map(Number);
  return new Date(year,month-1,1);
}

export function getEffectiveMonthlyDay(year,month,configuredDay){
  const day=Number(configuredDay),numericYear=Number(year),numericMonth=Number(month);
  if(!Number.isInteger(day)||day<1||day>31||!Number.isInteger(numericYear)||!Number.isInteger(numericMonth)||numericMonth<1||numericMonth>12) return null;
  const lastDay=new Date(numericYear,numericMonth,0).getDate();
  return new Date(numericYear,numericMonth-1,Math.min(day,lastDay));
}

export function effectivePaymentDueDate(paymentDueDay,today=new Date()){
  return getEffectiveMonthlyDay(today.getFullYear(),today.getMonth()+1,paymentDueDay);
}

export function getStatementCycleForTransaction(transactionDate,statementDay){
  const storageDate=toStorageDate(transactionDate);
  if(!storageDate) return null;
  const [year,month,day]=storageDate.split("-").map(Number);
  const statementDate=getEffectiveMonthlyDay(year,month,statementDay);
  if(!statementDate) return null;
  const transactionDay=new Date(year,month-1,day);
  const statementDateAmbiguous=transactionDay.getTime()===statementDate.getTime();
  const statementCycleDate=transactionDay>statementDate ? new Date(year,month,1) : new Date(year,month-1,1);
  return {cycle:paymentCycleFromDate(statementCycleDate),statementDate,statementDateAmbiguous};
}

export function effectivePaymentDueDateForCycle(paymentDueDay,cycle){
  const statementCycle=cycleDate(cycle);
  if(!statementCycle) return null;
  const dueMonth=new Date(statementCycle.getFullYear(),statementCycle.getMonth()+1,1);
  return getEffectiveMonthlyDay(dueMonth.getFullYear(),dueMonth.getMonth()+1,paymentDueDay);
}

export function buildCardPaymentObligations(cards=[],transactions=[],payments=[]){
  const cardsById=new Map(cards.filter(card=>card.cardType!=="debit").map(card=>[card.id,card]));
  const groups=new Map();
  transactions.forEach(transaction=>{
    const card=cardsById.get(transaction.cardId);
    if(!card) return;
    const cycleInfo=getStatementCycleForTransaction(transaction.date,card.statementDay);
    const dueDate=cycleInfo?effectivePaymentDueDateForCycle(card.paymentDueDay,cycleInfo.cycle):null;
    if(!cycleInfo||!dueDate) return;
    const key=`${card.id}|${cycleInfo.cycle}`;
    if(!groups.has(key)) groups.set(key,{key,card,cardId:card.id,cycle:cycleInfo.cycle,dueDate,transactionIds:[],transactionAmount:0,paymentAmount:0,outstandingAmount:0,paid:false,statementDateAmbiguous:false,ambiguousTransactionDates:[]});
    const obligation=groups.get(key);
    obligation.transactionIds.push(transaction.id);
    obligation.transactionAmount+=Number(transaction.amount)||0;
    if(cycleInfo.statementDateAmbiguous){
      obligation.statementDateAmbiguous=true;
      obligation.ambiguousTransactionDates.push(toStorageDate(transaction.date));
    }
  });
  payments.forEach(payment=>{
    if(!isValidPaymentCycle(payment.paymentCycle)) return;
    const obligation=groups.get(`${payment.cardId}|${payment.paymentCycle}`);
    if(!obligation) return;
    obligation.paymentAmount+=Number(payment.amount)||0;
    if(payment.paymentStatus==="paid") obligation.paid=true;
  });
  groups.forEach(obligation=>{
    obligation.outstandingAmount=obligation.paid?0:Math.max(0,obligation.transactionAmount-obligation.paymentAmount);
  });
  return [...groups.values()].sort((a,b)=>a.dueDate-b.dueDate||a.cardId.localeCompare(b.cardId,"vi"));
}

export function calculatePaymentCycleWarning(card,cycle,today=new Date(),details={}){
  const dueDate=effectivePaymentDueDateForCycle(card?.paymentDueDay,cycle);
  if(!dueDate) return null;
  const dueDayNumber=Date.UTC(dueDate.getFullYear(),dueDate.getMonth(),dueDate.getDate());
  const currentDayNumber=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
  const daysUntilDue=Math.round((dueDayNumber-currentDayNumber)/DAY_MS);
  if(daysUntilDue>7) return null;
  return {card,cycle,dueDate,daysUntilDue,overdueDays:Math.max(0,-daysUntilDue),status:daysUntilDue<0?"overdue":daysUntilDue===0?"today":"upcoming",...details};
}

export function calculatePaymentDueWarning(card,today=new Date()){
  return calculatePaymentCycleWarning(card,paymentCycleFromDate(today),today);
}

export function calculatePaymentDueWarnings(cards=[],transactions=[],payments=[],today=new Date()){
  const warnings=buildCardPaymentObligations(cards,transactions,payments).filter(obligation=>obligation.outstandingAmount>0).map(obligation=>calculatePaymentCycleWarning(obligation.card,obligation.cycle,today,{obligation,outstandingAmount:obligation.outstandingAmount,statementDateAmbiguous:obligation.statementDateAmbiguous})).filter(Boolean);
  return sortPaymentDueWarnings(warnings);
}

export function calculateStatementDateAdvisories(cards=[],transactions=[]){
  const cardsById=new Map(cards.filter(card=>card.cardType!=="debit").map(card=>[card.id,card]));
  return transactions.flatMap(transaction=>{
    const card=cardsById.get(transaction.cardId);
    if(!card) return [];
    const cycleInfo=getStatementCycleForTransaction(transaction.date,card.statementDay);
    return cycleInfo?.statementDateAmbiguous?[{card,transaction,cycle:cycleInfo.cycle,statementDate:cycleInfo.statementDate}]:[];
  });
}

export function statementDateAdvisoryText(advisory,cardLabel){
  return `${cardLabel} có giao dịch đúng ngày sao kê ${formatDateDisplay(advisory.transaction.date)}. Nên kiểm tra sao kê trước khi xác định kỳ thanh toán.`;
}

export function paymentDueWarningText(warning,cardLabel){
  const dueDate=formatDateDisplay(warning.dueDate);
  const [year,month]=String(warning.cycle||"").split("-");
  const cycleLabel=year&&month?`${month}/${year}`:warning.cycle;
  let text;
  if(warning.status==="overdue") text=`${cardLabel} - kỳ ${cycleLabel} đã quá hạn thanh toán ${warning.overdueDays} ngày (${dueDate}).`;
  else if(warning.status==="today") text=`${cardLabel} - kỳ ${cycleLabel} đến hạn thanh toán hôm nay (${dueDate}).`;
  else text=`${cardLabel} - kỳ ${cycleLabel} còn ${warning.daysUntilDue} ngày đến hạn thanh toán (${dueDate}).`;
  if(warning.statementDateAmbiguous) text+=" Có giao dịch trùng ngày sao kê trong kỳ này. Hãy kiểm tra sao kê ngân hàng.";
  return text;
}

export function sortPaymentDueWarnings(warnings=[]){
  const priority={overdue:0,today:1,upcoming:2};
  return [...warnings].sort((a,b)=>(priority[a.status]-priority[b.status])||(a.daysUntilDue-b.daysUntilDue)||String(a.card?.id||"").localeCompare(String(b.card?.id||""),"vi"));
}
