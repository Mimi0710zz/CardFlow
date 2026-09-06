export const INSURANCE_LINKS = Object.freeze([
  ["AIA","https://www.aia.com.vn/vi/dich-vu-khach-hang/thanh-toan-phi-bao-hiem.html"],
  ["AIA qua PAYOO","https://bill.payoo.vn/tra-tien-thanh-toan-bao-hiem-aia"],
  ["MANU","https://dongphi.manulife.com.vn/Page?app=online_payment"],
  ["CHUB","https://www.baohiemchubblife.vn/clientinfo/#/payment-no-authen"],
  ["SUNLIFE","https://online.sunlife.com.vn/sunway/processPayment?param=z4pC2qRaBC974KbXGULQCAlVOVhoFx2a4bCFD-iojBBEr5L2R9Zaw1M3IcfFCiSu9W36-3z9onQL9M9ZaOCW6JixW-DJAq4ILzGGCvpXv-A"],
  ["PRUDENTIAL","https://portal.prudential.com.vn/onlinepayment/payment"],
  ["HANWHALIFE","https://khachhang.hanwhalife.com.vn/"],
  ["MB","https://www.mbageas.life/tra-cuu-va-dong-phi-bao-hiem"],
  ["BẢO VIỆT","https://mybvlife.baovietnhantho.com.vn/#/auth/login"],
  ["DAICHI","https://kh.dai-ichi-life.com.vn/familypayment"],
  ["CATHAY","https://www.cathaylife.com.vn/CPWeb/html/MO/A1/MOA1_0100/MOA10000.html"]
].map(([name,url],index)=>Object.freeze({index:index+1,name,url})));
