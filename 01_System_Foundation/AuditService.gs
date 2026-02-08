/**
 * AuditService.gs
 * Oracle_ERP_V1/01_System_Foundation/
 * 
 * Implements Oracle EBS Audit Trail logic (Shadow Tables).
 * Logs all data changes into a dedicated, immutable sheet.
 */

const AUDIT_CONFIG = {
  AUDIT_SHEET_ID: '1vW_gabn5LL2NPnK-lJhhVkaycp7Kjiii1LDnvC1YhUc',
  SHEET_NAME: 'Audit_Trail'
};

/**
 * Centralized function to log any transaction or data change.
 * @param {string} moduleName - The module where the change occurred (e.g., 'ITEM_MASTER').
 * @param {string} action - The action performed (e.g., 'CREATE', 'UPDATE', 'DELETE').
 * @param {string} recordId - The primary key of the record being changed (e.g., SKU, Job_ID).
 * @param {Object} oldData - The state of the data before the change (JSON format).
 * @param {Object} newData - The state of the data after the change (JSON format).
 */
function logTransaction(moduleName, action, recordId, oldData, newData) {
  try {
    const ss = SpreadsheetApp.openById(AUDIT_CONFIG.AUDIT_SHEET_ID);
    let sheet = ss.getSheetByName(AUDIT_CONFIG.SHEET_NAME);
    
    if (!sheet) {
      sheet = ss.insertSheet(AUDIT_CONFIG.SHEET_NAME);
      sheet.appendRow(['Timestamp', 'User', 'Module', 'Action', 'Record_ID', 'Old_Data', 'New_Data']);
    }
    
    const user = Session.getActiveUser().getEmail() || 'SYSTEM';
    const timestamp = new Date();
    
    sheet.appendRow([
      timestamp,
      user,
      moduleName,
      action,
      recordId,
      JSON.stringify(oldData),
      JSON.stringify(newData)
    ]);

  } catch (e) {
    console.error(`CRITICAL: Audit log failed for module ${moduleName}. Error: ${e.message}`);
    // In a production system, you might want to send an email notification here.
  }
}
