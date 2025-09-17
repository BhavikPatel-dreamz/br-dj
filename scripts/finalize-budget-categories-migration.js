import sql from 'mssql';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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

async function finalizeBudgetCategoriesMigration() {
    try {
        console.log('🔄 Finalizing budget categories migration...');
        console.log('Connecting to SQL Server...');
        await sql.connect(dbConfig);
        console.log('✅ Connected successfully!');

        // Step 1: Verify all categories have category_id set
        console.log('🔍 Step 1: Verifying all categories have category_id...');
        const nullCheckResult = await sql.query(`
            SELECT COUNT(*) as null_count
            FROM shopify.budget_categories
            WHERE category_id IS NULL;
        `);

        if (nullCheckResult.recordset[0].null_count > 0) {
            console.error(`❌ Found ${nullCheckResult.recordset[0].null_count} records with NULL category_id`);
            console.error('Please run the migration script first to populate category_id values');
            return;
        }
        console.log('✅ All categories have category_id set');

        // Step 2: Make category_id NOT NULL
        console.log('📊 Step 2: Making category_id NOT NULL...');
        await sql.query(`
            ALTER TABLE shopify.budget_categories 
            ALTER COLUMN category_id BIGINT NOT NULL;
        `);
        console.log('✅ Made category_id NOT NULL');

        // Step 3: Drop the old unique constraint
        console.log('🗑️  Step 3: Dropping old unique constraint...');
        try {
            await sql.query(`
                ALTER TABLE shopify.budget_categories 
                DROP CONSTRAINT UQ_budget_categories_budget_category;
            `);
            console.log('✅ Dropped old unique constraint');
        } catch (error) {
            if (error.message.includes('does not exist')) {
                console.log('ℹ️  Old unique constraint doesn\'t exist');
            } else {
                throw error;
            }
        }

        // Step 4: Add new unique constraint with category_id
        console.log('🔗 Step 4: Adding new unique constraint with category_id...');
        try {
            await sql.query(`
                ALTER TABLE shopify.budget_categories
                ADD CONSTRAINT UQ_budget_categories_budget_category_id UNIQUE (budget_id, category_id);
            `);
            console.log('✅ Added new unique constraint');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️  New unique constraint already exists');
            } else {
                throw error;
            }
        }

        // Step 5: Drop the category_name column
        console.log('🗑️  Step 5: Dropping category_name column...');
        try {
            await sql.query(`
                ALTER TABLE shopify.budget_categories 
                DROP COLUMN category_name;
            `);
            console.log('✅ Dropped category_name column');
        } catch (error) {
            if (error.message.includes('does not exist')) {
                console.log('ℹ️  category_name column doesn\'t exist');
            } else {
                throw error;
            }
        }

        // Verification: Show updated table structure
        console.log('\n📊 Verification - Updated table structure:');
        const structureResult = await sql.query(`
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                IS_NULLABLE,
                COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'shopify' 
            AND TABLE_NAME = 'budget_categories'
            ORDER BY ORDINAL_POSITION;
        `);

        console.log('\nColumns in shopify.budget_categories:');
        structureResult.recordset.forEach(row => {
            console.log(`   ${row.COLUMN_NAME}: ${row.DATA_TYPE} ${row.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL'} ${row.COLUMN_DEFAULT || ''}`);
        });

        // Show constraints
        console.log('\nConstraints:');
        const constraintsResult = await sql.query(`
            SELECT 
                tc.CONSTRAINT_NAME,
                tc.CONSTRAINT_TYPE
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            WHERE tc.TABLE_SCHEMA = 'shopify' 
            AND tc.TABLE_NAME = 'budget_categories';
        `);

        constraintsResult.recordset.forEach(row => {
            console.log(`   ${row.CONSTRAINT_NAME}: ${row.CONSTRAINT_TYPE}`);
        });

        // Show sample data with new structure
        console.log('\n📊 Sample data with new structure:');
        const sampleResult = await sql.query(`
            SELECT TOP 5 
                bc.id,
                bc.budget_id,
                bc.category_id,
                bcm.name as category_name,
                bcm.parent_category,
                bc.allocated_amount
            FROM shopify.budget_categories bc
            INNER JOIN shopify.budget_categories_master bcm ON bc.category_id = bcm.id
            ORDER BY bc.id;
        `);

        sampleResult.recordset.forEach(row => {
            console.log(`   Budget Category ID: ${row.id}, Category ID: ${row.category_id}, Name: ${row.category_name}, Parent: ${row.parent_category}, Amount: $${row.allocated_amount}`);
        });

        await sql.close();
        console.log('\n✅ Migration finalization completed successfully!');
        console.log('\nThe budget_categories table now uses category_id references to budget_categories_master.');

    } catch (error) {
        console.error('❌ Migration finalization failed:', error);
        if (sql.connected) {
            await sql.close();
        }
        process.exit(1);
    }
}

// Run the finalization
finalizeBudgetCategoriesMigration();
