import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// Import after environment is loaded
const mssql = await import('./app/mssql.server.js');

async function examineRefundTables() {
  try {
    console.log('🔍 Examining Refund Table Structures...\n');
    
    // 1. Examine shopify.refund table structure
    console.log('🏗️  Structure of shopify.refund table:');
    const refundColumns = await mssql.default.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'shopify' 
      AND TABLE_NAME = 'refund'
      ORDER BY ORDINAL_POSITION
    `);
    
    refundColumns.forEach(col => {
      const nullable = col.IS_NULLABLE === 'YES' ? '(nullable)' : '(not null)';
      const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${length} ${nullable}`);
    });
    
    // 2. Examine shopify.order_line_refund table structure
    console.log('\n🏗️  Structure of shopify.order_line_refund table:');
    const orderLineRefundColumns = await mssql.default.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'shopify' 
      AND TABLE_NAME = 'order_line_refund'
      ORDER BY ORDINAL_POSITION
    `);
    
    orderLineRefundColumns.forEach(col => {
      const nullable = col.IS_NULLABLE === 'YES' ? '(nullable)' : '(not null)';
      const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${length} ${nullable}`);
    });
    
    // 3. Get sample data from refund table
    console.log('\n📝 Sample data from shopify.refund (first 3 rows):');
    const refundSample = await mssql.default.query(`
      SELECT TOP 3 * FROM shopify.refund ORDER BY created_at DESC
    `);
    
    refundSample.forEach((row, index) => {
      console.log(`\n  Row ${index + 1}:`);
      Object.entries(row).forEach(([key, value]) => {
        // Truncate long values for readability
        let displayValue = value;
        if (typeof value === 'string' && value.length > 50) {
          displayValue = value.substring(0, 50) + '...';
        }
        if (value instanceof Date) {
          displayValue = value.toISOString();
        }
        console.log(`    ${key}: ${displayValue}`);
      });
    });
    
    // 4. Get sample data from order_line_refund table
    console.log('\n📝 Sample data from shopify.order_line_refund (first 3 rows):');
    const orderLineRefundSample = await mssql.default.query(`
      SELECT TOP 3 * FROM shopify.order_line_refund ORDER BY id
    `);
    
    orderLineRefundSample.forEach((row, index) => {
      console.log(`\n  Row ${index + 1}:`);
      Object.entries(row).forEach(([key, value]) => {
        let displayValue = value;
        if (typeof value === 'string' && value.length > 50) {
          displayValue = value.substring(0, 50) + '...';
        }
        if (value instanceof Date) {
          displayValue = value.toISOString();
        }
        console.log(`    ${key}: ${displayValue}`);
      });
    });
    
    // 5. Show relationship between tables
    console.log('\n🔗 Relationship Analysis:');
    
    // Check if refunds link to orders
    const refundOrderLink = await mssql.default.query(`
      SELECT TOP 5 
        r.id as refund_id,
        r.order_id,
        r.created_at as refund_date
      FROM shopify.refund r
      WHERE r.order_id IS NOT NULL
      ORDER BY r.created_at DESC
    `);
    
    console.log('\nRefund to Order relationships:');
    refundOrderLink.forEach(row => {
      console.log(`  Refund ${row.refund_id} → Order ${row.order_id} (${row.refund_date?.toISOString()})`);
    });
    
    // Check if order_line_refund links to order_line
    const orderLineRefundLink = await mssql.default.query(`
      SELECT TOP 5 
        olr.id as refund_line_id,
        olr.order_line_id,
        olr.quantity as refunded_quantity,
        ol.quantity as original_quantity,
        ol.name as product_name
      FROM shopify.order_line_refund olr
      LEFT JOIN shopify.order_line ol ON olr.order_line_id = ol.id
      WHERE olr.order_line_id IS NOT NULL
      ORDER BY olr.id
    `);
    
    console.log('\nOrder Line Refund relationships:');
    orderLineRefundLink.forEach(row => {
      console.log(`  Refund Line ${row.refund_line_id}: ${row.refunded_quantity}/${row.original_quantity} of "${row.product_name}"`);
    });
    
    // 6. Count summary
    console.log('\n📊 Summary Counts:');
    const refundCount = await mssql.default.query(`SELECT COUNT(*) as count FROM shopify.refund`);
    const orderLineRefundCount = await mssql.default.query(`SELECT COUNT(*) as count FROM shopify.order_line_refund`);
    const orderCount = await mssql.default.query(`SELECT COUNT(*) as count FROM shopify.[order]`);
    const orderLineCount = await mssql.default.query(`SELECT COUNT(*) as count FROM shopify.order_line`);
    
    console.log(`  - Total Refunds: ${refundCount[0].count}`);
    console.log(`  - Total Order Line Refunds: ${orderLineRefundCount[0].count}`);
    console.log(`  - Total Orders: ${orderCount[0].count}`);
    console.log(`  - Total Order Lines: ${orderLineCount[0].count}`);
    
    const refundPercentage = ((refundCount[0].count / orderCount[0].count) * 100).toFixed(2);
    console.log(`  - Refund Rate: ${refundPercentage}% of orders have refunds`);
    
    console.log('\n✅ Refund table analysis complete!');
    
  } catch (error) {
    console.error('❌ Error examining refund tables:', error);
    console.error('Full error details:', error.message);
  } finally {
    // Close connection
    try {
      await mssql.default.close();
      console.log('\n🔒 Database connection closed');
    } catch (closeError) {
      console.error('Error closing connection:', closeError.message);
    }
  }
}

// Run the function
examineRefundTables();
