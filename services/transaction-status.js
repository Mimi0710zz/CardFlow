export const TRANSACTION_STATUS = {
  SENT_BILL: "sent_bill",
  HOST_BACK: "host_back",
  PERSONAL_USE: "personal_use",
  ANNUAL_FEE: "annual_fee",
  MANAGEMENT_FEE: "management_fee",
  // Kept only to read and edit existing records created before the status refresh.
  ISSUE: "issue",
  CANCELLED: "cancelled"
};

export const TRANSACTION_STATUS_OPTIONS = [
  {value:TRANSACTION_STATUS.SENT_BILL,label:"Đã gửi bill"},
  {value:TRANSACTION_STATUS.HOST_BACK,label:"Host đã back"},
  {value:TRANSACTION_STATUS.PERSONAL_USE,label:"Tiêu cá nhân"}
];

const LEGACY_STATUS_OPTIONS = [
  {value:TRANSACTION_STATUS.ISSUE,label:"Có vấn đề"},
  {value:TRANSACTION_STATUS.ANNUAL_FEE,label:"Phí thường niên"},
  {value:TRANSACTION_STATUS.MANAGEMENT_FEE,label:"Phí quản lý"},
  {value:TRANSACTION_STATUS.CANCELLED,label:"Huỷ"}
];
const ALL_TRANSACTION_STATUS_OPTIONS = [...TRANSACTION_STATUS_OPTIONS, ...LEGACY_STATUS_OPTIONS];

const LEGACY_STATUS_MAP = new Map([
  ["paid_bill_sent",TRANSACTION_STATUS.SENT_BILL],
  ["đã thanh toán + gửi bill",TRANSACTION_STATUS.SENT_BILL],
  ["đã thanh toán",TRANSACTION_STATUS.SENT_BILL],
  ["da thanh toan",TRANSACTION_STATUS.SENT_BILL],
  ["đã gửi host",TRANSACTION_STATUS.SENT_BILL],
  ["da gui host",TRANSACTION_STATUS.SENT_BILL],
  ["đơn đã đi",TRANSACTION_STATUS.SENT_BILL],
  ["don da di",TRANSACTION_STATUS.SENT_BILL],
  ["chờ back",TRANSACTION_STATUS.SENT_BILL],
  ["cho back",TRANSACTION_STATUS.SENT_BILL],
  ["đã back",TRANSACTION_STATUS.HOST_BACK],
  ["da back",TRANSACTION_STATUS.HOST_BACK],
  ["tiêu dùng cá nhân",TRANSACTION_STATUS.PERSONAL_USE],
  ["tieu dung ca nhan",TRANSACTION_STATUS.PERSONAL_USE],
  ["có vấn đề",TRANSACTION_STATUS.ISSUE],
  ["co van de",TRANSACTION_STATUS.ISSUE],
  ["hủy",TRANSACTION_STATUS.CANCELLED],
  ["huỷ",TRANSACTION_STATUS.CANCELLED],
  ["huy",TRANSACTION_STATUS.CANCELLED]
]);

export function transactionStatusLabel(status){
  return ALL_TRANSACTION_STATUS_OPTIONS.find(option=>option.value===status)?.label || TRANSACTION_STATUS_OPTIONS[0].label;
}

export function normalizeTransactionStatus(status){
  const value=String(status || "").trim();
  if(ALL_TRANSACTION_STATUS_OPTIONS.some(option=>option.value===value)) return value;
  return LEGACY_STATUS_MAP.get(value.toLowerCase()) || TRANSACTION_STATUS.SENT_BILL;
}

export function transactionStatusOptionsForEditing(status){
  const normalized=normalizeTransactionStatus(status);
  const legacy=LEGACY_STATUS_OPTIONS.find(option=>option.value===normalized);
  return legacy ? [...TRANSACTION_STATUS_OPTIONS, legacy] : TRANSACTION_STATUS_OPTIONS;
}

export function isLegacyIssueStatus(status){
  return String(status || "").trim().toLowerCase()==="có vấn đề";
}

export function isHostBackStatus(status){
  return status === TRANSACTION_STATUS.HOST_BACK;
}

export function isPersonalUseStatus(status){
  return status === TRANSACTION_STATUS.PERSONAL_USE;
}

export function isHostFeeApplicable(transaction){
  return !isPersonalUseStatus(normalizeTransactionStatus(transaction?.status));
}

export function isCancelledTransactionStatus(status){
  return status === TRANSACTION_STATUS.CANCELLED;
}
