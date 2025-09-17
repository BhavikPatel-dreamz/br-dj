import mssql from '../app/mssql.server.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createSessionsTable() {
  try {
    console.log('Connecting to database...');
    const pool = await mssql.getPool();
    
    // Read the SQL script
    const sqlScript = fs.readFileSync(
      path.join(__dirname, '../database/create-sessions-table.sql'), 
      'utf8'
    );
    
    console.log('Executing SQL script to create sessions table...');
    const result = await pool.request().query(sqlScript);
    
    console.log('✅ Sessions table creation script executed successfully!');
    console.log('Result:', result);
    
    // Test if the table exists
    const checkTable = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'sessions' AND TABLE_TYPE = 'BASE TABLE'
    `);
    
    if (checkTable.recordset.length > 0) {
      console.log('✅ Sessions table verified - table exists in database');
    } else {
      console.log('❌ Sessions table not found after execution');
    }
    
    await mssql.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating sessions table:', error);
    process.exit(1);
  }
}

createSessionsTable();
