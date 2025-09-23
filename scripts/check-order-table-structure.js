import mssql from '../app/mssql.server.js';

async function checkOrderTableStructure() {
  try {
    console.log('🔍 Checking for order-related tables...');
    
    // First, let's see what tables exist that might contain order data
    const tables = await mssql.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' 
      AND TABLE_NAME LIKE '%order%'
      ORDER BY TABLE_NAME
    `);
    
    console.log('📋 Tables containing "order":', tables);
    
    // If no tables with "order" in the name, let's see all tables
    if (tables.length === 0) {
      console.log('🔍 No tables found with "order" in name. Checking all tables...');
      const allTables = await mssql.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `);
      console.log('📋 All available tables:', allTables);
    } else {
      // Check structure of each order table
      for (const table of tables) {
        console.log(`\n📊 Structure of table: ${table.TABLE_NAME}`);
        
        const columns = await mssql.query(`
          SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            IS_NULLABLE,
            COLUMN_DEFAULT,
            CHARACTER_MAXIMUM_LENGTH
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = @tableName
          ORDER BY ORDINAL_POSITION
        `, { tableName: table.TABLE_NAME });
        
        console.table(columns);
        
        // Check if order_budget_month column already exists
        const hasColumn = columns.some(col => col.COLUMN_NAME === 'order_budget_month');
        console.log(`✅ Has order_budget_month column: ${hasColumn}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking table structure:', error);
  } finally {
    await mssql.close();
  }
}

checkOrderTableStructure();