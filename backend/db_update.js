const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'RideFlow'
  });

  try {
    await conn.query('ALTER TABLE Users ADD COLUMN ProfilePicture VARCHAR(255) NULL');
    console.log('Column added.');
  } catch (e) {
    console.log('Column might exist', e.message);
  }

  await conn.query(`UPDATE Users SET ProfilePicture = 'https://i.pravatar.cc/150?u=samiullah' WHERE Email = 'sami.driver@gmail.com'`);
  console.log('Samiullah updated.');
  conn.end();
}

run().catch(console.error);
