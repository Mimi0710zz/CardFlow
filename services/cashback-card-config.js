import {normalizeConditionMode} from "./cashback-program-config.js";

export function normalizeCardCashbackConfig(config={}){
  const requirement=config.totalSpendRequirement||{};
  const enabled=requirement.enabled===true;
  const amount=enabled?Math.max(0,Number(requirement.amount)||0):null;
  return {cardId:String(config.cardId||""),calculationMode:normalizeConditionMode(config.calculationMode),totalSpendRequirement:{enabled,amount}};
}

export function normalizeCardCashbackConfigs(configs=[],legacyPrograms=[]){
  const byCard=new Map();
  (Array.isArray(configs)?configs:[]).forEach(config=>{
    const normalized=normalizeCardCashbackConfig(config);
    if(normalized.cardId&&!byCard.has(normalized.cardId))byCard.set(normalized.cardId,normalized);
  });
  (Array.isArray(legacyPrograms)?legacyPrograms:[]).forEach(program=>{
    const cardId=String(program?.cardId||"");
    if(!cardId||byCard.has(cardId))return;
    const hasTotal=program.totalSpendMinimum!==null&&program.totalSpendMinimum!==undefined&&program.totalSpendMinimum!=="";
    byCard.set(cardId,normalizeCardCashbackConfig({cardId,calculationMode:program.conditionMode,totalSpendRequirement:{enabled:hasTotal,amount:program.totalSpendMinimum}}));
  });
  return [...byCard.values()];
}

export function cardCashbackConfigFor(configs=[],cardId=""){
  return normalizeCardCashbackConfig((configs||[]).find(config=>String(config?.cardId||"")===String(cardId||""))||{cardId});
}

export function upsertCardCashbackConfig(configs=[],config={}){
  const normalized=normalizeCardCashbackConfig(config),source=Array.isArray(configs)?configs:[];
  return source.some(item=>item.cardId===normalized.cardId)?source.map(item=>item.cardId===normalized.cardId?normalized:item):[...source,normalized];
}
