/**
 * Test_Phase5.gs
 * Oracle_ERP_V1/99_Unit_Tests/
 * 
 * Unit tests for BOM Service and MRP Service.
 */

function run_Phase5_Test() {
  console.log('--- Starting Phase 5 Unit Tests (BOM & MRP) ---');

  // Configuration Check
  if (BOM_CONFIG.SHEET_ID === 'REPLACE_WITH_YOUR_BOM_SHEET_ID' || 
      MRP_CONFIG.DEMAND_SHEET_ID === 'REPLACE_WITH_YOUR_DEMAND_SHEET_ID' ||
      MRP_CONFIG.MRP_RESULT_SHEET_ID === 'REPLACE_WITH_YOUR_MRP_RESULT_SHEET_ID') {
    console.error('FAILED: Please provide valid Spreadsheet IDs for BOM, Demand, and MRP Results.');
    return;
  }

  const parentSku = 'FG-001'; // Finished Good
  try {
    // 1. Define Master Data
    const componentSku = 'RM-001'; // Raw Material
    const bomComponents = [
      { sku: componentSku, quantity: 2, scrapFactor: 0.1 } // Requires 2, with 10% scrap
    ];

    // 2. Cleanup any previous test data
    console.log('Cleaning up previous test data...');
    const demandSs = SpreadsheetApp.openById(MRP_CONFIG.DEMAND_SHEET_ID);
    let demandSheet = demandSs.getSheetByName(MRP_CONFIG.DEMAND_SHEET_NAME);
    if (demandSheet) {
        const data = demandSheet.getDataRange().getValues();
        for(let i = data.length - 1; i >= 1; i--) {
            if(data[i][0] === parentSku) {
                demandSheet.deleteRow(i + 1);
            }
        }
    }

    // 3. Test BOM Definition
    console.log(`Defining BOM for ${parentSku}...`);
    const bomResult = defineBom(parentSku, bomComponents);
    if (!bomResult.success) throw new Error(`BOM Definition failed: ${bomResult.message}`);
    console.log('PASSED: BOM Definition successful.');

    // 4. Add Demand for the Finished Good
    console.log(`Adding demand for ${parentSku}...`);
    const demandQty = 50;
    if (!demandSheet) {
        demandSheet = demandSs.insertSheet(MRP_CONFIG.DEMAND_SHEET_NAME);
        demandSheet.appendRow(['SKU', 'Quantity', 'Status', 'Due_Date']);
    }
    demandSheet.appendRow([parentSku, demandQty, 'OPEN', new Date()]);
    console.log('PASSED: Added demand of 50 units.');

    // 4. Run MRP
    console.log(`Running MRP for ${parentSku}...`);
    const mrpResult = runMrp(parentSku);
    if (!mrpResult.success) throw new Error(`MRP Run failed: ${mrpResult.message}`);
    console.log('PASSED: MRP Run successful.');
    console.log('MRP Results:', JSON.stringify(mrpResult.results, null, 2));

    // 5. Verification
    const expectedComponentDemand = bomComponents[0].quantity * mrpResult.results.netReq;
    const calculatedDemand = mrpResult.results.componentDemand[0].requiredQty;
    if (calculatedDemand !== expectedComponentDemand) {
        throw new Error(`MRP calculation incorrect. Expected ${expectedComponentDemand}, but got ${calculatedDemand}`);
    }
    console.log('PASSED: MRP component demand calculation is correct.');

    // 6. Manual Verification Prompt
    console.log('ACTION REQUIRED: Please check the BOM sheet, Demand sheet, and MRP Results sheet to verify the data.');
    console.log('ACTION REQUIRED: Check the Audit Trail for BOM and MRP log entries.');

  } catch (e) {
    console.error(`CRITICAL ERROR during BOM/MRP testing: ${e.message}`);
  } finally {
    // Cleanup: Remove test demand
    const demandSs = SpreadsheetApp.openById(MRP_CONFIG.DEMAND_SHEET_ID);
    const demandSheet = demandSs.getSheetByName(MRP_CONFIG.DEMAND_SHEET_NAME);
    if (demandSheet) { // Only run cleanup if the sheet exists
        const data = demandSheet.getDataRange().getValues();
        for(let i = data.length - 1; i >= 1; i--) {
            if(data[i][0] === parentSku) {
                demandSheet.deleteRow(i + 1);
            }
        }
    }
  }

  console.log('--- Phase 5 Unit Tests Completed ---');
}
