/**
 * Quick script to reset the admin password.
 * Run: node reset-admin-password.js
 * Then delete this file.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('./db/connection');

const NEW_PASSWORD = 'admin123';

(async () => {
  try {
    const hash = await bcrypt.hash(NEW_PASSWORD, 10);
    const [result] = await pool.execute(
      `UPDATE Users SET PasswordHash = ? WHERE Email = 'admin@rideflow.com'`,
      [hash]
    );

    if (result.affectedRows > 0) {
      console.log(`✅ Admin password reset successfully!`);
      console.log(`   Email:    admin@rideflow.com`);
      console.log(`   Password: ${NEW_PASSWORD}`);
    } else {
      console.log('❌ No admin user found with email admin@rideflow.com');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
