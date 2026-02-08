/**
 * CostService.gs
 * Oracle_ERP_V1/07_Cost_Accounting/
 * 
 * Handles Standard Costing calculations based on Oracle Cost Management (CST) logic.
 */

const COST_CONFIG = {
  COST_SHEET_ID: '1ozabLYdYpgiat0WL1w_jAzixSB01RCWo89qWEx8geFY',
  COST_SHEET_NAME: 'Standard_Costs'
};

/**
 * Sets or updates the standard cost for a given SKU.
 * Typically used for raw materials or manually overridden costs.
 * @param {string} sku - The SKU to update.
 * @param {number} cost - The new standard cost.
 * @returns {Object} { success: boolean, message: string }
 */
function setStandardCost(sku, cost) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(ERP_CONFIG.LOCK_TIMEOUT_MS);

    const ss = SpreadsheetApp.openById(COST_CONFIG.COST_SHEET_ID);
    let sheet = ss.getSheetByName(COST_CONFIG.COST_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(COST_CONFIG.COST_SHEET_NAME);
      sheet.appendRow(['SKU', 'Standard_Cost', 'Last_Updated']);
    }

    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex(row => row[0] === sku);
    const oldData = rowIndex > -1 ? data[rowIndex] : null;

    if (rowIndex > -1) {
      sheet.getRange(rowIndex + 1, 2).setValue(cost);
      sheet.getRange(rowIndex + 1, 3).setValue(new Date());
    } else {
      sheet.appendRow([sku, cost, new Date()]);
    }

    SpreadsheetApp.flush();
    logTransaction('COSTING', 'SET_COST', sku, oldData, { sku, cost });
    return { success: true, message: `Cost for ${sku} set to ${cost}.` };

  } catch (e) {
    console.error(`Set Cost Error for ${sku}: ${e.message}`);
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Performs a cost roll-up for a parent SKU based on its BOM and component costs.
 * @param {string} parentSku - The finished good or sub-assembly to calculate the cost for.
 * @returns {Object} { success: boolean, message: string, newCost: number }
 */
function runCostRollup(parentSku) {
  try {
    // 1. Get BOM Structure
    const bomSs = SpreadsheetApp.openById(BOM_CONFIG.SHEET_ID);
    const bomSheet = bomSs.getSheetByName(BOM_CONFIG.SHEET_NAME);
    if (!bomSheet) throw new Error('BOM Sheet not found.');
    const bomData = bomSheet.getDataRange().getValues();
    const components = bomData
      .filter(row => row[0] === parentSku)
      .map(row => ({ sku: row[1], qtyPer: row[2] }));

    if (components.length === 0) throw new Error(`BOM for ${parentSku} not defined.`);

    // 2. Get Component Costs
    const costSs = SpreadsheetApp.openById(COST_CONFIG.COST_SHEET_ID);
    const costSheet = costSs.getSheetByName(COST_CONFIG.COST_SHEET_NAME);
    if (!costSheet) throw new Error('Cost Sheet not found.');
    const costData = costSheet.getDataRange().getValues();

    let calculatedCost = 0;
    for (const component of components) {
      const costRow = costData.find(row => row[0] === component.sku);
      if (!costRow) throw new Error(`Standard cost for component ${component.sku} is not defined.`);
      const componentCost = Number(costRow[1]);
      calculatedCost += component.qtyPer * componentCost;
    }

    // 3. Set the new calculated cost for the parent SKU
    const setResult = setStandardCost(parentSku, calculatedCost);
    if (!setResult.success) throw setResult;

    logTransaction('COSTING', 'RUN_ROLLUP', parentSku, null, { newCost: calculatedCost });
    return { success: true, message: `Cost roll-up for ${parentSku} successful.`, newCost: calculatedCost };

  } catch (e) {
    console.error(`Cost Roll-up Error for ${parentSku}: ${e.message}`);
    return { success: false, message: e.message };
  }
}
