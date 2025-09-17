import mssql from '../app/mssql.server.js';

async function checkCategoryTables() {
  try {
    console.log('Checking budget_categories_master table...');
    const masterResult = await mssql.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'budget_categories_master' AND TABLE_SCHEMA = 'shopify'
      ORDER BY ORDINAL_POSITION
    `);
    console.log('budget_categories_master columns:', masterResult);
    
    console.log('\nChecking budget_categories table...');
    const categoriesResult = await mssql.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'budget_categories' AND TABLE_SCHEMA = 'shopify'
      ORDER BY ORDINAL_POSITION
    `);
    console.log('budget_categories columns:', categoriesResult);
    
    console.log('\nChecking sample data from budget_categories_master...');
    const sampleMaster = await mssql.query('SELECT TOP 3 * FROM shopify.budget_categories_master');
    console.log('Sample master records:', sampleMaster);
    
    console.log('\nChecking sample data from budget_categories...');
    const sampleCategories = await mssql.query('SELECT TOP 3 * FROM shopify.budget_categories');
    console.log('Sample category records:', sampleCategories);
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

checkCategoryTables();
