// Create Budget Location Assignments Table Script
import mssql from '../app/mssql.server.js';

async function createBudgetLocationAssignmentsTable() {
  try {
    console.log('🚀 Creating budget location assignments table...');

    // Step 1: Create the table
    console.log('📊 Creating budget_location_assignments table...');
    await mssql.execute(`
      CREATE TABLE shopify.budget_location_assignments (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          budget_id BIGINT NOT NULL,
          location_id BIGINT NOT NULL,
          status NVARCHAR(50) NOT NULL DEFAULT 'active',
          assigned_by NVARCHAR(255) NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
          updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
          
          -- Foreign key constraint to budget table
          CONSTRAINT FK_budget_location_assignments_budget_id 
              FOREIGN KEY (budget_id) REFERENCES shopify.budget(id) 
              ON DELETE CASCADE,
          
          -- Check constraints
          CONSTRAINT CK_budget_location_assignments_status 
              CHECK (status IN ('active', 'inactive')),
          
          -- Unique constraint to prevent duplicate assignments
          CONSTRAINT UQ_budget_location_assignments_budget_location 
              UNIQUE (budget_id, location_id, status)
      );
    `);
    console.log('✅ Budget location assignments table created');

    // Step 2: Create indexes
    console.log('📋 Creating indexes...');
    await mssql.execute(`
      CREATE INDEX IX_budget_location_assignments_budget_id ON shopify.budget_location_assignments(budget_id);
    `);
    await mssql.execute(`
      CREATE INDEX IX_budget_location_assignments_location_id ON shopify.budget_location_assignments(location_id);
    `);
    await mssql.execute(`
      CREATE INDEX IX_budget_location_assignments_status ON shopify.budget_location_assignments(status);
    `);
    console.log('✅ Indexes created');

    // Step 3: Grant permissions (skip if user doesn't exist)
    console.log('🔐 Granting permissions...');
    try {
      await mssql.execute(`
        GRANT SELECT, INSERT, UPDATE, DELETE ON shopify.budget_location_assignments TO dynamic_dreamz_login;
      `);
      console.log('✅ Permissions granted');
    } catch (error) {
      console.log('⚠️  Skipping permissions (user may not exist or insufficient privileges)');
    }

    // Step 4: Create view
    console.log('👁️ Creating view...');
    await mssql.execute(`
      CREATE VIEW shopify.v_budget_location_assignments AS
      SELECT 
          bla.id,
          bla.budget_id,
          b.name as budget_name,
          b.total_amount as budget_total,
          b.status as budget_status,
          bla.location_id,
          bla.status as assignment_status,
          bla.assigned_by,
          bla.created_at as assigned_at,
          bla.updated_at
      FROM shopify.budget_location_assignments bla
      INNER JOIN shopify.budget b ON bla.budget_id = b.id
      WHERE bla.status = 'active'
    `);
    console.log('✅ View created');

    // Step 5: Grant view permissions (skip if user doesn't exist)
    console.log('🔐 Granting view permissions...');
    try {
      await mssql.execute(`
        GRANT SELECT ON shopify.v_budget_location_assignments TO dynamic_dreamz_login;
      `);
      console.log('✅ View permissions granted');
    } catch (error) {
      console.log('⚠️  Skipping view permissions (user may not exist or insufficient privileges)');
    }

    // Step 6: Test the table
    console.log('🧪 Testing table...');
    const testResult = await mssql.query('SELECT COUNT(*) as count FROM shopify.budget_location_assignments');
    console.log(`✅ Table test successful: ${testResult[0].count} assignments found`);

    console.log('\n🎉 Budget location assignments table setup completed successfully!');
    console.log('📄 Table: shopify.budget_location_assignments');
    console.log('👁️ View: shopify.v_budget_location_assignments');

  } catch (error) {
    console.error('❌ Error creating budget location assignments table:', error);
    throw error;
  }
}

// Run the script
createBudgetLocationAssignmentsTable()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
