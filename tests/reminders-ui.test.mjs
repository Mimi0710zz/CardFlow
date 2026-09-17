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
assert.match(app,/getActiveReminders\(state\.reminders/);
assert.match(app,/data-dashboard-reminders/);
assert.match(tracking,/getActiveRemindersForCard/);
assert.match(tracking,/tracking-reminder-badge/);
assert.match(tracking,/tracking-reminder-details/);

console.log("reminder UI tests passed");
