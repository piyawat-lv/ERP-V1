/**
 * MrpService.gs
 * Oracle_ERP_V1/04_Production_Planning/
 * 
 * Handles Material Requirements Planning (MRP) calculations.
 * Mimics Oracle ASCP (Advanced Supply Chain Planning) gross-to-net logic.
 */

const MRP_CONFIG = {
  DEMAND_SHEET_ID: '1PyUe3wwTfqGPteTe2eq2ZE2R6VUl4G-r95_EPMG5824', // IMPORTANT: Please update this ID
  DEMAND_SHEET_NAME: 'Demand_Schedule',
  MRP_RESULT_SHEET_ID: '1oc_UPu-zgDpGlxpn0YMs9qewqcZli-PuiWzeIovauN4', // IMPORTANT: Please update this ID
  MRP_RESULT_SHEET_NAME: 'MRP_Results'
};

/**
 * Runs a single-level MRP calculation for a given SKU.
 * @param {string} sku - The SKU to run MRP for.
 * @returns {Object} { success: boolean, message: string, results: Object }
 */
function runMrp(sku) {
  try {
    // 1. Get On-Hand Quantity from WMS
    const wmsSs = SpreadsheetApp.openById(WMS_CONFIG.SHEET_ID);
    const wmsSheet = wmsSs.getSheetByName(WMS_CONFIG.SHEET_NAME);
    const wmsData = wmsSheet ? wmsSheet.getDataRange().getValues() : [];
    const onHandQty = wmsData
      .filter(row => row[0] === sku)
      .reduce((sum, row) => sum + (Number(row[2]) || 0), 0);

    // 2. Get Gross Requirements (Demand)
    const demandSs = SpreadsheetApp.openById(MRP_CONFIG.DEMAND_SHEET_ID);
    let demandSheet = demandSs.getSheetByName(MRP_CONFIG.DEMAND_SHEET_NAME);
    if (!demandSheet) {
        demandSheet = demandSs.insertSheet(MRP_CONFIG.DEMAND_SHEET_NAME);
        demandSheet.appendRow(['SKU', 'Quantity', 'Status', 'Due_Date']);
    }
    const demandData = demandSheet.getDataRange().getValues();
    const grossRequirements = demandData
      .filter(row => row[0] === sku && row[2] === 'OPEN')
      .reduce((sum, row) => sum + (Number(row[1]) || 0), 0);

    // 3. Gross-to-Net Calculation
    const netRequirements = Math.max(0, grossRequirements - onHandQty);

    // 4. Get BOM for component explosion
    const bomSs = SpreadsheetApp.openById(BOM_CONFIG.SHEET_ID);
    const bomSheet = bomSs.getSheetByName(BOM_CONFIG.SHEET_NAME);
    const bomData = bomSheet ? bomSheet.getDataRange().getValues() : [];
    const components = bomData
      .filter(row => row[0] === sku)
      .map(row => ({ sku: row[1], qtyPer: row[2] }));

    // 5. Calculate component demand
    const componentDemand = components.map(c => ({
      sku: c.sku,
      requiredQty: c.qtyPer * netRequirements
    }));

    const results = {
      targetSku: sku,
      onHand: onHandQty,
      grossReq: grossRequirements,
      netReq: netRequirements,
      componentDemand: componentDemand
    };

    // Log results
    const resultSs = SpreadsheetApp.openById(MRP_CONFIG.MRP_RESULT_SHEET_ID);
    let resultSheet = resultSs.getSheetByName(MRP_CONFIG.MRP_RESULT_SHEET_NAME);
    if (!resultSheet) {
      resultSheet = resultSs.insertSheet(MRP_CONFIG.MRP_RESULT_SHEET_NAME);
      resultSheet.appendRow(['Run_Timestamp', 'Target_SKU', 'Net_Requirement', 'Component_Demand']);
    }
    resultSheet.appendRow([new Date(), sku, netRequirements, JSON.stringify(componentDemand)]);

    logTransaction('MRP', 'RUN_MRP', sku, { onHand: onHandQty, grossReq: grossRequirements }, results);
    return { success: true, message: 'MRP run successful', results: results };

  } catch (e) {
    console.error(`MRP Run Error for ${sku}: ${e.message}`);
    return { success: false, message: e.message };
  }
}
