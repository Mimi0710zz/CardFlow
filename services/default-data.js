export const MCC_DEFAULTS = [
  ["Giáo dục",8211],["Thức ăn nhanh",5814],["Siêu thị",5411],["Đi lại",4789],
  ["Nhà hàng (SPP)",5812],["Thời trang",5611],["Spa",7298],["Du lịch (TVLK, Trip, Agoda)",4722],
  ["Du lịch / Khách sạn",7011],["Gym",7997],["Bảo hiểm",6300],["Rạp chiếu phim",7832],
  ["Vé máy bay",4511],["Điện tử / Điện máy",5732],["Sân golf",5262]
];

export const BANK_MAPPINGS = [
  {code:"TCB", name:"Techcombank", aliases:["Techcombank"]},
  {code:"SACOM", name:"Sacombank", aliases:["Sacombank"]},
  {code:"SCB", name:"SCB", aliases:["SCB"]},
  {code:"VCB", name:"Vietcombank", aliases:["Vietcombank"]},
  {code:"CTG", name:"VietinBank", aliases:["VietinBank"]},
  {code:"BIDV", name:"BIDV", aliases:["BIDV"]},
  {code:"ACB", name:"ACB", aliases:["ACB"]},
  {code:"MBB", name:"MB", aliases:["MB"]},
  {code:"VPB", name:"VPBank", aliases:["VPBank"]},
  {code:"TPB", name:"TPBank", aliases:["TPBank"]},
  {code:"VIB", name:"VIB", aliases:["VIB"]},
  {code:"HSBC", name:"HSBC", aliases:["HSBC"]},
  {code:"SHINHAN", name:"Shinhan Bank", aliases:["Shinhan Bank"]},
  {code:"SCBSTD", name:"Standard Chartered", aliases:["Standard Chartered"]},
  {code:"CAKE", name:"Cake", aliases:["Cake"]}
];

export const seedData = {
  schemaVersion: 2,
  revision: 0,
  updatedAt: new Date().toISOString(),
  deviceId: "",
  banks: [],
  cards: [],
  cashbackPrograms: [],
  hosts: [],
  mccCategories: MCC_DEFAULTS.map(([name,mcc]) => ({id:`MCC-${mcc}`, name, mcc})),
  transactions: [],
  cashbackReceipts: [],
  payments: [],
  settings: {setupCompleted:false}
};

export function cloneSeed(){
  return JSON.parse(JSON.stringify(seedData));
}
