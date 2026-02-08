/**
 * Cost Accounting Module
 * Oracle Logic: CST (Cost Management)
 * Handles Standard Costing and Cost Roll-ups.
 */

const COST_CONFIG = {
  SHEET_ID: 'YOUR_COST_SHEET_ID',
  SHEET_NAME: 'Item_Costs'
};

/**
 * Calculate Cost Roll-up for a Parent SKU
 * Logic: Sum(Component Cost * Qty) from BOM
 */
function rollupStandardCost(parentSku) {
  return runInTransaction(() => {
    // 1. Get BOM components
    const bomSs = SpreadsheetApp.openById(BOM_CONFIG.SHEET_ID);
    const bomSheet = bomSs.getSheetByName(BOM_CONFIG.SHEET_NAME);
    const bomData = bomSheet.getDataRange().getValues();
    const components = bomData.filter(r => r[0] === parentSku);

    if (components.length === 0) {
      throw new Error(`BOM not found for SKU ${parentSku}`);
    }

    // 2. Get Component Costs
    const costSs = SpreadsheetApp.openById(COST_CONFIG.SHEET_ID);
    const costSheet = costSs.getSheetByName(COST_CONFIG.SHEET_NAME) || costSs.insertSheet(COST_CONFIG.SHEET_NAME);
    const costData = costSheet.getDataRange().getValues();

    let totalCost = 0;
    components.forEach(comp => {
      const childSku = comp[1];
      const qty = comp[2];
      const costRow = costData.find(r => r[0] === childSku);
      const unitCost = costRow ? Number(costRow[1]) : 0;
      totalCost += (unitCost * qty);
    });

    // 3. Update Parent Cost
    updateItemCost(parentSku, totalCost);

    logTransaction('COSTING', 'ROLLUP', {parentSku}, {totalCost});
    return { status: 'SUCCESS', parentSku, totalCost };
  }, `cost_rollup_${parentSku}`);
}

/**
 * Update Standard Cost for an Item
 */
function updateItemCost(sku, unitCost) {
  const ss = SpreadsheetApp.openById(COST_CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(COST_CONFIG.SHEET_NAME) || ss.insertSheet(COST_CONFIG.SHEET_NAME);
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['SKU', 'Unit_Cost', 'Last_Update']);
  }

  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(r => r[0] === sku);

  if (rowIndex > -1) {
    sheet.getRange(rowIndex + 1, 2).setValue(unitCost);
    sheet.getRange(rowIndex + 1, 3).setValue(new Date());
  } else {
    sheet.appendRow([sku, unitCost, new Date()]);
  }
}

/**
 * TEST: Cost Accounting Logic
 */
function testCosting() {
  console.log('Starting Test: Cost Accounting...');
  
  try {
    const rawSku = 'RAW-001';
    const parentSku = 'FINISHED-001';

    // 1. Set Raw Material Cost
    updateItemCost(rawSku, 5.00);
    console.log('Test 1 Passed: Set Component Cost');

    // 2. Rollup Parent Cost
    const result = rollupStandardCost(parentSku);
    console.log('Rollup Result:', JSON.stringify(result));
    
    if (result.totalCost <= 0) throw new Error('Cost Rollup failed to calculate value');
    console.log('Test 2 Passed: Cost Rollup');

  } catch (e) {
    console.error('Costing Test Failed: ' + e.message);
  }
}
