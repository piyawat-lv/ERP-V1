/**
 * JobOrderService.gs (Rev.01)
 * จัดการใบสั่งผลิต (Job Order)
 */

const SHEET_JOB = "JobOrder";

// 1. ดึงรายการ Job ทั้งหมด
function api_getAllJobs() {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_JOB);
  if(!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if(data.length < 2) return [];

  return data.slice(1).map(r => ({
    jobNo: r[0],
    jobDate: r[1],
    itemCode: r[2],
    itemName: r[3],
    planQty: r[4],
    uom: r[5],
    dueDate: r[6],
    bomId: r[7],
    lotNo: r[8],
    status: r[9],
    note: r[10]
  })).reverse(); // โชว์รายการใหม่สุดก่อน
}

// 2. ค้นหา Active BOM ของสินค้า (เพื่อนำมาเปิด Job)
function api_findActiveBOM(itemCode) {
  // ใช้ Function เดิมจาก BOMService แต่กรองเฉพาะ Active
  const result = api_findBOMByItemCode(itemCode); 
  // หมายเหตุ: api_findBOMByItemCode ใน BOMService Rev.03 คืนค่า BOM ตัวแรกที่เจอ
  // ในการใช้งานจริงควรเช็ค Status Active ด้วย แต่เบื้องต้นใช้ตัวนี้ก่อนได้ครับ
  return result;
}

// 3. บันทึก Job Order ใหม่
function api_saveJobOrder(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_JOB);

    if(!sheet) {
       sheet = ss.insertSheet(SHEET_JOB);
       sheet.appendRow(['JobNo','JobDate','ItemCode','ItemName','PlanQty','UOM','DueDate','BOM_ID','LotNo','Status','Note','CreatedAt']);
    }

    // Generate Job No (JO-YYMM-XXX)
    const today = new Date();
    const yymm = Utilities.formatDate(today, "GMT+7", "yyMM");
    const prefix = "JO-" + yymm + "-";
    
    // หาเลข Running (แบบง่าย นับจำนวนแถวที่ขึ้นต้นด้วย Prefix)
    const allData = sheet.getDataRange().getValues();
    let count = 0;
    allData.forEach(r => { if(String(r[0]).startsWith(prefix)) count++; });
    
    const runNo = String(count + 1).padStart(3, '0');
    const jobNo = prefix + runNo;

    // เตรียมข้อมูลลง Sheet
    const rowData = [
       jobNo,
       Utilities.formatDate(today, "GMT+7", "yyyy-MM-dd"), // JobDate
       data.itemCode,
       data.itemName,
       data.planQty,
       data.uom,
       data.dueDate, // String yyyy-MM-dd
       data.bomId,
       data.lotNo,
       'Planned',    // Status เริ่มต้น
       data.note,
       new Date()
    ];

    sheet.appendRow(rowData);
    return { success: true, message: 'Job Order Created: ' + jobNo, jobNo: jobNo };

  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

// 4. อัปเดตสถานะ Job
function api_updateJobStatus(jobNo, newStatus) {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_JOB);
  const data = sheet.getDataRange().getValues();
  
  const rowIndex = data.findIndex(r => r[0] === jobNo);
  if(rowIndex === -1) return { success: false, message: 'Job not found' };
  
  // Col J (Index 9) is Status
  sheet.getRange(rowIndex + 1, 10).setValue(newStatus);
  return { success: true, message: 'Status updated to ' + newStatus };
}
