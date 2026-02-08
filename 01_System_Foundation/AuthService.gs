/**
 * AuthService.gs (Rev.11 - Complete Version)
 * รวมฟังก์ชันทั้งหมด: Login, User Management, Reset Password, Active Status และ Helper Functions
 */

// ==========================================
// 1. HELPER FUNCTIONS (ส่วนที่หายไป คืนชีพแล้วครับ!)
// ==========================================

function getUserIdFromToken(token) {
  if (!token) return null;
  const ss = SpreadsheetApp.openById(ERP_CONFIG.AUTH_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.SESSIONS);
  const data = sheet.getDataRange().getValues();
  
  // Find session by token (Column A)
  const session = data.find(row => row[0] === token);
  
  // Check Expiry (Column D -> index 3)
  if (session) {
    const expiry = new Date(session[3]);
    if (new Date() > expiry) return null; // Token Expired
    return session[1]; // Return UserID
  }
  return null;
}

function checkPermission(token, requiredModule) {
  const userId = getUserIdFromToken(token);
  if (!userId) return false;

  const ss = SpreadsheetApp.openById(ERP_CONFIG.AUTH_SPREADSHEET_ID);
  const userSheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.USERS);
  const users = userSheet.getDataRange().getValues();
  
  const user = users.find(u => u[0] === userId);
  if (!user) return false;

  const allowedModules = user[8] ? user[8].toString() : ''; // Column I
  
  if (allowedModules === 'ALL') return true;
  if (requiredModule === 'USER_MANAGEMENT' && allowedModules.includes('USER_MANAGEMENT')) return true;

  return allowedModules.split(',').map(m => m.trim()).includes(requiredModule);
}

// [ฟังก์ชันนี้แหละครับที่ทำให้ Loading... ค้าง ถ้าไม่มีตัวนี้]
function getCurrentUserProfile(token) {
  const userId = getUserIdFromToken(token);
  if (!userId) return { success: false };

  const ss = SpreadsheetApp.openById(ERP_CONFIG.AUTH_SPREADSHEET_ID);
  const userSheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.USERS);
  const users = userSheet.getDataRange().getValues();
  
  const user = users.find(u => u[0] === userId);
  if (!user) return { success: false };

  return {
    success: true,
    username: user[1],
    fullName: user[5],
    permissions: user[8] 
  };
}

// ==========================================
// 2. MAIN SERVICES (Login & User Management)
// ==========================================

function login(username, rawPassword) {
  try {
    const ss = SpreadsheetApp.openById(ERP_CONFIG.AUTH_SPREADSHEET_ID);
    const userSheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.USERS);
    const data = userSheet.getDataRange().getValues();
    
    // Check Username & Active Status (Column E -> index 4)
    const userRow = data.find(row => row[1] === username && String(row[4]).toLowerCase() === 'true');

    if (!userRow) return { success: false, message: 'ไม่พบชื่อผู้ใช้ หรือบัญชีถูกระงับ (Inactive)' };

    const storedHash = userRow[2];
    const inputHash = hashPassword(rawPassword); // Function from Security.gs

    if (inputHash === storedHash) {
      const sessionToken = generateToken(); // Function from Security.gs
      const sessionSheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.SESSIONS);
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 8); 
      
      sessionSheet.appendRow([sessionToken, userRow[0], new Date(), expiryDate, true]);
      
      return { 
        success: true, 
        message: 'เข้าสู่ระบบสำเร็จ!', 
        token: sessionToken,
        mustChangePassword: userRow[7] === true 
      };
    } else {
      return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
    }
  } catch (e) {
    return { success: false, message: `System Error: ${e.message}` };
  }
}

