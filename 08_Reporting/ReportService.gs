/**
 * ReportService.gs
 * Oracle_ERP_V1/08_Reporting/
 * 
 * Handles generation of various reports by querying and processing data from other modules.
 */

/**
 * Generates an inventory transaction history (Stock Card) for a specific SKU.
 * @param {string} sku - The SKU to generate the report for.
 * @returns {Array<Object>} An array of transaction objects.
 */
function getInventoryTransactionHistory(sku) {
  try {
    const auditSs = SpreadsheetApp.openById(AUDIT_CONFIG.AUDIT_SHEET_ID);
    const auditSheet = auditSs.getSheetByName(AUDIT_CONFIG.SHEET_NAME);
    if (!auditSheet) {
      throw new Error('Audit Trail sheet not found.');
    }

    const data = auditSheet.getDataRange().getValues();
    const history = [];

    // Filter for WMS transactions related to the specific SKU
    for (let i = 1; i < data.length; i++) { // Skip header row
      const row = data[i];
      const module = row[2];
      const recordId = row[4];
      const oldData = JSON.parse(row[5] || '{}');

      if (module === 'WMS' && recordId === sku) {
        history.push({
          timestamp: new Date(row[0]).toLocaleString(),
          user: row[1],
          from: oldData.from,
          to: oldData.to,
          quantity: oldData.qty
        });
      }
    }

    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort descending

  } catch (e) {
    console.error(`Report Error for SKU ${sku}: ${e.message}`);
    throw new Error(e.message);
  }
}
