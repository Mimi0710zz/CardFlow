export const CASHBACK_RECEIPT_DESTINATION = Object.freeze({
  CREDIT_LIMIT: "credit_limit",
  CASH_OR_POINTS: "cash_or_points"
});

export const CASHBACK_RECEIPT_DESTINATION_OPTIONS = Object.freeze([
  { value: CASHBACK_RECEIPT_DESTINATION.CREDIT_LIMIT, label: "Hoàn vào hạn mức thẻ" },
  { value: CASHBACK_RECEIPT_DESTINATION.CASH_OR_POINTS, label: "Hoàn thành tiền/điểm đổi" }
]);

export function normalizeCashbackReceiptDestination(value, { legacy = false } = {}) {
  const raw = String(value ?? "").trim();
  if (raw === CASHBACK_RECEIPT_DESTINATION.CREDIT_LIMIT || raw === "Hoàn vào hạn mức thẻ") {
    return CASHBACK_RECEIPT_DESTINATION.CREDIT_LIMIT;
  }
  if (raw === CASHBACK_RECEIPT_DESTINATION.CASH_OR_POINTS || raw === "Hoàn thành tiền/điểm đổi") {
    return CASHBACK_RECEIPT_DESTINATION.CASH_OR_POINTS;
  }
  return legacy ? CASHBACK_RECEIPT_DESTINATION.CASH_OR_POINTS : CASHBACK_RECEIPT_DESTINATION.CREDIT_LIMIT;
}

export function cashbackReceiptDestinationLabel(value) {
  const normalized = normalizeCashbackReceiptDestination(value, { legacy: true });
  return CASHBACK_RECEIPT_DESTINATION_OPTIONS.find(option => option.value === normalized)?.label || "Hoàn thành tiền/điểm đổi";
}

export function cashbackCreditForCard(receipts = [], cardId = "") {
  return receipts.reduce((total, receipt) => {
    if (receipt?.cardId !== cardId) return total;
    if (normalizeCashbackReceiptDestination(receipt?.destination, { legacy: true }) !== CASHBACK_RECEIPT_DESTINATION.CREDIT_LIMIT) return total;
    const amount = Number(receipt?.amount) || 0;
    return total + Math.max(0, amount);
  }, 0);
}

export function calculateOutstandingDebt({ spent = 0, paid = 0, cashbackCredit = 0 } = {}) {
  return Math.max(0, (Number(spent) || 0) - (Number(paid) || 0) - (Number(cashbackCredit) || 0));
}
