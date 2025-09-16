import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mssql from '../app/mssql.server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('🚀 Starting budget table migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '../database/migrations/create-budget-table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split('GO')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
          await mssql.execute(statement);
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (error) {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          // Continue with next statement for some errors (like "already exists")
          if (!error.message.includes('already exists') && 
              !error.message.includes('There is already an object')) {
            throw error;
          }
        }
      }
    }
    
    console.log('🎉 Budget table migration completed successfully!');
    
    // Test the tables by querying them
    console.log('\n📊 Testing budget tables...');
    
    const budgets = await mssql.query('SELECT * FROM shopify.budget');
    console.log(`✅ Found ${budgets.length} budget records`);
    
    const categories = await mssql.query('SELECT * FROM shopify.budget_categories');
    console.log(`✅ Found ${categories.length} budget category records`);
    
    // Show budget summary
    const summary = await mssql.query('SELECT * FROM shopify.v_budget_summary');
    console.log('\n📈 Budget Summary:');
    summary.forEach(budget => {
      console.log(`- ${budget.name}: $${budget.total_amount} (${budget.category_count} categories)`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Close the database connection
    await mssql.close();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('💥 Migration script failed:', error);
  process.exit(1);
});
