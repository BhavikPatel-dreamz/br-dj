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

async function setupCompleteBudgetSystem() {
    try {
        console.log('🚀 Starting complete budget system setup...');
        console.log('Connecting to SQL Server...');
        await sql.connect(dbConfig);
        console.log('✅ Connected successfully!');

        // Step 1: Check what tables exist
        console.log('🔍 Checking existing tables...');
        const existingTables = await sql.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'shopify' 
            AND TABLE_NAME IN ('budget', 'budget_categories', 'budget_categories_master')
        `);

        console.log('📋 Existing tables:');
        const tableNames = existingTables.recordset.map(row => row.TABLE_NAME);
        tableNames.forEach(table => console.log(`  - shopify.${table}`));

        if (tableNames.length === 0) {
            console.log('  (No budget tables found)');
        }

        // Step 2: Create schema if it doesn't exist
        console.log('📁 Ensuring shopify schema exists...');
        await sql.query(`
            IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'shopify')
            BEGIN
                EXEC('CREATE SCHEMA shopify')
            END
        `);
        console.log('✅ Schema ready');

        // Step 3: Create budget_categories_master table if it doesn't exist
        if (!tableNames.includes('budget_categories_master')) {
            console.log('🏗️  Step 3: Creating budget_categories_master table...');
            
            await sql.query(`
                CREATE TABLE shopify.budget_categories_master (
                    id BIGINT IDENTITY(1,1) PRIMARY KEY,
                    category_name NVARCHAR(255) NOT NULL,
                    category_code NVARCHAR(50) NULL,
                    description NVARCHAR(MAX) NULL,
                    sort_order INT NOT NULL DEFAULT 0,
                    parent_category NVARCHAR(255) NULL,
                    is_active BIT NOT NULL DEFAULT 1,
                    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                    created_by NVARCHAR(255) NULL,
                    updated_by NVARCHAR(255) NULL,
                    
                    CONSTRAINT UQ_budget_categories_master_name UNIQUE (category_name)
                );
            `);
            console.log('✅ budget_categories_master table created');

            // Create indexes
            await sql.query(`
                CREATE INDEX IX_budget_categories_master_name ON shopify.budget_categories_master(category_name);
                CREATE INDEX IX_budget_categories_master_parent ON shopify.budget_categories_master(parent_category);
                CREATE INDEX IX_budget_categories_master_active ON shopify.budget_categories_master(is_active);
                CREATE INDEX IX_budget_categories_master_sort ON shopify.budget_categories_master(sort_order);
            `);
            console.log('✅ Indexes created');

            // Insert default categories
            await sql.query(`
                INSERT INTO shopify.budget_categories_master (category_name, category_code, parent_category, description, sort_order, created_by) VALUES 
                -- General Nursing categories
                ('Gen Nsg>Medical Supplies', 'GN001', 'Gen Nsg', 'General nursing medical supplies', 10, 'system'),
                ('Gen Nsg>Incontinent Supplies', 'GN002', 'Gen Nsg', 'Incontinence and hygiene supplies', 20, 'system'), 
                ('Gen Nsg>Wound Care', 'GN003', 'Gen Nsg', 'Wound care and dressing supplies', 30, 'system'),
                ('Gen Nsg>Personal Care', 'GN004', 'Gen Nsg', 'Personal care items for patients', 40, 'system'),
                ('Gen Nsg>Nutrition', 'GN005', 'Gen Nsg', 'Nutritional supplements and feeding supplies', 50, 'system'),
                ('Gen Nsg>House', 'GN006', 'Gen Nsg', 'General housekeeping supplies for nursing', 60, 'system'),
                ('Gen Nsg>Minor Equip', 'GN007', 'Gen Nsg', 'Small equipment for nursing', 70, 'system'),
                
                -- Capital Equipment categories
                ('Capital>Fixed Equip', 'CAP001', 'Capital', 'Fixed capital equipment', 200, 'system'),
                ('Capital>Major Moveable Equip', 'CAP002', 'Capital', 'Major moveable capital equipment', 210, 'system'),
                ('Capital>Leasehold Improvements', 'CAP003', 'Capital', 'Leasehold improvements and renovations', 220, 'system'),
                ('Capital>Minor Equip', 'CAP004', 'Capital', 'Minor capital equipment', 230, 'system'),
                
                -- Housekeeping categories
                ('Housekeeping>Minor Equip', 'HK001', 'Housekeeping', 'Small housekeeping equipment', 300, 'system'),
                ('Housekeeping>Supplies', 'HK002', 'Housekeeping', 'General housekeeping supplies', 310, 'system'),
                ('Housekeeping>Cleaning Supplies', 'HK003', 'Housekeeping', 'Cleaning chemicals and supplies', 320, 'system'),
                
                -- Maintenance categories
                ('Maintenance>Supplies', 'MNT001', 'Maintenance', 'General maintenance supplies', 400, 'system'),
                ('Maintenance>Minor Equip', 'MNT002', 'Maintenance', 'Small maintenance equipment', 410, 'system'),
                ('Maintenance>Tools', 'MNT003', 'Maintenance', 'Tools and equipment for maintenance', 420, 'system')
            `);
            console.log('✅ Default categories inserted');
        } else {
            console.log('ℹ️  budget_categories_master table already exists');
        }

        // Step 4: Create budget table if it doesn't exist
        if (!tableNames.includes('budget')) {
            console.log('🏗️  Step 4: Creating budget table...');
            
            await sql.query(`
                CREATE TABLE shopify.budget (
                    id BIGINT IDENTITY(1,1) PRIMARY KEY,
                    name NVARCHAR(255) NOT NULL,
                    description NVARCHAR(MAX) NULL,
                    total_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
                    status NVARCHAR(50) NOT NULL DEFAULT 'active',
                    fiscal_year INT NULL,
                    fiscal_quarter NVARCHAR(10) NULL,
                    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                    created_by NVARCHAR(255) NULL,
                    updated_by NVARCHAR(255) NULL,
                    
                    CONSTRAINT CK_budget_status CHECK (status IN ('active', 'inactive', 'draft', 'archived')),
                    CONSTRAINT CK_budget_total_amount CHECK (total_amount >= 0),
                    CONSTRAINT UQ_budget_name UNIQUE (name)
                );
            `);
            console.log('✅ budget table created');

            // Create indexes
            await sql.query(`
                CREATE INDEX IX_budget_status ON shopify.budget(status);
                CREATE INDEX IX_budget_fiscal_year ON shopify.budget(fiscal_year);
                CREATE INDEX IX_budget_created_at ON shopify.budget(created_at);
            `);
            console.log('✅ Budget indexes created');
        } else {
            console.log('ℹ️  budget table already exists');
        }

        // Step 5: Create budget_categories table with category_id (new structure)
        if (!tableNames.includes('budget_categories')) {
            console.log('🏗️  Step 5: Creating budget_categories table with category_id...');
            
            await sql.query(`
                CREATE TABLE shopify.budget_categories (
                    id BIGINT IDENTITY(1,1) PRIMARY KEY,
                    budget_id BIGINT NOT NULL,
                    category_id BIGINT NOT NULL,
                    allocated_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
                    spent_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
                    remaining_amount AS (allocated_amount - spent_amount) PERSISTED,
                    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                    
                    CONSTRAINT FK_budget_categories_budget_id FOREIGN KEY (budget_id) REFERENCES shopify.budget(id) ON DELETE CASCADE,
                    CONSTRAINT FK_budget_categories_category_id FOREIGN KEY (category_id) REFERENCES shopify.budget_categories_master(id),
                    CONSTRAINT CK_budget_categories_allocated_amount CHECK (allocated_amount >= 0),
                    CONSTRAINT CK_budget_categories_spent_amount CHECK (spent_amount >= 0),
                    CONSTRAINT UQ_budget_categories_budget_category UNIQUE (budget_id, category_id)
                );
            `);
            console.log('✅ budget_categories table created with category_id');

            // Create indexes
            await sql.query(`
                CREATE INDEX IX_budget_categories_budget_id ON shopify.budget_categories(budget_id);
                CREATE INDEX IX_budget_categories_category_id ON shopify.budget_categories(category_id);
            `);
            console.log('✅ Budget categories indexes created');
        } else {
            console.log('⚠️  budget_categories table already exists - checking structure...');
            
            // Check if it has the new structure
            const columns = await sql.query(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = 'shopify' 
                AND TABLE_NAME = 'budget_categories'
                AND COLUMN_NAME IN ('category_id', 'category_name')
            `);
            
            const hasOldStructure = columns.recordset.some(col => col.COLUMN_NAME === 'category_name');
            const hasNewStructure = columns.recordset.some(col => col.COLUMN_NAME === 'category_id');
            
            if (hasOldStructure && !hasNewStructure) {
                console.log('🔄 Table has old structure (category_name) - migration needed');
                console.log('   Run the migration script after this setup completes');
            } else if (hasNewStructure) {
                console.log('✅ Table already has new structure (category_id)');
            }
        }

        // Step 6: Create views
        console.log('🏗️  Step 6: Creating or updating views...');
        
        // Drop existing views if they exist
        await sql.query(`
            IF EXISTS (SELECT * FROM sys.views WHERE schema_id = SCHEMA_ID('shopify') AND name = 'v_budget_summary')
                DROP VIEW shopify.v_budget_summary;
        `);
        
        await sql.query(`
            IF EXISTS (SELECT * FROM sys.views WHERE schema_id = SCHEMA_ID('shopify') AND name = 'v_budget_categories_detail')
                DROP VIEW shopify.v_budget_categories_detail;
        `);
        
        // Create updated views
        await sql.query(`
            CREATE VIEW shopify.v_budget_summary AS
            SELECT 
                b.id,
                b.name,
                b.description,
                b.total_amount,
                b.status,
                b.fiscal_year,
                b.fiscal_quarter,
                COUNT(bc.id) as category_count,
                ISNULL(SUM(bc.spent_amount), 0) as total_spent,
                ISNULL(SUM(bc.remaining_amount), 0) as total_remaining,
                CASE 
                    WHEN b.total_amount > 0 THEN (ISNULL(SUM(bc.spent_amount), 0) / b.total_amount) * 100
                    ELSE 0 
                END as spend_percentage,
                b.created_at,
                b.updated_at
            FROM shopify.budget b
            LEFT JOIN shopify.budget_categories bc ON b.id = bc.budget_id
            GROUP BY 
                b.id, b.name, b.description, b.total_amount, b.status, 
                b.fiscal_year, b.fiscal_quarter, b.created_at, b.updated_at;
        `);
        
        await sql.query(`
            CREATE VIEW shopify.v_budget_categories_detail AS
            SELECT 
                b.id as budget_id,
                b.name as budget_name,
                bc.id as category_id,
                bc.category_id as master_category_id,
                bcm.category_name,
                bcm.category_code,
                bcm.parent_category,
                bc.allocated_amount,
                bc.spent_amount,
                bc.remaining_amount,
                CASE 
                    WHEN bc.allocated_amount > 0 THEN (bc.spent_amount / bc.allocated_amount) * 100
                    ELSE 0 
                END as category_spend_percentage,
                bc.created_at as category_created_at,
                bc.updated_at as category_updated_at
            FROM shopify.budget b
            INNER JOIN shopify.budget_categories bc ON b.id = bc.budget_id
            INNER JOIN shopify.budget_categories_master bcm ON bc.category_id = bcm.id;
        `);
        console.log('✅ Views created successfully');

        // Step 7: Show summary
        console.log('\n📊 Setup Summary:');
        const finalTableCheck = await sql.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'shopify' 
            AND TABLE_NAME IN ('budget', 'budget_categories', 'budget_categories_master')
        `);
        
        finalTableCheck.recordset.forEach(row => {
            console.log(`  ✅ shopify.${row.TABLE_NAME}`);
        });

        // Check category count
        const categoryCount = await sql.query(`
            SELECT COUNT(*) as count FROM shopify.budget_categories_master WHERE is_active = 1
        `);
        console.log(`  📋 ${categoryCount.recordset[0].count} active categories in master table`);

        await sql.close();
        console.log('\n🎉 Complete budget system setup finished!');
        console.log('\nNext steps:');
        console.log('  1. Test the system by creating a budget');
        console.log('  2. If you have existing budget_categories with old structure, run the migration script');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        console.error('Full error:', error);
        
        if (sql.connected) {
            await sql.close();
        }
        process.exit(1);
    }
}

// Run the setup
setupCompleteBudgetSystem()
    .then(() => {
        console.log('🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
