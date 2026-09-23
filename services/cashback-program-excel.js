import {buildCashbackProgramId,cashbackTransactionMethodLabel,formatCashbackRate,isCashbackUnlimited,normalizeCombineOperator,normalizeTransactionMethod} from "./cashback.js";
import {normalizeConditionMode} from "./cashback-program-config.js";
import {normalizeMoney} from "./money.js";
import {isMbPlatinumCard,normalizeMbPlatinumCardConfig} from "./mb-platinum-cashback.js";

const text=value=>String(value??"").trim();
const key=value=>text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const rate=value=>{const raw=text(value).replace("%","").replace(",","."),number=Number(raw)||0;return number>1?number/100:number;};

function mccCodes(program,categories){
  if(program.allMcc)return "Tất cả";
  return (program.mccCategoryIds||[]).map(id=>categories.find(item=>item.id===id)?.mcc).filter(Boolean).join(", ");
}

export function exportCashbackProgramRows(programs=[],{mccCategories=[],bankName=()=>"",cashbackCardConfigs=[]}={}){
  const configs=new Map((cashbackCardConfigs||[]).map(config=>[config.cardId,config]));
  return [...programs].sort((a,b)=>(a.year||0)-(b.year||0)||(a.month||0)-(b.month||0)||text(a.cardId).localeCompare(text(b.cardId),"vi")||text(a.id).localeCompare(text(b.id),"vi")).map(program=>{
    const config=configs.get(program.cardId)||{};
    return {
      "Năm":program.year||"","Tháng":program.month||"","Ngân hàng":bankName(program),"Card ID":program.cardId||"","Program ID":program.id||"","Tên chương trình":program.name||"","Package ID":program.packageId||"",
      "Condition Mode":normalizeConditionMode(program.conditionMode),"Tổng doanh số tối thiểu":program.totalSpendMinimum??"","Cách kết hợp chương trình":normalizeCombineOperator(program.conditionCombination),
      "% CB":formatCashbackRate(program.rate),"Giới hạn":isCashbackUnlimited(program)?"Không giới hạn":"Có giới hạn","Max CB":isCashbackUnlimited(program)?"Không giới hạn":Number(program.max)||0,
      "Chi tổng doanh số kèm theo":program.eligibleSpendMinimum??"","Hình thức giao dịch":cashbackTransactionMethodLabel(program.channel),"Nhóm MCC":program.allMcc?"Tất cả":(program.mccCategoryIds||[]).map(id=>mccCategories.find(item=>item.id===id)?.name).filter(Boolean).join(", "),"Mã MCC":mccCodes(program,mccCategories),"Ghi chú chương trình":program.note||"",
      "Mức chi tối thiểu kỳ sao kê":isMbPlatinumCard(program.cardId)?config.statementMinSpend??5000000:"","Kỳ neo luân phiên":isMbPlatinumCard(program.cardId)?config.rotationAnchorPeriodKey||"":"","Gói chính tại kỳ neo":isMbPlatinumCard(program.cardId)?config.rotationAnchorPrimaryPackageId||"":""
    };
  });
}

function importedProgram(row,rowIndex,mccCategories){
  const cardId=text(row["Card ID"]),name=text(row["Tên chương trình"]??row["Tên điều kiện"]??row["Tên nhóm"]??row["Chương trình"]),year=Number(row["Năm"]),month=Number(row["Tháng"]);
  const id=text(row["Program ID"]??row["Condition ID"]??row["Group ID"])||buildCashbackProgramId(cardId,`${name}-${year}-${month}`);
  const codes=text(row["Mã MCC"]).split(",").map(value=>value.trim()).filter(Boolean),allMcc=key(row["Nhóm MCC"])==="tat ca"||key(row["Mã MCC"])==="tat ca"||!codes.length;
  const maxText=text(row["Max CB"]),unlimited=key(row["Giới hạn"])==="khong gioi han"||key(maxText)==="khong gioi han";
  return {id,cardId,name,year,month,packageId:text(row["Package ID"]),conditionMode:normalizeConditionMode(row["Condition Mode"]),totalSpendMinimum:normalizeMoney(row["Tổng doanh số tối thiểu"]??row["Tổng chi tối thiểu toàn chương trình"]??row["Tổng chi tối thiểu"],{emptyValue:null}),conditionCombination:normalizeCombineOperator(row["Cách kết hợp chương trình"]??row["Điều kiện kết hợp"]),rate:rate(row["% CB"]),max:unlimited?null:normalizeMoney(row["Max CB"],{emptyValue:0}),maxCashbackUnlimited:unlimited,maxType:unlimited?"UNLIMITED":"LIMITED",eligibleSpendMinimum:normalizeMoney(row["Chi tổng doanh số kèm theo"]??row["Chi nhóm tối thiểu"]??row["Chi nhóm để max"],{emptyValue:null}),channel:normalizeTransactionMethod(row["Hình thức giao dịch"]),allMcc,mccCategoryIds:allMcc?[]:codes.map(code=>mccCategories.find(item=>String(item.mcc)===code)?.id).filter(Boolean),note:text(row["Ghi chú chương trình"]??row["Ghi chú điều kiện"]??row["Ghi chú chung"]),__row:rowIndex};
}

export function importCashbackProgramRows(rows=[],{cards=[],mccCategories=[]}={}){
  const validCards=new Set(cards.map(card=>card.id)),used=new Set();
  return rows.map((row,rowIndex)=>{
    const program=importedProgram(row,rowIndex,mccCategories);
    if(!program.cardId||!validCards.has(program.cardId))throw new Error(`Sheet “Chương trình Cashback”, dòng ${rowIndex+2}: Card ID không hợp lệ.`);
    if(!program.name)throw new Error(`Sheet “Chương trình Cashback”, dòng ${rowIndex+2}: Tên chương trình không được để trống.`);
    if(used.has(program.id))throw new Error(`Sheet “Chương trình Cashback”, dòng ${rowIndex+2}: Program ID bị trùng.`);
    used.add(program.id);delete program.__row;return program;
  });
}

export function importCashbackCardConfigs(rows=[],cards=[]){
  const cardsById=new Map((cards||[]).map(card=>[card.id,card])),configs=new Map();
  rows.forEach(row=>{
    const cardId=text(row["Card ID"]),card=cardsById.get(cardId);
    if(!card||!isMbPlatinumCard(cardId)||configs.has(cardId))return;
    configs.set(cardId,normalizeMbPlatinumCardConfig({cardId,statementMinSpend:normalizeMoney(row["Mức chi tối thiểu kỳ sao kê"],{emptyValue:5000000}),rotationAnchorPeriodKey:text(row["Kỳ neo luân phiên"]),rotationAnchorPrimaryPackageId:text(row["Gói chính tại kỳ neo"])},card));
  });
  return [...configs.values()];
}

export function exportCashbackTransactionAssignments(transactions=[]){
  return (transactions||[]).map(transaction=>({"ID":transaction.id||"","Cashback Package ID":transaction.cashbackPackageId||"","Cashback Program ID":transaction.cashbackProgramId||""}));
}

export function importCashbackTransactionAssignments(rows=[],transactions=[]){
  const byId=new Map((rows||[]).map(row=>[text(row.ID),row]));
  return (transactions||[]).map(transaction=>{
    const row=byId.get(String(transaction.id||""));
    if(!row)return transaction;
    return {...transaction,cashbackPackageId:text(row["Cashback Package ID"]),cashbackProgramId:text(row["Cashback Program ID"])};
  });
}
