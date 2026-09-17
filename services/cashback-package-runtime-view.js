import { getCashbackPeriodForCard } from "./cashback-period.js";
import { getActiveCashbackPackage, getActivePackageHistory, getPackageHistoryForPeriod, getPackageSwitchCount, getRemainingPackageSwitches } from "./cashback-packages.js";

export function buildCashbackPackageRuntimeView(program,card,referenceTimestamp){
  const period=getCashbackPeriodForCard(card,referenceTimestamp);
  const history=getPackageHistoryForPeriod(program,period).map(item=>({...item,packageName:program.packages.find(pkg=>pkg.id===item.packageId)?.name||item.packageId}));
  const activePackage=getActiveCashbackPackage(program,period,referenceTimestamp);
  const activeEntry=getActivePackageHistory(program,period,referenceTimestamp);
  const switchCount=getPackageSwitchCount(program,period);
  const switchLimit=Number(program.packageSwitchLimit)||0;
  return {period,activePackage,activeSince:activeEntry?.effectiveFrom||"",switchCount,switchLimit,remainingSwitches:getRemainingPackageSwitches(program,period),switchDisabled:Boolean(activePackage)&&switchCount>=switchLimit,action:activePackage?"switch":"initialize",history};
}
