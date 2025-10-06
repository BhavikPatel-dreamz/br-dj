import 'dotenv/config';
import fetch from 'node-fetch';
import mssql from "../app/mssql.server.js";

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const BATCH_SIZE = 100; // Process 100 products at a time
const MAX_BATCHES = 50; // Maximum 5000 products

// Get specific product ID from command line argument
const SPECIFIC_PRODUCT_ID = process.argv[2]; // node script.js 7897897987

const PRODUCTS_WITH_METAFIELDS_QUERY = `
  query getProductsWithMetafields($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          title
          handle
          productType
          vendor
          status
          metafields(first: 50) {
            edges {
              node {
                id
                key
                namespace
                value
                type
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// Query for specific product by ID
const SINGLE_PRODUCT_QUERY = `
  query getProductById($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      productType
      vendor
      status
      metafields(first: 50) {
        edges {
          node {
            id
            key
            namespace
            value
            type
          }
        }
      }
    }
  }
`;

async function makeShopifyGraphQLRequest(query, variables = {}) {
  if (!ADMIN_API_ACCESS_TOKEN || !SHOPIFY_STORE_URL) {
    throw new Error('Missing required environment variables');
  }

  let storeDomain = SHOPIFY_STORE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${storeDomain}/admin/api/2025-01/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ADMIN_API_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

async function fetchSingleProduct(productId) {
  try {
    console.log(`🔍 Fetching single product: ${productId}`);
    
    // Format the product ID for Shopify GraphQL
    const shopifyId = productId.startsWith('gid://') 
      ? productId 
      : `gid://shopify/Product/${productId}`;

    const data = await makeShopifyGraphQLRequest(SINGLE_PRODUCT_QUERY, {
      id: shopifyId
    });

    if (!data.product) {
      console.log('❌ Product not found');
      return null;
    }

    const product = data.product;
    const glCodeProducts = [];

    product.metafields.edges.forEach(metafieldEdge => {
      const metafield = metafieldEdge.node;
      const keyLower = metafield.key.toLowerCase();
      const namespaceLower = metafield.namespace.toLowerCase();

      // Check if this is a GL code metafield
      if (
        (keyLower.includes('apex') && (keyLower.includes('gl') || keyLower.includes('code'))) ||
        keyLower === 'gl_code' ||
        keyLower === 'gl_code_name' ||
        keyLower === 'apex_gl_code' ||
        namespaceLower.includes('apex') ||
        (keyLower.includes('gl') && keyLower.includes('code'))
      ) {
        glCodeProducts.push({
          productId: product.id.replace('gid://shopify/Product/', ''),
          productTitle: product.title,
          productType: product.productType,
          vendor: product.vendor,
          metafieldValue: metafield.value,
          metafieldKey: metafield.key,
          metafieldNamespace: metafield.namespace
        });
      }
    });

    console.log(`✅ Found ${glCodeProducts.length} GL code metafields`);
    return glCodeProducts;

  } catch (error) {
    console.error('❌ Error fetching single product:', error.message);
    return null;
  }
}

async function fetchProductBatch(cursor = null) {
  const data = await makeShopifyGraphQLRequest(PRODUCTS_WITH_METAFIELDS_QUERY, {
    first: BATCH_SIZE,
    after: cursor
  });

  const products = data.products.edges.map(edge => edge.node);
  const glCodeProducts = [];

  products.forEach(product => {
    product.metafields.edges.forEach(metafieldEdge => {
      const metafield = metafieldEdge.node;
      const keyLower = metafield.key.toLowerCase();
      const namespaceLower = metafield.namespace.toLowerCase();

      // Check if this is a GL code metafield
      if (
        (keyLower.includes('apex') && (keyLower.includes('gl') || keyLower.includes('code'))) ||
        keyLower === 'gl_code' ||
        keyLower === 'gl_code_name' ||
        keyLower === 'apex_gl_code' ||
        namespaceLower.includes('apex') ||
        (keyLower.includes('gl') && keyLower.includes('code'))
      ) {
        glCodeProducts.push({
          productId: product.id.replace('gid://shopify/Product/', ''),
          productTitle: product.title,
          productType: product.productType,
          vendor: product.vendor,
          metafieldValue: metafield.value,
          metafieldKey: metafield.key,
          metafieldNamespace: metafield.namespace
        });
      }
    });
  });

  return {
    products: glCodeProducts,
    hasNextPage: data.products.pageInfo.hasNextPage,
    endCursor: data.products.pageInfo.endCursor,
    totalFetched: products.length
  };
}

