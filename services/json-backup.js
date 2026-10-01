export const CARDFLOW_BACKUP_FORMAT="CardFlowBackup";
export const CARDFLOW_BACKUP_VERSION=1;
const BACKUP_SCHEMA_MAX = 21;
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
  "paymentTransactions",
  "reminders"
];
const SAFE_STATE_FIELDS=["schemaVersion","revision","updatedAt","deviceId",...KNOWN_ARRAY_FIELDS,"settings"];

function pad(value){
  return String(value).padStart(2, "0");
}

export function buildCardFlowBackupFilename(date = new Date()){
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `CardFlow_Backup_${stamp}.json`;
}

export function createCardFlowBackup(data,exportedAt=new Date().toISOString()){
  const safeData=Object.fromEntries(SAFE_STATE_FIELDS.filter(key=>Object.prototype.hasOwnProperty.call(data||{},key)).map(key=>[key,data[key]]));
  return {format:CARDFLOW_BACKUP_FORMAT,version:CARDFLOW_BACKUP_VERSION,exportedAt,data:safeData};
}

export function serializeCardFlowBackup(data,exportedAt){
  return JSON.stringify(createCardFlowBackup(data,exportedAt), null, 2);
}

export function validateCardFlowBackupJson(input){
  if(!input || typeof input !== "object" || Array.isArray(input)){
    return {valid:false, errors:["File JSON không chứa object dữ liệu CardFlow hợp lệ."], summary:null};
  }

  const envelope=input.format===CARDFLOW_BACKUP_FORMAT;
  const data=envelope?input.data:input;
  const errors = [];
  if(envelope&&Number(input.version)!==CARDFLOW_BACKUP_VERSION)errors.push(`Phiên bản backup ${input.version} không được hỗ trợ.`);
  if(envelope&&(!data||typeof data!=="object"||Array.isArray(data)))errors.push("Backup không chứa dữ liệu CardFlow hợp lệ.");
  const schemaVersion = Number(data?.schemaVersion);
  if(!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > BACKUP_SCHEMA_MAX){
    errors.push(`schemaVersion không hợp lệ. CardFlow Client hiện hỗ trợ backup schema 1-${BACKUP_SCHEMA_MAX}.`);
  }

  const presentArrays = KNOWN_ARRAY_FIELDS.filter(key => Array.isArray(data?.[key]));
  if(!presentArrays.length){
    errors.push("Không tìm thấy các bảng dữ liệu đặc trưng của CardFlow trong file backup.");
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      schemaVersion: Number.isInteger(schemaVersion) ? schemaVersion : null,
      cards: Array.isArray(data?.cards) ? data.cards.length : 0,
      transactions: Array.isArray(data?.transactions) ? data.transactions.length : 0,
      payments: Array.isArray(data?.payments) ? data.payments.length : 0,
      cashbackReceipts: Array.isArray(data?.cashbackReceipts) ? data.cashbackReceipts.length : 0,
      reminders: Array.isArray(data?.reminders) ? data.reminders.length : 0
    },
    data
  };
}
