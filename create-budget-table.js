import mssql from './app/mssql.server.js';

async function createBudgetTable() {
  try {
    console.log('🚀 Creating budget table...');
    
    // Step 1: Create schema if it doesn't exist
    console.log('📁 Creating shopify schema...');
    try {
      await mssql.execute(`
        IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'shopify')
        BEGIN
            EXEC('CREATE SCHEMA shopify')
            PRINT 'Created shopify schema'
        END
        ELSE
        BEGIN
            PRINT 'Shopify schema already exists'
        END
      `);
      console.log('✅ Shopify schema ready');
    } catch (error) {
      console.log('ℹ️  Schema may already exist:', error.message);
    }

    // Step 2: Drop existing tables if they exist (for clean reinstall)
    console.log('🧹 Cleaning up existing tables...');
    try {
      await mssql.execute(`
        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'shopify' AND TABLE_NAME = 'budget_categories')
        BEGIN
            DROP TABLE shopify.budget_categories;
            PRINT 'Dropped existing budget_categories table'
        END
      `);
      console.log('✅ Cleaned budget_categories table');
    } catch (error) {
      console.log('ℹ️  budget_categories table didn\'t exist');
    }

    try {
      await mssql.execute(`
        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'shopify' AND TABLE_NAME = 'budget')
        BEGIN
            DROP TABLE shopify.budget;
            PRINT 'Dropped existing budget table'
        END
      `);
      console.log('✅ Cleaned budget table');
    } catch (error) {
      console.log('ℹ️  budget table didn\'t exist');
    }

    // Step 3: Create budget table
    console.log('📊 Creating budget table...');
    await mssql.execute(`
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
          
          -- Add constraints
          CONSTRAINT CK_budget_status CHECK (status IN ('active', 'inactive', 'draft', 'archived')),
          CONSTRAINT CK_budget_total_amount CHECK (total_amount >= 0),
          CONSTRAINT UQ_budget_name UNIQUE (name)
      );
    `);
    console.log('✅ Budget table created');

    // Step 4: Create budget_categories table
    console.log('📋 Creating budget_categories table...');
    await mssql.execute(`
      CREATE TABLE shopify.budget_categories (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          budget_id BIGINT NOT NULL,
          category_name NVARCHAR(255) NOT NULL,
          allocated_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
          spent_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
          remaining_amount AS (allocated_amount - spent_amount) PERSISTED,
          created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
          updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
          
          -- Foreign key constraint
          CONSTRAINT FK_budget_categories_budget_id FOREIGN KEY (budget_id) REFERENCES shopify.budget(id) ON DELETE CASCADE,
          
          -- Check constraints
          CONSTRAINT CK_budget_categories_allocated_amount CHECK (allocated_amount >= 0),
          CONSTRAINT CK_budget_categories_spent_amount CHECK (spent_amount >= 0),
          
          -- Unique constraint
          CONSTRAINT UQ_budget_categories_budget_category UNIQUE (budget_id, category_name)
      );
    `);
    console.log('✅ Budget categories table created');

    // Step 5: Create indexes
    console.log('🔍 Creating indexes...');
    await mssql.execute(`CREATE INDEX IX_budget_status ON shopify.budget(status);`);
    await mssql.execute(`CREATE INDEX IX_budget_fiscal_year ON shopify.budget(fiscal_year);`);
    await mssql.execute(`CREATE INDEX IX_budget_created_at ON shopify.budget(created_at);`);
    await mssql.execute(`CREATE INDEX IX_budget_categories_budget_id ON shopify.budget_categories(budget_id);`);
    await mssql.execute(`CREATE INDEX IX_budget_categories_category_name ON shopify.budget_categories(category_name);`);
    console.log('✅ Indexes created');

    // Step 6: Insert sample data
    console.log('📝 Inserting sample data...');
    
    // Insert budgets with OUTPUT to get IDs
    const budget1 = await mssql.execute(`
      INSERT INTO shopify.budget (name, description, fiscal_year, fiscal_quarter, created_by)
      OUTPUT INSERTED.id
      VALUES ('Q4 2024 Medical Supplies Budget', 'Budget for medical supplies and equipment for Q4 2024', 2024, 'Q4', 'system')
    `);

    const budget2 = await mssql.execute(`
      INSERT INTO shopify.budget (name, description, fiscal_year, fiscal_quarter, created_by)
      OUTPUT INSERTED.id  
      VALUES ('Annual Capital Equipment Budget 2024', 'Capital expenditure budget for equipment and infrastructure', 2024, 'Annual', 'system')
    `);

    const budget3 = await mssql.execute(`
      INSERT INTO shopify.budget (name, description, fiscal_year, fiscal_quarter, created_by)
      OUTPUT INSERTED.id
      VALUES ('Housekeeping & Maintenance Budget Q4', 'Operational budget for housekeeping and maintenance supplies', 2024, 'Q4', 'system')
    `);

    const budget1Id = budget1.recordset[0].id;
    const budget2Id = budget2.recordset[0].id;
    const budget3Id = budget3.recordset[0].id;

    console.log(`✅ Created budgets with IDs: ${budget1Id}, ${budget2Id}, ${budget3Id}`);

    // Insert budget categories
    await mssql.execute(`
      INSERT INTO shopify.budget_categories (budget_id, category_name, allocated_amount)
      VALUES 
          (${budget1Id}, 'Gen Nsg>Medical Supplies', 15000.00),
          (${budget1Id}, 'Gen Nsg>Incontinent Supplies', 8000.00),
          (${budget1Id}, 'Gen Nsg>Wound Care', 5000.00),
          (${budget1Id}, 'Gen Nsg>Personal Care', 3000.00),
          
          (${budget2Id}, 'Capital>Fixed Equip', 50000.00),
          (${budget2Id}, 'Capital>Major Moveable Equip', 25000.00),
          (${budget2Id}, 'Capital>Leasehold Improvements', 15000.00),
          (${budget2Id}, 'Capital>Minor Equip', 10000.00),
          
          (${budget3Id}, 'Housekeeping>Minor Equip', 3000.00),
          (${budget3Id}, 'Housekeeping>Supplies', 8000.00),
          (${budget3Id}, 'Maintenance>Supplies', 6000.00),
          (${budget3Id}, 'Maintenance>Minor Equip', 4000.00)
    `);

    // Update budget totals
    await mssql.execute(`
      UPDATE b
      SET total_amount = cat_totals.total, updated_at = GETUTCDATE()
      FROM shopify.budget b
      INNER JOIN (
          SELECT budget_id, SUM(allocated_amount) as total
          FROM shopify.budget_categories
          GROUP BY budget_id
      ) cat_totals ON b.id = cat_totals.budget_id
    `);

    console.log('✅ Sample data inserted and totals updated');

    // Step 7: Create views for easier querying
    console.log('📊 Creating budget views...');
    
    try {
      await mssql.execute(`
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
            b.fiscal_year, b.fiscal_quarter, b.created_at, b.updated_at
      `);
      console.log('✅ Budget summary view created');
    } catch (error) {
      console.log('ℹ️  Budget summary view may already exist:', error.message);
    }

    // Step 8: Test the tables
    console.log('\n📊 Testing budget tables...');
    
    const budgets = await mssql.query('SELECT * FROM shopify.budget');
    console.log(`✅ Found ${budgets.length} budget records`);

    const categories = await mssql.query('SELECT * FROM shopify.budget_categories');
    console.log(`✅ Found ${categories.length} budget category records`);

    // Show budget summary
    console.log('\n📈 Budget Summary:');
    budgets.forEach(budget => {
      console.log(`- ${budget.name}: $${budget.total_amount} (Status: ${budget.status})`);
    });

    console.log('\n🎉 Budget table creation completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Budget table creation failed:', error);
    throw error;
  } finally {
    // Close the database connection
    await mssql.close();
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createBudgetTable().catch(error => {
    console.error('💥 Budget table creation script failed:', error);
    process.exit(1);
  });
}

export { createBudgetTable };
