export function stripVietnamese(value){
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}

export function normalizeCardNameForId(name){
  const common = {"AMERICAN EXPRESS":"AMEX"};
  const ascii = stripVietnamese(name).trim().toUpperCase();
  const mapped = common[ascii] || ascii;
  return mapped.replace(/[^A-Z0-9]+/g,"-").replace(/-+/g,"-").replace(/^-+|-+$/g,"");
}

export function buildCardId(bankCode, cardName){
  return `${String(bankCode || "").trim().toUpperCase()}-${normalizeCardNameForId(cardName)}`;
}
