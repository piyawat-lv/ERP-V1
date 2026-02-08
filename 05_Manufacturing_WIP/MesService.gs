/**
 * MesService.gs
 * Oracle_ERP_V1/05_Manufacturing_WIP/
 * 
 * Handles Manufacturing Execution System (MES) and Work-in-Process (WIP) transactions.
 * Mimics Oracle WIP logic for Job Orders.
 */

const MES_CONFIG = {
  WIP_SHEET_ID: '1sSPHbcaBa6VPhrffyXpmFJD6uiFc0PML1Z7q7MpSQl4',
  WIP_SHEET_NAME: 'WIP_Jobs'
};

/**
 * Releases a new Work Order, which triggers material issuance from WMS.
 * @param {string} parentSku - The SKU to be produced.
 * @param {number} quantity - The quantity to produce (typically from MRP Net Requirement).
 * @returns {Object} { success: boolean, message: string, jobId: string }
 */
function releaseWorkOrder(parentSku, quantity) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(ERP_CONFIG.LOCK_TIMEOUT_MS);

    // 1. Get BOM to determine required components
    const bomSs = SpreadsheetApp.openById(BOM_CONFIG.SHEET_ID);
    const bomSheet = bomSs.getSheetByName(BOM_CONFIG.SHEET_NAME);
    if (!bomSheet) throw new Error(`BOM Sheet not found.`);
    const bomData = bomSheet.getDataRange().getValues();
    const components = bomData
      .filter(row => row[0] === parentSku)
      .map(row => ({ sku: row[1], qtyPer: row[2] }));

    if (components.length === 0) {
      throw new Error(`BOM for ${parentSku} not defined.`);
    }

    // 2. Issue components from WMS (STORES -> WIP)
    for (const component of components) {
      const requiredQty = component.qtyPer * quantity;
      const issueResult = processInventoryTransaction(component.sku, 'STORES', 'WIP', requiredQty);
      if (!issueResult.success) {
        throw new Error(`Failed to issue ${component.sku}: ${issueResult.message}`);
      }
    }

    // 3. Create the WIP Job
    const ss = SpreadsheetApp.openById(MES_CONFIG.WIP_SHEET_ID);
    let sheet = ss.getSheetByName(MES_CONFIG.WIP_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(MES_CONFIG.WIP_SHEET_NAME);
      sheet.appendRow(['Job_ID', 'SKU', 'Qty_Required', 'Qty_Completed', 'Status', 'Release_Date']);
    }
    const jobId = `WIP-${parentSku}-${Date.now()}`;
    sheet.appendRow([jobId, parentSku, quantity, 0, 'RELEASED', new Date()]);

    SpreadsheetApp.flush();
    logTransaction('MES', 'RELEASE_WO', jobId, { sku: parentSku, qty: quantity }, { status: 'SUCCESS' });
    return { success: true, message: 'Work Order released successfully.', jobId: jobId };

  } catch (e) {
    console.error(`Work Order Release Error for ${parentSku}: ${e.message}`);
    // NOTE: A robust implementation would require a rollback transaction here.
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Completes a Work Order, moving finished goods from WIP to FINISHED_GOODS.
 * @param {string} jobId - The Job ID to complete.
 * @param {number} completedQty - The quantity of finished goods produced.
 * @returns {Object} { success: boolean, message: string }
 */
function completeWorkOrder(jobId, completedQty) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(ERP_CONFIG.LOCK_TIMEOUT_MS);

    const ss = SpreadsheetApp.openById(MES_CONFIG.WIP_SHEET_ID);
    const sheet = ss.getSheetByName(MES_CONFIG.WIP_SHEET_NAME);
    if (!sheet) throw new Error('WIP Jobs sheet not found.');

    const data = sheet.getDataRange().getValues();
    const jobIndex = data.findIndex(row => row[0] === jobId);

    if (jobIndex === -1) throw new Error(`Job ID ${jobId} not found.`);

    const jobData = data[jobIndex];
    const sku = jobData[1];
    const requiredQty = jobData[2];
    const currentCompleted = jobData[3];
    const newCompleted = currentCompleted + completedQty;

    if (newCompleted > requiredQty) {
      throw new Error(`Over-completion is not allowed. Required: ${requiredQty}, Total Completed: ${newCompleted}`);
    }

    // 1. Receive Finished Good into WMS (JOB_COMPLETION -> FINISHED_GOODS)
    const receiptResult = processInventoryTransaction(sku, 'JOB_COMPLETION', 'FINISHED_GOODS', completedQty);
    if (!receiptResult.success) {
      throw new Error(`Failed to receive finished good ${sku}: ${receiptResult.message}`);
    }

    // 2. Update WIP Job Status
    sheet.getRange(jobIndex + 1, 4).setValue(newCompleted);
    const newStatus = newCompleted === requiredQty ? 'COMPLETED' : 'PARTIALLY_COMPLETED';
    sheet.getRange(jobIndex + 1, 5).setValue(newStatus);

    SpreadsheetApp.flush();
    logTransaction('MES', 'COMPLETE_WO', jobId, { oldQty: currentCompleted }, { newQty: newCompleted, status: newStatus });
    return { success: true, message: 'Work Order completed successfully.' };

  } catch (e) {
    console.error(`Work Order Completion Error for ${jobId}: ${e.message}`);
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Retrieves all data from the WIP Jobs sheet.
 * This is a public function callable from the client-side UI.
 * @returns {Array<Array<any>>} A 2D array of the WIP job data.
 */
function getWipJobsData() {
  try {
    const ss = SpreadsheetApp.openById(MES_CONFIG.WIP_SHEET_ID);
    const sheet = ss.getSheetByName(MES_CONFIG.WIP_SHEET_NAME);
    if (!sheet) {
      return [];
    }
    return sheet.getDataRange().getValues();
  } catch (e) {
    console.error(`Get WIP Jobs Data Error: ${e.message}`);
    throw new Error(`Could not retrieve WIP Jobs data: ${e.message}`);
  }
}
