/**
 * OeeService.gs
 * Oracle_ERP_V1/06_OEE_ShopFloor/
 * 
 * Handles logging of shop floor data for Overall Equipment Effectiveness (OEE) calculation.
 * Mimics Oracle Manufacturing Operations Center (MOC) data collection.
 */

const OEE_CONFIG = {
  SHEET_ID: '15c4xq20ZjvDiNi_P0kZ9B89omrtd7BcQjY80olFIGPA',
  SHEET_NAME: 'OEE_Data_Logs'
};

/**
 * Logs a machine event (e.g., Downtime, Production Count).
 * @param {string} machineId - The ID of the machine.
 * @param {string} eventType - The type of event ('PRODUCTION', 'DOWNTIME', 'QUALITY').
 * @param {number} value - The value associated with the event (e.g., quantity produced, minutes of downtime).
 * @param {string} jobId - Optional: The Job ID associated with this event.
 * @returns {Object} { success: boolean, message: string }
 */
function logMachineEvent(machineId, eventType, value, jobId = null) {
  try {
    const ss = SpreadsheetApp.openById(OEE_CONFIG.SHEET_ID);
    let sheet = ss.getSheetByName(OEE_CONFIG.SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(OEE_CONFIG.SHEET_NAME);
      sheet.appendRow(['Timestamp', 'Machine_ID', 'Event_Type', 'Value', 'Job_ID']);
    }

    const timestamp = new Date();
    sheet.appendRow([timestamp, machineId, eventType, value, jobId]);

    // OEE logging is often considered operational data, not a financial transaction,
    // so we may choose not to log it to the main Audit Trail to reduce noise.
    // However, if required, the call would be:
    // logTransaction('OEE', 'LOG_EVENT', machineId, null, { eventType, value, jobId });

    return { success: true, message: 'Event logged successfully.' };

  } catch (e) {
    console.error(`OEE Logging Error for Machine ${machineId}: ${e.message}`);
    return { success: false, message: e.message };
  }
}
