import { normalizeCardNameForId } from "./card-id.js";

export const ALL_MCC_VALUE = "__ALL_MCC__";

export function formatCashbackRate(rate){
  return `${((Number(rate) || 0) * 100).toLocaleString("vi-VN", {minimumFractionDigits:1, maximumFractionDigits:1})}%`;
}

export function buildCashbackProgramId(cardId, programName){
  const normalizedName = normalizeCardNameForId(programName);
  return normalizedName ? `${String(cardId || "").trim()}-${normalizedName}` : "";
}

export function normalizeProgramMcc(program, mccCategories){
  const categories = Array.isArray(mccCategories) ? mccCategories : [];
  const requested = Array.isArray(program?.mccCategoryIds) ? program.mccCategoryIds : [];
  const legacy = Array.isArray(program?.categories) ? program.categories : [];
  const values = requested.length ? requested : legacy;
  const ids = [...new Set(values.map(value => {
    const raw = String(value ?? "").trim();
    return categories.find(item => item.id === raw || item.name === raw || String(item.mcc) === raw)?.id || "";
  }).filter(Boolean))];
  const explicitlyAll = program?.allMcc === true;
  const legacyAll = program?.allMcc == null && values.length === 0;
  const allMcc = explicitlyAll || legacyAll;
  const legacyNames = legacy.map(value => String(value ?? "").trim()).filter(Boolean);
  return {
    allMcc,
    mccCategoryIds: allMcc ? [] : ids,
    categories: allMcc ? [] : [...new Set([
      ...ids.map(id => categories.find(item => item.id === id)?.name).filter(Boolean),
      ...legacyNames.filter(name => !categories.some(item => item.id === name))
    ])]
  };
}

export function isMccEligible(program, transaction, mccCategories){
  const normalized = normalizeProgramMcc(program, mccCategories);
  if(normalized.allMcc) return true;
  const transactionCategory = mccCategories.find(item =>
    item.id === transaction.mccCategoryId || item.name === transaction.category || Number(item.mcc) === Number(transaction.mcc)
  );
  if(transactionCategory && normalized.mccCategoryIds.includes(transactionCategory.id)) return true;
  return normalized.categories.includes(String(transaction.category || "").trim());
}

export function applySharedCashbackDisplay(programs){
  const rows = (programs || []).map(program => ({...program}));
  const groups = new Map();
  rows.forEach(row => {
    if(!row.shared) return;
    if(!groups.has(row.shared)) groups.set(row.shared, []);
    groups.get(row.shared).push(row);
  });
  groups.forEach(group => {
    const cap = Number(group[0]?.max) || 0;
    const earned = Math.min(cap, group.reduce((total, row) => total + (Number(row.rawCashback) || 0), 0));
    group.forEach((row, index) => {
      row.countedCashback = index === 0 ? earned : 0;
      row.displayCashback = earned;
    });
  });
  rows.forEach(row => {
    if(row.countedCashback === undefined) row.countedCashback = Number(row.rawCashback) || 0;
    if(row.displayCashback === undefined) row.displayCashback = row.countedCashback;
  });
  return rows;
}

function progressRatio(value, target){
  const normalizedTarget = Number(target) || 0;
  if(normalizedTarget <= 0) return null;
  return Math.min(1, Math.max(0, (Number(value) || 0) / normalizedTarget));
}

export function calculateRuleProgress(program, eligibleSpend, totalCardSpend){
  const eligibleProgress = progressRatio(eligibleSpend, program?.eligibleTarget);
  const totalProgress = progressRatio(totalCardSpend, program?.totalTarget);
  const requiresTotalTarget = program?.requiresTotalTarget === true || program?.progressRequiresTotalTarget === true;

  if(eligibleProgress !== null){
    if(requiresTotalTarget && totalProgress !== null) return Math.min(eligibleProgress, totalProgress);
    return eligibleProgress;
  }
  return totalProgress ?? 0;
}
