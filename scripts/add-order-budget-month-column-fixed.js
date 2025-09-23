import mssql from '../app/mssql.server.js';

async function checkSchemaAndAddColumn() {
  try {
    console.log('🔍 Checking table schema and permissions...');
    
    // First, let's check the table with its full schema name
    const tables = await mssql.query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'order'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    
    console.log('📋 Available order tables with schema:');
    console.table(tables);
    
    if (tables.length === 0) {
      console.log('❌ No order table found');
      return;
    }
    
    // Use the first order table found (usually dbo.order)
    const schemaName = tables[0].TABLE_SCHEMA;
    const tableName = tables[0].TABLE_NAME;
    const fullTableName = `[${schemaName}].[${tableName}]`;
    
    console.log(`🎯 Working with table: ${fullTableName}`);
    
    // Check if the column already exists
    const existingColumn = await mssql.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = @schemaName AND TABLE_NAME = @tableName AND COLUMN_NAME = 'order_budget_month'
    `, { schemaName, tableName });
    
    if (existingColumn.length > 0) {
      console.log('⚠️  Column order_budget_month already exists in the table');
      return;
    }
    
    // Add the column with proper schema qualification
    const alterQuery = `
      ALTER TABLE ${fullTableName} 
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
      WHERE TABLE_SCHEMA = @schemaName AND TABLE_NAME = @tableName AND COLUMN_NAME = 'order_budget_month'
    `, { schemaName, tableName });
    
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
      FROM ${fullTableName} 
      ORDER BY created_at DESC
    `);
    
    console.table(sampleRecords);
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    // Provide specific error guidance
    if (error.message && error.message.includes('permission')) {
      console.error('🔐 Permission Error - Check:');
      console.error('1. Your user has ALTER table permissions');
      console.error('2. You have DDL permissions on the database');
      console.error('3. Contact your database administrator for ALTER permissions');
    }
    
    if (error.message && error.message.includes('already exists')) {
      console.error('📋 Column might already exist or there\'s a name conflict');
    }
    
  } finally {
    await mssql.close();
  }
}

checkSchemaAndAddColumn();