/**
 * Test_Phase7.gs
 * Oracle_ERP_V1/99_Unit_Tests/
 * 
 * Unit tests for OEE Service and Cost Accounting Service.
 */

function run_Phase7_Test() {
  console.log('--- Starting Phase 7 Unit Tests (OEE & Costing) ---');

  if (OEE_CONFIG.SHEET_ID === 'REPLACE_WITH_YOUR_OEE_SHEET_ID' || 
      COST_CONFIG.COST_SHEET_ID === 'REPLACE_WITH_YOUR_COST_SHEET_ID') {
    console.error('FAILED: Please provide valid Spreadsheet IDs for OEE and Costing.');
    return;
  }

  const parentSku = 'FG-001';
  const componentSku = 'RM-001';

  try {
    // 1. Test OEE Logging
    console.log('Testing OEE event logging...');
    const oeeResult = logMachineEvent('MACHINE-01', 'DOWNTIME', 15, 'WIP-TEST-JOB-001');
    if (!oeeResult.success) throw new Error(`OEE logging failed: ${oeeResult.message}`);
    console.log('PASSED: OEE event logged successfully.');

    // 2. Test Setting Standard Cost for Raw Material
    console.log(`Setting standard cost for raw material ${componentSku}...`);
    const cost = 10.50;
    const setCostResult = setStandardCost(componentSku, cost);
    if (!setCostResult.success) throw new Error(`Set standard cost failed: ${setCostResult.message}`);
    console.log(`PASSED: Standard cost for ${componentSku} set to ${cost}.`);

    // 3. Test Cost Roll-up
    console.log(`Running cost roll-up for finished good ${parentSku}...`);
    const rollupResult = runCostRollup(parentSku);
    if (!rollupResult.success) throw new Error(`Cost roll-up failed: ${rollupResult.message}`);
    console.log(`PASSED: Cost roll-up successful. New cost for ${parentSku} is ${rollupResult.newCost}.`);

    // 4. Verification
    const expectedCost = 2 * 10.50; // From BOM: 2 units of RM-001 per FG-001
    if (rollupResult.newCost !== expectedCost) {
      throw new Error(`Cost roll-up calculation incorrect. Expected ${expectedCost}, but got ${rollupResult.newCost}`);
    }
    console.log('PASSED: Cost roll-up calculation is correct.');

    // 5. Manual Verification Prompt
    console.log('ACTION REQUIRED: Please manually check the following:');
    console.log('  - OEE Data Logs Sheet: Should have a new downtime entry.');
    console.log(`  - Standard Costs Sheet: Cost for ${componentSku} should be ${cost}, and cost for ${parentSku} should be ${expectedCost}.`);
    console.log('  - Audit Trail Sheet: Should have logs for setting cost and running the cost roll-up.');

  } catch (e) {
    console.error(`CRITICAL ERROR during OEE/Costing testing: ${e.message}`);
  }

  console.log('--- Phase 7 Unit Tests Completed ---');
}
