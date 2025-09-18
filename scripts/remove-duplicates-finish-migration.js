// Remove duplicates and finish migration
import mssql from '../app/mssql.server.js';

async function removeDuplicatesAndFinishMigration() {
  try {
    console.log('🚀 Removing duplicates and finishing migration...');

    // Step 1: Find duplicates
    console.log('🔍 Finding duplicates...');
    const duplicates = await mssql.query(`
      SELECT 
          budget_id,
          location_id,
          status,
          COUNT(*) as count
      FROM shopify.budget_location_assignments
      GROUP BY budget_id, location_id, status
      HAVING COUNT(*) > 1
    `);

    console.log(`📊 Found ${duplicates.length} duplicate combinations`);

    // Step 2: Remove duplicates (keep the oldest record for each combination)
    for (const dup of duplicates) {
      console.log(`🔄 Processing duplicates for budget_id: ${dup.budget_id}, location_id: ${dup.location_id}, status: ${dup.status}`);
      
      // Get all records for this combination, ordered by ID (oldest first)
      const records = await mssql.query(`
        SELECT id
        FROM shopify.budget_location_assignments
        WHERE budget_id = ${dup.budget_id} 
          AND location_id = ${dup.location_id} 
          AND status = '${dup.status}'
        ORDER BY id
      `);
      
      // Keep the first (oldest) record, delete the rest
      const keepId = records[0].id;
      const deleteIds = records.slice(1).map(r => r.id);
      
      console.log(`   Keeping ID: ${keepId}, deleting IDs: [${deleteIds.join(', ')}]`);
      
      for (const deleteId of deleteIds) {
        await mssql.execute(`
          DELETE FROM shopify.budget_location_assignments 
          WHERE id = ${deleteId}
        `);
      }
    }
    
    console.log('✅ Duplicates removed');

    // Step 3: Verify no duplicates remain
    console.log('🔍 Verifying no duplicates remain...');
    const remainingDuplicates = await mssql.query(`
      SELECT 
          budget_id,
          location_id,
          status,
          COUNT(*) as count
      FROM shopify.budget_location_assignments
      GROUP BY budget_id, location_id, status
      HAVING COUNT(*) > 1
    `);
    
    if (remainingDuplicates.length > 0) {
      throw new Error(`Still have ${remainingDuplicates.length} duplicate combinations!`);
    }
    
    console.log('✅ No duplicates found');

    // Step 4: Create the unique constraint
    console.log('🔗 Creating unique constraint...');
    await mssql.execute(`
      ALTER TABLE shopify.budget_location_assignments 
      ADD CONSTRAINT UQ_budget_location_assignments_budget_location 
      UNIQUE (budget_id, location_id, status)
    `);
    console.log('✅ Unique constraint created');

    // Step 5: Verify the final result
    console.log('🧪 Verifying final result...');
    const finalData = await mssql.query(`
      SELECT 
          id,
          budget_id,
          location_id,
          status,
          created_at
      FROM shopify.budget_location_assignments
      ORDER BY budget_id, location_id, status
    `);
    
    console.log('📊 Final data:');
    finalData.forEach(row => {
      console.log(`   ID: ${row.id}, budget_id: ${row.budget_id}, location_id: ${row.location_id}, status: ${row.status}`);
    });

    // Step 6: Check column structure
    const structure = await mssql.query(`
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
    
    console.log('📊 Final location_id structure:', structure[0]);

    console.log('\n🎉 Migration completed successfully!');
    console.log('📄 Table: shopify.budget_location_assignments');
    console.log('🔢 location_id is now BIGINT (numeric)');
    console.log('✨ Duplicates removed and unique constraint applied');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run the script
removeDuplicatesAndFinishMigration()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
