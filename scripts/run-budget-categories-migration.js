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

async function runBudgetCategoriesMigration() {
    try {
        console.log('🔄 Starting budget categories migration...');
        console.log('Connecting to SQL Server...');
        await sql.connect(dbConfig);
        console.log('✅ Connected successfully!');

        // Step 1: Add the new category_id column
        console.log('📊 Step 1: Adding category_id column...');
        try {
            await sql.query(`
                ALTER TABLE shopify.budget_categories 
                ADD category_id BIGINT NULL;
            `);
            console.log('✅ Added category_id column');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️  category_id column already exists');
            } else {
                throw error;
            }
        }

        // Step 2: Add foreign key constraint
        console.log('🔗 Step 2: Adding foreign key constraint...');
        try {
            await sql.query(`
                ALTER TABLE shopify.budget_categories
                ADD CONSTRAINT FK_budget_categories_category_id 
                FOREIGN KEY (category_id) REFERENCES shopify.budget_categories_master(id);
            `);
            console.log('✅ Added foreign key constraint');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️  Foreign key constraint already exists');
            } else {
                throw error;
            }
        }

        // Step 3: Populate category_id based on existing category_name
        console.log('🔄 Step 3: Populating category_id from category_name...');
        const updateResult = await sql.query(`
            UPDATE bc
            SET category_id = bcm.id
            FROM shopify.budget_categories bc
            INNER JOIN shopify.budget_categories_master bcm ON bc.category_name = bcm.name
            WHERE bc.category_id IS NULL;
        `);
        console.log(`✅ Updated ${updateResult.rowsAffected[0]} records`);

        // Step 4: Check for any unmapped categories
        console.log('🔍 Step 4: Checking for unmapped categories...');
        const unmappedResult = await sql.query(`
            SELECT 
                bc.id as budget_category_id,
                bc.category_name,
                'No matching master category found' as issue
            FROM shopify.budget_categories bc
            LEFT JOIN shopify.budget_categories_master bcm ON bc.category_name = bcm.name
            WHERE bc.category_id IS NULL;
        `);

        if (unmappedResult.recordset.length > 0) {
            console.warn('⚠️  Found unmapped categories:');
            unmappedResult.recordset.forEach(row => {
                console.warn(`   - ID: ${row.budget_category_id}, Name: ${row.category_name}`);
            });
            
            // Try to create missing categories in master table
            console.log('🔄 Creating missing categories in master table...');
            for (const row of unmappedResult.recordset) {
                const categoryName = row.category_name;
                const parentCategory = categoryName.split('>')[0];
                
                try {
                    const insertResult = await sql.query(`
                        INSERT INTO shopify.budget_categories_master (name, parent_category, description, created_by)
                        OUTPUT INSERTED.id
                        VALUES (@name, @parentCategory, @description, 'migration');
                    `, {
                        name: categoryName,
                        parentCategory: parentCategory,
                        description: `Auto-created during migration for ${categoryName}`
                    });
                    
                    const newCategoryId = insertResult.recordset[0].id;
                    
                    // Update the budget_categories record
                    await sql.query(`
                        UPDATE shopify.budget_categories
                        SET category_id = @categoryId
                        WHERE id = @budgetCategoryId;
                    `, {
                        categoryId: newCategoryId,
                        budgetCategoryId: row.budget_category_id
                    });
                    
                    console.log(`✅ Created and linked category: ${categoryName} (ID: ${newCategoryId})`);
                } catch (error) {
                    console.error(`❌ Failed to create category ${categoryName}:`, error.message);
                }
            }
        } else {
            console.log('✅ All categories are properly mapped');
        }

        // Step 5: Create index on category_id for performance
        console.log('🔍 Step 5: Creating index on category_id...');
        try {
            await sql.query(`
                CREATE INDEX IX_budget_categories_category_id ON shopify.budget_categories(category_id);
            `);
            console.log('✅ Created index on category_id');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️  Index on category_id already exists');
            } else {
                throw error;
            }
        }

        // Verification: Show some sample data
        console.log('\n📊 Verification - Sample budget categories:');
        const sampleResult = await sql.query(`
            SELECT TOP 10 
                bc.id,
                bc.budget_id,
                bc.category_id,
                bc.category_name,
                bcm.name as master_category_name,
                bcm.parent_category,
                bc.allocated_amount
            FROM shopify.budget_categories bc
            LEFT JOIN shopify.budget_categories_master bcm ON bc.category_id = bcm.id
            ORDER BY bc.id;
        `);

        sampleResult.recordset.forEach(row => {
            console.log(`   Budget Category ID: ${row.id}, Category ID: ${row.category_id}, Name: ${row.category_name || 'N/A'}, Master Name: ${row.master_category_name || 'N/A'}, Amount: $${row.allocated_amount}`);
        });

        await sql.close();
        console.log('\n✅ Migration completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Test the budget creation functionality');
        console.log('2. If everything works correctly, you can run the final cleanup:');
        console.log('   - Make category_id NOT NULL');
        console.log('   - Drop the category_name column');
        console.log('   - Update the unique constraint');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        if (sql.connected) {
            await sql.close();
        }
        process.exit(1);
    }
}

// Run the migration
runBudgetCategoriesMigration();
