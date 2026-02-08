/**
 * InventoryService.gs (Rev.02 - Full Features)
 */

const SHEET_INV_TRANS = "Inventory_Trans";
const SHEET_INV_ONHAND = "Inventory_onhand";
const SHEET_ITEM = "ItemMaster";

// 1. Helper: ดึงข้อมูล Item (เพื่อหา UOM และ Name)
function api_getItemInfo(code) {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_ITEM);
  const data = sheet.getDataRange().getValues();
  // สมมติ ItemCode=Col B(1), Name=Col C(2), UOM=Col G(6) (อิงตาม ItemMaster Rev ล่าสุด)
  const item = data.find(r => String(r[1]).toUpperCase() === code.toUpperCase().trim());
  if (item) {
    return { found: true, name: item[2], uom: item[6] };
  }
  return { found: false, name: '', uom: '' };
}

// 2. บันทึก Transaction (IN / OUT / ADJ)
function api_saveInvTransaction(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_INV_TRANS);
    
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_INV_TRANS);
      sheet.appendRow(['TransID','Date','Type','SubType','RefDoc','ItemCode','ItemName','Qty','UOM','LotNo','Location','MfgDate','ExpDate','ItemStatus','User','Note','CreatedAt']);
    }

    // --- 1. Auto VLOOKUP UOM & Name ---
    const itemInfo = api_getItemInfo(data.itemCode);
    const finalUOM = itemInfo.found ? itemInfo.uom : (data.uom || '-');
    const finalName = itemInfo.found ? itemInfo.name : (data.itemName || 'Unknown');

    // --- 2. Generate TransID ---
    const today = new Date();
    const yymm = Utilities.formatDate(today, "GMT+7", "yyMM");
    const prefix = "TR-" + yymm + "-";
    // นับจำนวน row เพื่อ gen id ง่ายๆ (หรือจะใช้ logic อื่นก็ได้)
    const nextId = prefix + String(sheet.getLastRow()).padStart(4, '0');
    
    const currentUser = Session.getActiveUser().getEmail();

    // --- 3. Save to Trans Sheet ---
    sheet.appendRow([
      nextId,
      data.date,          // String YYYY-MM-DD
      data.type,          // IN, OUT, ADJ
      data.subType,       // RM, PK, FG...
      data.refDoc,
      data.itemCode,
      finalName,
      Number(data.qty),   // Ensure Number
      finalUOM,
      data.lotNo,
      data.location,
      data.mfgDate,       // New
      data.expDate,
      data.itemStatus,    // AVG, Damage...
      currentUser,
      data.note,
      new Date()
    ]);

    // --- 4. Trigger Recalculate Stock On-Hand ---
    updateStockOnHandSheet(ss);

    return { success: true, message: `Transaction Saved: ${nextId}` };

  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

// 3. ฟังก์ชันคำนวณและอัปเดต Sheet "Inventory_onhand"
function updateStockOnHandSheet(ss) {
  const transSheet = ss.getSheetByName(SHEET_INV_TRANS);
  let stockSheet = ss.getSheetByName(SHEET_INV_ONHAND);
  
  if(!stockSheet) { stockSheet = ss.insertSheet(SHEET_INV_ONHAND); }
  
  const transData = transSheet.getDataRange().getValues();
  // Skip Header, data starts row 1 (index 1)
  if(transData.length < 2) return;

  // Dictionary เพื่อรวมยอด: Key = ItemCode + Lot + Location + Status
  let stockMap = {};

  for(let i=1; i<transData.length; i++) {
    const r = transData[i];
    const type = r[2]; // IN, OUT, ADJ
    const itemCode = r[5];
    const itemName = r[6];
    const qty = Number(r[7]);
    const uom = r[8];
    const lot = r[9];
    const loc = r[10];
    const status = r[13];

    // สร้าง Key
    const key = `${itemCode}|${lot}|${loc}|${status}`;

    if(!stockMap[key]) {
      stockMap[key] = {
        code: itemCode, name: itemName, lot: lot, loc: loc, status: status, uom: uom, qty: 0
      };
    }

    // Logic คำนวณ
    if(type === 'IN') {
       stockMap[key].qty += qty;
    } else if (type === 'OUT') {
       stockMap[key].qty -= qty;
    } else if (type === 'ADJ') {
       // ADJ ถ้า User กรอกลบคือลด กรอกบวกคือเพิ่ม
       stockMap[key].qty += qty; 
    }
  }

  // เขียนข้อมูลใหม่ทับลงใน Inventory_onhand
  stockSheet.clear();
  stockSheet.appendRow(['ItemCode','ItemName','LotNo','Location','ItemStatus','Qty','UOM','LastUpdate']);

  const rowsToWrite = [];
  const now = new Date();
  
  for(const key in stockMap) {
    const s = stockMap[key];
    if(s.qty !== 0) { // เก็บเฉพาะยอดที่ไม่ใช่ 0
       rowsToWrite.push([s.code, s.name, s.lot, s.loc, s.status, s.qty, s.uom, now]);
    }
  }
  
  if(rowsToWrite.length > 0) {
    stockSheet.getRange(2, 1, rowsToWrite.length, 8).setValues(rowsToWrite);
  }
}

// 4. Report 1: Stock On-Hand (CSV)
function api_getReportOnHand() {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  
  // เรียก update ก่อนเพื่อให้ข้อมูลล่าสุด
  updateStockOnHandSheet(ss);
  
  const sheet = ss.getSheetByName(SHEET_INV_ONHAND);
  const data = sheet.getDataRange().getValues();
  
  // แปลงเป็น CSV
  let csv = "";
  data.forEach(row => {
     // Join ด้วย comma, ใส่ quote กันข้อมูลมี comma
     const line = row.map(field => `"${field}"`).join(",");
     csv += line + "\n";
  });
  
  return { success: true, csvData: csv, fileName: "Stock_OnHand.csv", displayData: data.slice(1) };
}

// 5. Report 2: Movement (CSV with Filter)
function api_getReportMovement(typeFilter, startDate, endDate) {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_INV_TRANS);
  const data = sheet.getDataRange().getValues();
  
  const start = new Date(startDate).setHours(0,0,0,0);
  const end = new Date(endDate).setHours(23,59,59,999);
  
  let csv = "TransID,Date,Type,SubType,RefDoc,ItemCode,Name,Qty,UOM,Lot,Loc,User\n";
  const filteredData = [];

  // Loop ข้อมูล (ข้าม Header)
  for(let i=1; i<data.length; i++) {
     const r = data[i];
     const rDate = new Date(r[1]); // Col B
     const rType = r[2]; // Col C
     
     // Check Date
     if(rDate.getTime() < start || rDate.getTime() > end) continue;
     
     // Check Type (ถ้าเลือก All ก็ผ่านหมด)
     if(typeFilter !== 'ALL' && rType !== typeFilter) continue;
     
     const rowString = [
       r[0], // ID
       Utilities.formatDate(rDate, "GMT+7", "yyyy-MM-dd"),
       r[2], // Type
       r[3], // SubType
       r[4], // Ref
       r[5], // Code
       `"${r[6]}"`, // Name
       r[7], // Qty
       r[8], // UOM
       r[9], // Lot
       r[10], // Loc
       r[14] // User
     ].join(",");
     
     csv += rowString + "\n";
     filteredData.push(rowString); // เก็บไว้โชว์ได้ถ้าต้องการ
  }

  return { success: true, csvData: csv, fileName: `Movement_${typeFilter}.csv` };
}
