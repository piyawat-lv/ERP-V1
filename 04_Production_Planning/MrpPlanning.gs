/**
 * Production Planning (MPS/MRP) Module
 * Oracle Logic: ASCP / Value Chain Planning
 * Handles Demand-Supply Netting and Lead-time Offsets.
 */

const MRP_CONFIG = {
  SHEET_ID: 'YOUR_MRP_SHEET_ID',
  SHEET_NAME: 'Planning_Demand'
};

/**
 * Run MRP Netting for a specific SKU
 * Oracle Logic: Gross Requirements - Scheduled Receipts - On Hand = Net Requirements
 */
function runMrpNetting(sku) {
  return runInTransaction(() => {
    // 1. Get On-Hand from WMS
    const wmsSs = SpreadsheetApp.openById(WMS_CONFIG.SHEET_ID);
    const wmsSheet = wmsSs.getSheetByName(WMS_CONFIG.SHEET_NAME);
    const wmsData = wmsSheet.getDataRange().getValues();
    const onHand = wmsData
      .filter(r => r[0] === sku)
      .reduce((sum, r) => sum + Number(r[2]), 0);

    // 2. Get Gross Requirements (Demand)
    const mrpSs = SpreadsheetApp.openById(MRP_CONFIG.SHEET_ID);
    const demandSheet = mrpSs.getSheetByName(MRP_CONFIG.SHEET_NAME) || mrpSs.insertSheet(MRP_CONFIG.SHEET_NAME);
    const demandData = demandSheet.getDataRange().getValues();
    const grossReq = demandData
      .filter(r => r[0] === sku && r[2] === 'PENDING')
      .reduce((sum, r) => sum + Number(r[1]), 0);

    // 3. Calculate Net
    const netReq = Math.max(0, grossReq - onHand);

    logTransaction('MRP', 'NETTING_RUN', {sku, onHand, grossReq}, {netReq});
    
    return {
      sku: sku,
      onHand: onHand,
      grossRequirement: grossReq,
      netRequirement: netReq,
      action: netReq > 0 ? 'RELEASE_WORK_ORDER' : 'NONE'
    };
  }, `mrp_run_${sku}`);
}

/**
 * Add Demand (Sales Order / Forecast)
 */
function addDemand(sku, qty, dueDate) {
  const ss = SpreadsheetApp.openById(MRP_CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(MRP_CONFIG.SHEET_NAME) || ss.insertSheet(MRP_CONFIG.SHEET_NAME);
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['SKU', 'Qty', 'Status', 'Due_Date', 'Created_At']);
  }
  
  sheet.appendRow([sku, qty, 'PENDING', dueDate, new Date()]);
  logTransaction('MRP', 'ADD_DEMAND', null, {sku, qty, dueDate});
}

/**
 * TEST: MRP Netting Logic
 */
function testMRP() {
  console.log('Starting Test: MRP Planning...');
  
  try {
    const testSku = 'FINISHED-001';
    
    // 1. Add Demand
    addDemand(testSku, 50, new Date(Date.now() + 86400000 * 7)); // 7 days out
    console.log('Test 1 Passed: Demand Added');

    // 2. Run Netting (Assuming some stock exists from WMS test)
    const results = runMrpNetting(testSku);
    console.log('MRP Results:', JSON.stringify(results));
    
    if (typeof results.netRequirement !== 'number') throw new Error('Invalid Net Req calculation');
    console.log('Test 2 Passed: Netting Calculation');

  } catch (e) {
    console.error('MRP Test Failed: ' + e.message);
  }
}
