import 'dotenv/config';
import mssql from "../app/mssql.server.js";

async function checkBudgetCategories() {
  try {
    console.log('Checking budget_categories_master table...\n');
    
    // First, let's check if the budget_categories_master table exists and see its structure
    const tableStructureQuery = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'budget_categories_master'
      ORDER BY ORDINAL_POSITION
    `;

    console.log('=== BUDGET CATEGORIES MASTER TABLE STRUCTURE ===');
    const tableStructure = await mssql.query(tableStructureQuery);
    
    if (tableStructure.length === 0) {
      console.log('budget_categories_master table not found or not accessible.');
      return;
    }

    tableStructure.forEach(col => {
      console.log(`${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

    // Get all budget categories
    const allBudgetCategoriesQuery = `
      SELECT *
      FROM budget_categories_master
      ORDER BY category_name
    `;

    console.log('\n=== ALL BUDGET CATEGORIES ===');
    const allBudgetCategories = await mssql.query(allBudgetCategoriesQuery);
    
    if (allBudgetCategories.length === 0) {
      console.log('No budget categories found in the table.');
    } else {
      console.log(`Found ${allBudgetCategories.length} budget categories:`);
      allBudgetCategories.forEach((cat, index) => {
        console.log(`${index + 1}. ID: ${cat.id || cat.category_id || 'N/A'} | Name: "${cat.category_name || cat.name}" | Active: ${cat.is_active || cat.active || 'N/A'}`);
      });
    }

    // Look specifically for Ostomy-related budget categories
    const ostomyBudgetQuery = `
      SELECT *
      FROM budget_categories_master
      WHERE category_name LIKE '%ostomy%'
         OR category_name LIKE '%Ostomy%'
         OR category_name LIKE '%OSTOMY%'
      ORDER BY category_name
    `;

    console.log('\n=== OSTOMY-RELATED BUDGET CATEGORIES ===');
    const ostomyBudgetCategories = await mssql.query(ostomyBudgetQuery);
    
    if (ostomyBudgetCategories.length === 0) {
      console.log('No Ostomy-related categories found in budget_categories_master.');
    } else {
      ostomyBudgetCategories.forEach(cat => {
        console.log(`- ID: ${cat.id || cat.category_id || 'N/A'}`);
        console.log(`- Name: "${cat.category_name || cat.name}"`);
        console.log(`- Active: ${cat.is_active || cat.active || 'N/A'}`);
        console.log('---');
      });
    }

    // Compare product categories with budget categories
    const productCategoriesQuery = `
      SELECT DISTINCT 
        COALESCE(product_type, 'Uncategorized') as category_name,
        COUNT(*) as product_count
      FROM brdjdb.shopify.product 
      GROUP BY product_type
      ORDER BY category_name
    `;

    console.log('\n=== COMPARISON: PRODUCT vs BUDGET CATEGORIES ===');
    const productCategories = await mssql.query(productCategoriesQuery);
    const budgetCategoryNames = allBudgetCategories.map(cat => cat.category_name || cat.name);
    
    console.log('Product categories that HAVE budget categories:');
    const matched = [];
    const unmatched = [];
    
    productCategories.forEach(prodCat => {
      const isInBudget = budgetCategoryNames.some(budgetName => 
        budgetName.toLowerCase() === prodCat.category_name.toLowerCase()
      );
      
      if (isInBudget) {
        matched.push(prodCat);
        console.log(`✅ "${prodCat.category_name}" (${prodCat.product_count} products)`);
      } else {
        unmatched.push(prodCat);
      }
    });

    console.log('\nProduct categories that DO NOT have budget categories:');
    unmatched.forEach(prodCat => {
      console.log(`❌ "${prodCat.category_name}" (${prodCat.product_count} products)`);
    });

    console.log('\nBudget categories that DO NOT have matching product categories:');
    budgetCategoryNames.forEach(budgetName => {
      const hasMatch = productCategories.some(prodCat => 
        prodCat.category_name.toLowerCase() === budgetName.toLowerCase()
      );
      if (!hasMatch) {
        console.log(`⚠️  "${budgetName}" (budget category with no products)`);
      }
    });

    console.log('\n=== SUMMARY ===');
    console.log(`Total product categories: ${productCategories.length}`);
    console.log(`Total budget categories: ${allBudgetCategories.length}`);
    console.log(`Matched categories: ${matched.length}`);
    console.log(`Unmatched product categories: ${unmatched.length}`);

  } catch (error) {
    console.error('Error checking budget categories:', error);
    
    // If the table doesn't exist, let's check what budget-related tables are available
    console.log('\nChecking for other budget-related tables...');
    try {
      const budgetTablesQuery = `
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME LIKE '%budget%'
           OR TABLE_NAME LIKE '%category%'
        ORDER BY TABLE_NAME
      `;
      
      const budgetTables = await mssql.query(budgetTablesQuery);
      console.log('Available budget/category tables:');
      budgetTables.forEach(table => {
        console.log(`- ${table.TABLE_NAME}`);
      });
    } catch (innerError) {
      console.error('Error checking for budget tables:', innerError);
    }
  }
}

// Run the check
checkBudgetCategories();
