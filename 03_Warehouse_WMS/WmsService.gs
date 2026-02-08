/**
 * WmsService.gs
 * Oracle_ERP_V1/03_Warehouse_WMS/
 * 
 * Handles Inventory Transactions based on Oracle WMS Subinventory logic.
 * Ensures ACID-like transactions for all stock movements.
 */

const WMS_CONFIG = {
  SHEET_ID: '1fEpc8XTtZAvTIeTW4L98Y2JTArf3mnOkMJVCI8D1f-4',
  SHEET_NAME: 'On_Hand_Quantity'
};

/**
 * Processes an inventory transaction (e.g., Receipt, Transfer, Issue).
 * @param {string} sku - The SKU being transacted.
 * @param {string} fromSubinv - The source subinventory (e.g., 'RECEIVING', 'STORES'). Use 'SUPPLIER' for initial receipts.
 * @param {string} toSubinv - The destination subinventory (e.g., 'STORES', 'WIP'). Use 'CUSTOMER' for shipments.
 * @param {number} quantity - The quantity to transact.
 * @returns {Object} { success: boolean, message: string }
 */
function processInventoryTransaction(sku, fromSubinv, toSubinv, quantity) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(ERP_CONFIG.LOCK_TIMEOUT_MS);

    const ss = SpreadsheetApp.openById(WMS_CONFIG.SHEET_ID);
    let sheet = ss.getSheetByName(WMS_CONFIG.SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(WMS_CONFIG.SHEET_NAME);
      sheet.appendRow(['SKU', 'Subinventory', 'On_Hand_Qty', 'Last_Updated']);
    }

    const data = sheet.getDataRange().getValues();
    let fromRowIndex = -1;
    let toRowIndex = -1;

    if (fromSubinv !== 'SUPPLIER' && fromSubinv !== 'JOB_COMPLETION') {
      fromRowIndex = data.findIndex(row => row[0] === sku && row[1] === fromSubinv);
      if (fromRowIndex === -1 || data[fromRowIndex][2] < quantity) {
        throw new Error(`Insufficient stock for ${sku} in ${fromSubinv}.`);
      }
    }

    if (toSubinv !== 'CUSTOMER' && toSubinv !== 'SCRAP') {
      toRowIndex = data.findIndex(row => row[0] === sku && row[1] === toSubinv);
    }

    // Perform transaction
    const timestamp = new Date();
    if (fromRowIndex !== -1) {
      const newQty = data[fromRowIndex][2] - quantity;
      sheet.getRange(fromRowIndex + 1, 3).setValue(newQty);
      sheet.getRange(fromRowIndex + 1, 4).setValue(timestamp);
    }

    if (toRowIndex !== -1) {
      const newQty = data[toRowIndex][2] + quantity;
      sheet.getRange(toRowIndex + 1, 3).setValue(newQty);
      sheet.getRange(toRowIndex + 1, 4).setValue(timestamp);
    } else if (toSubinv !== 'CUSTOMER' && toSubinv !== 'SCRAP') {
      sheet.appendRow([sku, toSubinv, quantity, timestamp]);
    }

    SpreadsheetApp.flush(); // Commit changes before logging
    logTransaction('WMS', 'TRANSFER', sku, { from: fromSubinv, to: toSubinv, qty: quantity }, { status: 'SUCCESS' });
    return { success: true, message: 'Transaction successful' };

  } catch (e) {
    console.error(`WMS Transaction Error for SKU ${sku}: ${e.message}`);
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Retrieves all data from the On-Hand Quantity sheet.
 * This is a public function callable from the client-side UI.
 * @returns {Array<Array<any>>} A 2D array of the on-hand data.
 */
function getWmsData() {
  try {
    const ss = SpreadsheetApp.openById(WMS_CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(WMS_CONFIG.SHEET_NAME);
    if (!sheet) {
      return []; // Return empty array if sheet doesn't exist
    }
    return sheet.getDataRange().getValues();
  } catch (e) {
    console.error(`Get WMS Data Error: ${e.message}`);
    throw new Error(`Could not retrieve WMS data: ${e.message}`);
  }
}

