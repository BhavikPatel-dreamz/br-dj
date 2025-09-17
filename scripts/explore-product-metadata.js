import 'dotenv/config';
import mssql from "../app/mssql.server.js";

async function exploreProductMetadata() {
  try {
    console.log('Exploring Shopify product metadata structure...\n');
    
    // First, let's see what product-related tables exist
    const productTablesQuery = `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE '%product%'
        AND TABLE_SCHEMA = 'shopify'
      ORDER BY TABLE_NAME
    `;

    console.log('=== PRODUCT-RELATED TABLES ===');
    const productTables = await mssql.query(productTablesQuery);
    productTables.forEach(table => {
      console.log(`- ${table.TABLE_NAME}`);
    });

    // Check if there's a product_metafield table
    const metafieldTablesQuery = `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE '%meta%'
        AND TABLE_SCHEMA = 'shopify'
      ORDER BY TABLE_NAME
    `;

    console.log('\n=== METADATA/METAFIELD TABLES ===');
    const metafieldTables = await mssql.query(metafieldTablesQuery);
    if (metafieldTables.length > 0) {
      metafieldTables.forEach(table => {
        console.log(`- ${table.TABLE_NAME}`);
      });
    } else {
      console.log('No metafield-specific tables found.');
    }

    // Let's examine the product table structure to see if metadata is stored there
    const productStructureQuery = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'product'
        AND TABLE_SCHEMA = 'shopify'
      ORDER BY ORDINAL_POSITION
    `;

    console.log('\n=== PRODUCT TABLE STRUCTURE ===');
    const productColumns = await mssql.query(productStructureQuery);
    productColumns.forEach(col => {
      const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      console.log(`${col.COLUMN_NAME}: ${col.DATA_TYPE}${length} - ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Look for any columns that might contain metadata
    const metadataColumns = productColumns.filter(col => 
      col.COLUMN_NAME.toLowerCase().includes('meta') ||
      col.COLUMN_NAME.toLowerCase().includes('gl') ||
      col.COLUMN_NAME.toLowerCase().includes('apex') ||
      col.COLUMN_NAME.toLowerCase().includes('code')
    );

    if (metadataColumns.length > 0) {
      console.log('\n=== POTENTIAL METADATA COLUMNS IN PRODUCT TABLE ===');
      metadataColumns.forEach(col => {
        console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
      });
    }

    // Check if there's a separate metafield table
    try {
      const metafieldStructureQuery = `
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          CHARACTER_MAXIMUM_LENGTH,
          IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'product_metafield'
          AND TABLE_SCHEMA = 'shopify'
        ORDER BY ORDINAL_POSITION
      `;

      console.log('\n=== PRODUCT_METAFIELD TABLE STRUCTURE ===');
      const metafieldColumns = await mssql.query(metafieldStructureQuery);
      if (metafieldColumns.length > 0) {
        metafieldColumns.forEach(col => {
          const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
          console.log(`${col.COLUMN_NAME}: ${col.DATA_TYPE}${length} - ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
      } else {
        console.log('No product_metafield table found.');
      }
    } catch (error) {
      console.log('No product_metafield table accessible.');
    }

    // Let's look for any table that might contain metafields
    const allTablesQuery = `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'shopify'
        AND (TABLE_NAME LIKE '%field%' OR TABLE_NAME LIKE '%meta%')
      ORDER BY TABLE_NAME
    `;

    console.log('\n=== ALL FIELD/META TABLES ===');
    const allMetaTables = await mssql.query(allTablesQuery);
    allMetaTables.forEach(table => {
      console.log(`- ${table.TABLE_NAME}`);
    });

    // Sample some products to see what data is available
    const sampleProductsQuery = `
      SELECT TOP 3 *
      FROM brdjdb.shopify.product
      WHERE product_type = 'Ostomy'
      ORDER BY id
    `;

    console.log('\n=== SAMPLE PRODUCT DATA (Ostomy products) ===');
    const sampleProducts = await mssql.query(sampleProductsQuery);
    if (sampleProducts.length > 0) {
      const product = sampleProducts[0];
      console.log('Sample product columns and values:');
      Object.keys(product).forEach(key => {
        const value = product[key];
        if (value !== null && value !== '') {
          console.log(`${key}: ${typeof value === 'string' && value.length > 100 ? value.substring(0, 100) + '...' : value}`);
        }
      });
    }

  } catch (error) {
    console.error('Error exploring product metadata:', error);
  }
}

// Run the exploration
exploreProductMetadata();
