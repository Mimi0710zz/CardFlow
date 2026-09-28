const BACKUP_SCHEMA_MAX = 20;
const KNOWN_ARRAY_FIELDS = [
  "banks",
  "cards",
  "cashbackProgramGroups",
  "cashbackCardConfigs",
  "hosts",
  "mccCategories",
  "orderTypes",
  "transactions",
  "cashbackReceipts",
  "trackingCashbackReceipts",
  "feeTargets",
  "payments",
  "reminders"
];

function pad(value){
  return String(value).padStart(2, "0");
}

export function buildCardFlowBackupFilename(date = new Date()){
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `CardFlow_Client_Backup_${stamp}.json`;
}

export function serializeCardFlowBackup(data){
  return JSON.stringify(data, null, 2);
}

export function validateCardFlowBackupJson(input){
  if(!input || typeof input !== "object" || Array.isArray(input)){
    return {valid:false, errors:["File JSON không chứa object dữ liệu CardFlow hợp lệ."], summary:null};
  }

  const schemaVersion = Number(input.schemaVersion);
  const errors = [];
  if(!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > BACKUP_SCHEMA_MAX){
    errors.push(`schemaVersion không hợp lệ. CardFlow Client hiện hỗ trợ backup schema 1-${BACKUP_SCHEMA_MAX}.`);
  }

  const presentArrays = KNOWN_ARRAY_FIELDS.filter(key => Array.isArray(input[key]));
  if(!presentArrays.length){
    errors.push("Không tìm thấy các bảng dữ liệu đặc trưng của CardFlow trong file backup.");
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      schemaVersion: Number.isInteger(schemaVersion) ? schemaVersion : null,
      cards: Array.isArray(input.cards) ? input.cards.length : 0,
      transactions: Array.isArray(input.transactions) ? input.transactions.length : 0,
      payments: Array.isArray(input.payments) ? input.payments.length : 0,
      cashbackReceipts: Array.isArray(input.cashbackReceipts) ? input.cashbackReceipts.length : 0,
      reminders: Array.isArray(input.reminders) ? input.reminders.length : 0
    }
  };
}
