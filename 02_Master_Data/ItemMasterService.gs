/**
 * ItemService.gs (Rev.06)
 * - Added 'Supplier' field
 */

// 1. ดึงข้อมูลสินค้าทั้งหมด
function api_getAllItems() {
  try {
    const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.ITEMS);
    if (!sheet) return [];
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // อ่านข้อมูล 11 คอลัมน์ (เพิ่ม Supplier เข้ามา)
    const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();

    return data.map(r => ({
      id: r[0],
      code: r[1],
      name: r[2],
      category: r[3],
      source: r[4],
      supplier: r[5], // [NEW] Supplier (Column F)
      uom: r[6],
      cost: Number(r[7]) || 0,
      safetyStock: r[8] || 0,
      status: r[9]
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
}

// 2. Dashboard Stats (ใช้ Logic เดิมได้)
function api_getItemDashboardStats() {
  const items = api_getAllItems();
  const total = items.length;
  const catCount = {};
  items.forEach(i => {
    const cat = i.category || 'Uncategorized';
    catCount[cat] = (catCount[cat] || 0) + 1;
  });
  const statusCount = { Active: 0, Inactive: 0 };
  items.forEach(i => {
    if (i.status === 'Active') statusCount.Active++;
    else statusCount.Inactive++;
  });
  return { total: total, categories: catCount, status: statusCount };
}

// 3. ปุ่ม Check Code (ใช้ Logic เดิมได้)
function api_checkItemCode(code) {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.ITEMS);
  if (!sheet) return { status: 'AVAILABLE', message: 'Sheet not created yet' };

  const data = sheet.getDataRange().getValues();
  const inputCode = code.toUpperCase().trim();
  
  const exists = data.some(r => String(r[1]).toUpperCase() === inputCode);
  
  if (!exists) {
    return { status: 'AVAILABLE', message: '✅ รหัสนี้ใช้งานได้' };
  } else {
    const suggestion = generateNextCodeLogic(inputCode, data);
    if (suggestion) {
      return { 
        status: 'DUPLICATE', 
        message: `❌ รหัสซ้ำ!`, 
        detail: `ล่าสุดคือ: <b>${suggestion.latest}</b>`,
        nextCode: suggestion.next 
      };
    } else {
      return { status: 'DUPLICATE', message: '❌ รหัสซ้ำ' };
    }
  }
}

// 4. บันทึกข้อมูล (แก้ไขเพิ่ม Supplier)
function api_saveItem(itemData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
    let sheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.ITEMS);
    
    // สร้าง Header (เพิ่ม Supplier)
    if(!sheet) {
      sheet = ss.insertSheet(ERP_CONFIG.SHEET_NAMES.ITEMS);
      sheet.appendRow([
        'ItemID', 'ItemCode', 'ItemName', 'Category', 'Source', 
        'Supplier', 'UOM', 'CostPerUnit', 'SafetyStock', 'Status', 'CreatedAt'
      ]);
    }

    const data = sheet.getDataRange().getValues();

    // --- UPDATE ---
    if (itemData.id) {
      const rowIndex = data.findIndex(r => String(r[0]) === String(itemData.id));
      if (rowIndex === -1) return { success: false, message: 'Item Not Found' };
      
      const row = rowIndex + 1;
      sheet.getRange(row, 2).setValue(itemData.code.toUpperCase());
      sheet.getRange(row, 3).setValue(itemData.name);
      sheet.getRange(row, 4).setValue(itemData.category);
      sheet.getRange(row, 5).setValue(itemData.source);
      sheet.getRange(row, 6).setValue(itemData.supplier); // [NEW] Update Supplier
      sheet.getRange(row, 7).setValue(itemData.uom);
      sheet.getRange(row, 8).setValue(itemData.cost);
      sheet.getRange(row, 9).setValue(itemData.safetyStock);
      sheet.getRange(row, 10).setValue(itemData.status);
      
      return { success: true, message: 'Updated Successfully' };
    } 
    
    // --- CREATE ---
    else {
      const inputCode = itemData.code.toUpperCase().trim();
      
      // Check Duplicate
      if (data.some(r => String(r[1]).toUpperCase() === inputCode)) {
        const suggestion = generateNextCodeLogic(inputCode, data);
        return { 
          success: false, isDuplicate: true, message: 'Duplicate Code!', 
          detail: suggestion ? `ล่าสุด: ${suggestion.latest}` : "", 
          nextCode: suggestion ? suggestion.next : "" 
        };
      }

      const newId = 'ITM-' + Date.now();
      // Append Row (เพิ่ม Supplier ที่ index 5)
      sheet.appendRow([
        newId, 
        inputCode, 
        itemData.name, 
        itemData.category, 
        itemData.source, 
        itemData.supplier, // [NEW]
        itemData.uom, 
        itemData.cost || 0, 
        itemData.safetyStock || 0, 
        itemData.status || 'Active', 
        new Date()
      ]);
      return { success: true, message: 'Created Successfully' };
    }

  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

// 5. Cost Calc (ปรับ Index ให้ตรงกับ Column ใหม่)
function api_recalcAverageCost() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
    const stockSheet = ss.getSheetByName('StockBalance');
    if (!stockSheet) return { success: false, message: 'No Stock Sheet' };
    
    const stockData = stockSheet.getDataRange().getValues(); 
    const costMap = {};
    
    for(let i=1; i<stockData.length; i++) {
       const code = String(stockData[i][0]).toUpperCase();
       const qty = Number(stockData[i][2]);
       const cost = Number(stockData[i][3]);
       if(qty > 0) {
          if(!costMap[code]) costMap[code] = { val: 0, qty: 0 };
          costMap[code].val += (qty * cost);
          costMap[code].qty += qty;
       }
    }

    const itemSheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.ITEMS);
    const itemData = itemSheet.getDataRange().getValues();
    let updatedCount = 0;

    for(let i=1; i<itemData.length; i++) {
       const itemCode = String(itemData[i][1]).toUpperCase();
       if(costMap[itemCode] && costMap[itemCode].qty > 0) {
          const avgCost = costMap[itemCode].val / costMap[itemCode].qty;
          // [UPDATED] Cost อยู่ Column 8 (Index 7) เพราะมี Supplier แทรก
          itemSheet.getRange(i+1, 8).setValue(Number(avgCost.toFixed(2))); 
          updatedCount++;
       }
    }
    return { success: true, message: `Updated cost for ${updatedCount} items.` };
  } catch(e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

// Helper (เหมือนเดิม)
function generateNextCodeLogic(inputCode, allData) {
  const match = inputCode.match(/^(.*?)(\d+)$/);
  if (!match) return null; 
  const prefix = match[1]; const numberPart = match[2];  
  let maxNum = 0;
  allData.forEach(r => {
    const dbCode = String(r[1]).toUpperCase(); 
    if (dbCode.startsWith(prefix)) {
      const currentNumPart = dbCode.substring(prefix.length);
      if (/^\d+$/.test(currentNumPart)) {
         const num = parseInt(currentNumPart, 10);
         if (num > maxNum) maxNum = num;
      }
    }
  });
  const nextNum = maxNum + 1;
  return {
    latest: `${prefix}${String(maxNum).padStart(numberPart.length, '0')}`,
    next: `${prefix}${String(nextNum).padStart(numberPart.length, '0')}`
  };
}
// --- [NEW] Helper: Get Spreadsheet URL ---
function api_getSheetURL() {
  try {
    const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
    return { success: true, url: ss.getUrl() };
  } catch(e) {
    return { success: false, message: e.message };
  }
}
