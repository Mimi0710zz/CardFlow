export function formatPercentDisplay(value,emptyText="—"){
  if(value===""||value==null)return emptyText;
  const number=Number(value);
  if(!Number.isFinite(number))return emptyText;
  return `${number.toLocaleString("vi-VN",{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
}
