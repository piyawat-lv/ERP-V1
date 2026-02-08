/**
 * Test_Phase1.gs
 * Oracle_ERP_V1/99_Unit_Tests/
 * Unit tests for Authentication and Security logic.
 * 
 * IMPORTANT: Before running these tests, you must:
 * 1. Create a Google Sheet for Authentication.
 * 2. Create sheets named 'Users', 'Roles', and 'Sessions'.
 * 3. Update ERP_CONFIG.AUTH_SPREADSHEET_ID in Oracle_ERP_V1/01_System_Foundation/Config.gs
 * 4. Add a test user in 'Users' sheet with a pre-hashed SHA-256 password.
 */

function run_Phase1_Test() {
  console.log('--- Starting Phase 1 Unit Tests ---');

  if (ERP_CONFIG.AUTH_SPREADSHEET_ID === 'REPLACE_WITH_YOUR_SHEET_ID' || ERP_CONFIG.AUTH_SPREADSHEET_ID === '') {
    console.error('FAILED: Please provide a valid Spreadsheet ID in Config.gs');
    return;
  }

  try {
    const testUsername = 'admin';
    const testPassword = 'password123'; // Assume this is the raw password for the test user

    // 1. Mock Login Attempt
    console.log('Testing login for user: ' + testUsername);
    const loginResult = login(testUsername, testPassword);
    
    if (loginResult.success) {
      console.log('PASSED: Login successful. Received Token: ' + loginResult.token);
      
      // 2. Test Permission Check (Valid Module)
      const validModule = 'WAREHOUSE_WMS'; // Assume this is in the Roles sheet for this user
      const hasPermission = checkPermission(loginResult.token, validModule);
      console.log(`Permission Check [${validModule}]: ` + (hasPermission ? 'PASSED' : 'FAILED'));

      // 3. Test Permission Check (Invalid Module)
      const invalidModule = 'SECRET_TREASURY';
      const noPermission = checkPermission(loginResult.token, invalidModule);
      console.log(`Permission Check [${invalidModule}] (Expected False): ` + (!noPermission ? 'PASSED' : 'FAILED'));

    } else {
      console.error('FAILED: Login failed. Message: ' + loginResult.message);
      console.log('Note: Ensure a user exists in the "Users" sheet with matching hash.');
    }

  } catch (e) {
    console.error('CRITICAL ERROR during testing: ' + e.message);
  }

  console.log('--- Phase 1 Unit Tests Completed ---');
}
