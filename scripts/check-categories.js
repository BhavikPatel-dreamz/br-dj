import 'dotenv/config';
import mssql from "../app/mssql.server.js";

async function checkProductCategories() {
  try {
    console.log('Connecting to database to check product categories...\n');
    
    // Query to get all unique product types (categories)
    const categoryQuery = `
      SELECT 
        COALESCE(product_type, 'Uncategorized') as category,
        COUNT(*) as product_count
      FROM brdjdb.shopify.product 
      GROUP BY product_type
      ORDER BY product_count DESC, category ASC
    `;
    
    // Query to specifically look for Ostomy-related categories
    const ostomyQuery = `
      SELECT 
        COALESCE(product_type, 'Uncategorized') as category,
        COUNT(*) as product_count,
        STRING_AGG(title, ', ') as sample_products
      FROM brdjdb.shopify.product 
      WHERE product_type LIKE '%ostomy%' 
         OR product_type LIKE '%Ostomy%'
         OR title LIKE '%ostomy%'
         OR title LIKE '%Ostomy%'
      GROUP BY product_type
      ORDER BY product_count DESC
    `;

    console.log('=== ALL PRODUCT CATEGORIES ===');
    const allCategories = await mssql.query(categoryQuery);
    
    if (allCategories.length === 0) {
      console.log('No categories found in the database.');
    } else {
      allCategories.forEach(cat => {
        console.log(`${cat.category}: ${cat.product_count} products`);
      });
    }

    console.log('\n=== OSTOMY-RELATED CATEGORIES ===');
    const ostomyCategories = await mssql.query(ostomyQuery);
    
    if (ostomyCategories.length === 0) {
      console.log('No Ostomy-specific categories found.');
      console.log('Searching for Ostomy in product titles...');
      
      // Broader search in product titles
      const titleSearchQuery = `
        SELECT TOP 10
          COALESCE(product_type, 'Uncategorized') as category,
          title,
          vendor
        FROM brdjdb.shopify.product 
        WHERE title LIKE '%ostomy%' 
           OR title LIKE '%Ostomy%'
           OR title LIKE '%stoma%'
           OR title LIKE '%Stoma%'
        ORDER BY title
      `;
      
      const titleResults = await mssql.query(titleSearchQuery);
      
      if (titleResults.length === 0) {
        console.log('No Ostomy products found in product titles either.');
      } else {
        console.log('Found Ostomy products:');
        titleResults.forEach(product => {
          console.log(`- Category: "${product.category}" | Product: "${product.title}" | Vendor: "${product.vendor}"`);
        });
      }
    } else {
      ostomyCategories.forEach(cat => {
        console.log(`Category: "${cat.category}"`);
        console.log(`Products: ${cat.product_count}`);
        console.log(`Sample products: ${cat.sample_products}`);
        console.log('---');
      });
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total categories found: ${allCategories.length}`);
    console.log(`Ostomy-specific categories: ${ostomyCategories.length}`);

  } catch (error) {
    console.error('Error checking categories:', error);
  }
}

// Run the check
checkProductCategories();
