// Clean and Alter Budget Location Assignments Table Script
import mssql from '../app/mssql.server.js';

async function cleanAndAlterBudgetLocationAssignmentsTable() {
  try {
    console.log('🚀 Cleaning and altering budget location assignments table...');

    // Step 1: Check current data
    console.log('🔍 Checking current location_id data...');
    const currentData = await mssql.query(`
      SELECT 
          id,
          budget_id,
          location_id,
          status,
          assigned_by,
          created_at
      FROM shopify.budget_location_assignments
      ORDER BY id
    `);
    
    console.log(`📊 Found ${currentData.length} records:`);
    currentData.forEach(row => {
      console.log(`   ID: ${row.id}, location_id: "${row.location_id}"`);
    });

    // Step 2: Add temporary column for numeric location ID
    console.log('🔄 Adding temporary numeric location_id column...');
    
    try {
      await mssql.execute(`
        ALTER TABLE shopify.budget_location_assignments 
        ADD location_id_numeric BIGINT
      `);
      console.log('✅ Temporary column added');
    } catch (error) {
      console.log('⚠️  Temporary column might already exist');
    }

    // Step 3: Extract numeric IDs and update the temporary column
    console.log('🔄 Extracting numeric IDs...');
    
    for (const row of currentData) {
      const locationString = row.location_id;
      // Extract the numeric ID from the beginning of the string
      const numericMatch = locationString.match(/^(\d+)/);
      
      if (numericMatch) {
        const numericId = parseInt(numericMatch[1]);
        console.log(`   Extracting: "${locationString}" -> ${numericId}`);
        
        await mssql.execute(`
          UPDATE shopify.budget_location_assignments 
          SET location_id_numeric = ${numericId}
          WHERE id = ${row.id}
        `);
      } else {
        console.log(`   ⚠️  Could not extract numeric ID from: "${locationString}"`);
      }
    }

    // Step 4: Verify all records have numeric values
    console.log('🔍 Verifying numeric extraction...');
    const nullCheck = await mssql.query(`
      SELECT COUNT(*) as count
      FROM shopify.budget_location_assignments 
      WHERE location_id_numeric IS NULL
    `);
    
    if (nullCheck[0].count > 0) {
      throw new Error(`${nullCheck[0].count} records still have NULL numeric location_id values`);
    }

    // Step 5: Drop constraints and indexes that depend on location_id
    console.log('🗑️  Dropping dependent constraints and indexes...');
    
    try {
      await mssql.execute(`
        ALTER TABLE shopify.budget_location_assignments 
        DROP CONSTRAINT UQ_budget_location_assignments_budget_location
      `);
      console.log('✅ Unique constraint dropped');
    } catch (error) {
      console.log('⚠️  Unique constraint may not exist');
    }

    try {
      await mssql.execute(`
        DROP INDEX IX_budget_location_assignments_location_id ON shopify.budget_location_assignments
      `);
      console.log('✅ Location index dropped');
    } catch (error) {
      console.log('⚠️  Location index may not exist');
    }

    // Step 6: Drop the old location_id column
    console.log('🗑️  Dropping old location_id column...');
    await mssql.execute(`
      ALTER TABLE shopify.budget_location_assignments 
      DROP COLUMN location_id
    `);
    console.log('✅ Old location_id column dropped');

    // Step 7: Rename the numeric column to location_id
    console.log('🔄 Renaming numeric column to location_id...');
    await mssql.execute(`
      EXEC sp_rename 'shopify.budget_location_assignments.location_id_numeric', 'location_id', 'COLUMN'
    `);
    console.log('✅ Column renamed');

    // Step 8: Make the column NOT NULL
    console.log('🔄 Making location_id NOT NULL...');
    await mssql.execute(`
      ALTER TABLE shopify.budget_location_assignments 
      ALTER COLUMN location_id BIGINT NOT NULL
    `);
    console.log('✅ location_id is now NOT NULL');

    // Step 9: Recreate constraints and indexes
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

    // Step 10: Verify the final result
    console.log('🧪 Verifying the final result...');
    const finalData = await mssql.query(`
      SELECT 
          id,
          budget_id,
          location_id,
          status,
          assigned_by,
          created_at
      FROM shopify.budget_location_assignments
      ORDER BY id
    `);
    
    console.log('📊 Final data:');
    finalData.forEach(row => {
      console.log(`   ID: ${row.id}, location_id: ${row.location_id} (${typeof row.location_id})`);
    });

    // Step 11: Check column structure
    const finalStructure = await mssql.query(`
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
    
    console.log('📊 Final location_id structure:', finalStructure[0]);

    console.log('\n🎉 Budget location assignments table cleanup and alteration completed successfully!');
    console.log('📄 Table: shopify.budget_location_assignments');
    console.log('🔢 location_id is now BIGINT (numeric) with extracted numeric IDs');

  } catch (error) {
    console.error('❌ Error cleaning and altering budget location assignments table:', error);
    throw error;
  }
}

// Run the script
cleanAndAlterBudgetLocationAssignmentsTable()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
