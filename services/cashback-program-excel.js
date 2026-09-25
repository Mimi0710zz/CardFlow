import {buildCashbackProgramId, cashbackTransactionMethodLabel, formatCashbackRate, isCashbackUnlimited, normalizeCashbackConditions, normalizeCombineOperator, normalizeTransactionMethod} from "./cashback.js";
import {deriveProgramMaxCashback,normalizeConditionMode} from "./cashback-program-config.js";
import {normalizeMoney} from "./money.js";
import {cardCashbackConfigFor,normalizeCardCashbackConfig,normalizeCardCashbackConfigs} from "./cashback-card-config.js";

const text=value=>String(value??"").trim();
const key=value=>text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const rate=value=>{
  const raw=text(value).replace("%","").replace(",","."),number=Number(raw)||0;
  return number>1?number/100:number;
};

function mccCodes(condition,categories){
  if(condition.allMcc)return "Tất cả";
  return (condition.mccCategoryIds||[]).map(id=>categories.find(item=>item.id===id)?.mcc).filter(Boolean).join(", ");
}

export function exportCashbackProgramRows(programs=[],{mccCategories=[],bankName=()=>"",cardCashbackConfigs=[]}={}){
  const normalizedCardConfigs=normalizeCardCashbackConfigs(cardCashbackConfigs,programs);
  return [...programs].sort((a,b)=>(a.year||0)-(b.year||0)||(a.month||0)-(b.month||0)||text(a.cardId).localeCompare(text(b.cardId),"vi")||text(a.name).localeCompare(text(b.name),"vi")).flatMap(program=>{
    const cardConfig=cardCashbackConfigFor(normalizedCardConfigs,program.cardId);
    const scopes=Array.isArray(program.packages)&&program.packages.length
      ? program.packages.flatMap(pkg=>(pkg.groups||[]).map(group=>({pkg,group})))
      : [{pkg:null,group:program}];
    const packageIndexes=new Map();
    return scopes.flatMap(({pkg,group})=>normalizeCashbackConditions(group,mccCategories).map(condition=>{
      const scopeKey=pkg?.id||"",order=(packageIndexes.get(scopeKey)||0)+1;packageIndexes.set(scopeKey,order);
      return {
        "Năm":program.year||"","Tháng":program.month||"","Ngân hàng":bankName(program),"Card ID":program.cardId||"","Program ID":program.id||"","Tên chương trình":program.name||"","Card Calculation Mode":cardConfig.calculationMode,"Card Total Spend Enabled":cardConfig.totalSpendRequirement.enabled,"Card Total Spend":cardConfig.totalSpendRequirement.amount??"","Condition Mode":cardConfig.calculationMode,
        "Tổng doanh số tối thiểu":cardConfig.totalSpendRequirement.amount??"","Max cashback chương trình":deriveProgramMaxCashback(program),"Tổng chi tối thiểu toàn chương trình":cardConfig.totalSpendRequirement.amount??"","Max cashback toàn kỳ":deriveProgramMaxCashback(program),"Số lần đổi gói tối đa":program.packageSwitchLimit??"",
        "Package ID":pkg?.id||"","Tên gói":pkg?.name||"","Group ID":group.id||"","Tên nhóm":group.name||"","Tổng chi tối thiểu":group.totalSpendMinimum??"","Điều kiện kết hợp":normalizeCombineOperator(group.conditionCombination),"Ghi chú chung":group.note||"",
        "Condition ID":condition.id||"","Tên điều kiện":condition.name||"","% CB":formatCashbackRate(condition.rate),"Limit Type":condition.maxType||(isCashbackUnlimited(condition)?"UNLIMITED":"LIMITED"),"Giới hạn":condition.maxType==="NO_CASHBACK"?"Không hoàn":(isCashbackUnlimited(condition)?"Không giới hạn":"Có giới hạn"),"Max CB":condition.maxType==="NO_CASHBACK"?"":(isCashbackUnlimited(condition)?"Không giới hạn":Number(condition.max)||0),
        "Chi tổng doanh số kèm theo":condition.eligibleSpendMinimum??"","Chi nhóm tối thiểu":condition.eligibleSpendMinimum??"","Hình thức giao dịch":cashbackTransactionMethodLabel(condition.channel),"Nhóm MCC":condition.allMcc?"Tất cả":(condition.mccCategoryIds||[]).map(id=>mccCategories.find(item=>item.id===id)?.name).filter(Boolean).join(", "),"Mã MCC":mccCodes(condition,mccCategories),"Ghi chú điều kiện":condition.note||"","Thứ tự điều kiện":order
      };
    }));
  });
}

