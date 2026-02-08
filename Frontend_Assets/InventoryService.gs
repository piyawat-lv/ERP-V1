/**
 * InventoryService.gs (Rev.01 - Inbound)
 * จัดการการรับเข้า (Inbound)
 */

const SHEET_INV = "Inventory_Trans";
const SHEET_JOB = "JobOrder";
const SHEET_ITEM = "ItemMaster";

// 1. ค้นหาข้อมูล Item (VLOOKUP)
function api_getItemDetails(itemCode) {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_ITEM);
  const data = sheet.getDataRange().getValues();
  
  // Find Item (Col B = ItemCode)
  const item = data.find(r => String(r[1]).toUpperCase() === itemCode.toUpperCase().trim());
  
  if(item) {
    return { success: true, name: item[2], uom: item[6] }; // Adjust index based on your ItemMaster cols
  } else {
    return { success: false, message: 'Item Not Found' };
  }
}

// 2. ค้นหาข้อมูล Job Order (เพื่อดึง FG มาดีแคลร์รับเข้า)
function api_getJobDetails(jobNo) {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_JOB);
  const data = sheet.getDataRange().getValues();
  
  // Find Job (Col A = JobNo)
  const job = data.find(r => String(r[0]).toUpperCase() === jobNo.toUpperCase().trim());
  
  if(job) {
    return { 
      success: true, 
      itemCode: job[2], 
      itemName: job[3], 
      planQty: job[4], 
      uom: job[5],
      lotNo: job[8]
    };
  } else {
    return { success: false, message: 'Job No Not Found' };
  }
}

// 3. บันทึก Transaction (Inbound)
function api_saveInbound(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_INV);
    
    if(!sheet) {
      sheet = ss.insertSheet(SHEET_INV);
      sheet.appendRow(['TransID','Date','Type','SubType','RefDoc','ItemCode','ItemName','Qty','UOM','LotNo','Location','ExpDate','User','Note','CreatedAt']);
    }
    
    // Generate Trans ID (TR-YYMM-XXX)
    const today = new Date();
    const yymm = Utilities.formatDate(today, "GMT+7", "yyMM");
    const prefix = "TR-" + yymm + "-";
    const allData = sheet.getDataRange().getValues();
    let count = 0;
    allData.forEach(r => { if(String(r[0]).startsWith(prefix)) count++; });
    const transId = prefix + String(count + 1).padStart(4, '0');
    
    // Get User
    const user = Session.getActiveUser().getEmail();

    // Append Row
    sheet.appendRow([
      transId,
      Utilities.formatDate(new Date(data.date), "GMT+7", "yyyy-MM-dd"),
      'IN',             // Type
      data.subType,     // Purchase or Production
      data.refDoc,
      data.itemCode,
      data.itemName,
      data.qty,
      data.uom,
      data.lotNo,
      data.location,
      data.expDate || '',
      user,
      data.note,
      new Date()
    ]);

    return { success: true, message: 'Received Successfully: ' + transId };

  } catch(e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

// 4. ดึงรายการล่าสุด (Recent Transactions)
function api_getRecentTrans() {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_INV);
  if(!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if(data.length < 2) return [];
  
  // เอาเฉพาะ Type = IN และ 10 รายการล่าสุด
  return data.slice(1)
             .filter(r => r[2] === 'IN')
             .reverse()
             .slice(0, 10)
             .map(r => ({
               id: r[0],
               date: Utilities.formatDate(new Date(r[1]), "GMT+7", "dd/MM/yyyy"),
               type: r[3], // SubType
               item: r[5] + ' - ' + r[6],
               qty: r[7] + ' ' + r[8],
               loc: r[10]
             }));
}
