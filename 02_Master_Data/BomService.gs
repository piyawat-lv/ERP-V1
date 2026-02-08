/**
 * BOMService.gs (Rev.02 - Manual Input & VLOOKUP)
 */

const SHEET_BOM_HEAD = "BOM_Header";
const SHEET_BOM_DTL = "BOM_Detail";

// 1. ดึง Master Data (Item & Station) มาไว้ทำ VLOOKUP หน้าบ้าน
function api_getMasterDataForBOM() {
  const items = api_getAllItems(); // จาก ItemService
  const stations = api_getAllWorkStations(); // จาก WorkStationService
  
  return {
    items: items, // ส่งไปทั้งหมดเพื่อให้ค้นหาได้ทั้ง FG, WIP, RM
    stations: stations
  };
}

// 2. ดึงรายการ BOM ทั้งหมด
function api_getBOMList() {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_BOM_HEAD);
  if(!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if(data.length < 2) return [];
  
  // Map ให้ตรง Column ใหม่
  return data.slice(1).map(r => ({
    bomId: r[0],
    itemCode: r[1],
    itemName: r[2],
    type: r[3],
    batchSize: r[4],
    batchUom: r[5],
    revision: r[6],
    status: r[7]
  }));
}

// 3. ดึง BOM Detail (Rev.02 Structure)
function api_getBOMDetail(bomId) {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  
  const hSheet = ss.getSheetByName(SHEET_BOM_HEAD);
  const hData = hSheet.getDataRange().getValues();
  const headerRow = hData.find(r => r[0] === bomId);
  if(!headerRow) return null;

  const dSheet = ss.getSheetByName(SHEET_BOM_DTL);
  const dData = dSheet.getDataRange().getValues();
  
  const details = dData.filter(r => r[0] === bomId).map(r => ({
    seq: r[1],
    workDesc: r[2],
    itemCode: r[3],
    itemName: r[4],
    stationCode: r[5],
    stationName: r[6],
    qty: r[7],
    uom: r[8],
    params: r[9]
  }));

  return {
    header: {
      bomId: headerRow[0],
      itemCode: headerRow[1],
      itemName: headerRow[2],
      type: headerRow[3],
      batchSize: headerRow[4],
      batchUom: headerRow[5],
      revision: headerRow[6],
      status: headerRow[7]
    },
    details: details
  };
}

// 4. บันทึก BOM (Rev.02 Structure)
function api_saveBOM(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
    
    let hSheet = ss.getSheetByName(SHEET_BOM_HEAD);
    let dSheet = ss.getSheetByName(SHEET_BOM_DTL);

    // Create Headers if missing
    if(!hSheet) { hSheet = ss.insertSheet(SHEET_BOM_HEAD); hSheet.appendRow(['BOM_ID','ItemCode','ItemName','Type','BatchSize','BatchUOM','Revision','Status','UpdatedAt']); }
    if(!dSheet) { dSheet = ss.insertSheet(SHEET_BOM_DTL); dSheet.appendRow(['BOM_ID','Seq','WorkDesc','ItemCode','ItemName','StationCode','StationName','Qty_Time','UOM','Parameters']); }

    const bomId = data.header.bomId || ('BOM-' + Date.now());

    // --- SAVE HEADER (9 Cols) ---
    const hRows = hSheet.getDataRange().getValues();
    const hIndex = hRows.findIndex(r => r[0] === bomId);
    
    const rowData = [
      bomId, 
      data.header.itemCode, 
      data.header.itemName, 
      data.header.type,
      data.header.batchSize, 
      data.header.batchUom, 
      data.header.revision || 'Rev.01', 
      data.header.status || 'Active', 
      new Date()
    ];

    if(hIndex > -1) {
       hSheet.getRange(hIndex + 1, 1, 1, 9).setValues([rowData]);
    } else {
       hSheet.appendRow(rowData);
    }

    // --- SAVE DETAIL (10 Cols) ---
    // Delete Old
    const dRows = dSheet.getDataRange().getValues();
    for (let i = dRows.length - 1; i >= 1; i--) {
      if (dRows[i][0] === bomId) dSheet.deleteRow(i + 1);
    }

    // Insert New
    if(data.details && data.details.length > 0) {
      const newRows = data.details.map(d => [
        bomId,
        d.seq,        // 1. Seq (Manual/Duplicate OK)
        d.workDesc,   // 2. Work Desc
        d.itemCode,   // 3. Item Code
        d.itemName,   // 4. Item Name
        d.stationCode,// 5. Station Code
        d.stationName,// 6. Station Name
        d.qty,        // 7. Qty
        d.uom,        // 8. UOM
        d.params      // 9. Params
      ]);
      
      dSheet.getRange(dSheet.getLastRow() + 1, 1, newRows.length, 10).setValues(newRows);
    }

    return { success: true, message: 'BOM Saved (Rev.02)', bomId: bomId };

  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}
