import assert from "node:assert/strict";
import fs from "node:fs";
import { getProfitRowsForMonth, getProfitSummaryForMonth } from "../services/dashboard-summary.js";

const rows=getProfitRowsForMonth({cards:[{id:"CARD-B"},{id:"CARD-A"}],transactions:[],receipts:[{id:"1",date:"2026-09-01",cardId:"CARD-A",amount:250000}],year:2026,month:9});
assert.deepEqual(getProfitSummaryForMonth(rows),{cardCount:2,totalCashback:250000,totalHostFee:0,totalProfit:250000});

const app=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../styles.css",import.meta.url),"utf8");
assert.match(app,/cashback-receipt-total-row/);
assert.match(app,/Tổng: \$\{summary\.cardCount\} thẻ/);
assert.match(app,/positive cashback-receipt-amount/);
assert.match(app,/host-fee-value cashback-receipt-host-fee/);
assert.match(app,/<th>Thẻ<\/th><th>Tiền Cashback \(VNĐ\)<\/th><th>Phí Host \(VNĐ\)<\/th><th>Tiền lời \(VNĐ\)<\/th><th>Ngày CB<\/th><th>Ghi chú<\/th>/);
assert.match(app,/data-profit-cashback=/);
assert.match(app,/summary\.totalProfit/);
assert.match(app,/wireProfitCashbackInputs\(\)/);
assert.match(app,/function profitReceiptDate\(\)/);
assert.match(app,/new Date\(selectedYear,selectedMonth,0\)\.getDate\(\)/);
assert.match(css,/cashback-receipt-total-row/);
assert.match(css,/cashback-receipts-table thead th\{position:sticky;top:0/);
assert.match(css,/\.host-fee-value\{color:var\(--expense\)\}/);
assert.match(css,/\.cashback-receipts-table tbody tr:not\(\.cashback-receipt-total-row\)>td\{padding-top:4px;padding-bottom:4px;vertical-align:middle\}/);
assert.match(css,/\.cashback-receipt-amount.*font-weight:400/);
assert.match(css,/\.cashback-receipt-host-fee.*font-weight:400/);
assert.match(css,/\.cashback-receipts-table \.cashback-receipt-profit\{font-weight:700\}/);
assert.match(app,/syncCashbackReceiptsTableStickyOffset\(\)/);
assert.match(app,/title:"Tiền lời"/);
assert.match(fs.readFileSync(new URL("../index.html",import.meta.url),"utf8"),/>Tiền lời<\/span>/);
assert.match(app,/label:"Cashback thực nhận",sheetName:"Cashback thực nhận"/);

console.log("cashback receipts summary tests passed");
