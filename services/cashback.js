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
