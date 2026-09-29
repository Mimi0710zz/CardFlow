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

export function parseMoneyExpression(input){
  const source=String(input??"").replace(/\s+/g,"").replace(/[.,]/g,"");
  if(!source||!/^[\d+\-*/()]+$/.test(source))return {ok:false,error:"Biểu thức tiền không hợp lệ."};
  let index=0;
  const parseExpression=()=>{
    let value=parseTerm();
    while(source[index]==="+"||source[index]==="-"){
      const operator=source[index++],right=parseTerm();
      value=operator==="+"?value+right:value-right;
    }
    return value;
  };
  const parseTerm=()=>{
    let value=parseFactor();
    while(source[index]==="*"||source[index]==="/"){
      const operator=source[index++],right=parseFactor();
      if(operator==="/"&&right===0)throw new Error("Không thể chia cho 0.");
      value=operator==="*"?value*right:value/right;
    }
    return value;
  };
  const parseFactor=()=>{
    if(source[index]==="+"||source[index]==="-"){
      const operator=source[index++],value=parseFactor();
      return operator==="-"?-value:value;
    }
    if(source[index]==="("){
      index++;
      const value=parseExpression();
      if(source[index]!==")")throw new Error("Biểu thức tiền không hợp lệ.");
      index++;
      return value;
    }
    const start=index;
    while(/\d/.test(source[index]||""))index++;
    if(start===index)throw new Error("Biểu thức tiền không hợp lệ.");
    return Number(source.slice(start,index));
  };
  try{
    const value=parseExpression();
    if(index!==source.length||!Number.isFinite(value))throw new Error("Biểu thức tiền không hợp lệ.");
    return {ok:true,value:Math.round(value)};
  }catch(error){
    return {ok:false,error:error.message==="Không thể chia cho 0."?error.message:"Biểu thức tiền không hợp lệ."};
  }
}

export function resolveMoneyExpression(input,previousValue=0){
  const result=parseMoneyExpression(input);
  return result.ok?result:{...result,value:Number(previousValue)||0};
}
