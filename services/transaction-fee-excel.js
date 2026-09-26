import { normalizeTransactionFee } from "./transaction-fee-model.js";

export function exportTransactionFeeColumns(transaction={}){
  const normalized=normalizeTransactionFee(transaction);
  return {"Phí Đơn (%)":normalized.orderFeePercent,"Phí Đơn (VNĐ)":normalized.orderFeeFixed,"Phí Host (VNĐ)":normalized.hostFeeAmount,"Tiền về":normalized.returnAmount};
}

export function importTransactionFeeColumns(row={}){
  const transaction={amount:row["Tiền đơn"]??row["TIỀN ĐƠN (VND)"]??row.amount??0};
  const hasNewFields=Object.prototype.hasOwnProperty.call(row,"Phí Đơn (%)")||Object.prototype.hasOwnProperty.call(row,"Phí Đơn (VNĐ)");
  if(hasNewFields){
    transaction.orderFeePercent=row["Phí Đơn (%)"]??0;
    transaction.orderFeeFixed=row["Phí Đơn (VNĐ)"]??0;
  }else{
    if(Object.prototype.hasOwnProperty.call(row,"Phí Host (%)"))transaction.hostFeePercent=row["Phí Host (%)"];
    if(Object.prototype.hasOwnProperty.call(row,"Phí Host (VNĐ)"))transaction.hostFeeAmount=row["Phí Host (VNĐ)"];
    if(Object.prototype.hasOwnProperty.call(row,"Tiền về"))transaction.backAmount=row["Tiền về"];
    else if(Object.prototype.hasOwnProperty.call(row,"TIỀN BACK (VND)"))transaction.backAmount=row["TIỀN BACK (VND)"];
  }
  const normalized=normalizeTransactionFee(transaction);
  return {amount:normalized.amount,orderFeePercent:normalized.orderFeePercent,orderFeeFixed:normalized.orderFeeFixed,hostFeeAmount:normalized.hostFeeAmount,returnAmount:normalized.returnAmount};
}
