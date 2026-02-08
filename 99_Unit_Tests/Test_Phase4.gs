/**
 * Test_Phase4.gs
 * Oracle_ERP_V1/99_Unit_Tests/
 * 
 * Unit tests for the Warehouse Management System (WMS) Service.
 */

function run_Phase4_Test() {
  console.log('--- Starting Phase 4 Unit Tests (WMS) ---');

  if (WMS_CONFIG.SHEET_ID === 'REPLACE_WITH_YOUR_WMS_SHEET_ID') {
    console.error('FAILED: Please provide a valid Spreadsheet ID for WMS in WmsService.gs');
    return;
  }

  try {
    const testSku = 'TEST-SKU-001'; // Using the same SKU from Phase 3 test

    // 1. Test Initial Receipt
    console.log(`Testing Initial Receipt for ${testSku}...`);
    const receiptResult = processInventoryTransaction(testSku, 'SUPPLIER', 'STORES', 100);
    if (!receiptResult.success) throw new Error(`Initial Receipt failed: ${receiptResult.message}`);
    console.log('PASSED: Initial Receipt of 100 units to STORES.');

    // 2. Test Internal Transfer
    console.log(`Testing Internal Transfer for ${testSku}...`);
    const transferResult = processInventoryTransaction(testSku, 'STORES', 'WIP', 25);
    if (!transferResult.success) throw new Error(`Internal Transfer failed: ${transferResult.message}`);
    console.log('PASSED: Transferred 25 units from STORES to WIP.');

    // 3. Test for Insufficient Stock (should fail)
    console.log(`Testing Insufficient Stock for ${testSku}...`);
    const insufficientResult = processInventoryTransaction(testSku, 'STORES', 'WIP', 80); // Only 75 left
    if (insufficientResult.success) throw new Error('Insufficient stock check failed. Transaction should have been blocked.');
    console.log('PASSED: Insufficient stock transaction was correctly blocked.');

    // 4. Verification (Manual)
    console.log('ACTION REQUIRED: Please manually check the WMS sheet. On-hand for TEST-SKU-001 should be: STORES: 75, WIP: 25.');
    console.log('ACTION REQUIRED: Please also check the Audit Trail sheet for two new WMS log entries.');

  } catch (e) {
    console.error(`CRITICAL ERROR during WMS testing: ${e.message}`);
  }

  console.log('--- Phase 4 Unit Tests Completed ---');
}
