import mssql from '../app/mssql.server.js';

async function checkOrderTableSchema() {
  try {
    console.log('🔍 Checking schema for order table...');
    
    const result = await mssql.query(`
      SELECT TABLE_SCHEMA, TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'order'
    `);
    
    console.log('Order table schema info:', result);
    
    if (result.length > 0) {
      const schema = result[0].TABLE_SCHEMA;
      console.log(`✅ Found order table in schema: ${schema}`);
      
      // Test a simple query with the correct schema
      const testQuery = `SELECT TOP 5 id, created_at, total_price FROM [${schema}].[order] WHERE _fivetran_deleted != 1 ORDER BY created_at DESC`;
      console.log('🧪 Testing query:', testQuery);
      
      const testResult = await mssql.query(testQuery);
      console.log('✅ Test query successful. Sample data:');
      console.table(testResult);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mssql.close();
  }
}

checkOrderTableSchema();