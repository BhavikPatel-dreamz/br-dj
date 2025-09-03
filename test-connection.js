import dotenv from 'dotenv';
import mssql from './app/mssql.server.js';

// Load environment variables
dotenv.config();

async function testConnection() {
  try {
    console.log('Testing MSSQL connection with fixed environment variables...');
    
    // Test basic query
    const result = await mssql.test.findMany();
    console.log('✅ Connection successful!');
    console.log('Data from test table:', result);
    
    // Test count
    const count = await mssql.test.count();
    console.log('✅ Count query successful:', count);
    
    // Test raw query
    const rawResult = await mssql.query('SELECT COUNT(*) as total FROM test');
    console.log('✅ Raw query successful:', rawResult);
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    console.error('Full error:', error);
  } finally {
    // Close connection
    await mssql.close();
    console.log('Connection closed');
  }
}

testConnection();
