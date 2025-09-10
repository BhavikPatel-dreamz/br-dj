import 'dotenv/config';
import sql from 'mssql';

// Get connection details from environment variables
const server = process.env.MS_SQL_HOST;
const database = process.env.MS_SQL_DATABASE;
const user = process.env.MS_SQL_USERNAME;
// Remove quotes if they exist in the password
const password = process.env.MS_SQL_PASSWORD;

// Validate required environment variables
if (!server || !database || !user || !password) {
  const missing = [];
  if (!server) missing.push('MS_SQL_HOST');
  if (!database) missing.push('MS_SQL_DATABASE');
  if (!user) missing.push('MS_SQL_USERNAME');
  if (!password) missing.push('MS_SQL_PASSWORD');
  
  console.error('❌ Missing environment variables:', missing);
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

console.log('Database config:===================', {
  server: server,
  database: database,
  user: user,
  passwordLength: password ? password.length : 0,
  hasSpecialChars: password ? /[^a-zA-Z0-9]/.test(password) : false,
  hasQuotes: password ? password.includes('"') : false,
  startsWithQuote: password ? password.charAt(0) === '"' : false,
  endsWithQuote: password ? password.charAt(password.length - 1) === '"' : false
});

// Configuration for MSSQL connection
const config = {
    server: server,
    user: user,
    password: password,
    database: database,
    port: 1433,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      connectTimeout: 10000,
      requestTimeout: 10000
    
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

// Create connection pool
async function getConnection() {
  if (!pool) {
    try {
      console.log('🔄 Attempting to connect to SQL Server...');
      console.log('Connection details:', {
        server: server,
        database: database,
        user: user,
        port: 1433,
        encrypt: true,
        trustServerCertificate: true
      });
      
      pool = await sql.connect(config);
      console.log('✅ Connected to MSSQL database successfully');
    } catch (err) {
      console.error('❌ Database connection failed:', err);
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        code: err.code,
        state: err.state,
        class: err.class,
        serverName: err.serverName,
        procName: err.procName,
        lineNumber: err.lineNumber
      });
      
      // Provide specific troubleshooting guidance
      if (err.message && err.message.includes('Login failed')) {
        console.error('🔐 Authentication Issues - Check:');
        console.error('1. Username is correct:', user);
        console.error('2. Password is correct (length:', password ? password.length : 0, ')');
        console.error('3. User has access to database:', database);
        console.error('4. Firewall allows connection from this IP');
        console.error('5. Azure SQL allows your IP address');
      }
      
      if (err.message && err.message.includes('timeout')) {
        console.error('⏰ Connection Timeout - Check:');
        console.error('1. Server is reachable:', server);
        console.error('2. Port 1433 is open');
        console.error('3. Network connectivity');
      }
      
      pool = null; // Reset pool on failure
      throw err;
    }
  }
  return pool;
}

// Database helper functions
const mssql = {
  // Get connection pool
  async getPool() {
    return await getConnection();
  },

  // Execute query with parameters
  async query(queryText, params = {}) {
    try {
      const pool = await getConnection();
      const request = pool.request();
      
      // Add parameters to request
      Object.keys(params).forEach(key => {
        request.input(key, params[key]);
      });
      
      const result = await request.query(queryText);
      return result.recordset;
    } catch (err) {
      console.error('Query error:', err);
      throw err;
    }
  },

  // Raw SQL execution
  async execute(queryText, params = {}) {
    try {
      const pool = await getConnection();
      const request = pool.request();
      
      // Add parameters to request
      Object.keys(params).forEach(key => {
        request.input(key, params[key]);
      });
      
      return await request.query(queryText);
    } catch (err) {
      console.error('Execute error:', err);
      throw err;
    }
  },

  // Test table operations (read-only for safety)
  test: {
    async findMany() {
      return await mssql.query('SELECT * FROM test ORDER BY id');
    },
    
    async findById(id) {
      return await mssql.query('SELECT * FROM test WHERE id = @id', { id });
    },
    
    async count() {
      const result = await mssql.query('SELECT COUNT(*) as count FROM test');
      return result[0]?.count || 0;
    }
  },

  // Generic table operations
  table: (tableName) => ({
    async select(columns = '*', whereClause = '', params = {}) {
      const query = `SELECT ${columns} FROM ${tableName} ${whereClause}`;
      return await mssql.query(query, params);
    },
    
    async count(whereClause = '', params = {}) {
      const query = `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`;
      const result = await mssql.query(query, params);
      return result[0]?.count || 0;
    }
  }),

  // Close connection
  async close() {
    if (pool) {
      await pool.close();
      pool = null;
      console.log('MSSQL connection closed');
    }
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  await mssql.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mssql.close();
  process.exit(0);
});

export default mssql;
