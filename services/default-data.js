export const MCC_DEFAULTS = [
  ["Giáo dục",8211],["Thức ăn nhanh",5814],["Siêu thị",5411],["Đi lại",4789],
  ["Nhà hàng (SPP)",5812],["Thời trang",5611],["Spa",7298],["Du lịch (TVLK, Trip, Agoda)",4722],
  ["Du lịch / Khách sạn",7011],["Gym",7997],["Bảo hiểm",6300],["Rạp chiếu phim",7832],
  ["Vé máy bay",4511],["Điện tử / Điện máy",5732],["Sân golf",5262]
];

export const seedData = {
  schemaVersion: 2,
  revision: 0,
  updatedAt: new Date().toISOString(),
  deviceId: "",
  cards: [
    {id:"TCB-EVERYDAY", bank:"Techcombank", name:"Everyday", network:"", limitGroup:"TCB-EVERYDAY", groupLimit:82000000},
    {id:"SCB-AMEX", bank:"Sacombank", name:"American Express", network:"American Express", limitGroup:"SCB-SHARED", groupLimit:30000000},
    {id:"SCB-CASHBACK", bank:"Sacombank", name:"Cashback", network:"Visa", limitGroup:"SCB-SHARED", groupLimit:30000000},
    {id:"CAKE-SIGNATURE", bank:"Cake", name:"Signature", network:"", limitGroup:"CAKE-SIGNATURE", groupLimit:50000000}
  ],
  cashbackPrograms: [
    {id:"TCB-ONLINE", cardId:"TCB-EVERYDAY", name:"Online Cashback", rate:.05, max:500000, eligibleTarget:10000000, totalTarget:10000000, channel:"Online"},
    {id:"SCB-CB-SUPER", cardId:"SCB-CASHBACK", name:"Siêu thị / Tạp hóa", rate:.068, max:680000, eligibleTarget:10000000, totalTarget:10000000, categories:["Siêu thị"], shared:"SCB-CB-680"},
    {id:"SCB-CB-TRAVEL", cardId:"SCB-CASHBACK", name:"Di chuyển", rate:.168, max:680000, eligibleTarget:4047619, totalTarget:4047619, categories:["Đi lại"], shared:"SCB-CB-680"},
    {id:"SCB-AMEX-TRAVEL", cardId:"SCB-AMEX", name:"Du lịch / Khách sạn / Đại lý du lịch", rate:.20, max:1000000, eligibleTarget:5000000, totalTarget:5000000, categories:["Du lịch (TVLK, Trip, Agoda)","Du lịch / Khách sạn","Vé máy bay"]},
    {id:"CAKE-SIG-20", cardId:"CAKE-SIGNATURE", name:"Du lịch / Giáo dục / Điện máy", rate:.20, max:2000000, eligibleTarget:10000000, totalTarget:20000000, categories:["Du lịch (TVLK, Trip, Agoda)","Du lịch / Khách sạn","Vé máy bay","Giáo dục","Điện tử / Điện máy"]}
  ],
  hosts: [{id:"HOST-A", name:"Host A"}, {id:"HOST-B", name:"Host B"}],
  mccCategories: MCC_DEFAULTS.map(([name,mcc]) => ({id:`MCC-${mcc}`, name, mcc})),
  transactions: [],
  payments: [],
  settings: {}
};

export function cloneSeed(){
  return JSON.parse(JSON.stringify(seedData));
}
