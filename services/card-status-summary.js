function creditLimitGroupKey(row, index){
  return String(row.limitGroupId || row.limitGroup || row.id || `ROW-${index}`);
}

export function resolveCreditLimitGroups(rows = []){
  const groups = new Map();
  rows.forEach((row,index) => {
    if(row.cardType === "debit") return;
    const groupKey=creditLimitGroupKey(row,index);
    if(!groups.has(groupKey)){
      groups.set(groupKey,{
        groupKey,
        memberCardIds:[],
        groupLimit:Number(row.groupLimit) || 0,
        totalDebt:0,
        remainingLimit:0
      });
    }
    const group=groups.get(groupKey);
    group.memberCardIds.push(row.id);
    group.totalDebt += Number(row.debt) || 0;
  });
  groups.forEach(group => {
    group.remainingLimit=Math.max(0,group.groupLimit-group.totalDebt);
  });
  return [...groups.values()];
}

export function summarizeCardStatusRows(rows = []){
  const creditLimitGroups=resolveCreditLimitGroups(rows);
  const summary = {totalLimit:0,monthlySpend:0,outstanding:0,remainingLimit:0,cashback:0,estimatedProfit:0};
  creditLimitGroups.forEach(group => {
    summary.totalLimit += group.groupLimit;
    summary.remainingLimit += group.remainingLimit;
  });
  rows.forEach(row => {
    if(row.cardType !== "debit"){
      summary.outstanding += Number(row.debt) || 0;
    }
    summary.monthlySpend += Number(row.monthSpend) || 0;
    summary.cashback += Number(row.cb) || 0;
    summary.estimatedProfit += Number(row.profit) || 0;
  });
  return summary;
}