/**
 * BOMService.gs (Rev.03 - Add Search & Export)
 */

// ... (Code เดิม: api_getMasterDataForBOM, api_getBOMList, api_saveBOM เก็บไว้เหมือนเดิม) ...

// [NEW] 1. ค้นหา BOM ID ด้วย Item Code (สำหรับปุ่ม Edit)
function api_findBOMByItemCode(itemCode) {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_BOM_HEAD);
  if(!sheet) return null;
  
  const data = sheet.getDataRange().getValues(); // Row 1 is header
  
  // ค้นหาแถวที่ ItemCode (Col B -> Index 1) ตรงกัน และเอาตัวล่าสุดหรือตัวแรกที่เจอ
  // แนะนำให้หาตัวที่เป็น Active
  const foundRow = data.find(r => String(r[1]).toUpperCase() === itemCode.toUpperCase().trim());
  
  if (foundRow) {
    // ส่ง BOM_ID กลับไปเพื่อเรียก api_getBOMDetail ต่อ
    return { success: true, bomId: foundRow[0] };
  } else {
    return { success: false, message: 'BOM not found for Item Code: ' + itemCode };
  }
}

// [NEW] 2. สร้างข้อมูล CSV สำหรับ Report (สำหรับปุ่ม Export)
function api_getBOMReportCSV(itemCode) {
  const findResult = api_findBOMByItemCode(itemCode);
  if (!findResult.success) return { success: false, message: findResult.message };

  // ดึงข้อมูล Detail ทั้งหมดมา
  const bomData = api_getBOMDetail(findResult.bomId);
  if (!bomData) return { success: false, message: 'Data extraction failed' };

  // --- สร้าง Content CSV ---
  let csvContent = "";
  
  // 1. Header Information
  csvContent += `BOM Report for Item: ,${bomData.header.itemCode} - ${bomData.header.itemName}\n`;
  csvContent += `BOM ID: ,${bomData.header.bomId}\n`;
  csvContent += `Batch Size: ,${bomData.header.batchSize} ${bomData.header.batchUom}\n`;
  csvContent += `Type: ,${bomData.header.type}\n`;
  csvContent += `Status: ,${bomData.header.status}\n`;
  csvContent += `\n`; // เว้นบรรทัด

  // 2. Table Header
  csvContent += `Seq,Work Description,Type,Item/Station Code,Name,Qty/Time,UOM,Parameters\n`;

  // 3. Table Rows
  bomData.details.forEach(d => {
    // Clean data (ป้องกัน Comma ทำลาย format csv)
    const cleanDesc = (d.workDesc || '').replace(/,/g, ' ');
    const cleanName = (d.itemName || d.stationName || '').replace(/,/g, ' ');
    const cleanParams = (d.params || '').replace(/,/g, ' ');
    
    // Determine Type (Material or Machine) based on data presence
    let type = d.itemCode ? 'Material' : 'Machine';
    let code = d.itemCode || d.stationCode || '';

    // CSV Row string
    const row = [
      d.seq,
      cleanDesc,
      type,
      code,
      cleanName,
      d.qty,
      d.uom,
      cleanParams
    ].join(",");

    csvContent += row + "\n";
  });

  return { 
    success: true, 
    csvData: csvContent, 
    fileName: `BOM_${bomData.header.itemCode}.csv` 
  };
}
