export function summarizeCardStatusRows(rows = []){
  const groups = new Set();
  const summary = {totalLimit:0,monthlySpend:0,outstanding:0,remainingLimit:0,cashback:0,estimatedProfit:0};
  rows.forEach((row,index) => {
    const groupId=String(row.limitGroupId || row.limitGroup || row.id || `ROW-${index}`);
    if(!groups.has(groupId)){
      groups.add(groupId);
      summary.totalLimit += Number(row.groupLimit) || 0;
      summary.remainingLimit += Number(row.remaining) || 0;
    }
    summary.monthlySpend += Number(row.monthSpend) || 0;
    summary.outstanding += Number(row.debt) || 0;
    summary.cashback += Number(row.cb) || 0;
    summary.estimatedProfit += Number(row.profit) || 0;
  });
  return summary;
}
