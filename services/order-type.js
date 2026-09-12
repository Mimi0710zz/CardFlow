export const CARD_FEE_ORDER_TYPE = "Phí thẻ";
export const DEFAULT_ORDER_TYPE_COLOR = "#6b7280";
export const DEFAULT_ORDER_TYPE_COLORS = Object.freeze({
  ALEPAY:"#ea580c", AMWAY:"#b45309", BH:"#be123c", BHX:"#65a30d", GO:"#16a34a", HPAY:"#c2410c",
  "LINK MPOS":"#475569", MEGAPAY:"#dc2626", POS:"#9333ea", QR:"#047857", "SUN.W":"#0284c7", TGDD:"#15803d",
  TRIP:"#ca8a04", TVLK:"#0f766e", UNICITY:"#4f46e5", VMB:"#0891b2", VNPAY:"#7c3aed", VOUCHER:"#db2777", ZING:"#2563eb"
});
export const DEFAULT_ORDER_TYPE_NAMES = Object.freeze([...Object.keys(DEFAULT_ORDER_TYPE_COLORS), CARD_FEE_ORDER_TYPE]);

export function normalizeOrderTypeColor(value){
  return /^#[0-9a-f]{6}$/i.test(String(value || "").trim()) ? String(value).trim().toLowerCase() : "";
}

export function orderTypeDefaultColor(name, index=0){
  const raw=String(name || "").trim();
  if(raw.toLocaleLowerCase("vi")===CARD_FEE_ORDER_TYPE.toLocaleLowerCase("vi")) return DEFAULT_ORDER_TYPE_COLOR;
  const key=raw.toUpperCase();
  return DEFAULT_ORDER_TYPE_COLORS[key] || DEFAULT_ORDER_TYPE_COLOR;
}

export function isCardFeeOrderType(value){
  return String(value || "").trim().toLocaleLowerCase("vi")===CARD_FEE_ORDER_TYPE.toLocaleLowerCase("vi");
}

export function isCardFeeTransaction(transaction){
  return isCardFeeOrderType(transaction?.orderType);
}
