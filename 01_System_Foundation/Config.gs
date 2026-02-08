/**
 * Config.gs (Rev.02 - Add Inventory DB)
 */
const ERP_CONFIG = {
  // 1. ฐานข้อมูล Users / Login (ไฟล์เดิม)
  AUTH_SPREADSHEET_ID: '167UY94ci2M7KQphitInaaIERvFLqzPMriVoAhwSfryQ', 

  // 2. ฐานข้อมูลสินค้า / Inventory (ไฟล์ใหม่ที่คุณเพิ่งให้มา)
  INVENTORY_SPREADSHEET_ID: '1QJetjiPcKXhlpveDxaF-55pgO4UeY_dFP82ZZEqn5rs',

  SHEET_NAMES: {
    USERS: 'Users',
    SESSIONS: 'Sessions',
    ITEMS: 'Items' // ชื่อแท็บที่จะอยู่ในไฟล์ใหม่
  },
  
  SESSION_TIMEOUT_MINUTES: 60,
  LOCK_TIMEOUT_MS: 10000
};