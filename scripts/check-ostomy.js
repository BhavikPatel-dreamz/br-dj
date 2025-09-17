import 'dotenv/config';
import mssql from "../app/mssql.server.js";

async function checkOstomyProducts() {
  try {
    console.log('Checking Ostomy category details...\n');
    
    // Get Ostomy products with details
    const ostomyProductsQuery = `
      SELECT TOP 20
        title,
        vendor,
        product_type,
        handle,
        status
      FROM brdjdb.shopify.product 
      WHERE product_type = 'Ostomy'
      ORDER BY title
    `;
    
    // Get count by vendor for Ostomy products
    const ostomyVendorsQuery = `
      SELECT 
        vendor,
        COUNT(*) as product_count
      FROM brdjdb.shopify.product 
      WHERE product_type = 'Ostomy'
      GROUP BY vendor
      ORDER BY product_count DESC
    `;

    console.log('=== OSTOMY CATEGORY DETAILS ===');
    console.log('Total Ostomy products: 55\n');

    console.log('=== SAMPLE OSTOMY PRODUCTS ===');
    const ostomyProducts = await mssql.query(ostomyProductsQuery);
    
    if (ostomyProducts.length > 0) {
      ostomyProducts.forEach((product, index) => {
        console.log(`${index + 1}. "${product.title}"`);
        console.log(`   Vendor: ${product.vendor}`);
        console.log(`   Status: ${product.status}`);
        console.log('   ---');
      });
    }

    console.log('\n=== OSTOMY PRODUCTS BY VENDOR ===');
    const ostomyVendors = await mssql.query(ostomyVendorsQuery);
    
    if (ostomyVendors.length > 0) {
      ostomyVendors.forEach(vendor => {
        console.log(`${vendor.vendor}: ${vendor.product_count} products`);
      });
    }

    // Check if there are other related categories
    console.log('\n=== RELATED CATEGORIES ===');
    const relatedQuery = `
      SELECT 
        product_type,
        COUNT(*) as product_count
      FROM brdjdb.shopify.product 
      WHERE product_type LIKE '%stomy%' 
         OR product_type LIKE '%continent%'
         OR product_type LIKE '%urology%'
         OR product_type = 'Urology'
         OR product_type = 'Incontinence'
      GROUP BY product_type
      ORDER BY product_count DESC
    `;
    
    const relatedCategories = await mssql.query(relatedQuery);
    relatedCategories.forEach(cat => {
      console.log(`${cat.product_type}: ${cat.product_count} products`);
    });

  } catch (error) {
    console.error('Error checking Ostomy products:', error);
  }
}

// Run the check
checkOstomyProducts();
