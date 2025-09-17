import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

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
    }
};

async function createTriggers() {
    try {
        console.log('🔧 Creating triggers and fixing budget totals...');
        await sql.connect(dbConfig);
        
        // Drop trigger if it exists
        await sql.query(`
            IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_budget_update_total')
                DROP TRIGGER shopify.TR_budget_update_total;
        `);
        
        // Create trigger to update budget totals
        await sql.query(`
            CREATE TRIGGER TR_budget_update_total
            ON shopify.budget_categories
            AFTER INSERT, UPDATE, DELETE
            AS
            BEGIN
                SET NOCOUNT ON;
                
                -- Update total for affected budgets
                WITH affected_budgets AS (
                    SELECT budget_id FROM inserted
                    UNION
                    SELECT budget_id FROM deleted
                )
                UPDATE b
                SET total_amount = ISNULL(
                    (SELECT SUM(allocated_amount) 
                     FROM shopify.budget_categories bc 
                     WHERE bc.budget_id = b.id), 0)
                FROM shopify.budget b
                INNER JOIN affected_budgets ab ON b.id = ab.budget_id;
            END
        `);
        
        console.log('✅ Budget total update trigger created');
        
        // Manually update existing budget totals
        await sql.query(`
            UPDATE b
            SET total_amount = ISNULL(
                (SELECT SUM(allocated_amount) 
                 FROM shopify.budget_categories bc 
                 WHERE bc.budget_id = b.id), 0)
            FROM shopify.budget b
        `);
        
        console.log('✅ Updated existing budget totals');
        
        // Test the results
        const results = await sql.query(`
            SELECT name, total_amount 
            FROM shopify.budget 
            WHERE name LIKE '%2024%'
            ORDER BY name
        `);
        
        console.log('\n💰 Updated Budget Totals:');
        results.recordset.forEach(budget => {
            console.log(`  - ${budget.name}: $${budget.total_amount}`);
        });
        
        // Test the view again
        const viewResults = await sql.query(`
            SELECT 
                name, 
                total_amount, 
                category_count, 
                total_spent, 
                total_remaining,
                spend_percentage
            FROM shopify.v_budget_summary 
            WHERE name LIKE '%2024%'
            ORDER BY name
        `);
        
        console.log('\n📊 Budget Summary View:');
        viewResults.recordset.forEach(budget => {
            console.log(`  - ${budget.name}:`);
            console.log(`    Total: $${budget.total_amount}, Categories: ${budget.category_count}`);
            console.log(`    Remaining: $${budget.total_remaining}, Spent: ${budget.spend_percentage}%`);
        });
        
        await sql.close();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (sql.connected) await sql.close();
        process.exit(1);
    }
}

createTriggers();
