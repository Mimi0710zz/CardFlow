import { toStorageDate } from "./date.js";

function reminderId(){return `REMINDER-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
export function localReminderDate(value=new Date()){return toStorageDate(value);}
export function normalizeReminder(reminder={}){
  const now=new Date().toISOString();
  return {id:String(reminder.id||reminderId()),cardId:String(reminder.cardId||"").trim(),title:String(reminder.title||"").trim(),content:String(reminder.content||"").trim(),startDate:toStorageDate(reminder.startDate),endDate:toStorageDate(reminder.endDate),createdAt:String(reminder.createdAt||now),updatedAt:String(reminder.updatedAt||reminder.createdAt||now)};
}
export function validateReminder(reminder={}){
  const errors=[];
  if(!String(reminder.cardId||"").trim())errors.push("Vui lòng chọn Thẻ.");
  if(!String(reminder.title||"").trim())errors.push("Vui lòng nhập Tiêu đề.");
  const start=toStorageDate(reminder.startDate),end=toStorageDate(reminder.endDate);
  if(!start)errors.push("Từ ngày không hợp lệ.");
  if(!end)errors.push("Đến ngày không hợp lệ.");
  if(start&&end&&end<start)errors.push("Đến ngày phải lớn hơn hoặc bằng Từ ngày.");
  return errors;
}
export function getReminderState(reminder,referenceDate=new Date()){
  const today=localReminderDate(referenceDate);
  if(today<reminder.startDate)return "upcoming";
  if(today>reminder.endDate)return "expired";
  return "active";
}
export function isReminderActive(reminder,referenceDate=new Date()){return getReminderState(reminder,referenceDate)==="active";}
export function getActiveReminders(reminders=[],referenceDate=new Date()){return reminders.filter(item=>isReminderActive(item,referenceDate));}
export function getActiveRemindersForCard(reminders=[],cardId,referenceDate=new Date()){return getActiveReminders(reminders,referenceDate).filter(item=>item.cardId===cardId);}
