import 'dotenv/config';
import mssql from "../app/mssql.server.js";
import fs from 'fs';
import path from 'path';

/**
 * Migration script to create the location_census table
 * Run this script to set up the database schema for location census management
 */

async function runMigration() {
  try {
    console.log("Starting location census table migration...");

    // Read the SQL migration file
    const migrationPath = path.join(process.cwd(), 'database', 'migrations', 'create-location-census.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    // Split the SQL into individual statements
    const statements = migrationSql
      .split('GO')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log("Executing statement...");
        await mssql.query(statement);
      }
    }

    console.log("✅ Location census table migration completed successfully!");
    
    // Test the table by inserting a sample record
    console.log("Testing table with sample data...");
    
    const testData = {
      locationId: "TEST_LOC_001",
      censusMonth: "01-2025",
      censusAmount: 50
    };

    const insertQuery = `
      INSERT INTO shopify.location_census 
      (location_id, census_month, census_amount)
      VALUES (@locationId, @censusMonth, @censusAmount);
    `;

    await mssql.query(insertQuery, testData);
    console.log("✅ Test record inserted successfully!");

    // Verify the record was inserted
    const verifyQuery = `
      SELECT * FROM shopify.v_location_census 
      WHERE location_id = @locationId AND census_month = @censusMonth
    `;

    const result = await mssql.query(verifyQuery, {
      locationId: testData.locationId,
      censusMonth: testData.censusMonth
    });

    if (result.length > 0) {
      console.log("✅ Test record verified in database:");
      console.log("   Location:", result[0].location_id);
      console.log("   Month:", result[0].census_month);
      console.log("   Census Amount:", result[0].census_amount);
    }

    // Clean up test record
    console.log("Cleaning up test record...");
    const deleteQuery = `
      DELETE FROM shopify.location_census 
      WHERE location_id = @locationId AND census_month = @censusMonth
    `;

    await mssql.query(deleteQuery, {
      locationId: testData.locationId,
      censusMonth: testData.censusMonth
    });

    console.log("✅ Test record cleaned up successfully!");
    console.log("\n🎉 Migration completed! You can now use the location census management features.");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    console.error("Error details:", error.message);
    process.exit(1);
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(() => {
      console.log("Migration script finished successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

export { runMigration };