// Create User (Support Active Status)
function createUserWithModules(userData, moduleList, adminToken) {
  const lock = LockService.getScriptLock();
  try {
    if (!checkPermission(adminToken, 'USER_MANAGEMENT')) return { success: false, message: '⛔ Permission Denied' };

    lock.waitLock(ERP_CONFIG.LOCK_TIMEOUT_MS);
    const ss = SpreadsheetApp.openById(ERP_CONFIG.AUTH_SPREADSHEET_ID);
    const userSheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.USERS);
    
    const data = userSheet.getDataRange().getValues();
    if (data.some(r => r[1].toString().toLowerCase() === userData.username.toLowerCase())) {
      return { success: false, message: 'Username นี้มีอยู่ในระบบแล้ว' };
    }

    const moduleString = moduleList ? moduleList.join(',') : '';
    const isActive = (userData.isActive === undefined) ? true : userData.isActive;

    userSheet.appendRow([
      'U' + Date.now(),
      userData.username,
      hashPassword(userData.password),
      'CUSTOM', 
      isActive, 
      userData.fullName,
      userData.department,
      true, 
      moduleString 
    ]);
    
    SpreadsheetApp.flush();
    return { success: true, message: 'สร้างผู้ใช้งานเรียบร้อยแล้ว' };
  } catch (e) {
    return { success: false, message: 'Error: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

// Update User (Support Active Status & Password Edit)
function updateUser(userData, moduleList, adminToken) {
  const lock = LockService.getScriptLock();
  try {
    if (!checkPermission(adminToken, 'USER_MANAGEMENT')) return { success: false, message: '⛔ Permission Denied' };

    lock.waitLock(ERP_CONFIG.LOCK_TIMEOUT_MS);
    const ss = SpreadsheetApp.openById(ERP_CONFIG.AUTH_SPREADSHEET_ID);
    const userSheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.USERS);
    const data = userSheet.getDataRange().getValues();

    const rowIndex = data.findIndex(r => r[0] === userData.id);
    if (rowIndex === -1) return { success: false, message: 'ไม่พบ User นี้ในระบบ' };

    const rowNum = rowIndex + 1;
    // Update basic info
    userSheet.getRange(rowNum, 2).setValue(userData.username);
    userSheet.getRange(rowNum, 6).setValue(userData.fullName);
    userSheet.getRange(rowNum, 7).setValue(userData.department);
    
    // Update Active Status
    if (userData.isActive !== undefined) {
        userSheet.getRange(rowNum, 5).setValue(userData.isActive);
    }

    // Update Permissions
    const moduleString = moduleList ? moduleList.join(',') : '';
    userSheet.getRange(rowNum, 9).setValue(moduleString);

    // Optional: Password update from Edit form
    if (userData.password && userData.password.trim() !== '') {
       userSheet.getRange(rowNum, 3).setValue(hashPassword(userData.password));
    }

    return { success: true, message: 'อัปเดตข้อมูลสำเร็จ' };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

// Reset Password to '1234'
function resetUserPassword(targetUserId, adminToken) {
  const lock = LockService.getScriptLock();
  try {
    if (!checkPermission(adminToken, 'USER_MANAGEMENT')) return { success: false, message: '⛔ Permission Denied' };

    lock.waitLock(ERP_CONFIG.LOCK_TIMEOUT_MS);
    const ss = SpreadsheetApp.openById(ERP_CONFIG.AUTH_SPREADSHEET_ID);
    const userSheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.USERS);
    const data = userSheet.getDataRange().getValues();

    const rowIndex = data.findIndex(r => r[0] === targetUserId);
    if (rowIndex === -1) return { success: false, message: 'User not found' };

    const defaultPassHash = hashPassword('1234');
    
    userSheet.getRange(rowIndex + 1, 3).setValue(defaultPassHash);
    userSheet.getRange(rowIndex + 1, 8).setValue(true); // Must change password

    return { success: true, message: 'รีเซ็ตรหัสผ่านเป็น "1234" เรียบร้อย' };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

function deleteUser(targetUserId, adminToken) {
    return { success: false, message: 'Please use Inactive status instead of Delete.' };
}

/**
 * ดึงรายชื่อ User ทั้งหมด (ฉบับ Force Read แก้ปัญหาข้อมูลหาย)
 */
/**
 * ดึงรายชื่อ User ทั้งหมด (ฉบับ Super Safe Force Read)
 * แก้ปัญหา undefined และ Inactive
 */
/**
 * ดึงรายชื่อ User ทั้งหมด (ฉบับกันเหนียว 100%)
 * อ่านครบ 9 คอลัมน์ + แปลงค่าว่างให้เป็น String ที่ถูกต้อง
 */
/**
 * เปลี่ยนชื่อฟังก์ชันเป็น api_getAllUsers เพื่อหนีฟังก์ชันเก่าที่ค้างอยู่
 */
function api_getAllUsers() {
  console.log("🚀 API Called: api_getAllUsers"); // เพิ่ม Log เพื่อเช็คว่าถูกเรียกจริง
  try {
    const ss = SpreadsheetApp.openById(ERP_CONFIG.AUTH_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.USERS);
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // อ่านข้อมูล 9 คอลัมน์ (A-I)
    const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues(); 
    
    const users = data.map(r => {
      // Helper แปลงค่าว่าง
      const val = (v) => (v === null || v === undefined || String(v) === '') ? '-' : String(v);
      const isActive = String(r[4]).toUpperCase() === 'TRUE';

      return {
        id: r[0], 
        username: r[1], 
        active: isActive, 
        fullName: val(r[5]), 
        department: val(r[6]), 
        modules: val(r[8])
      };
    });

    console.log("✅ Data Returned to Frontend:", JSON.stringify(users)); // Log ดูข้อมูลที่ส่งกลับ
    return users;

  } catch(e) { 
    console.error('❌ Error in api_getAllUsers: ' + e.message);
    return []; 
  }
}

// Password Change (Self Service)
function changeOwnPassword(token, oldPassword, newPassword) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(ERP_CONFIG.LOCK_TIMEOUT_MS);
    const userId = getUserIdFromToken(token);
    if (!userId) return { success: false, message: 'Session Expired' };

    const ss = SpreadsheetApp.openById(ERP_CONFIG.AUTH_SPREADSHEET_ID);
    const userSheet = ss.getSheetByName(ERP_CONFIG.SHEET_NAMES.USERS);
    const data = userSheet.getDataRange().getValues();
    
    const rowIndex = data.findIndex(row => row[0] === userId);
    if (rowIndex === -1) return { success: false, message: 'User not found' };

    const currentHash = data[rowIndex][2];
    if (currentHash !== hashPassword(oldPassword)) return { success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' };

    const newHash = hashPassword(newPassword);
    userSheet.getRange(rowIndex + 1, 3).setValue(newHash); 
    userSheet.getRange(rowIndex + 1, 8).setValue(false);   

    return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ!' };
  } catch (e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}