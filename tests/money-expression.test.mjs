import assert from "node:assert/strict";
import test from "node:test";
import { parseMoneyExpression, resolveMoneyExpression } from "../services/money.js";

test("cộng số nguyên",()=>assert.deepEqual(parseMoneyExpression("1000000+250000"),{ok:true,value:1_250_000}));
test("cộng tiền có dấu phân cách hàng nghìn",()=>assert.deepEqual(parseMoneyExpression("1.000.000 + 250.000"),{ok:true,value:1_250_000}));
test("phép trừ",()=>assert.deepEqual(parseMoneyExpression("2.000.000-500.000"),{ok:true,value:1_500_000}));
test("phép nhân",()=>assert.deepEqual(parseMoneyExpression("500000*2"),{ok:true,value:1_000_000}));
test("phép chia",()=>assert.deepEqual(parseMoneyExpression("2.000.000/4"),{ok:true,value:500_000}));
test("nhiều toán tử theo đúng thứ tự ưu tiên",()=>assert.deepEqual(parseMoneyExpression("1000000+250000-50000*2"),{ok:true,value:1_150_000}));
test("hỗ trợ ngoặc",()=>assert.deepEqual(parseMoneyExpression("(1.000.000 + 500.000) * 2"),{ok:true,value:3_000_000}));
test("từ chối biểu thức không hợp lệ",()=>assert.equal(parseMoneyExpression("1000000+alert(1)").ok,false));
test("từ chối chia cho 0",()=>assert.equal(parseMoneyExpression("1000000/0").ok,false));
test("input lỗi giữ nguyên giá trị hợp lệ trước đó",()=>assert.deepEqual(resolveMoneyExpression("1+",750_000),{ok:false,value:750_000,error:"Biểu thức tiền không hợp lệ."}));
