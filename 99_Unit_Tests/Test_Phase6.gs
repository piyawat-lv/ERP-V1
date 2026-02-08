/**
 * Test_Phase6.gs
 * Oracle_ERP_V1/99_Unit_Tests/
 * 
 * Unit tests for the Manufacturing Execution System (MES) Service.
 */

function run_Phase6_Test() {
  console.log('--- Starting Phase 6 Unit Tests (MES/WIP) ---');

  if (MES_CONFIG.WIP_SHEET_ID === 'REPLACE_WITH_YOUR_WIP_SHEET_ID') {
    console.error('FAILED: Please provide a valid Spreadsheet ID for WIP Jobs in MesService.gs');
    return;
  }

  const parentSku = 'FG-001';
  const componentSku = 'RM-001';
  let testJobId = null;

  try {
    // 1. Setup: Ensure there is enough raw material in STORES
    console.log(`Setting up initial stock for ${componentSku}...`);
    // First, clear any existing stock to ensure a clean test state
    // In a real scenario, this would be more complex. For now, we assume we can just add stock.
    const initialStockQty = 250;
    const stockResult = processInventoryTransaction(componentSku, 'SUPPLIER', 'STORES', initialStockQty);
    if (!stockResult.success) throw new Error(`Failed to setup initial stock: ${stockResult.message}`);
    console.log(`PASSED: Added ${initialStockQty} units of ${componentSku} to STORES.`);

    // 2. Test Work Order Release
    const woQty = 100;
    console.log(`Testing Work Order Release for ${woQty} units of ${parentSku}...`);
    const releaseResult = releaseWorkOrder(parentSku, woQty);
    if (!releaseResult.success) throw new Error(`Work Order Release failed: ${releaseResult.message}`);
    testJobId = releaseResult.jobId;
    console.log(`PASSED: Work Order ${testJobId} released successfully.`);

    // 3. Test Work Order Completion
    console.log(`Testing Work Order Completion for ${testJobId}...`);
    const completeResult = completeWorkOrder(testJobId, woQty);
    if (!completeResult.success) throw new Error(`Work Order Completion failed: ${completeResult.message}`);
    console.log('PASSED: Work Order completion successful.');

    // 4. Verification (Manual)
    console.log('ACTION REQUIRED: Please manually check the following:');
    console.log(`  - WIP Jobs Sheet: Job ${testJobId} should have status 'COMPLETED'.`);
    console.log(`  - WMS Sheet: On-hand for ${componentSku} in STORES should be 50 (250 initial - 2*100 used).`);
    console.log(`  - WMS Sheet: On-hand for ${parentSku} in FINISHED_GOODS should be 100.`);
    console.log('  - Audit Trail Sheet: Should have logs for WO Release, WO Completion, and all related WMS transactions.');

  } catch (e) {
    console.error(`CRITICAL ERROR during MES testing: ${e.message}`);
  } finally {
    // Cleanup can be added here if necessary, e.g., deleting the created job.
  }

  console.log('--- Phase 6 Unit Tests Completed ---');
}
