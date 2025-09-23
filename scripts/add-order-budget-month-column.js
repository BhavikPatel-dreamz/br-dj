import mssql from '../app/mssql.server.js';

async function addOrderBudgetMonthColumn() {
  try {
    console.log('🔄 Adding order_budget_month column to the order table...');
    
    // First, check if the column already exists
    const existingColumn = await mssql.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'order' AND COLUMN_NAME = 'order_budget_month'
    `);
    
    if (existingColumn.length > 0) {
      console.log('⚠️  Column order_budget_month already exists in the order table');
      return;
    }
    
    // Add the column - using nvarchar to store the budget month (e.g., "2025-01", "2025-02")
    const alterQuery = `
      ALTER TABLE [order] 
      ADD order_budget_month NVARCHAR(7) NULL
    `;
    
    console.log('📝 Executing SQL:', alterQuery);
    
    await mssql.execute(alterQuery);
    
    console.log('✅ Successfully added order_budget_month column to the order table');
    
    // Verify the column was added
    const verifyColumn = await mssql.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'order' AND COLUMN_NAME = 'order_budget_month'
    `);
    
    console.log('🔍 Column details:');
    console.table(verifyColumn);
    
    // Show some sample records to see the new column
    console.log('📊 Sample records with new column:');
    const sampleRecords = await mssql.query(`
      SELECT TOP 5 
        id, 
        name, 
        created_at, 
        total_price, 
        order_budget_month 
      FROM [order] 
      ORDER BY created_at DESC
    `);
    
    console.table(sampleRecords);
    
  } catch (error) {
    console.error('❌ Error adding order_budget_month column:', error);
    
    // Provide specific error guidance
    if (error.message && error.message.includes('permission')) {
      console.error('🔐 Permission Error - Check:');
      console.error('1. Your user has ALTER table permissions');
      console.error('2. You have DDL permissions on the database');
    }
    
    if (error.message && error.message.includes('already exists')) {
      console.error('📋 Column might already exist or there\'s a name conflict');
    }
    
  } finally {
    await mssql.close();
  }
}

addOrderBudgetMonthColumn();