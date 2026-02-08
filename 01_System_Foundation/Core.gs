/**
 * Core Infrastructure for GAS ERP
 * Implements Oracle-style Transaction Handling, Locking, and Audit Logging.
 */

const CONFIG = {
  MASTER_SHEET_ID: 'YOUR_MASTER_SHEET_ID', // Central Registry
  LOCK_TIMEOUT_MS: 10000,
  AUDIT_LOG_SHEET_ID: 'YOUR_AUDIT_LOG_SHEET_ID'
};

/**
 * Transaction Wrapper with LockService (ACID-like)
 * @param {Function} callback Logic to execute within the lock
 * @param {string} lockName Identifier for the lock
 * @returns {*} Result of the callback
 */
function runInTransaction(callback, lockName = 'global') {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
    const result = callback();
    SpreadsheetApp.flush(); // Ensure changes are committed before releasing lock
    return result;
  } catch (e) {
    Logger.log('Transaction Error: ' + e.message);
    throw new Error('ERP_TRANSACTION_FAILED: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Audit Logger (Oracle EBS Shadow Table Logic)
 */
function logTransaction(module, action, oldData, newData) {
  const ss = SpreadsheetApp.openById(CONFIG.AUDIT_LOG_SHEET_ID);
  const sheet = ss.getSheets()[0];
  const user = Session.getActiveUser().getEmail();
  const timestamp = new Date();
  
  sheet.appendRow([
    timestamp,
    user,
    module,
    action,
    JSON.stringify(oldData),
    JSON.stringify(newData)
  ]);
}

/**
 * TEST: Validate Transaction Locking and Audit Logging
 */
function testCoreInfrastructure() {
  console.log('Starting Test: Core Infrastructure...');
  
  try {
    // Test 1: Successful Transaction
    const testResult = runInTransaction(() => {
      console.log('Inside lock: Simulating work...');
      return 'SUCCESS';
    }, 'test_lock');
    
    if (testResult !== 'SUCCESS') throw new Error('Lock callback failed');
    console.log('Test 1 Passed: Lock execution');

    // Test 2: Audit Logging (Requires Sheet ID)
    // logTransaction('TEST_MODULE', 'TEST_ACTION', {val: 1}, {val: 2});
    // console.log('Test 2 Passed: Logging (Manual check required for sheet content)');

    console.log('All Core Infrastructure tests passed (Simulation mode).');
  } catch (e) {
    console.error('Test Failed: ' + e.message);
  }
}
