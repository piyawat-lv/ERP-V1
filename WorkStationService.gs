/**
 * WorkStationService.gs (Rev.01)
 * จัดการทะเบียนเครื่องจักร (Master Data Only)
 */

const WS_SHEET_NAME = "WorkStation";

// 1. ดึงข้อมูลทั้งหมด
function api_getAllWorkStations() {
  try {
    const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(WS_SHEET_NAME);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // อ่านข้อมูล 8 คอลัมน์ (A-H)
    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

    return data.map(r => ({
      id: r[0],
      code: r[1],
      name: r[2],
      type: r[3],
      model: r[4],
      capacity: r[5],
      status: r[6],
      created: r[7]
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
}

// 2. เช็ค Duplicate Code (เหมือน Item Master)
function api_checkStationCode(code) {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(WS_SHEET_NAME);
  if (!sheet) return { status: 'AVAILABLE', message: 'Sheet not found' };

  const data = sheet.getDataRange().getValues();
  const inputCode = code.toUpperCase().trim();
  const exists = data.some(r => String(r[1]).toUpperCase() === inputCode);

  if (!exists) {
    return { status: 'AVAILABLE', message: '✅ รหัสนี้ใช้งานได้' };
  } else {
    return { status: 'DUPLICATE', message: '❌ รหัสซ้ำ!' };
  }
}

// 3. บันทึกข้อมูล (Create / Update)
function api_saveWorkStation(wsData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
    let sheet = ss.getSheetByName(WS_SHEET_NAME);

    // สร้าง Sheet และ Header ถ้ายังไม่มี
    if (!sheet) {
      sheet = ss.insertSheet(WS_SHEET_NAME);
      sheet.appendRow(['StationID', 'StationCode', 'StationName', 'Type', 'Model', 'Capacity', 'Status', 'CreatedAt']);
    }

    const data = sheet.getDataRange().getValues();

    // --- Validate ---
    if (!wsData.code || !wsData.name) return { success: false, message: 'Code & Name are required.' };

    // --- UPDATE ---
    if (wsData.id) {
      const rowIndex = data.findIndex(r => String(r[0]) === String(wsData.id));
      if (rowIndex === -1) return { success: false, message: 'ID Not Found' };

      const row = rowIndex + 1;
      sheet.getRange(row, 2).setValue(wsData.code.toUpperCase());
      sheet.getRange(row, 3).setValue(wsData.name);
      sheet.getRange(row, 4).setValue(wsData.type);
      sheet.getRange(row, 5).setValue(wsData.model);
      sheet.getRange(row, 6).setValue(wsData.capacity); // Text or Number
      sheet.getRange(row, 7).setValue(wsData.status);

      return { success: true, message: 'Updated Work Station Successfully' };
    }

    // --- CREATE ---
    else {
      // Check Duplicate
      const inputCode = wsData.code.toUpperCase().trim();
      if (data.some(r => String(r[1]).toUpperCase() === inputCode)) {
        return { success: false, message: 'Duplicate Station Code!' };
      }

      const newId = 'WS-' + Date.now();
      sheet.appendRow([
        newId,
        inputCode,
        wsData.name,
        wsData.type,
        wsData.model,
        wsData.capacity,
        wsData.status || 'Active',
        new Date()
      ]);

      return { success: true, message: 'Created Work Station Successfully' };
    }

  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}
