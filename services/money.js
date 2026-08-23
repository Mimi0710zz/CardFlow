const MONEY_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0
});

function cleanMoneyText(value, {allowNegative = false} = {}){
  let text = String(value ?? "").trim();
  text = text.replace(/([,.])\d{1,2}\s*(?:đ|vnd|vnđ)?\s*$/i, "");
  const sign = allowNegative && /^\s*-/.test(text) ? "-" : "";
  return sign + text.replace(/[^\d]/g, "");
}

export function parseMoney(value, {emptyValue = 0, allowNegative = false} = {}){
  if(value === "" || value == null) return emptyValue;
  const cleaned = cleanMoneyText(value, {allowNegative});
  if(cleaned === "" || cleaned === "-") return emptyValue;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : emptyValue;
}

export function normalizeMoney(value, options = {}){
  return parseMoney(value, options);
}

export function formatMoneyInput(value, {allowEmpty = false, allowNegative = false} = {}){
  if(allowEmpty && (value === "" || value == null)) return "";
  const number = normalizeMoney(value, {emptyValue:0, allowNegative});
  return MONEY_FORMATTER.format(Math.round(number));
}

export function formatMoneyDisplay(value, {emptyText = "", showCurrency = true} = {}){
  if(value === "" || value == null){
    if(emptyText) return emptyText;
    value = 0;
  }
  const number = normalizeMoney(value, {emptyValue:0, allowNegative:true});
  const formatted = MONEY_FORMATTER.format(Math.round(number));
  return showCurrency ? `${formatted} đ` : formatted;
}
