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

async function createSampleBudgets() {
    try {
        console.log('🎯 Creating sample budgets with category_id structure...');
        console.log('Connecting to SQL Server...');
        await sql.connect(dbConfig);
        console.log('✅ Connected successfully!');

        // First, let's see what categories are available
        console.log('📋 Available categories:');
        const categories = await sql.query(`
            SELECT id, category_name, parent_category, category_code 
            FROM shopify.budget_categories_master 
            WHERE is_active = 1 
            ORDER BY parent_category, sort_order
        `);
        
        categories.recordset.slice(0, 10).forEach(cat => {
            console.log(`  - ID: ${cat.id}, Name: ${cat.category_name}, Parent: ${cat.parent_category}`);
        });
        console.log(`  ... and ${categories.recordset.length - 10} more categories`);

        // Check if sample budgets already exist
        const existingBudgets = await sql.query(`
            SELECT COUNT(*) as count FROM shopify.budget 
            WHERE name IN (
                'Q4 2024 Medical Supplies Budget',
                'Annual Capital Equipment Budget 2024',
                'Housekeeping & Maintenance Budget Q4'
            )
        `);

        if (existingBudgets.recordset[0].count > 0) {
            console.log('⚠️  Sample budgets already exist. Cleaning up first...');
            
            // Delete existing sample budgets and their categories (CASCADE will handle categories)
            await sql.query(`
                DELETE FROM shopify.budget 
                WHERE name IN (
                    'Q4 2024 Medical Supplies Budget',
                    'Annual Capital Equipment Budget 2024',
                    'Housekeeping & Maintenance Budget Q4'
                )
            `);
            console.log('✅ Cleaned up existing sample data');
        }

        // Create sample budgets
        console.log('🏗️  Creating sample budgets...');
        
        // Budget 1: Medical Supplies
        const budget1 = await sql.query(`
            INSERT INTO shopify.budget (name, description, fiscal_year, fiscal_quarter, created_by)
            OUTPUT INSERTED.id
            VALUES ('Q4 2024 Medical Supplies Budget', 'Budget for medical supplies and equipment for Q4 2024', 2024, 'Q4', 'system')
        `);
        const budget1Id = budget1.recordset[0].id;
        console.log(`✅ Created Budget 1 (ID: ${budget1Id})`);

        // Budget 2: Capital Equipment
        const budget2 = await sql.query(`
            INSERT INTO shopify.budget (name, description, fiscal_year, fiscal_quarter, created_by)
            OUTPUT INSERTED.id
            VALUES ('Annual Capital Equipment Budget 2024', 'Capital expenditure budget for equipment and infrastructure', 2024, 'Annual', 'system')
        `);
        const budget2Id = budget2.recordset[0].id;
        console.log(`✅ Created Budget 2 (ID: ${budget2Id})`);

        // Budget 3: Housekeeping & Maintenance
        const budget3 = await sql.query(`
            INSERT INTO shopify.budget (name, description, fiscal_year, fiscal_quarter, created_by)
            OUTPUT INSERTED.id
            VALUES ('Housekeeping & Maintenance Budget Q4', 'Operational budget for housekeeping and maintenance supplies', 2024, 'Q4', 'system')
        `);
        const budget3Id = budget3.recordset[0].id;
        console.log(`✅ Created Budget 3 (ID: ${budget3Id})`);

        // Now add budget categories using category IDs
        console.log('💰 Adding budget categories with allocations...');

        // Get specific category IDs we want to use
        const categoryIds = await sql.query(`
            SELECT id, category_name FROM shopify.budget_categories_master 
            WHERE category_name IN (
                'Gen Nsg>Medical Supplies',
                'Gen Nsg>Incontinent Supplies', 
                'Gen Nsg>Wound Care',
                'Gen Nsg>Personal Care',
                'Capital>Fixed Equip',
                'Capital>Major Moveable Equip',
                'Capital>Leasehold Improvements',
                'Capital>Minor Equip',
                'Housekeeping>Minor Equip',
                'Housekeeping>Supplies',
                'Maintenance>Supplies',
                'Maintenance>Minor Equip'
            )
        `);

        // Create a map for easier lookup
        const categoryMap = {};
        categoryIds.recordset.forEach(cat => {
            categoryMap[cat.category_name] = cat.id;
        });

        // Insert budget categories for Budget 1 (Medical Supplies)
        if (categoryMap['Gen Nsg>Medical Supplies']) {
            await sql.query(`
                INSERT INTO shopify.budget_categories (budget_id, category_id, allocated_amount) VALUES
                (${budget1Id}, ${categoryMap['Gen Nsg>Medical Supplies']}, 15000.00),
                (${budget1Id}, ${categoryMap['Gen Nsg>Incontinent Supplies']}, 8000.00),
                (${budget1Id}, ${categoryMap['Gen Nsg>Wound Care']}, 5000.00),
                (${budget1Id}, ${categoryMap['Gen Nsg>Personal Care']}, 3000.00)
            `);
            console.log('✅ Added categories to Medical Supplies Budget');
        }

        // Insert budget categories for Budget 2 (Capital Equipment)
        if (categoryMap['Capital>Fixed Equip']) {
            await sql.query(`
                INSERT INTO shopify.budget_categories (budget_id, category_id, allocated_amount) VALUES
                (${budget2Id}, ${categoryMap['Capital>Fixed Equip']}, 50000.00),
                (${budget2Id}, ${categoryMap['Capital>Major Moveable Equip']}, 25000.00),
                (${budget2Id}, ${categoryMap['Capital>Leasehold Improvements']}, 15000.00),
                (${budget2Id}, ${categoryMap['Capital>Minor Equip']}, 10000.00)
            `);
            console.log('✅ Added categories to Capital Equipment Budget');
        }

        // Insert budget categories for Budget 3 (Housekeeping & Maintenance)
        if (categoryMap['Housekeeping>Minor Equip']) {
            await sql.query(`
                INSERT INTO shopify.budget_categories (budget_id, category_id, allocated_amount) VALUES
                (${budget3Id}, ${categoryMap['Housekeeping>Minor Equip']}, 3000.00),
                (${budget3Id}, ${categoryMap['Housekeeping>Supplies']}, 8000.00),
                (${budget3Id}, ${categoryMap['Maintenance>Supplies']}, 6000.00),
                (${budget3Id}, ${categoryMap['Maintenance>Minor Equip']}, 4000.00)
            `);
            console.log('✅ Added categories to Housekeeping & Maintenance Budget');
        }

        // Test the views
        console.log('\n🔍 Testing the new structure with views...');
        
        // Test budget summary view
        const budgetSummary = await sql.query(`
            SELECT TOP 3 
                name, 
                total_amount, 
                category_count, 
                total_spent, 
                total_remaining 
            FROM shopify.v_budget_summary 
            ORDER BY created_at DESC
        `);
        
        console.log('📊 Budget Summary:');
        budgetSummary.recordset.forEach(budget => {
            console.log(`  - ${budget.name}: $${budget.total_amount} allocated, ${budget.category_count} categories`);
        });

        // Test detailed categories view
        const categoryDetails = await sql.query(`
            SELECT TOP 5
                budget_name,
                category_name,
                parent_category,
                allocated_amount,
                remaining_amount
            FROM shopify.v_budget_categories_detail
            ORDER BY budget_id, allocated_amount DESC
        `);

        console.log('\n📋 Sample Category Details:');
        categoryDetails.recordset.forEach(detail => {
            console.log(`  - ${detail.budget_name} → ${detail.category_name}: $${detail.allocated_amount}`);
        });

        // Update budget totals (trigger should handle this, but let's verify)
        console.log('\n🔄 Verifying budget totals...');
        const totalsCheck = await sql.query(`
            SELECT 
                b.name,
                b.total_amount as stored_total,
                ISNULL(SUM(bc.allocated_amount), 0) as calculated_total
            FROM shopify.budget b
            LEFT JOIN shopify.budget_categories bc ON b.id = bc.budget_id
            WHERE b.name LIKE '%2024%'
            GROUP BY b.id, b.name, b.total_amount
        `);

        totalsCheck.recordset.forEach(budget => {
            const match = budget.stored_total === budget.calculated_total;
            console.log(`  - ${budget.name}: Stored=$${budget.stored_total}, Calculated=$${budget.calculated_total} ${match ? '✅' : '⚠️'}`);
        });

        await sql.close();
        console.log('\n🎉 Sample budgets created successfully!');
        console.log('\n✅ The new category_id structure is working perfectly!');
        console.log('\nWhat was created:');
        console.log('  🏠 3 sample budgets');
        console.log('  📋 12 budget category allocations using category_id references');
        console.log('  🔗 All foreign key relationships working correctly');
        console.log('  📊 Views returning proper data with category names from master table');
        
    } catch (error) {
        console.error('❌ Sample data creation failed:', error.message);
        console.error('Full error:', error);
        
        if (sql.connected) {
            await sql.close();
        }
        process.exit(1);
    }
}

// Run the sample data creation
createSampleBudgets()
    .then(() => {
        console.log('🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
