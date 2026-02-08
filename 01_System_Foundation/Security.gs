/**
 * Security.gs
 * Oracle_ERP_V1/01_System_Foundation/
 * Cryptographic and token generation services.
 */

/**
 * Hash password using SHA-256
 * @param {string} rawPassword 
 * @returns {string} Hashed password
 */
function hashPassword(rawPassword) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, rawPassword);
  let hash = '';
  for (let i = 0; i < digest.length; i++) {
    let byte = digest[i];
    if (byte < 0) byte += 256;
    let bStr = byte.toString(16);
    if (bStr.length === 1) bStr = '0' + bStr;
    hash += bStr;
  }
  return hash;
}

/**
 * Generate a unique session token
 * @returns {string} UUID
 */
function generateToken() {
  return Utilities.getUuid();
}

/**
 * HELPER FUNCTION: Run this once to generate a password hash.
 * 1. Set the password in the 'passwordToHash' variable.
 * 2. Run this function from the Apps Script editor.
 * 3. Copy the output from the logs and paste it into the 'PasswordHash' column in your 'Users' sheet.
 */
function generatePasswordHashForSetup() {
  const passwordToHash = 'admin1234'; // <-- SET YOUR DESIRED PASSWORD HERE
  const hash = hashPassword(passwordToHash);
  console.log(`Password: ${passwordToHash}`);
  console.log(`SHA-256 Hash: ${hash}`);
}
