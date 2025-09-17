import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration using environment variables
const dbConfig = {
    server: process.env.MS_SQL_HOST,
    user: process.env.MS_SQL_USERNAME,
    password: process.env.MS_SQL_PASSWORD,
    database: process.env.MS_SQL_DATABASE,
    port: 1433,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        connectTimeout: 30000,
        requestTimeout: 30000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

async function createBudgetCategoriesMasterTable() {
    try {
        console.log('🔄 Starting budget categories master table creation...');
        console.log('Connecting to SQL Server...');
        await sql.connect(dbConfig);
        console.log('✅ Connected successfully!');

        // Check if table already exists
        console.log('🔍 Checking if table already exists...');
        const tableCheck = await sql.query(`
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'shopify' 
            AND TABLE_NAME = 'budget_categories_master'
        `);

        if (tableCheck.recordset[0].count > 0) {
            console.log('⚠️  Table shopify.budget_categories_master already exists');
            
            // Check if it has the correct schema
            const schemaCheck = await sql.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = 'shopify' 
                AND TABLE_NAME = 'budget_categories_master'
                AND COLUMN_NAME IN ('category_name', 'category_code', 'sort_order')
            `);
            
            if (schemaCheck.recordset.length < 3) {
                console.log('⚠️  Table exists but schema is incomplete. Dropping and recreating...');
                await sql.query('DROP TABLE IF EXISTS shopify.budget_categories_master');
            } else {
                console.log('✅ Table already exists with correct schema');
                
                // Check if data exists
                const dataCheck = await sql.query('SELECT COUNT(*) as count FROM shopify.budget_categories_master');
                console.log(`ℹ️  Current record count: ${dataCheck.recordset[0].count}`);
                
                if (dataCheck.recordset[0].count > 0) {
                    console.log('✅ Migration already completed!');
                    return;
                }
            }
        }

        // Read and execute the migration SQL
        console.log('📄 Reading migration file...');
        const migrationPath = path.join(__dirname, '../database/migrations/create-budget-categories-master.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Split by GO statements and execute each batch
        const batches = migrationSQL.split(/^\s*GO\s*$/gm).filter(batch => batch.trim());
        
        console.log(`📊 Executing ${batches.length} batches...`);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i].trim();
            if (batch) {
                console.log(`Executing batch ${i + 1}/${batches.length}`);
                try {
                    await sql.query(batch);
                } catch (error) {
                    console.error(`❌ Error in batch ${i + 1}:`, error.message);
                    throw error;
                }
            }
        }
        
        // Verify the creation
        const finalCheck = await sql.query('SELECT COUNT(*) as count FROM shopify.budget_categories_master');
        console.log(`✅ Migration completed successfully! Created ${finalCheck.recordset[0].count} categories`);
        
        // Show some sample data
        const sampleData = await sql.query(`
            SELECT TOP 5 
                id, category_name, category_code, parent_category, sort_order 
            FROM shopify.budget_categories_master 
            ORDER BY sort_order, category_name
        `);
        
        console.log('\n📋 Sample categories created:');
        sampleData.recordset.forEach(row => {
            console.log(`  - ${row.category_name} (${row.category_code || 'No code'}) - Sort: ${row.sort_order}`);
        });
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Full error:', error);
        throw error;
    } finally {
        console.log('🔌 Closing database connection...');
        await sql.close();
    }
}

// Run the migration
createBudgetCategoriesMasterTable()
    .then(() => {
        console.log('🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Script failed:', error);
        process.exit(1);
    });
