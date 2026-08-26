export const TRANSACTION_STATUS = {
  PAID_BILL_SENT: "paid_bill_sent",
  HOST_BACK: "host_back",
  ISSUE: "issue",
  CANCELLED: "cancelled"
};

export const TRANSACTION_STATUS_OPTIONS = [
  {value:TRANSACTION_STATUS.PAID_BILL_SENT,label:"Đã thanh toán + Gửi bill"},
  {value:TRANSACTION_STATUS.HOST_BACK,label:"Host đã back"},
  {value:TRANSACTION_STATUS.ISSUE,label:"Có vấn đề"},
  {value:TRANSACTION_STATUS.CANCELLED,label:"Huỷ"}
];

const LEGACY_STATUS_MAP = new Map([
  ["đã thanh toán",TRANSACTION_STATUS.PAID_BILL_SENT],
  ["da thanh toan",TRANSACTION_STATUS.PAID_BILL_SENT],
  ["đã gửi host",TRANSACTION_STATUS.PAID_BILL_SENT],
  ["da gui host",TRANSACTION_STATUS.PAID_BILL_SENT],
  ["đơn đã đi",TRANSACTION_STATUS.PAID_BILL_SENT],
  ["don da di",TRANSACTION_STATUS.PAID_BILL_SENT],
  ["chờ back",TRANSACTION_STATUS.PAID_BILL_SENT],
  ["cho back",TRANSACTION_STATUS.PAID_BILL_SENT],
  ["đã back",TRANSACTION_STATUS.HOST_BACK],
  ["da back",TRANSACTION_STATUS.HOST_BACK],
  ["có vấn đề",TRANSACTION_STATUS.ISSUE],
  ["co van de",TRANSACTION_STATUS.ISSUE],
  ["hủy",TRANSACTION_STATUS.CANCELLED],
  ["huỷ",TRANSACTION_STATUS.CANCELLED],
  ["huy",TRANSACTION_STATUS.CANCELLED]
]);

export function transactionStatusLabel(status){
  return TRANSACTION_STATUS_OPTIONS.find(option=>option.value===status)?.label || TRANSACTION_STATUS_OPTIONS[0].label;
}

export function normalizeTransactionStatus(status){
  const value=String(status || "").trim();
  if(TRANSACTION_STATUS_OPTIONS.some(option=>option.value===value)) return value;
  return LEGACY_STATUS_MAP.get(value.toLowerCase()) || TRANSACTION_STATUS.PAID_BILL_SENT;
}

export function isHostBackStatus(status){
  return status === TRANSACTION_STATUS.HOST_BACK;
}

export function isCancelledTransactionStatus(status){
  return status === TRANSACTION_STATUS.CANCELLED;
}
