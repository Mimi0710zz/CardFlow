import assert from "node:assert/strict";
import { canonicalizeData } from "../services/local-repository.js";
import { getActiveReminders, getActiveRemindersForCard, getReminderState, normalizeReminder, validateReminder } from "../services/reminders.js";

const base={id:"REM-1",cardId:"CARD-A",title:"Phí thường niên",content:"Kiểm tra điều kiện miễn phí",startDate:"2026-09-17",endDate:"2026-09-20",createdAt:"2026-09-01T08:00:00",updatedAt:"2026-09-01T08:00:00"};
assert.deepEqual(validateReminder(base),[]);
assert.match(normalizeReminder({...base,id:""}).id,/^REMINDER-/);
assert.deepEqual(validateReminder({...base,endDate:"2026-09-16"}),["Đến ngày phải lớn hơn hoặc bằng Từ ngày."]);
assert.equal(getReminderState(base,"2026-09-16"),"upcoming");
assert.equal(getReminderState(base,"2026-09-17"),"active");
assert.equal(getReminderState(base,"2026-09-18"),"active");
assert.equal(getReminderState(base,"2026-09-20"),"active");
assert.equal(getReminderState(base,"2026-09-21"),"expired");

const reminders=[base,{...base,id:"REM-2",title:"Reminder 2"},{...base,id:"REM-3",cardId:"CARD-B",endDate:"2026-09-16"}];
assert.deepEqual(getActiveReminders(reminders,"2026-09-18").map(item=>item.id),["REM-1","REM-2"]);
assert.deepEqual(getActiveRemindersForCard(reminders,"CARD-A","2026-09-18").map(item=>item.id),["REM-1","REM-2"]);
assert.deepEqual(getActiveRemindersForCard(reminders,"CARD-B","2026-09-18"),[]);
assert.deepEqual(getActiveReminders(reminders.filter(item=>item.id!=="REM-1"),"2026-09-18").map(item=>item.id),["REM-2"]);

const legacy=canonicalizeData({schemaVersion:17,cards:[],cashbackProgramGroups:[]});
assert.deepEqual(legacy.reminders,[]);
const missingCard=canonicalizeData({schemaVersion:17,cards:[],cashbackProgramGroups:[],reminders:[{...base,cardId:"MISSING"}]});
assert.equal(missingCard.reminders[0].cardId,"MISSING");
assert.deepEqual(canonicalizeData(JSON.parse(JSON.stringify(missingCard))).reminders,missingCard.reminders);

console.log("reminder domain tests passed");
