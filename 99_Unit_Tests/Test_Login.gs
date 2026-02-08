/**
 * Test_Login.gs
 * Oracle_ERP_V1/99_Unit_Tests/
 * 
 * A dedicated test script to debug the login process with detailed logging.
 */

function run_Login_Test() {
  console.log('--- Starting Detailed Login Test ---');

  const testUsername = 'admin';
  const testPassword = 'admin1234';

  try {
    console.log(`1. Attempting to log in with Username: '${testUsername}'`);

    const ss = SpreadsheetApp.openById(ERP_CONFIG.AUTH_SPREADSHEET_ID);
    const userSheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.USERS);
    if (!userSheet) {
      console.error('CRITICAL: User database sheet not found.');
      return;
    }
    console.log('2. Successfully opened User database sheet.');

    const data = userSheet.getDataRange().getValues();
    console.log('3. Read all user data from the sheet.');

    const userRow = data.find(row => row[1] === testUsername);
    if (!userRow) {
      console.error(`CRITICAL: Did not find any row with Username: '${testUsername}'. Check for typos.`);
      return;
    }
    console.log(`4. Found user row: ${JSON.stringify(userRow)}`);

    const isActive = String(userRow[4]).toLowerCase() === 'true';
    if (!isActive) {
        console.error(`CRITICAL: User '${testUsername}' is not active. IsActive flag is '${userRow[4]}'.`);
        return;
    }
    console.log(`5. User is active.`);

    const storedHash = userRow[2];
    console.log(`6. Stored Hash from sheet: '${storedHash}'`);

    const inputHash = hashPassword(testPassword);
    console.log(`7. Generated Hash from input password '${testPassword}': '${inputHash}'`);

    if (inputHash === storedHash) {
      console.log('8. SUCCESS: Hashes match!');
    } else {
      console.error('9. FAILURE: Hashes DO NOT match. Please re-generate the hash for your password and update the sheet.');
    }
    
    // Final call to the actual function to see its output
    console.log('\n--- Calling the actual login() function now ---');
    const finalResult = login(testUsername, testPassword);
    console.log('Final result from login() function:', JSON.stringify(finalResult, null, 2));

  } catch (e) {
    console.error(`An unexpected error occurred during the test: ${e.message}`);
  }
  console.log('--- Detailed Login Test Completed ---');
}
