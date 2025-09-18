// Check duplicates in budget location assignments
import mssql from '../app/mssql.server.js';

async function checkDuplicates() {
  try {
    console.log('🔍 Checking for duplicates...');
    
    const duplicates = await mssql.query(`
      SELECT 
          budget_id,
          location_id,
          status,
          COUNT(*) as count
      FROM shopify.budget_location_assignments
      GROUP BY budget_id, location_id, status
      HAVING COUNT(*) > 1
      ORDER BY budget_id, location_id, status
    `);
    
    console.log('📊 Duplicate combinations:');
    duplicates.forEach(row => {
      console.log(`   budget_id: ${row.budget_id}, location_id: ${row.location_id}, status: ${row.status}, count: ${row.count}`);
    });
    
    if (duplicates.length > 0) {
      console.log('\n🔍 Detailed data for duplicates:');
      for (const dup of duplicates) {
        const detailedData = await mssql.query(`
          SELECT * 
          FROM shopify.budget_location_assignments
          WHERE budget_id = ${dup.budget_id} 
            AND location_id = ${dup.location_id} 
            AND status = '${dup.status}'
          ORDER BY id
        `);
        
        console.log(`\n   Records for budget_id: ${dup.budget_id}, location_id: ${dup.location_id}, status: ${dup.status}:`);
        detailedData.forEach(row => {
          console.log(`     ID: ${row.id}, created_at: ${row.created_at}, assigned_by: ${row.assigned_by}`);
        });
      }
    }
    
    console.log('\n📊 All current data:');
    const allData = await mssql.query(`
      SELECT * FROM shopify.budget_location_assignments
      ORDER BY budget_id, location_id, status, id
    `);
    
    allData.forEach(row => {
      console.log(`   ID: ${row.id}, budget_id: ${row.budget_id}, location_id: ${row.location_id}, status: ${row.status}, created_at: ${row.created_at}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDuplicates();
