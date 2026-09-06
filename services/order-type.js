export const CARD_FEE_ORDER_TYPE = "Phí thẻ";
export const DEFAULT_ORDER_TYPE_COLOR = "#64748b";
export const ORDER_TYPE_COLORS = ["#2563eb","#0f766e","#7c3aed","#be123c","#ea580c","#15803d","#0891b2","#9333ea","#65a30d","#c2410c","#db2777","#4f46e5","#047857","#b45309","#0284c7","#16a34a","#dc2626","#475569","#ca8a04"];

export function normalizeOrderTypeColor(value){
  return /^#[0-9a-f]{6}$/i.test(String(value || "").trim()) ? String(value).trim().toLowerCase() : "";
}

export function orderTypeDefaultColor(name, index=0){
  if(String(name || "").trim()===CARD_FEE_ORDER_TYPE) return DEFAULT_ORDER_TYPE_COLOR;
  const source=[...String(name || "")].reduce((sum,char)=>sum+char.charCodeAt(0),Number(index)||0);
  return ORDER_TYPE_COLORS[source%ORDER_TYPE_COLORS.length];
}
