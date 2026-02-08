/**
 * Test_Phase3.gs
 * Oracle_ERP_V1/99_Unit_Tests/
 * 
 * Unit tests for the Item Master Service.
 */

function run_Phase3_Test() {
  console.log('--- Starting Phase 3 Unit Tests (Item Master) ---');

  if (ITEM_MASTER_CONFIG.SHEET_ID === 'REPLACE_WITH_YOUR_ITEM_MASTER_SHEET_ID') {
    console.error('FAILED: Please provide a valid Spreadsheet ID for Item Master in ItemMasterService.gs');
    return;
  }

  try {
    // 1. Mock Item Data
    const mockItem = {
      sku: 'TEST-SKU-001',
      description: 'Test Component',
      uom: 'EA',
      category: 'RAW_MATERIAL',
      status: 'ACTIVE'
    };

    // 2. Test CREATE operation
    console.log(`Testing CREATE for SKU: ${mockItem.sku}`);
    const createResult = upsertItem(mockItem);
    if (createResult.success) {
      console.log('PASSED: Item CREATE successful.');
    } else {
      throw new Error(`Item CREATE failed: ${createResult.message}`);
    }

    // 3. Test UPDATE operation
    mockItem.description = 'Test Component (Updated)';
    console.log(`Testing UPDATE for SKU: ${mockItem.sku}`);
    const updateResult = upsertItem(mockItem);
    if (updateResult.success) {
      console.log('PASSED: Item UPDATE successful.');
    } else {
      throw new Error(`Item UPDATE failed: ${updateResult.message}`);
    }

    // 4. Verification (Manual)
    console.log('ACTION REQUIRED: Please manually check the Item Master sheet for the created/updated data.');
    console.log('ACTION REQUIRED: Please also check the Audit Trail sheet for two new log entries related to this test.');

  } catch (e) {
    console.error(`CRITICAL ERROR during Item Master testing: ${e.message}`);
  }

  console.log('--- Phase 3 Unit Tests Completed ---');
}
