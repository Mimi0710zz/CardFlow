import { TRANSACTION_STATUS } from "./transaction-status.js";

export const TRANSACTION_FORM_CONTEXT = {
  ORDER: "order",
  PERSONAL: "personal"
};

export function transactionFieldsForContext(fields=[],context=TRANSACTION_FORM_CONTEXT.ORDER){
  if(context!==TRANSACTION_FORM_CONTEXT.PERSONAL) return fields;
  return fields.filter(field=>field.name!=="host"&&field.name!=="status");
}

export function transactionValuesForContext(values={},context=TRANSACTION_FORM_CONTEXT.ORDER){
  if(context!==TRANSACTION_FORM_CONTEXT.PERSONAL) return values;
  return {...values,host:"",status:TRANSACTION_STATUS.PERSONAL_USE};
}
