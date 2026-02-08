/**
 * JobOrderService.gs (Rev.02 - Advanced Search & Report)
 */

const SHEET_JOB = "JobOrder";

// 1. ดึงข้อมูล Master Item (สำหรับ VLOOKUP Server-side)
function getMasterItemMap() {
  const items = api_getAllItems(); // เรียกจาก ItemService
  // สร้าง Map เพื่อค้นหาเร็วๆ: { "FG-001": {name: "Product A", uom: "PCS"} }
  let map = {};
  items.forEach(i => {
    map[i.code] = { name: i.name, uom: i.uom };
  });
  return map;
}

// 2. บันทึก Job (Auto VLOOKUP Name/UOM + Record User)
function api_saveJobOrder(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_JOB);

    if(!sheet) {
       sheet = ss.insertSheet(SHEET_JOB);
       sheet.appendRow(['JobNo','JobDate','ItemCode','ItemName','PlanQty','UOM','DueDate','BOM_ID','LotNo','Status','User','EndDate','ActualQty','Remark','CreatedAt']);
    }

    // --- VLOOKUP Logic ---
    const itemMap = getMasterItemMap();
    const itemInfo = itemMap[data.itemCode] || { name: 'Unknown', uom: '-' };
    const finalItemName = itemInfo.name;
    const finalUOM = itemInfo.uom;
    
    // --- Get Current User ---
    const currentUser = Session.getActiveUser().getEmail() || 'Admin';

    // Generate Job No
    const today = new Date();
    const yymm = Utilities.formatDate(today, "GMT+7", "yyMM");
    const prefix = "JO-" + yymm + "-";
    
    const allData = sheet.getDataRange().getValues();
    let count = 0;
    allData.forEach(r => { if(String(r[0]).startsWith(prefix)) count++; });
    const jobNo = prefix + String(count + 1).padStart(3, '0');

    // Prepare Data (15 Cols)
    const rowData = [
       jobNo,
       Utilities.formatDate(today, "GMT+7", "yyyy-MM-dd"), // JobDate
       data.itemCode,
       finalItemName, // Auto Name
       data.planQty,
       finalUOM,      // Auto UOM
       data.dueDate,
       data.bomId,
       data.lotNo,
       'Planned',
       currentUser,   // User
       '',            // EndDate (Blank initially)
       '',            // ActualQty (Blank initially)
       data.remark,   // Remark
       new Date()
    ];

    sheet.appendRow(rowData);
    return { success: true, message: 'Job Created: ' + jobNo, jobNo: jobNo };

  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

// 3. [NEW] ค้นหา Job ตามช่วงเวลา (Search Data Menu)
function api_searchJobOrders(criteria, startDate, endDate) {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_JOB);
  if(!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if(data.length < 2) return [];
  
  const start = new Date(startDate).setHours(0,0,0,0);
  const end = new Date(endDate).setHours(23,59,59,999);
  
  // Filter
  const filtered = data.slice(1).filter(r => {
    let checkDate;
    // Criteria: 'JobDate' (Col 1) or 'EndDate' (Col 11)
    if (criteria === 'JobDate') {
        checkDate = new Date(r[1]);
    } else {
        // ถ้า EndDate ว่าง ถือว่าไม่ผ่านเงื่อนไข
        if(!r[11]) return false; 
        checkDate = new Date(r[11]);
    }
    
    return checkDate.getTime() >= start && checkDate.getTime() <= end;
  });

  return filtered.map(r => ({
    jobNo: r[0],
    jobDate: Utilities.formatDate(new Date(r[1]), "GMT+7", "dd/MM/yyyy"),
    itemCode: r[2],
    itemName: r[3],
    planQty: r[4],
    uom: r[5],
    status: r[9],
    user: r[10],
    endDate: r[11] ? Utilities.formatDate(new Date(r[11]), "GMT+7", "dd/MM/yyyy") : '-',
    actualQty: r[12] || '-',
    remark: r[13]
  }));
}

// 4. [NEW] รายงาน BOM ของ Job (CSV Report)
function api_getJobBOMReport(jobNo) {
  const ss = SpreadsheetApp.openById(ERP_CONFIG.INVENTORY_SPREADSHEET_ID);
  
  // 1. หา Job Row เพื่อเอา ItemCode
  const jSheet = ss.getSheetByName(SHEET_JOB);
  const jData = jSheet.getDataRange().getValues();
  const jobRow = jData.find(r => r[0] === jobNo);
  
  if(!jobRow) return { success: false, message: 'Job No not found' };
  
  const itemCode = jobRow[2]; // Col C
  const planQty = jobRow[4];
  
  // 2. หา BOM ของ ItemCode นั้น (ใช้ Logic จาก BOMService)
  // เรียกใช้ api_getBOMReportCSV ของ BOMService แต่เราจะ Custom Header นิดหน่อย
  const bomResult = api_findBOMByItemCode(itemCode);
  if(!bomResult.success) return { success: false, message: 'BOM not found for this Job Item' };
  
  const bomDetail = api_getBOMDetail(bomResult.bomId);
  
  // 3. สร้าง CSV Content
  let csv = `JOB ORDER REPORT\n`;
  csv += `Job No:,${jobNo}\n`;
  csv += `Product:,${itemCode} - ${bomDetail.header.itemName}\n`;
  csv += `Plan Qty:,${planQty} ${bomDetail.header.batchUom}\n`;
  csv += `BOM Ref:,${bomDetail.header.bomId}\n\n`;
  
  csv += `--- BOM & WORKSTATION DETAIL ---\n`;
  csv += `Seq,Description,Type,Item/Machine Code,Name,Std Qty/Time,UOM,Parameters\n`;
  
  bomDetail.details.forEach(d => {
     let type = d.itemCode ? 'Material' : 'Machine';
     let code = d.itemCode || d.stationCode;
     let name = d.itemName || d.stationName;
     
     const row = [
       d.seq,
       `"${d.workDesc || ''}"`, // Quote เพื่อกัน Comma หลุด
       type,
       code,
       `"${name}"`,
       d.qty,
       d.uom,
       `"${d.params || ''}"`
     ].join(",");
     csv += row + "\n";
  });
  
  return { success: true, csvData: csv, fileName: `Report_${jobNo}.csv` };
}

// Function อัปเดต Actual/EndDate (สำหรับปุ่ม Update หน้าบ้าน ถ้าต้องการ)
function api_updateJobResult(jobNo, actualQty, endDate, remark) {
    // ... Logic update column 11, 12, 13 ... 
    // (สามารถเพิ่มได้ถ้าต้องการให้ user กรอกผลผลิตจริง)
}
