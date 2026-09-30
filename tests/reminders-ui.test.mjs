import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const tracking=fs.readFileSync(new URL("../services/tracking-matrix-ui.js",import.meta.url),"utf8");

assert.match(html,/data-view="reminders"/);
assert.match(html,/id="view-reminders"/);
assert.match(app,/function renderReminders\(/);
assert.match(app,/Thêm lời nhắc/);
assert.match(app,/Tuỳ chỉnh lời nhắc/);
assert.match(app,/Xoá lời nhắc/);
assert.match(app,/data-reminder-filter/);
assert.match(app,/const reminderFilters=\{cardId:new Set\(\),status:new Set\(\),dateFrom:"",dateTo:""\}/);
assert.match(app,/data-reminder-filter-panel/);
assert.match(app,/multiFilterGroup\("cardId","Thẻ"/);
assert.match(app,/multiFilterGroup\("status","Tình trạng"/);
assert.match(app,/matchesMultiFilter\(item\.cardId,reminderFilters\.cardId\)/);
assert.match(app,/applyFilterPanel\("reminders","reminders"\)/);
assert.match(app,/clearAppliedFilters\("reminders","reminders"\)/);
assert.doesNotMatch(app,/<select data-reminder-filter="cardId"/);
assert.match(app,/getActiveReminders\(state\.reminders/);
assert.match(app,/data-dashboard-reminders/);
assert.match(tracking,/getActiveRemindersForCard/);
assert.match(tracking,/tracking-reminder-badge/);
assert.match(tracking,/tracking-reminder-details/);

console.log("reminder UI tests passed");