function importedCondition(row,groupId,index,mccCategories){
  const codes=text(row["Mã MCC"]).split(",").map(value=>value.trim()).filter(Boolean),allMcc=key(row["Nhóm MCC"])==="tat ca"||key(row["Mã MCC"])==="tat ca"||!codes.length;
  const maxText=text(row["Max CB"]),limitKey=key(row["Giới hạn"]),stableLimit=text(row["Limit Type"]).toUpperCase(),noCashback=stableLimit==="NO_CASHBACK"||limitKey==="khong hoan",unlimited=!noCashback&&(stableLimit==="UNLIMITED"||limitKey==="khong gioi han"||key(maxText)==="khong gioi han");
  return {
    id:text(row["Condition ID"])||`${groupId}-COND-${index+1}`,
    name:text(row["Tên điều kiện"]??row["Tên nhóm"])||`Điều kiện ${index+1}`,
    rate:rate(row["% CB"]),max:unlimited||noCashback?null:normalizeMoney(row["Max CB"],{emptyValue:0}),maxCashbackUnlimited:unlimited,maxType:noCashback?"NO_CASHBACK":(unlimited?"UNLIMITED":"LIMITED"),
    eligibleSpendMinimum:normalizeMoney(row["Chi tổng doanh số kèm theo"]??row["Chi nhóm tối thiểu"]??row["Chi nhóm để max"],{emptyValue:null}),
    channel:normalizeTransactionMethod(row["Hình thức giao dịch"]),allMcc,mccCategoryIds:allMcc?[]:codes.map(code=>mccCategories.find(item=>String(item.mcc)===code)?.id).filter(Boolean),note:text(row["Ghi chú điều kiện"])
  };
}

export function importCashbackProgramRows(rows=[],{cards=[],mccCategories=[],existingPrograms=[]}={}){
  const validCards=new Set(cards.map(card=>card.id)),programs=new Map(),usedConditions=new Set(),cardConfigs=new Map();
  rows.forEach((row,rowIndex)=>{
    const cardId=text(row["Card ID"]),name=text(row["Tên chương trình"]??row["Tên nhóm"]??row["Chương trình"]),year=Number(row["Năm"]),month=Number(row["Tháng"]);
    if(!cardId||!validCards.has(cardId))throw new Error(`Sheet “Chương trình Cashback”, dòng ${rowIndex+2}: Card ID không hợp lệ.`);
    if(row["Card Calculation Mode"]!==undefined&&!cardConfigs.has(cardId)){cardConfigs.set(cardId,normalizeCardCashbackConfig({cardId,calculationMode:row["Card Calculation Mode"],totalSpendRequirement:{enabled:row["Card Total Spend Enabled"]===true||key(row["Card Total Spend Enabled"])==="co",amount:row["Card Total Spend"]}}));}
    if(!name)throw new Error(`Sheet “Chương trình Cashback”, dòng ${rowIndex+2}: Tên chương trình không được để trống.`);
    const programId=text(row["Program ID"]??row["Group ID"])||buildCashbackProgramId(cardId,`${name}-${year}-${month}`),packaged=Boolean(text(row["Package ID"]||row["Tên gói"]));
    if(!programs.has(programId)){
      const existing=existingPrograms.find(item=>item.id===programId);
      programs.set(programId,{id:programId,cardId,name,year,month,conditionMode:normalizeConditionMode(row["Condition Mode"]),totalSpendMinimum:normalizeMoney(row["Tổng doanh số tối thiểu"]??row["Tổng chi tối thiểu toàn chương trình"]??(!packaged?row["Tổng chi tối thiểu"]:null),{emptyValue:null}),maxCashbackPerPeriod:normalizeMoney(row["Max cashback chương trình"]??row["Max cashback toàn kỳ"],{emptyValue:null}),packageSwitchLimit:Number(row["Số lần đổi gói tối đa"])||0,...(packaged?{packages:[],packageHistory:existing?.packageHistory||[]}:{conditions:[]})});
    }
    const program=programs.get(programId),order=Number(row["Thứ tự điều kiện"])||rowIndex+1;
    let group=program;
    if(packaged){
      const packageId=text(row["Package ID"])||`${programId}-PACKAGE-1`,packageName=text(row["Tên gói"])||"Gói 1";
      let pkg=program.packages.find(item=>item.id===packageId);if(!pkg){pkg={id:packageId,name:packageName,groups:[]};program.packages.push(pkg);}
      const groupId=text(row["Group ID"])||`${packageId}-GROUP-${pkg.groups.length+1}`;
      group=pkg.groups.find(item=>item.id===groupId);if(!group){group={id:groupId,name:text(row["Tên nhóm"]),totalSpendMinimum:normalizeMoney(row["Tổng chi tối thiểu"],{emptyValue:null}),conditionCombination:normalizeCombineOperator(row["Điều kiện kết hợp"]),note:text(row["Ghi chú chung"]),conditions:[]};pkg.groups.push(group);}
    }else{
      program.conditionCombination=normalizeCombineOperator(row["Điều kiện kết hợp"]);program.note=text(row["Ghi chú chung"]);
    }
    const condition=importedCondition(row,group.id,rowIndex,mccCategories);if(usedConditions.has(condition.id))throw new Error(`Sheet “Chương trình Cashback”, dòng ${rowIndex+2}: Condition ID bị trùng.`);usedConditions.add(condition.id);
    group.conditions.push({...condition,__order:order});
  });
  const imported=[...programs.values()].map(program=>{
    const sort=conditions=>conditions.sort((a,b)=>a.__order-b.__order).map(({__order,...condition})=>condition);
    if(Array.isArray(program.packages)){program.packages.forEach(pkg=>pkg.groups.forEach(group=>{group.conditions=sort(group.conditions);}));}
    else program.conditions=sort(program.conditions);
    return program;
  });
  imported.cardCashbackConfigs=[...cardConfigs.values()];
  return imported;
}
