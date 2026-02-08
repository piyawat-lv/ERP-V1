/**
 * BomService.gs
 * Oracle_ERP_V1/02_Master_Data/
 * 
 * Handles creation and management of Bill of Materials (BOM) structures.
 * Mimics Oracle Manufacturing (BOM_BILL_OF_MATERIALS) logic.
 */

const BOM_CONFIG = {
  SHEET_ID: '1VmzjrbowqfZW_nxRdUfkvLMqhSWj3zu6sllDh4K7oi0',
  SHEET_NAME: 'BOM_Structure'
};

/**
 * Defines or overwrites the BOM for a given parent SKU.
 * @param {string} parentSku - The finished good or sub-assembly SKU.
 * @param {Array<Object>} components - An array of component objects [{ sku, quantity, scrapFactor }].
 * @returns {Object} { success: boolean, message: string }
 */
function defineBom(parentSku, components) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(ERP_CONFIG.LOCK_TIMEOUT_MS);

    // Security Check: Circular Reference
    for (const component of components) {
      if (component.sku === parentSku) {
        throw new Error(`Circular reference detected: ${parentSku} cannot contain itself.`);
      }
    }

    const ss = SpreadsheetApp.openById(BOM_CONFIG.SHEET_ID);
    let sheet = ss.getSheetByName(BOM_CONFIG.SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(BOM_CONFIG.SHEET_NAME);
      sheet.appendRow(['Parent_SKU', 'Component_SKU', 'Quantity_per', 'Scrap_Factor']);
    }

    const data = sheet.getDataRange().getValues();
    const oldBom = data.filter(row => row[0] === parentSku);

    // Simple overwrite: remove all old components for this parent
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === parentSku) {
        sheet.deleteRow(i + 1);
      }
    }

    // Add new components
    const rowsToAdd = components.map(c => [parentSku, c.sku, c.quantity, c.scrapFactor || 0]);
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, 4).setValues(rowsToAdd);

    SpreadsheetApp.flush();
    logTransaction('BOM', 'DEFINE_BOM', parentSku, oldBom, components);
    return { success: true, message: `BOM for ${parentSku} defined successfully.` };

  } catch (e) {
    console.error(`BOM Definition Error for ${parentSku}: ${e.message}`);
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}
