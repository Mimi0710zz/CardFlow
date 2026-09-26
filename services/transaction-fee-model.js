import { normalizeMoney } from "./money.js";

const LEGACY_PERCENT_FIELDS=["hostFeePercent","feePercent","hostPercent"];
const CURRENCY_TOLERANCE=1;

export function normalizeFeePercent(value){
  if(value===""||value==null)return 0;
  const number=Number(String(value).trim().replace(",","."));
  return Number.isFinite(number)?number:0;
}

export function calculateTransactionFee(orderAmount,orderFeePercent=0,orderFeeFixed=0){
  const amount=normalizeMoney(orderAmount,{emptyValue:0});
  const percent=normalizeFeePercent(orderFeePercent);
  const fixed=normalizeMoney(orderFeeFixed,{emptyValue:0,allowNegative:true});
  const percentageFee=Math.round(amount*percent/100);
  const hostFeeAmount=Math.round(percentageFee+fixed);
  return {orderAmount:amount,orderFeePercent:percent,orderFeeFixed:fixed,hostFeeAmount,returnAmount:Math.round(amount-hostFeeAmount)};
}

export function transactionFeeProfitDelta(transaction={}){
  const fee=Number(transaction.hostFeeAmount);
  return Number.isFinite(fee)?-fee:0;
}

function firstFinitePercent(transaction){
  for(const field of LEGACY_PERCENT_FIELDS){
    if(!Object.prototype.hasOwnProperty.call(transaction,field))continue;
    const value=normalizeFeePercent(transaction[field]);
    if(Number.isFinite(value))return value;
  }
  return null;
}

export function normalizeTransactionFee(transaction={}){
  const amount=normalizeMoney(transaction.amount??transaction.orderAmount,{emptyValue:0});
  const hasNewInputs=Object.prototype.hasOwnProperty.call(transaction,"orderFeePercent")||Object.prototype.hasOwnProperty.call(transaction,"orderFeeFixed");
  let orderFeePercent,orderFeeFixed;
  if(hasNewInputs){
    orderFeePercent=normalizeFeePercent(transaction.orderFeePercent);
    orderFeeFixed=normalizeMoney(transaction.orderFeeFixed,{emptyValue:0,allowNegative:true});
  }else{
    const legacyPercent=firstFinitePercent(transaction);
    const hasLegacyTotal=transaction.hostFeeAmount!==""&&transaction.hostFeeAmount!=null&&Number.isFinite(Number(transaction.hostFeeAmount));
    const legacyReturn=normalizeMoney(transaction.returnAmount??transaction.backAmount,{emptyValue:null,allowNegative:true});
    const legacyTotal=hasLegacyTotal?normalizeMoney(transaction.hostFeeAmount,{emptyValue:0,allowNegative:true}):(legacyReturn==null?null:amount-legacyReturn);
    if(legacyPercent!=null){
      orderFeePercent=legacyPercent;
      const percentageFee=Math.round(amount*legacyPercent/100);
      orderFeeFixed=legacyTotal==null?0:Math.round(legacyTotal-percentageFee);
      if(Math.abs(orderFeeFixed)<=CURRENCY_TOLERANCE)orderFeeFixed=0;
    }else{
      orderFeePercent=0;
      orderFeeFixed=legacyTotal==null?0:Math.round(legacyTotal);
    }
  }
  const calculated=calculateTransactionFee(amount,orderFeePercent,orderFeeFixed);
  const {hostFeePercent:_hostFeePercent,feePercent:_feePercent,hostPercent:_hostPercent,...current}=transaction;
  return {...current,amount:calculated.orderAmount,orderFeePercent:calculated.orderFeePercent,orderFeeFixed:calculated.orderFeeFixed,hostFeeAmount:calculated.hostFeeAmount,returnAmount:calculated.returnAmount,backAmount:calculated.returnAmount};
}
