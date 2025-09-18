import 'dotenv/config';
import mssql from "../app/mssql.server.js";

/**
 * Script to extract unique categories from shopify_category column
 * and populate them into budget_categories_master table
 */

async function getUniqueShopifyCategories() {
  try {
    console.log('🔍 FETCHING UNIQUE SHOPIFY CATEGORIES FROM PRODUCTS TABLE...');
    console.log('═'.repeat(80));

    // Query to get all unique categories from shopify_category column
    const uniqueCategoriesQuery = `
      SELECT DISTINCT 
        shopify_category,
        COUNT(*) as product_count
      FROM shopify.product
      WHERE shopify_category IS NOT NULL
        AND LTRIM(RTRIM(shopify_category)) != ''
      GROUP BY shopify_category
      ORDER BY product_count DESC, shopify_category ASC
    `;

    const categories = await mssql.query(uniqueCategoriesQuery);

    console.log(`✅ Found ${categories.length} unique categories:`);
    console.log('');

    // Display the categories with product counts
    categories.forEach((cat, index) => {
      console.log(`${index + 1}. "${cat.shopify_category}" (${cat.product_count} products)`);
    });

    return categories;

  } catch (error) {
    console.error('❌ Error fetching unique categories:', error.message);
    return [];
  }
}

async function insertCategoriesIntoBudgetMaster(categories) {
  if (categories.length === 0) {
    console.log('No categories to insert.');
    return { inserted: 0, updated: 0, skipped: 0 };
  }

  try {
    console.log('\n📝 INSERTING CATEGORIES INTO BUDGET_CATEGORIES_MASTER...');
    console.log('═'.repeat(80));

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const category of categories) {
      const categoryName = category.shopify_category.trim();
      const productCount = category.product_count;

      try {
        // Generate a category code based on the name
        const categoryCode = generateCategoryCode(categoryName);
        
        // Create a description with product count
        const description = `Shopify category with ${productCount} products. Auto-generated from product data.`;

        // Use MERGE to insert or update the category
        const mergeQuery = `
          MERGE shopify.budget_categories_master AS target
          USING (VALUES (@categoryName, @categoryCode, @description, @productCount)) AS source 
            (category_name, category_code, description, product_count)
          ON target.category_name = source.category_name
          WHEN MATCHED THEN
            UPDATE SET 
              description = 'Shopify category with ' + CAST(@productCount AS NVARCHAR) + ' products. Updated on ' + FORMAT(GETDATE(), 'yyyy-MM-dd'),
              updated_at = GETDATE(),
              updated_by = 'shopify_category_sync'
          WHEN NOT MATCHED THEN
            INSERT (category_name, category_code, description, sort_order, is_active, created_at, updated_at, created_by, updated_by)
            VALUES (source.category_name, source.category_code, source.description, 9999, 1, GETDATE(), GETDATE(), 'shopify_category_sync', 'shopify_category_sync')
          OUTPUT $action;
        `;

        const result = await mssql.query(mergeQuery, {
          categoryName,
          categoryCode,
          description,
          productCount
        });

        // Count the action types
        if (result && result.length > 0) {
          const action = result[0]['$action'];
          if (action === 'INSERT') {
            inserted++;
            console.log(`✅ Inserted: "${categoryName}" (${productCount} products)`);
          } else if (action === 'UPDATE') {
            updated++;
            console.log(`🔄 Updated: "${categoryName}" (${productCount} products)`);
          }
        } else {
          skipped++;
          console.log(`⚠️  Skipped: "${categoryName}"`);
        }

      } catch (error) {
        skipped++;
        console.error(`❌ Failed to process "${categoryName}": ${error.message}`);
      }
    }

    console.log('\n📊 SUMMARY:');
    console.log(`   ✅ Inserted: ${inserted} new categories`);
    console.log(`   🔄 Updated: ${updated} existing categories`);
    console.log(`   ⚠️  Skipped: ${skipped} categories`);
    console.log(`   📦 Total processed: ${inserted + updated + skipped}`);

    return { inserted, updated, skipped };

  } catch (error) {
    console.error('❌ Error inserting categories into budget master:', error.message);
    return { inserted: 0, updated: 0, skipped: 0 };
  }
}

function generateCategoryCode(categoryName) {
  // Generate a simple category code based on the name
  // Take first 2 words, get first 3 characters of each, convert to uppercase
  const words = categoryName.split(' ').filter(word => word.length > 0);
  
  let code = '';
  if (words.length >= 2) {
    code = words[0].substring(0, 3) + words[1].substring(0, 3);
  } else if (words.length === 1) {
    code = words[0].substring(0, 6);
  } else {
    code = 'CAT';
  }

  // Remove special characters and convert to uppercase
  code = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  // Add a numeric suffix to make it unique
  const timestamp = Date.now().toString().slice(-3);
  
  return code + timestamp;
}

