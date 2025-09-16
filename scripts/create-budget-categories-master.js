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
        console.log('Connecting to SQL Server...');
        await sql.connect(dbConfig);
        console.log('Connected successfully!');

        // Execute statements individually instead of parsing GO statements
        console.log('Creating budget_categories_master table...');
        
        // 1. Create the table
        await sql.query(`
            CREATE TABLE shopify.budget_categories_master (
                id BIGINT IDENTITY(1,1) PRIMARY KEY,
                name NVARCHAR(255) NOT NULL,
                description NVARCHAR(MAX) NULL,
                parent_category NVARCHAR(255) NULL,
                is_active BIT NOT NULL DEFAULT 1,
                created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                created_by NVARCHAR(255) NULL,
                updated_by NVARCHAR(255) NULL,
                
                -- Add constraints
                CONSTRAINT UQ_budget_categories_master_name UNIQUE (name)
            );
        `);
        console.log('✅ Table created successfully');

        // 2. Create indexes
        await sql.query(`CREATE INDEX IX_budget_categories_master_name ON shopify.budget_categories_master(name);`);
        await sql.query(`CREATE INDEX IX_budget_categories_master_parent ON shopify.budget_categories_master(parent_category);`);
        await sql.query(`CREATE INDEX IX_budget_categories_master_active ON shopify.budget_categories_master(is_active);`);
        console.log('✅ Indexes created successfully');

        // 3. Insert default categories
        const insertSQL = `
            INSERT INTO shopify.budget_categories_master (name, parent_category, description, created_by) VALUES 
            -- General Nursing categories
            ('Gen Nsg>Medical Supplies', 'Gen Nsg', 'General nursing medical supplies', 'system'),
            ('Gen Nsg>Incontinent Supplies', 'Gen Nsg', 'Incontinence and hygiene supplies', 'system'), 
            ('Gen Nsg>Wound Care', 'Gen Nsg', 'Wound care and dressing supplies', 'system'),
            ('Gen Nsg>Personal Care', 'Gen Nsg', 'Personal care items for patients', 'system'),
            ('Gen Nsg>Nutrition', 'Gen Nsg', 'Nutritional supplements and feeding supplies', 'system'),
            ('Gen Nsg>House', 'Gen Nsg', 'General housekeeping supplies for nursing', 'system'),
            ('Gen Nsg>Minor Equip', 'Gen Nsg', 'Small equipment for nursing', 'system'),
            ('Gen Nsg>PEN Supplies', 'Gen Nsg', 'PEN related nursing supplies', 'system'),
            ('Gen Nsg>Urology & Ostomy', 'Gen Nsg', 'Urology and ostomy care supplies', 'system'),
            ('Gen Nsg>Forms & Printing', 'Gen Nsg', 'Forms and printing materials', 'system'),
            ('Gen Nsg>Personal Items', 'Gen Nsg', 'Personal items for patients', 'system'),
            ('Gen Nsg>Rental Equip', 'Gen Nsg', 'Equipment rental for nursing', 'system'),

            -- Capital Equipment categories
            ('Capital>Fixed Equip', 'Capital', 'Fixed capital equipment', 'system'),
            ('Capital>Major Moveable Equip', 'Capital', 'Major moveable capital equipment', 'system'),
            ('Capital>Leasehold Improvements', 'Capital', 'Leasehold improvements and renovations', 'system'),
            ('Capital>Minor Equip', 'Capital', 'Minor capital equipment', 'system'),

            -- Housekeeping categories
            ('Housekeeping>Minor Equip', 'Housekeeping', 'Small housekeeping equipment', 'system'),
            ('Housekeeping>Supplies', 'Housekeeping', 'General housekeeping supplies', 'system'),
            ('Housekeeping>Cleaning Supplies', 'Housekeeping', 'Cleaning chemicals and supplies', 'system'),

            -- Maintenance categories
            ('Maintenance>Supplies', 'Maintenance', 'General maintenance supplies', 'system'),
            ('Maintenance>Minor Equip', 'Maintenance', 'Small maintenance equipment', 'system'),
            ('Maintenance>Tools', 'Maintenance', 'Tools and equipment for maintenance', 'system'),

            -- Administration categories
            ('Admin & Gen>Office Supplies', 'Admin & Gen', 'General office supplies', 'system'),
            ('Admin & Gen>Minor Equip', 'Admin & Gen', 'Small office equipment', 'system'),
            ('Administration>Technology', 'Administration', 'Technology and IT equipment', 'system'),
            ('Administration>Communications', 'Administration', 'Communication equipment and services', 'system'),

            -- Dietary/Food Service categories
            ('Dietary>Minor Equip', 'Dietary', 'Small dietary equipment', 'system'),
            ('Dietary>Supplements', 'Dietary', 'Nutritional supplements', 'system'),
            ('Dietary>Dietary Supplies', 'Dietary', 'General dietary supplies', 'system'),
            ('Food Service>Food & Beverages', 'Food Service', 'Food and beverage items', 'system'),
            ('Food Service>Kitchen Supplies', 'Food Service', 'Kitchen supplies and utensils', 'system'),
            ('Food Service>Equipment', 'Food Service', 'Kitchen and food service equipment', 'system'),

            -- Laundry categories
            ('Laundry>Linens', 'Laundry', 'Bed linens and towels', 'system'),
            ('Laundry>Minor Equip', 'Laundry', 'Small laundry equipment', 'system'),

            -- Therapy categories
            ('Therapy>Minor Equip', 'Therapy', 'Small therapy equipment', 'system'),
            ('Therapy>Therapy Supplies', 'Therapy', 'General therapy supplies', 'system'),
            ('Therapy>Respiratory Supplies', 'Therapy', 'Respiratory therapy supplies', 'system'),
            ('Therapeutic>Recreation Supplies', 'Therapeutic', 'Recreation and activity supplies', 'system'),
            ('Therapeutic>Activity Materials', 'Therapeutic', 'Activity and craft materials', 'system'),
            ('Therapeutic>Equipment', 'Therapeutic', 'Therapeutic equipment', 'system'),

            -- Activities categories
            ('Activities>Minor Equip', 'Activities', 'Small activities equipment', 'system'),
            ('Activities>Supplies', 'Activities', 'Activity supplies and materials', 'system');
        `;
        
        await sql.query(insertSQL);
        console.log('✅ Default categories inserted successfully');

        // 4. Create view
        await sql.query(`
            CREATE VIEW shopify.v_budget_categories_master AS
            SELECT 
                id,
                name,
                description,
                parent_category,
                created_at,
                updated_at,
                created_by
            FROM shopify.budget_categories_master
            WHERE is_active = 1;
        `);
        console.log('✅ View created successfully');

        // Test the table by getting count
        const countResult = await sql.query(`
            SELECT COUNT(*) as total_categories 
            FROM shopify.budget_categories_master
        `);
        
        console.log(`Total categories inserted: ${countResult.recordset[0].total_categories}`);

        // Show some sample categories
        const sampleResult = await sql.query(`
            SELECT TOP 10 
                id, name, parent_category, description 
            FROM shopify.budget_categories_master 
            ORDER BY parent_category, name
        `);
        
        console.log('\nSample categories:');
        sampleResult.recordset.forEach(category => {
            console.log(`- ${category.name} (${category.parent_category})`);
        });

        await sql.close();
        console.log('\nDatabase connection closed.');
        console.log('Budget categories master table created successfully!');
        
    } catch (error) {
        console.error('Error creating budget categories master table:', error);
        
        // If it's a permission error but table might still be created, let's check
        if (error.message && error.message.includes('permission')) {
            console.log('\nChecking if table was created despite permission error...');
            try {
                const checkResult = await sql.query(`
                    SELECT COUNT(*) as total_categories 
                    FROM shopify.budget_categories_master
                `);
                console.log(`Table exists with ${checkResult.recordset[0].total_categories} categories`);
            } catch (checkError) {
                console.log('Table was not created:', checkError.message);
            }
        }
        
        await sql.close();
        process.exit(1);
    }
}

// Run the migration
createBudgetCategoriesMasterTable();
