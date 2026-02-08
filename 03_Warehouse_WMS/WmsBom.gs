/**
 * Warehouse & BOM Modules
 * Oracle Logic: WMS (LPN/Subinventory) & BOM (Bills of Materials)
 */

const WMS_CONFIG = {
  SHEET_ID: 'YOUR_WMS_SHEET_ID',
  SHEET_NAME: 'Inventory'
};

const BOM_CONFIG = {
  SHEET_ID: 'YOUR_BOM_SHEET_ID',
  SHEET_NAME: 'BOM_Structures'
};

/**
 * Perform Inventory Transaction (Transfer/Adjustment)
 * ACID-like implementation using runInTransaction
 */
function processInventoryTransaction(sku, fromSub, toSub, qty, reason) {
  return runInTransaction(() => {
    const ss = SpreadsheetApp.openById(WMS_CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(WMS_CONFIG.SHEET_NAME) || ss.insertSheet(WMS_CONFIG.SHEET_NAME);
    
    // Header check
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['SKU', 'Subinventory', 'Qty_On_Hand', 'Last_Tx_Date']);
    }

    const data = sheet.getDataRange().getValues();
    let sourceIdx = -1;
    let destIdx = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === sku && data[i][1] === fromSub) sourceIdx = i;
      if (data[i][0] === sku && data[i][1] === toSub) destIdx = i;
    }

    // Validation
    if (sourceIdx === -1 && fromSub !== 'INITIAL_RECEIPT') {
      throw new Error(`Insufficient Stock: SKU ${sku} not found in ${fromSub}`);
    }
    
    const currentSourceQty = sourceIdx > -1 ? data[sourceIdx][2] : 0;
    if (fromSub !== 'INITIAL_RECEIPT' && currentSourceQty < qty) {
      throw new Error(`Insufficient Stock: SKU ${sku} in ${fromSub} has ${currentSourceQty}, requested ${qty}`);
    }

    // Execute Move
    if (sourceIdx > -1) {
      sheet.getRange(sourceIdx + 1, 3).setValue(currentSourceQty - qty);
    }

    if (destIdx > -1) {
      const currentDestQty = data[destIdx][2];
      sheet.getRange(destIdx + 1, 3).setValue(currentDestQty + qty);
    } else {
      sheet.appendRow([sku, toSub, qty, new Date()]);
    }

    logTransaction('WMS', 'TRANSFER', {sku, fromSub, qty}, {sku, toSub, qty, reason});
    return { status: 'SUCCESS' };
  }, `wms_tx_${sku}`);
}

/**
 * Define BOM Structure
 */
function defineBOM(parentSku, components) {
  return runInTransaction(() => {
    const ss = SpreadsheetApp.openById(BOM_CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(BOM_CONFIG.SHEET_NAME) || ss.insertSheet(BOM_CONFIG.SHEET_NAME);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Parent_SKU', 'Child_SKU', 'Qty_Required', 'Scrap_Factor']);
    }

    // Remove old structure for this parent (Simple implementation)
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === parentSku) sheet.deleteRow(i + 1);
    }

    components.forEach(comp => {
      sheet.appendRow([parentSku, comp.sku, comp.qty, comp.scrap || 0]);
    });

    logTransaction('BOM', 'DEFINE_STRUCTURE', null, {parentSku, components});
    return { status: 'SUCCESS' };
  }, `bom_def_${parentSku}`);
}

/**
 * TEST: WMS & BOM Logic
 */
function testWmsBOM() {
  console.log('Starting Test: WMS & BOM...');
  
  try {
    // Test 1: Initial Receipt
    processInventoryTransaction('RAW-001', 'INITIAL_RECEIPT', 'STORES', 100, 'Initial Stock');
    console.log('Test 1 Passed: Initial Receipt');

    // Test 2: Internal Transfer
    processInventoryTransaction('RAW-001', 'STORES', 'WIP', 20, 'Production Issue');
    console.log('Test 2 Passed: Internal Transfer');

    // Test 3: BOM Definition
    defineBOM('FINISHED-001', [
      {sku: 'RAW-001', qty: 2, scrap: 0.05}
    ]);
    console.log('Test 3 Passed: BOM Definition');

  } catch (e) {
    console.error('WMS/BOM Test Failed: ' + e.message);
  }
}
