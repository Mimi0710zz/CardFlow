import {
  MB_PLATINUM_PACKAGE_IDS,
  deriveMbPlatinumSlotUsage,
  isMbPlatinumCard,
  mbPlatinumPackageLabel,
  validateMbPlatinumAssignment
} from "./mb-platinum-cashback.js";

export function normalizeMbPlatinumTransactionAssignment(transaction={}){
  if(!isMbPlatinumCard(transaction.cardId))return {cashbackPackageId:"",cashbackProgramId:""};
  return {cashbackPackageId:String(transaction.cashbackPackageId||""),cashbackProgramId:String(transaction.cashbackProgramId||"")};
}

export function buildMbPlatinumTransactionFormModel({card={},config={},programs=[],transactions=[],mccCategories=[],transaction={},referenceDate}={}){
  if(!isMbPlatinumCard(card.id||transaction.cardId))return {visible:false};
  const packageId=String(transaction.cashbackPackageId||""),programId=String(transaction.cashbackProgramId||"");
  const usage=deriveMbPlatinumSlotUsage({config,card,programs,transactions,mccCategories,referenceDate:referenceDate||transaction.date||new Date(),excludeTransactionId:transaction.id||""});
  const packageOptions=MB_PLATINUM_PACKAGE_IDS.map(id=>{
    const state=usage.packages[id];
    return {id,value:id,label:`${mbPlatinumPackageLabel(id)} — Đã dùng ${state.used}/${state.limit} chương trình`,disabled:false,explanation:state.remaining?`Còn ${state.remaining} chương trình khả dụng.`:`Đã đủ ${state.used}/${state.limit} chương trình; chỉ có thể chọn chương trình đã dùng.`};
  });
  const programOptions=packageId?(programs||[]).filter(program=>isMbPlatinumCard(program.cardId)&&program.packageId===packageId).map(program=>{
    const state=usage.packages[packageId],duplicate=state.occupiedProgramIds.includes(program.id),disabled=!duplicate&&state.used>=state.limit;
    return {id:program.id,value:program.id,label:program.name||program.id,disabled,duplicate,explanation:disabled?`Gói ${state.label} đã đủ ${state.used}/${state.limit} chương trình trong kỳ sao kê này.`:duplicate?"Chương trình đã được sử dụng; giao dịch này không tạo slot mới.":"Có thể sử dụng một slot mới."};
  }):[];
  const selectedProgram=programOptions.find(option=>option.id===programId)||null;
  return {visible:true,packageId,programId,packageOptions,programOptions,selectedProgram,usage,help:selectedProgram?.explanation||packageOptions.find(option=>option.id===packageId)?.explanation||"Vui lòng chọn Gói, sau đó chọn Chương trình."};
}

export function validateMbPlatinumTransactionAssignment(context={}){
  const transaction=context.transaction||{};
  if(!isMbPlatinumCard(transaction.cardId))return {valid:true,duplicate:false,qualified:false,message:""};
  if(Boolean(transaction.cashbackPackageId)!==Boolean(transaction.cashbackProgramId))return {valid:false,duplicate:false,qualified:false,message:"Vui lòng chọn đầy đủ Gói và Chương trình cashback."};
  return validateMbPlatinumAssignment(context);
}
