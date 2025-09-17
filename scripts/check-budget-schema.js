import mssql from '../app/mssql.server.js';

async function checkBudgetTable() {
  try {
    console.log('Checking budget table columns...');
    const result = await mssql.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'budget' AND TABLE_SCHEMA = 'shopify'
      ORDER BY ORDINAL_POSITION
    `);
    console.log('Budget table columns:', result);
    
    console.log('\nChecking if budget table has any records...');
    const count = await mssql.query('SELECT COUNT(*) as count FROM shopify.budget');
    console.log('Budget count:', count);
    
    console.log('\nChecking actual columns by querying with *...');
    const sample = await mssql.query('SELECT TOP 1 * FROM shopify.budget');
    console.log('Sample record (keys):', sample[0] ? Object.keys(sample[0]) : 'No records');
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

checkBudgetTable();
