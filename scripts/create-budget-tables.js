import mssql from '../app/mssql.server.js';

async function runSimpleMigration() {
  try {
    console.log('🚀 Starting budget table migration...');
    
    // Step 1: Create schema if it doesn't exist
    console.log('📁 Creating shopify schema...');
    try {
      await mssql.execute(`
        IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'shopify')
        BEGIN
            EXEC('CREATE SCHEMA shopify')
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
        END
      `);
      console.log('✅ Dropped budget_categories table');
    } catch (error) {
      console.log('ℹ️  budget_categories table didn\'t exist');
    }

    try {
      await mssql.execute(`
        IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'shopify' AND TABLE_NAME = 'budget')
        BEGIN
            DROP TABLE shopify.budget;
        END
      `);
      console.log('✅ Dropped budget table');
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
    await mssql.execute(`
      CREATE INDEX IX_budget_status ON shopify.budget(status);
    `);
    await mssql.execute(`
      CREATE INDEX IX_budget_fiscal_year ON shopify.budget(fiscal_year);
    `);
    await mssql.execute(`
      CREATE INDEX IX_budget_created_at ON shopify.budget(created_at);
    `);
    await mssql.execute(`
      CREATE INDEX IX_budget_categories_budget_id ON shopify.budget_categories(budget_id);
    `);
    await mssql.execute(`
      CREATE INDEX IX_budget_categories_category_name ON shopify.budget_categories(category_name);
    `);
    console.log('✅ Indexes created');

    // Step 6: Insert sample data
    console.log('📝 Inserting sample data...');
    
    // Insert budgets
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
      SET total_amount = cat_totals.total
      FROM shopify.budget b
      INNER JOIN (
          SELECT budget_id, SUM(allocated_amount) as total
          FROM shopify.budget_categories
          GROUP BY budget_id
      ) cat_totals ON b.id = cat_totals.budget_id
    `);

    console.log('✅ Sample data inserted');

    // Step 7: Test the tables
    console.log('\n📊 Testing budget tables...');
    
    const budgets = await mssql.query('SELECT * FROM shopify.budget');
    console.log(`✅ Found ${budgets.length} budget records`);

    const categories = await mssql.query('SELECT * FROM shopify.budget_categories');
    console.log(`✅ Found ${categories.length} budget category records`);

    // Show budget summary
    console.log('\n📈 Budget Summary:');
    budgets.forEach(budget => {
      console.log(`- ${budget.name}: $${budget.total_amount}`);
    });

    console.log('\n🎉 Budget table migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Close the database connection
    await mssql.close();
  }
}

// Run the migration
runSimpleMigration().catch(error => {
  console.error('💥 Migration script failed:', error);
  process.exit(1);
});
