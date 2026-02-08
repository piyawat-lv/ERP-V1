/**
 * Code.gs (Main Server File)
 */

/**
 * Serves the main HTML page of the web app.
 * รวม Logic การเช็ค page ทั้งหมดไว้ในฟังก์ชันเดียว
 */
function doGet(e) {
  // รับค่า parameter 'page' ถ้าไม่มีให้เป็น null
  let page = e.parameter.page;

  // 1. กรณีเรียกหน้า User Management
  if (page == 'user_management') {
    return HtmlService.createTemplateFromFile('UserManagement_UI')
      .evaluate()
      .setTitle('Oracle ERP V1 - User Management')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } 
  
  // 2. กรณีเรียกหน้า Dashboard
  else if (page == 'dashboard') {
    // ใช้ createTemplateFromFile เพื่อให้รองรับการ include ไฟล์อื่นได้ในอนาคต
    return HtmlService.createTemplateFromFile('Index') 
      .evaluate()
      .setTitle('Oracle ERP V1 - Main Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } 
  
  // 3. กรณีอื่นๆ (Default) ให้เด้งไปหน้า Login
  else {
    return HtmlService.createTemplateFromFile('Login')
      .evaluate()
      .setTitle('Oracle ERP V1 - Login')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

/**
 * Helper function สำหรับดึงไฟล์ HTML ย่อยมาใส่ (เช่น CSS/JS แยกไฟล์)
 * จำเป็นต้องมีถ้าใน HTML คุณใช้ <?!= include('Filename') ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Returns the absolute URL for the main dashboard page.
 */
function getDashboardUrl() {
  const url = ScriptApp.getService().getUrl();
  return url + '?page=dashboard';
}

// --- ส่วนนี้คือ AdminService เดิมของคุณ (ถ้ามี Code จัดการ User ให้แปะต่อท้ายไฟล์นี้ หรือแยกไฟล์ก็ได้) ---
// function getAllUsers() { ... }
// function saveUser(form) { ... }

/**
 * Returns the URL of the web app itself.
 * Used for Logout redirection.
 */
function getScriptUrl() {
  return ScriptApp.getService().getUrl();
  
}