/**
 * Migration: Add City column to Drivers table
 * and set sami.driver@gmail.com to Lahore.
 */
require('dotenv').config();
const pool = require('./db/connection');

async function migrate() {
  const conn = await pool.getConnection();
  try {
    // 1. Add City column if it doesn't exist
    try {
      await conn.query(`ALTER TABLE Drivers ADD COLUMN City VARCHAR(50) NOT NULL DEFAULT 'Lahore'`);
      console.log('✅ City column added to Drivers table.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  City column already exists.');
      } else {
        throw e;
      }
    }

    // 2. Set sami.driver@gmail.com to Lahore
    const [result] = await conn.query(
      `UPDATE Drivers d
       JOIN Users u ON d.DriverID = u.UserID
       SET d.City = 'Lahore'
       WHERE u.Email = 'sami.driver@gmail.com'`
    );
    console.log(`✅ sami.driver@gmail.com set to Lahore. (${result.affectedRows} row(s) updated)`);

    console.log('🎉 Migration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();
