import 'dotenv/config';
import mssql from "../app/mssql.server.js";

async function checkBudgetCategoriesWithSchema() {
  try {
    console.log('Checking budget categories with schema prefix...\n');
    
    // Try different schema prefixes for the budget_categories_master table
    const schemas = ['brdjdb.dbo', 'dbo', 'brdjdb.shopify', 'shopify'];
    let budgetCategories = [];
    let workingSchema = null;

    for (const schema of schemas) {
      try {
        console.log(`Trying schema: ${schema}`);
        const query = `SELECT TOP 5 * FROM ${schema}.budget_categories_master`;
        const result = await mssql.query(query);
        budgetCategories = result;
        workingSchema = schema;
        console.log(`✅ Success with schema: ${schema}\n`);
        break;
      } catch (error) {
        console.log(`❌ Failed with schema: ${schema}`);
      }
    }

    if (!workingSchema) {
      console.log('Could not access budget_categories_master with any schema. Trying alternative approach...\n');
      
      // Try to use the view instead
      try {
        console.log('Trying with view: v_budget_categories_master');
        const viewQuery = `SELECT TOP 10 * FROM v_budget_categories_master`;
        budgetCategories = await mssql.query(viewQuery);
        workingSchema = 'view';
        console.log('✅ Success with view\n');
      } catch (viewError) {
        console.log('❌ View access also failed');
        
        // Last resort - try budget_categories table
        try {
          console.log('Trying budget_categories table instead...');
          const altQuery = `SELECT TOP 10 * FROM budget_categories`;
          budgetCategories = await mssql.query(altQuery);
          workingSchema = 'budget_categories';
          console.log('✅ Success with budget_categories table\n');
        } catch (altError) {
          console.log('❌ All attempts failed');
          return;
        }
      }
    }

    console.log(`=== BUDGET CATEGORIES (using ${workingSchema}) ===`);
    if (budgetCategories.length === 0) {
      console.log('No budget categories found.');
    } else {
      console.log(`Found ${budgetCategories.length} budget categories (showing sample):`);
      budgetCategories.forEach((cat, index) => {
        // Handle different possible column names
        const id = cat.id || cat.category_id || cat.budget_category_id || 'N/A';
        const name = cat.category_name || cat.name || cat.budget_category_name || 'N/A';
        const active = cat.is_active !== undefined ? cat.is_active : (cat.active !== undefined ? cat.active : 'N/A');
        
        console.log(`${index + 1}. ID: ${id} | Name: "${name}" | Active: ${active}`);
      });
    }

    // Now get all budget categories to check for Ostomy
    let allBudgetCategories = [];
    if (workingSchema === 'view') {
      allBudgetCategories = await mssql.query(`SELECT * FROM v_budget_categories_master ORDER BY category_name`);
    } else if (workingSchema === 'budget_categories') {
      allBudgetCategories = await mssql.query(`SELECT * FROM budget_categories ORDER BY category_name`);
    } else {
      allBudgetCategories = await mssql.query(`SELECT * FROM ${workingSchema}.budget_categories_master ORDER BY category_name`);
    }

    console.log('\n=== SEARCHING FOR OSTOMY IN BUDGET CATEGORIES ===');
    const ostomyBudgetCategories = allBudgetCategories.filter(cat => {
      const name = cat.category_name || cat.name || cat.budget_category_name || '';
      return name.toLowerCase().includes('ostomy');
    });

    if (ostomyBudgetCategories.length === 0) {
      console.log('❌ No Ostomy category found in budget categories.');
      
      // Show all categories to see what's available
      console.log('\n=== ALL AVAILABLE BUDGET CATEGORIES ===');
      allBudgetCategories.forEach((cat, index) => {
        const name = cat.category_name || cat.name || cat.budget_category_name || 'N/A';
        console.log(`${index + 1}. "${name}"`);
      });
      
    } else {
      console.log('✅ Found Ostomy-related budget categories:');
      ostomyBudgetCategories.forEach(cat => {
        const id = cat.id || cat.category_id || cat.budget_category_id || 'N/A';
        const name = cat.category_name || cat.name || cat.budget_category_name || 'N/A';
        const active = cat.is_active !== undefined ? cat.is_active : (cat.active !== undefined ? cat.active : 'N/A');
        
        console.log(`- ID: ${id} | Name: "${name}" | Active: ${active}`);
      });
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total budget categories: ${allBudgetCategories.length}`);
    console.log(`Ostomy budget categories: ${ostomyBudgetCategories.length}`);
    console.log(`Product category "Ostomy": 55 products (from previous query)`);
    
    if (ostomyBudgetCategories.length > 0) {
      console.log('✅ Ostomy has budget category mapping');
    } else {
      console.log('❌ Ostomy does NOT have budget category mapping');
    }

  } catch (error) {
    console.error('Error checking budget categories:', error);
  }
}

// Run the check
checkBudgetCategoriesWithSchema();
