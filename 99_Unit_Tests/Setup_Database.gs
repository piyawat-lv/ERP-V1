/**
 * Setup_Database.gs (Rev.01)
 * Updated: เพิ่มคอลัมน์ FullName และ Department ในตาราง Users
 */

function setup_Initial_Database() {
  const ssId = ERP_CONFIG.AUTH_SPREADSHEET_ID;
  if (!ssId || ssId === 'REPLACE_WITH_YOUR_SHEET_ID') {
    console.error('ERROR: กรุณาใส่ Spreadsheet ID ที่ถูกต้องใน Config.gs ก่อนรันสคริปต์นี้');
    return;
  }

  const ss = SpreadsheetApp.openById(ssId);
  console.log('--- Starting Database Setup (Rev.01) ---');

  // 1. Setup 'Users' Sheet
  let userSheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.USERS);
  if (!userSheet) {
    userSheet = ss.insertSheet(ERP_CONFIG.SHEET_NAMES.USERS);
  }
  userSheet.clear();
  
  // [Change Rev.01] เพิ่ม FullName และ Department ต่อท้าย
  userSheet.appendRow(['UserID', 'Username', 'PasswordHash', 'RoleID', 'IsActive', 'FullName', 'Department']);
  
  // สร้าง Hash สำหรับ 'password123'
  const adminPasswordHash = hashPassword('password123');
  
  // [Change Rev.01] เพิ่มข้อมูล Admin เริ่มต้นให้ครบตามโครงสร้างใหม่
  userSheet.appendRow(['U001', 'admin', adminPasswordHash, 'R001', true, 'System Administrator', 'IT_Support']);
  
  console.log('✅ Users sheet initialized with structure (v2)');

  // 2. Setup 'Roles' Sheet (โครงสร้างเดิม)
  let roleSheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.ROLES);
  if (!roleSheet) {
    roleSheet = ss.insertSheet(ERP_CONFIG.SHEET_NAMES.ROLES);
  }
  roleSheet.clear();
  roleSheet.appendRow(['RoleID', 'RoleName', 'AllowedModules']);
  roleSheet.appendRow(['R001', 'Administrator', 'WAREHOUSE_WMS,ITEM_MASTER,MRP_PLANNING,USER_MANAGEMENT']);
  console.log('✅ Roles sheet initialized');

  // 3. Setup 'Sessions' Sheet (โครงสร้างเดิม)
  let sessionSheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.SESSIONS);
  if (!sessionSheet) {
    sessionSheet = ss.insertSheet(ERP_CONFIG.SHEET_NAMES.SESSIONS);
  }
  sessionSheet.clear();
  sessionSheet.appendRow(['SessionToken', 'UserID', 'ExpiryTime']);
  console.log('✅ Sessions sheet initialized');
  
  console.log('--- Database Setup Completed Successfully (Rev.01) ---');
}