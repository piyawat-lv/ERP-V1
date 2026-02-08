/**
 * BOMService.gs (Rev.01)
 * จัดการสูตรการผลิต (Header & Detail)
 */

const SHEET_BOM_HEAD = "BOM_Header";
const SHEET_BOM_DTL = "BOM_Detail";

// 1. ดึงข้อมูล Master Data สำหรับ Dropdown
function api_getMasterDataForBOM() {
  const items = api_getAllItems(); // จาก ItemService
  const stations = api_getAllWorkStations(); // จาก WorkStationService
  
  // Filter เฉพาะ FG เพื่อทำหัวบิล, RM/PK เพื่อเป็นส่วนผสม
  return {
    fgList: items.filter(i => ['Finished Good', 'WIP', 'Semi-Product'].includes(i.category)),
    matList: items.filter(i => ['Raw Material', 'Packaging', 'Semi-Product'].includes(i.category)),
    machineList: stations.filter(s => s.status === 'Active')
  };
}

// 2. ดึงรายการ BOM ทั้งหมด (แสดงหน้าแรก)
function api_getBOMList() {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_BOM_HEAD);
  if(!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if(data.length < 2) return [];
  
  return data.slice(1).map(r => ({
    bomId: r[0],
    fgCode: r[1],
    fgName: r[2],
    batchSize: r[3],
    revision: r[5],
    status: r[6]
  }));
}

// 3. ดึง BOM รายตัว (สำหรับ Edit)
function api_getBOMDetail(bomId) {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  
  // Get Header
  const hSheet = ss.getSheetByName(SHEET_BOM_HEAD);
  const hData = hSheet.getDataRange().getValues();
  const headerRow = hData.find(r => r[0] === bomId);
  if(!headerRow) return null;

  // Get Details
  const dSheet = ss.getSheetByName(SHEET_BOM_DTL);
  const dData = dSheet.getDataRange().getValues();
  // Filter เอาเฉพาะ row ที่ BOM_ID ตรงกัน
  const details = dData.filter(r => r[0] === bomId).map(r => ({
    seq: r[1],
    type: r[2],
    code: r[3],
    name: r[4],
    qty: r[5],
    uom: r[6],
    params: r[7] // Parameter เครื่องจักร
  }));

  return {
    header: {
      bomId: headerRow[0],
      fgCode: headerRow[1],
      fgName: headerRow[2],
      batchSize: headerRow[3],
      batchUOM: headerRow[4],
      revision: headerRow[5],
      status: headerRow[6]
    },
    details: details
  };
}

// 4. บันทึก BOM (Save Header + Replace Details)
function api_saveBOM(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
    
    let hSheet = ss.getSheetByName(SHEET_BOM_HEAD);
    let dSheet = ss.getSheetByName(SHEET_BOM_DTL);

    // Create Sheets if missing
    if(!hSheet) { hSheet = ss.insertSheet(SHEET_BOM_HEAD); hSheet.appendRow(['BOM_ID','FG_Code','FG_Name','BatchSize','BatchUOM','Revision','Status','UpdatedAt']); }
    if(!dSheet) { dSheet = ss.insertSheet(SHEET_BOM_DTL); dSheet.appendRow(['BOM_ID','Seq','Type','Code','Name','Qty_Time','UOM','Parameters']); }

    const bomId = data.header.bomId || ('BOM-' + Date.now());
    const timestamp = new Date();

    // --- STEP 1: Save Header ---
    const hRows = hSheet.getDataRange().getValues();
    const hIndex = hRows.findIndex(r => r[0] === bomId);
    
    const rowData = [
      bomId, 
      data.header.fgCode, 
      data.header.fgName, 
      data.header.batchSize, 
      data.header.batchUOM, 
      data.header.revision || 'Rev.01', 
      data.header.status || 'Active', 
      timestamp
    ];

    if(hIndex > -1) {
       // Update
       hSheet.getRange(hIndex + 1, 1, 1, 8).setValues([rowData]);
    } else {
       // Create
       hSheet.appendRow(rowData);
    }

    // --- STEP 2: Save Details (Delete old -> Insert new) ---
    // วิธีง่ายสุดคือลบรายการเก่าของ BOM นี้ทิ้งแล้วลงใหม่
    // แต่เพื่อประสิทธิภาพ ถ้าข้อมูลเยอะอาจต้องใช้วิธีอื่น แต่วิธีนี้ง่ายและชัวร์สุดสำหรับ Apps Script
    
    // หา Row ที่ต้องลบ
    const dRows = dSheet.getDataRange().getValues();
    // วนลูปจากล่างขึ้นบนเพื่อ delete row
    for (let i = dRows.length - 1; i >= 1; i--) {
      if (dRows[i][0] === bomId) {
        dSheet.deleteRow(i + 1);
      }
    }

    // ลงข้อมูลใหม่
    if(data.details && data.details.length > 0) {
      const newRows = data.details.map((d, index) => [
        bomId,
        index + 1, // Seq อัตโนมัติ
        d.type,
        d.code,
        d.name,
        d.qty,
        d.uom,
        d.params || '' // Parameter
      ]);
      
      // Batch insert
      dSheet.getRange(dSheet.getLastRow() + 1, 1, newRows.length, 8).setValues(newRows);
    }

    return { success: true, message: 'BOM Saved Successfully', bomId: bomId };

  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}
