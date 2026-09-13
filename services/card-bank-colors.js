const BANK_TEXT_COLORS=Object.freeze([
  "#1d4ed8",
  "#047857",
  "#b45309",
  "#be123c",
  "#6d28d9",
  "#0f766e",
  "#c2410c",
  "#4338ca",
  "#0e7490",
  "#a21caf",
  "#15803d",
  "#b91c1c"
]);

function stableHash(value){
  return [...String(value || "")].reduce((hash,char)=>((hash * 33) + char.charCodeAt(0)) >>> 0,5381);
}

export function cardBankKey(card={}){
  return String(card.bankId || card.bank || "").trim().toUpperCase();
}

export function bankTextColor(card={}){
  const key=cardBankKey(card);
  if(!key) return "";
  return BANK_TEXT_COLORS[stableHash(key) % BANK_TEXT_COLORS.length];
}
