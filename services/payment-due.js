import { formatDateDisplay } from "./date.js";

export function effectivePaymentDueDate(paymentDueDay, today = new Date()){
  const day = Number(paymentDueDay);
  if(!Number.isInteger(day) || day < 1 || day > 31) return null;
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return new Date(today.getFullYear(), today.getMonth(), Math.min(day, lastDay));
}

export function paymentCycleFromDate(value = new Date()){
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2,"0")}`;
}

export function isValidPaymentCycle(value){
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ""));
}

function cycleDate(cycle){
  if(!isValidPaymentCycle(cycle)) return null;
  const [year,month]=cycle.split("-").map(Number);
  return new Date(year,month-1,1);
}

function nextCycle(cycle){
  const date=cycleDate(cycle);
  if(!date) return "";
  return paymentCycleFromDate(new Date(date.getFullYear(),date.getMonth()+1,1));
}

export function effectivePaymentDueDateForCycle(paymentDueDay, cycle){
  const date=cycleDate(cycle);
  return date ? effectivePaymentDueDate(paymentDueDay,date) : null;
}

export function calculatePaymentDueWarning(card, today = new Date()){
  return calculatePaymentCycleWarning(card,paymentCycleFromDate(today),today);
}

export function calculatePaymentCycleWarning(card, cycle, today = new Date()){
  const dueDate = effectivePaymentDueDateForCycle(card?.paymentDueDay,cycle);
  if(!dueDate) return null;
  const dueDayNumber = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const currentDayNumber = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntilDue = Math.round((dueDayNumber - currentDayNumber) / (24 * 60 * 60 * 1000));
  if(daysUntilDue > 7) return null;
  return {
    card,
    cycle,
    dueDate,
    daysUntilDue,
    overdueDays:Math.max(0, -daysUntilDue),
    status:daysUntilDue < 0 ? "overdue" : daysUntilDue === 0 ? "today" : "upcoming"
  };
}

export function calculatePaymentDueWarnings(cards = [], payments = [], today = new Date()){
  const currentCycle=paymentCycleFromDate(today);
  const paidCycles=new Set(payments.filter(payment=>payment.paymentStatus==="paid" && isValidPaymentCycle(payment.paymentCycle)).map(payment=>`${payment.cardId}|${payment.paymentCycle}`));
  const warnings=[];
  cards.forEach(card=>{
    let cycle=isValidPaymentCycle(card?.paymentTrackingStartMonth) ? card.paymentTrackingStartMonth : currentCycle;
    while(cycle <= currentCycle){
      if(!paidCycles.has(`${card.id}|${cycle}`)){
        const warning=calculatePaymentCycleWarning(card,cycle,today);
        if(warning) warnings.push(warning);
      }
      cycle=nextCycle(cycle);
    }
  });
  return sortPaymentDueWarnings(warnings);
}

export function paymentDueWarningText(warning, cardLabel){
  const dueDate = formatDateDisplay(warning.dueDate);
  if(warning.status === "overdue") return `${cardLabel} đã quá hạn thanh toán kỳ ${warning.cycle} ${warning.overdueDays} ngày (${dueDate}).`;
  if(warning.status === "today") return `${cardLabel} đến hạn thanh toán hôm nay (${dueDate}).`;
  return `${cardLabel} còn ${warning.daysUntilDue} ngày đến hạn thanh toán (${dueDate}).`;
}

export function sortPaymentDueWarnings(warnings = []){
  const priority = {overdue:0, today:1, upcoming:2};
  return [...warnings].sort((a,b)=>(priority[a.status]-priority[b.status]) || (a.daysUntilDue-b.daysUntilDue) || String(a.card?.id || "").localeCompare(String(b.card?.id || "")));
}
