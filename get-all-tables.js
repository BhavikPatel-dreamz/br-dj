import dotenv from 'dotenv';
import mssql from './app/mssql.server.js';

// Load environment variables
dotenv.config();

async function getAllTables() {
  try {
    console.log('🔍 Connecting to database to fetch all tables...\n');
    
    // Get all databases
    console.log('📊 Available Databases:');
    const databases = await mssql.query(`
      SELECT name as database_name
      FROM sys.databases 
      WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
      ORDER BY name
    `);
    
    databases.forEach((db, index) => {
      console.log(`${index + 1}. ${db.database_name}`);
    });
    
    console.log('\n📋 All Tables in Current Database:');
    
    // Get all tables with schema information
    const allTables = await mssql.query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    
    // Group tables by schema
    const tablesBySchema = {};
    allTables.forEach(table => {
      const schema = table.TABLE_SCHEMA;
      if (!tablesBySchema[schema]) {
        tablesBySchema[schema] = [];
      }
      tablesBySchema[schema].push(table.TABLE_NAME);
    });
    
    // Display tables grouped by schema
    let totalTables = 0;
    Object.entries(tablesBySchema).forEach(([schema, tables]) => {
      console.log(`\n🏗️  Schema: ${schema} (${tables.length} tables)`);
      tables.forEach((table, index) => {
        console.log(`  ${index + 1}. ${table}`);
        totalTables++;
      });
    });
    
    console.log(`\n📊 Total Tables Found: ${totalTables}`);
    
    // Look specifically for Shopify-related tables
    console.log('\n🛍️  Shopify-Related Tables:');
    const shopifyTables = await mssql.query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      AND (TABLE_SCHEMA LIKE '%shopify%' OR TABLE_NAME LIKE '%shopify%')
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    
    if (shopifyTables.length > 0) {
      shopifyTables.forEach((table, index) => {
        console.log(`${index + 1}. ${table.TABLE_SCHEMA}.${table.TABLE_NAME}`);
      });
    } else {
      console.log('   No tables with "shopify" in schema or name found.');
    }
    
    // Look for refund-related tables across all schemas
    console.log('\n🔄 Refund-Related Tables:');
    const refundTables = await mssql.query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      AND (
        TABLE_NAME LIKE '%refund%' OR 
        TABLE_NAME LIKE '%return%' OR 
        TABLE_NAME LIKE '%adjustment%' OR
        TABLE_NAME LIKE '%credit%' OR
        TABLE_NAME LIKE '%void%'
      )
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    
    if (refundTables.length > 0) {
      refundTables.forEach((table, index) => {
        console.log(`${index + 1}. ${table.TABLE_SCHEMA}.${table.TABLE_NAME}`);
      });
    } else {
      console.log('   No refund-related tables found.');
    }
    
    // Look for order-related tables
    console.log('\n📦 Order-Related Tables:');
    const orderTables = await mssql.query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      AND (
        TABLE_NAME LIKE '%order%' OR 
        TABLE_NAME LIKE '%line%' OR 
        TABLE_NAME LIKE '%product%' OR
        TABLE_NAME LIKE '%customer%'
      )
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    
    if (orderTables.length > 0) {
      orderTables.forEach((table, index) => {
        console.log(`${index + 1}. ${table.TABLE_SCHEMA}.${table.TABLE_NAME}`);
      });
    } else {
      console.log('   No order-related tables found.');
    }
    
    // Get row counts for important tables
    console.log('\n📊 Table Row Counts (for important tables):');
    
    const importantTables = [
      'order', 'order_line', 'product', 'customer', 
      'refund', 'refund_line_item', 'refund_line', 
      'adjustment', 'return'
    ];
    
    for (const tableName of importantTables) {
      try {
        // Check if table exists in any schema
        const tableExists = await mssql.query(`
          SELECT 
            TABLE_SCHEMA,
            TABLE_NAME
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_NAME = '${tableName}'
          AND TABLE_TYPE = 'BASE TABLE'
        `);
        
        if (tableExists.length > 0) {
          for (const table of tableExists) {
            try {
              const countResult = await mssql.query(`
                SELECT COUNT(*) as row_count 
                FROM ${table.TABLE_SCHEMA}.${table.TABLE_NAME}
              `);
              const rowCount = countResult[0]?.row_count || 0;
              console.log(`   ${table.TABLE_SCHEMA}.${table.TABLE_NAME}: ${rowCount.toLocaleString()} rows`);
            } catch (countError) {
              console.log(`   ${table.TABLE_SCHEMA}.${table.TABLE_NAME}: Error getting count - ${countError.message}`);
            }
          }
        }
      } catch (error) {
        // Table doesn't exist, skip silently
      }
    }
    
    console.log('\n✅ Database exploration complete!');
    
  } catch (error) {
    console.error('❌ Error exploring database:', error);
    console.error('Full error details:', error.message);
  } finally {
    // Close connection
    try {
      await mssql.close();
      console.log('\n🔒 Database connection closed');
    } catch (closeError) {
      console.error('Error closing connection:', closeError.message);
    }
  }
}

// Run the function
getAllTables();
