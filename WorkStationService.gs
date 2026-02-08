/**
 * WorkStationService.gs (Rev.02 - Separate Capacity & UOM)
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

    // อ่านข้อมูล 9 คอลัมน์ (A-I) เพิ่ม CapacityUOM เข้ามา
    const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();

    return data.map(r => ({
      id: r[0],
      code: r[1],
      name: r[2],
      type: r[3],
      model: r[4],
      capacity: Number(r[5]) || 0, // บังคับเป็นตัวเลข
      capacityUOM: r[6],           // [NEW] หน่วยนับ
      status: r[7],
      created: r[8]
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
}

// 2. เช็ค Duplicate (Logic เดิม)
function api_checkStationCode(code) {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(WS_SHEET_NAME);
  if (!sheet) return { status: 'AVAILABLE', message: 'Sheet not found' };
  
  const data = sheet.getDataRange().getValues();
  const inputCode = code.toUpperCase().trim();
  // เช็ค Col B (Index 1)
  const exists = data.some(r => String(r[1]).toUpperCase() === inputCode);

  return exists ? { status: 'DUPLICATE', message: '❌ รหัสซ้ำ!' } : { status: 'AVAILABLE', message: '✅ ใช้งานได้' };
}

// 3. บันทึกข้อมูล (Updated Rev.02)
function api_saveWorkStation(wsData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
    let sheet = ss.getSheetByName(WS_SHEET_NAME);

    // ถ้าไม่มี Sheet ให้สร้างใหม่พร้อม Header 9 ช่อง
    if (!sheet) {
      sheet = ss.insertSheet(WS_SHEET_NAME);
      sheet.appendRow(['StationID', 'StationCode', 'StationName', 'Type', 'Model', 'Capacity', 'CapacityUOM', 'Status', 'CreatedAt']);
    }

    const data = sheet.getDataRange().getValues();

    if (!wsData.code || !wsData.name) return { success: false, message: 'Code & Name required.' };

    // --- UPDATE ---
    if (wsData.id) {
      const rowIndex = data.findIndex(r => String(r[0]) === String(wsData.id));
      if (rowIndex === -1) return { success: false, message: 'ID Not Found' };

      const row = rowIndex + 1;
      sheet.getRange(row, 2).setValue(wsData.code.toUpperCase());
      sheet.getRange(row, 3).setValue(wsData.name);
      sheet.getRange(row, 4).setValue(wsData.type);
      sheet.getRange(row, 5).setValue(wsData.model);
      sheet.getRange(row, 6).setValue(wsData.capacity);     // Col F
      sheet.getRange(row, 7).setValue(wsData.capacityUOM);  // Col G [NEW]
      sheet.getRange(row, 8).setValue(wsData.status);       // Col H

      return { success: true, message: 'Updated Work Station Successfully' };
    }

    // --- CREATE ---
    else {
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
        wsData.capacity || 0,
        wsData.capacityUOM, // [NEW]
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
