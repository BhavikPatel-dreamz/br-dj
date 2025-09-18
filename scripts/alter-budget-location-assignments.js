// Alter Budget Location Assignments Table Script - Change location_id to BIGINT
import mssql from '../app/mssql.server.js';

async function alterBudgetLocationAssignmentsTable() {
  try {
    console.log('🚀 Altering budget location assignments table...');

    // Step 1: Check current table structure
    console.log('🔍 Checking current table structure...');
    const currentStructure = await mssql.query(`
      SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'shopify' 
        AND TABLE_NAME = 'budget_location_assignments'
        AND COLUMN_NAME = 'location_id'
    `);
    
    if (currentStructure.length > 0) {
      console.log('📊 Current location_id structure:', currentStructure[0]);
      
      // Check if location_id is already BIGINT
      if (currentStructure[0].DATA_TYPE === 'bigint') {
        console.log('✅ location_id is already BIGINT - no changes needed');
        return;
      }
    }

    // Step 2: Check if there's any data in the table
    console.log('🔍 Checking for existing data...');
    const dataCount = await mssql.query('SELECT COUNT(*) as count FROM shopify.budget_location_assignments');
    console.log(`📊 Found ${dataCount[0].count} existing records`);

    if (dataCount[0].count > 0) {
      console.log('⚠️  Warning: Table contains data. Please ensure all location_id values are numeric before proceeding.');
      
      // Check for non-numeric location_id values
      const nonNumericCheck = await mssql.query(`
        SELECT location_id, COUNT(*) as count
        FROM shopify.budget_location_assignments 
        WHERE ISNUMERIC(location_id) = 0
        GROUP BY location_id
      `);
      
      if (nonNumericCheck.length > 0) {
        console.log('❌ Found non-numeric location_id values:');
        nonNumericCheck.forEach(row => {
          console.log(`   - "${row.location_id}" (${row.count} records)`);
        });
        throw new Error('Cannot convert location_id to BIGINT: non-numeric values found');
      }
    }

    // Step 3: Drop constraints and indexes that depend on location_id
    console.log('🗑️  Dropping dependent constraints and indexes...');
    
    try {
      await mssql.execute(`
        ALTER TABLE shopify.budget_location_assignments 
        DROP CONSTRAINT UQ_budget_location_assignments_budget_location
      `);
      console.log('✅ Unique constraint dropped');
    } catch (error) {
      console.log('⚠️  Unique constraint may not exist or already dropped');
    }

    try {
      await mssql.execute(`
        DROP INDEX IX_budget_location_assignments_location_id ON shopify.budget_location_assignments
      `);
      console.log('✅ Location index dropped');
    } catch (error) {
      console.log('⚠️  Location index may not exist or already dropped');
    }

    // Step 4: Alter the column
    console.log('🔄 Altering location_id column to BIGINT...');
    await mssql.execute(`
      ALTER TABLE shopify.budget_location_assignments 
      ALTER COLUMN location_id BIGINT NOT NULL
    `);
    console.log('✅ location_id column altered to BIGINT');

    // Step 5: Recreate constraints and indexes
    console.log('🔗 Recreating constraints and indexes...');
    
    await mssql.execute(`
      CREATE INDEX IX_budget_location_assignments_location_id ON shopify.budget_location_assignments(location_id)
    `);
    console.log('✅ Location index recreated');

    await mssql.execute(`
      ALTER TABLE shopify.budget_location_assignments 
      ADD CONSTRAINT UQ_budget_location_assignments_budget_location 
      UNIQUE (budget_id, location_id, status)
    `);
    console.log('✅ Unique constraint recreated');

    // Step 6: Verify the change
    console.log('🧪 Verifying the change...');
    const newStructure = await mssql.query(`
      SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'shopify' 
        AND TABLE_NAME = 'budget_location_assignments'
        AND COLUMN_NAME = 'location_id'
    `);
    
    console.log('📊 New location_id structure:', newStructure[0]);

    // Step 7: Test the table
    console.log('🧪 Testing table...');
    const testResult = await mssql.query('SELECT COUNT(*) as count FROM shopify.budget_location_assignments');
    console.log(`✅ Table test successful: ${testResult[0].count} assignments found`);

    console.log('\n🎉 Budget location assignments table alteration completed successfully!');
    console.log('📄 Table: shopify.budget_location_assignments');
    console.log('🔢 location_id is now BIGINT (numeric)');

  } catch (error) {
    console.error('❌ Error altering budget location assignments table:', error);
    throw error;
  }
}

// Run the script
alterBudgetLocationAssignmentsTable()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