// BULK UPDATE - Much faster than individual updates (FIXED TEMP TABLE ISSUE)
async function bulkUpdateProductCategories(productsToUpdate) {
  if (productsToUpdate.length === 0) {
    return { success: true, updated: 0 };
  }

  try {
    console.log(`   💾 Bulk updating ${productsToUpdate.length} products...`);

    // Use table variable instead of temp table (more reliable)
    const updatePromises = [];
    
    // For small batches, use individual parameterized queries (safer)
    if (productsToUpdate.length <= 10) {
      for (const product of productsToUpdate) {
        const query = `
          UPDATE shopify.product
          SET shopify_category = @category,
              updated_at = GETDATE()
          WHERE id = @productId
        `;
        
        updatePromises.push(
          mssql.query(query, {
            category: product.category,
            productId: product.productId
          }).catch(err => {
            console.warn(`   ⚠️  Failed to update product ${product.productId}`);
            return null;
          })
        );
      }
      
      const results = await Promise.all(updatePromises);
      const updatedCount = results.filter(r => r !== null).length;
      console.log(`   ✅ Update complete: ${updatedCount} products updated`);
      return { success: true, updated: updatedCount };
    }

    // For larger batches, use dynamic SQL (faster but needs sanitization)
    const caseStatements = productsToUpdate.map(p => {
      const sanitizedCategory = p.category.replace(/'/g, "''");
      return `WHEN ${p.productId} THEN '${sanitizedCategory}'`;
    }).join('\n        ');

    const productIds = productsToUpdate.map(p => p.productId).join(',');

    const bulkQuery = `
      UPDATE shopify.product
      SET shopify_category = CASE id
        ${caseStatements}
      END,
      updated_at = GETDATE()
      WHERE id IN (${productIds});
      
      SELECT @@ROWCOUNT as updated_count;
    `;

    const result = await mssql.query(bulkQuery);
    
    // Get the count from the result
    let updatedCount = productsToUpdate.length; // Default to expected count
    
    if (Array.isArray(result) && result.length > 0) {
      updatedCount = result[0].updated_count || productsToUpdate.length;
    } else if (result && result.rowsAffected) {
      updatedCount = result.rowsAffected[0] || productsToUpdate.length;
    }
    
    console.log(`   ✅ Bulk update complete: ${updatedCount} products updated`);
    return { success: true, updated: updatedCount };

  } catch (error) {
    console.error('   ❌ Bulk update failed:', error.message);
    
    // Fallback to individual updates if bulk fails
    console.log('   🔄 Falling back to individual updates...');
    let updatedCount = 0;
    
    for (const product of productsToUpdate) {
      try {
        await mssql.query(`
          UPDATE shopify.product
          SET shopify_category = @category,
              updated_at = GETDATE()
          WHERE id = @productId
        `, {
          category: product.category,
          productId: product.productId
        });
        updatedCount++;
      } catch (err) {
        console.warn(`   ⚠️  Failed to update product ${product.productId}`);
      }
    }
    
    console.log(`   ✅ Fallback complete: ${updatedCount} products updated`);
    return { success: true, updated: updatedCount };
  }
}

async function ensureShopifyCategoryColumn() {
  try {
    const checkColumnQuery = `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'product' 
      AND TABLE_SCHEMA = 'shopify'
      AND COLUMN_NAME = 'shopify_category'
    `;

    const columnExists = await mssql.query(checkColumnQuery);

    if (columnExists.length === 0) {
      console.log('📝 Adding shopify_category column...');
      await mssql.query(`
        ALTER TABLE shopify.product
        ADD shopify_category NVARCHAR(500) NULL
      `);
      console.log('✅ Column added successfully');
    } else {
      console.log('✅ shopify_category column exists');
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error with column:', error.message);
    return { success: false };
  }
}

async function processSingleProduct(productId) {
  try {
    console.log('\n🎯 SINGLE PRODUCT MODE');
    console.log('═'.repeat(80));
    console.log(`Product ID: ${productId}\n`);

    // Ensure column exists
    const columnCheck = await ensureShopifyCategoryColumn();
    if (!columnCheck.success) return;

    // Fetch the product
    const products = await fetchSingleProduct(productId);
    
    if (!products || products.length === 0) {
      console.log('❌ No GL code metafields found for this product');
      return { success: false };
    }

    // Display found metafields
    console.log('\n📋 Found GL Code Metafields:');
    products.forEach(p => {
      console.log(`   • ${p.metafieldNamespace}.${p.metafieldKey} = ${p.metafieldValue}`);
    });

    // Prepare for update
    const productsToUpdate = products.map(item => ({
      productId: item.productId,
      category: item.metafieldKey === 'gl_code_name' 
        ? item.metafieldValue 
        : `GL-${item.metafieldValue}`,
      title: item.productTitle
    }));

    // Update the product
    console.log('\n📝 Updating product...');
    const updateResult = await bulkUpdateProductCategories(productsToUpdate);

    if (updateResult.success && updateResult.updated > 0) {
      console.log('\n✅ SUCCESS!');
      console.log(`   Product: ${products[0].productTitle}`);
      console.log(`   Category: ${productsToUpdate[0].category}`);
      console.log(`   Type: ${products[0].productType}`);
      console.log(`   Vendor: ${products[0].vendor}`);
    }

    return { success: true };

  } catch (error) {
    console.error('❌ Error processing single product:', error);
    return { success: false };
  }
}

async function processProductsInBatches() {
  try {
    console.log('\n🚀 FAST BATCH PROCESSING STARTED');
    console.log('═'.repeat(80));
    console.log(`⚙️  Batch Size: ${BATCH_SIZE} products per batch`);
    console.log(`⚙️  Strategy: Fetch → Bulk Update → Fetch Next → Repeat\n`);

    // Ensure column exists
    const columnCheck = await ensureShopifyCategoryColumn();
    if (!columnCheck.success) return;

    let totalProductsProcessed = 0;
    let totalProductsUpdated = 0;
    let totalGLCodesFound = 0;
    let hasNextPage = true;
    let cursor = null;
    let batchNumber = 1;

    const startTime = Date.now();

    while (hasNextPage && batchNumber <= MAX_BATCHES) {
      const batchStartTime = Date.now();
      
      console.log(`\n📦 Batch ${batchNumber}/${MAX_BATCHES}`);
      console.log('─'.repeat(40));
      
      // Step 1: Fetch batch from Shopify
      console.log(`   🔍 Fetching ${BATCH_SIZE} products from Shopify...`);
      const batchResult = await fetchProductBatch(cursor);
      
      if (batchResult.totalFetched === 0) {
        console.log('   ℹ️  No more products to fetch');
        break;
      }

      console.log(`   ✅ Fetched: ${batchResult.totalFetched} products`);
      console.log(`   🎯 Found: ${batchResult.products.length} products with GL codes`);
      
      totalProductsProcessed += batchResult.totalFetched;
      totalGLCodesFound += batchResult.products.length;

      // Step 2: Bulk update database (if we have products to update)
      if (batchResult.products.length > 0) {
        // Prepare products for bulk update
        const productsToUpdate = batchResult.products.map(item => ({
          productId: item.productId,
          category: item.metafieldKey === 'gl_code_name' 
            ? item.metafieldValue 
            : `GL-${item.metafieldValue}`,
          title: item.productTitle
        }));

        const updateResult = await bulkUpdateProductCategories(productsToUpdate);
        
        if (updateResult.success) {
          totalProductsUpdated += updateResult.updated;
        }
      } else {
        console.log('   ⏭️  No GL codes found, skipping update');
      }

      // Update pagination
      hasNextPage = batchResult.hasNextPage;
      cursor = batchResult.endCursor;
      
      const batchTime = ((Date.now() - batchStartTime) / 1000).toFixed(2);
      console.log(`   ⏱️  Batch completed in ${batchTime}s`);
      console.log(`   📊 Running Total: ${totalProductsProcessed} processed | ${totalProductsUpdated} updated`);
      
      batchNumber++;

      // Small delay to respect API limits (250ms)
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const avgTimePerBatch = (totalTime / (batchNumber - 1)).toFixed(2);

    // Final statistics
    console.log('\n🎉 PROCESSING COMPLETE!');
    console.log('═'.repeat(80));
    console.log(`📦 Total Products Processed: ${totalProductsProcessed}`);
    console.log(`🎯 Total GL Codes Found: ${totalGLCodesFound}`);
    console.log(`✅ Total Products Updated: ${totalProductsUpdated}`);
    console.log(`📊 Batches Completed: ${batchNumber - 1}`);
    console.log(`⏱️  Total Time: ${totalTime}s`);
    console.log(`⚡ Average Time per Batch: ${avgTimePerBatch}s`);
    console.log(`🚀 Processing Speed: ${(totalProductsProcessed / totalTime).toFixed(1)} products/sec`);

    // Show category distribution
    const statsQuery = `
      SELECT 
        shopify_category,
        COUNT(*) as product_count
      FROM shopify.product
      WHERE shopify_category IS NOT NULL
      GROUP BY shopify_category
      ORDER BY product_count DESC
    `;

    const stats = await mssql.query(statsQuery);
    
    if (stats.length > 0) {
      console.log('\n📊 CATEGORY DISTRIBUTION:');
      stats.slice(0, 10).forEach(row => {
        console.log(`   ${row.shopify_category}: ${row.product_count} products`);
      });
      if (stats.length > 10) {
        console.log(`   ... and ${stats.length - 10} more categories`);
      }
    }

    return { 
      success: true, 
      totalProcessed: totalProductsProcessed,
      totalUpdated: totalProductsUpdated, 
      totalGLCodes: totalGLCodesFound,
      categories: stats.length,
      totalTime: totalTime
    };

  } catch (error) {
    console.error('❌ Fatal error:', error);
    return { success: false, error: error.message };
  }
}

// Main execution
async function main() {
  // Check if a specific product ID was provided
  if (SPECIFIC_PRODUCT_ID) {
    console.log('🚀 SHOPIFY SINGLE PRODUCT SYNC');
    console.log('═'.repeat(80));
    
    const result = await processSingleProduct(SPECIFIC_PRODUCT_ID);
    
    if (result.success) {
      console.log('\n✅ Single product sync completed!');
    } else {
      console.log('\n❌ Single product sync failed');
    }
    return;
  }

  // Batch processing mode
  console.log('🚀 SHOPIFY FAST BATCH SYNC - OPTIMIZED VERSION');
  console.log('═'.repeat(80));
  console.log('Strategy: Fetch 100 → Bulk Update → Fetch Next 100 → Repeat');
  console.log('═'.repeat(80));
  console.log('\n💡 TIP: Run with specific product ID:');
  console.log('   node script.js 7897897987\n');
  
  try {
    const result = await processProductsInBatches();
    
    if (result.success) {
      console.log('\n✅ SYNC COMPLETED SUCCESSFULLY!');
      console.log(`   Processing Rate: ${(result.totalProcessed / result.totalTime).toFixed(1)} products/sec`);
    } else {
      console.log('\n❌ SYNC FAILED');
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
    process.exit(1);
  }
}

main();