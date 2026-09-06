export const TRANSACTION_STATUS = {
  PAID_BILL_SENT: "paid_bill_sent",
  HOST_BACK: "host_back",
  PERSONAL_USE: "personal_use",
  ANNUAL_FEE: "annual_fee",
  MANAGEMENT_FEE: "management_fee",
  // Kept only to read and edit existing records created before the status refresh.
  ISSUE: "issue",
  CANCELLED: "cancelled"
};

export const TRANSACTION_STATUS_OPTIONS = [
  {value:TRANSACTION_STATUS.PAID_BILL_SENT,label:"Đã thanh toán + Gửi bill"},
  {value:TRANSACTION_STATUS.HOST_BACK,label:"Host đã back"},
  {value:TRANSACTION_STATUS.PERSONAL_USE,label:"Tiêu dùng cá nhân"},
  {value:TRANSACTION_STATUS.ANNUAL_FEE,label:"Phí thường niên"},
  {value:TRANSACTION_STATUS.MANAGEMENT_FEE,label:"Phí quản lý"},
  {value:TRANSACTION_STATUS.CANCELLED,label:"Huỷ"}
];

const LEGACY_ISSUE_OPTION = {value:TRANSACTION_STATUS.ISSUE,label:"Có vấn đề"};
const ALL_TRANSACTION_STATUS_OPTIONS = [...TRANSACTION_STATUS_OPTIONS, LEGACY_ISSUE_OPTION];

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
  return LEGACY_STATUS_MAP.get(value.toLowerCase()) || TRANSACTION_STATUS.PAID_BILL_SENT;
}

export function transactionStatusOptionsForEditing(status){
  return normalizeTransactionStatus(status)===TRANSACTION_STATUS.ISSUE
    ? [...TRANSACTION_STATUS_OPTIONS, LEGACY_ISSUE_OPTION]
    : TRANSACTION_STATUS_OPTIONS;
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
