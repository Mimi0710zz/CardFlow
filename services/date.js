function pad2(value){
  return String(value).padStart(2, "0");
}

function partsToStorage(year, month, day){
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if(!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return "";
  if(y < 1000 || m < 1 || m > 12 || d < 1 || d > 31) return "";
  const date = new Date(Date.UTC(y, m - 1, d));
  if(date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return "";
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function toStorageDate(value){
  if(value == null || value === "") return "";
  if(value instanceof Date && !Number.isNaN(value.getTime())){
    return partsToStorage(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const text = String(value).trim();
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(match) return partsToStorage(match[1], match[2], match[3]);
  match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if(match) return partsToStorage(match[3], match[2], match[1]);
  return "";
}

export function parseDateInput(value){
  return toStorageDate(value);
}

export function isValidDate(value){
  return Boolean(toStorageDate(value));
}

export function formatDateDisplay(value, {emptyText = ""} = {}){
  const storage = toStorageDate(value);
  if(!storage) return emptyText;
  const [year, month, day] = storage.split("-");
  return `${day}-${month}-${year}`;
}

export function formatDateTimeDisplay(value, {emptyText = ""} = {}){
  if(!value) return emptyText;
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return emptyText;
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