async function showCategoriesInBudgetMaster() {
  try {
    console.log('\n📋 CATEGORIES NOW IN BUDGET_CATEGORIES_MASTER:');
    console.log('═'.repeat(80));

    const categoriesQuery = `
      SELECT 
        id,
        category_name,
        category_code,
        description,
        is_active,
        created_by,
        FORMAT(created_at, 'yyyy-MM-dd HH:mm') as created_at
      FROM shopify.budget_categories_master
      WHERE created_by = 'shopify_category_sync' 
         OR updated_by = 'shopify_category_sync'
      ORDER BY category_name
    `;

    const categories = await mssql.query(categoriesQuery);

    if (categories.length === 0) {
      console.log('No categories found that were created by this script.');
      return;
    }

    categories.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat.category_name}`);
      console.log(`   📋 Code: ${cat.category_code}`);
      console.log(`   📝 Description: ${cat.description}`);
      console.log(`   ✅ Active: ${cat.is_active ? 'Yes' : 'No'}`);
      console.log(`   👤 Created by: ${cat.created_by} on ${cat.created_at}`);
      console.log('');
    });

    console.log(`Total categories managed by this script: ${categories.length}`);

  } catch (error) {
    console.error('❌ Error showing categories:', error.message);
  }
}

async function validateProductCategoryMapping() {
  try {
    console.log('\n🔍 VALIDATING PRODUCT-CATEGORY MAPPING...');
    console.log('═'.repeat(80));

    // Check if all products with categories have corresponding budget categories
    const validationQuery = `
      SELECT 
        p.shopify_category,
        COUNT(p.id) as product_count,
        CASE 
          WHEN bcm.id IS NOT NULL THEN 'Mapped'
          ELSE 'Missing'
        END as budget_category_status
      FROM shopify.product p
      LEFT JOIN shopify.budget_categories_master bcm ON p.shopify_category = bcm.category_name
      WHERE p.shopify_category IS NOT NULL 
        AND LTRIM(RTRIM(p.shopify_category)) != ''
      GROUP BY p.shopify_category, bcm.id
      ORDER BY budget_category_status DESC, product_count DESC
    `;

    const validation = await mssql.query(validationQuery);

    const mapped = validation.filter(v => v.budget_category_status === 'Mapped');
    const missing = validation.filter(v => v.budget_category_status === 'Missing');

    console.log(`✅ Mapped categories: ${mapped.length}`);
    console.log(`❌ Missing categories: ${missing.length}`);

    if (missing.length > 0) {
      console.log('\n⚠️  Categories missing from budget_categories_master:');
      missing.forEach(cat => {
        console.log(`   "${cat.shopify_category}" (${cat.product_count} products)`);
      });
    }

    return { mapped: mapped.length, missing: missing.length };

  } catch (error) {
    console.error('❌ Error validating mapping:', error.message);
    return { mapped: 0, missing: 0 };
  }
}

// Main execution function
async function main() {
  console.log('🚀 SHOPIFY CATEGORIES TO BUDGET CATEGORIES SYNC');
  console.log('═'.repeat(80));

  try {
    // Step 1: Get all unique categories from products
    const uniqueCategories = await getUniqueShopifyCategories();

    if (uniqueCategories.length === 0) {
      console.log('\n❌ No categories found in products table. Make sure:');
      console.log('   1. Products table exists and has data');
      console.log('   2. shopify_category column exists and has values');
      console.log('   3. Database connection is working');
      return;
    }

    // Step 2: Insert/update categories in budget_categories_master
    const insertResult = await insertCategoriesIntoBudgetMaster(uniqueCategories);

    // Step 3: Show the categories now in budget_categories_master
    await showCategoriesInBudgetMaster();

    // Step 4: Validate the mapping
    const validation = await validateProductCategoryMapping();

    console.log('\n✅ SCRIPT COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(80));
    console.log(`📊 Final Summary:`);
    console.log(`   📦 Unique categories found: ${uniqueCategories.length}`);
    console.log(`   ✅ Categories inserted: ${insertResult.inserted}`);
    console.log(`   🔄 Categories updated: ${insertResult.updated}`);
    console.log(`   ⚠️  Categories skipped: ${insertResult.skipped}`);
    console.log(`   🔗 Properly mapped: ${validation.mapped}`);
    console.log(`   ❌ Missing mappings: ${validation.missing}`);

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.error(error.stack);
  }
}

// Run the script
main();
