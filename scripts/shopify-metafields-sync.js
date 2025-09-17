import 'dotenv/config';
import fetch from 'node-fetch';
import mssql from "../app/mssql.server.js";

/**
 * Direct Shopify GraphQL API call to fetch metafields
 * Using Admin API access token
 */

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;

// GraphQL query to get products with metafields
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
                description
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

async function makeShopifyGraphQLRequest(query, variables = {}) {
  if (!ADMIN_API_ACCESS_TOKEN) {
    throw new Error('SHOPIFY_ADMIN_API_ACCESS_TOKEN environment variable is required');
  }

  if (!SHOPIFY_STORE_URL) {
    throw new Error('SHOPIFY_APP_URL or SHOP_CUSTOM_DOMAIN environment variable is required');
  }

  // Clean up the store URL to get just the domain
  let storeDomain = SHOPIFY_STORE_URL;
  if (storeDomain.includes('://')) {
    storeDomain = storeDomain.split('://')[1];
  }
  if (storeDomain.endsWith('/')) {
    storeDomain = storeDomain.slice(0, -1);
  }

  const url = `https://${storeDomain}/admin/api/2025-01/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ADMIN_API_ACCESS_TOKEN,
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

async function fetchAllProductMetafields() {
  try {
    console.log('🔍 Fetching product metafields from Shopify GraphQL API...\n');
    
    console.log('Environment check:');
    console.log(`Store URL: ${SHOPIFY_STORE_URL ? '✅ Set' : '❌ Missing'}`);
    console.log(`Admin API Token: ${ADMIN_API_ACCESS_TOKEN ? '✅ Set' : '❌ Missing'}`);
    console.log('');

    let allProducts = [];
    let hasNextPage = true;
    let cursor = null;
    let page = 1;

    while (hasNextPage && page <= 10) { // Limit to 10 pages (250 products max)
      console.log(`📄 Fetching page ${page}...`);
      
      const variables = {
        first: 25,
        after: cursor
      };

      const data = await makeShopifyGraphQLRequest(PRODUCTS_WITH_METAFIELDS_QUERY, variables);
      const products = data.products.edges;

      products.forEach(edge => {
        allProducts.push(edge.node);
      });

      hasNextPage = data.products.pageInfo.hasNextPage;
      cursor = data.products.pageInfo.endCursor;
      page++;
      
      console.log(`   Fetched ${products.length} products (Total: ${allProducts.length})`);
      
      // Add small delay to be respectful to API limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n✅ Total products fetched: ${allProducts.length}`);

    // Analyze all metafields
    const metafieldAnalysis = {};
    const apexGLCodes = [];

    allProducts.forEach(product => {
      product.metafields.edges.forEach(metafieldEdge => {
        const metafield = metafieldEdge.node;
        const fullKey = `${metafield.namespace}.${metafield.key}`;

        // Track all metafields
        if (!metafieldAnalysis[fullKey]) {
          metafieldAnalysis[fullKey] = {
            namespace: metafield.namespace,
            key: metafield.key,
            type: metafield.type,
            count: 0,
            sampleValues: []
          };
        }
        metafieldAnalysis[fullKey].count++;
        if (metafieldAnalysis[fullKey].sampleValues.length < 3) {
          metafieldAnalysis[fullKey].sampleValues.push(metafield.value);
        }

        // Look for APEX GL Code or similar patterns
        const keyLower = metafield.key.toLowerCase();
        const namespaceLower = metafield.namespace.toLowerCase();
        const valueLower = String(metafield.value).toLowerCase();

        if (
          // Direct matches
          keyLower.includes('apex') && (keyLower.includes('gl') || keyLower.includes('code')) ||
          keyLower === 'gl_code' ||
          keyLower === 'apex_gl_code_name' ||
          keyLower === 'apex_gl_code' ||
          // Namespace matches
          namespaceLower.includes('apex') ||
          // General GL code patterns
          (keyLower.includes('gl') && keyLower.includes('code')) ||
          (keyLower.includes('budget') && keyLower.includes('code')) ||
          (keyLower.includes('account') && keyLower.includes('code'))
        ) {
          apexGLCodes.push({
            productId: product.id,
            productTitle: product.title,
            productType: product.productType,
            vendor: product.vendor,
            status: product.status,
            metafieldNamespace: metafield.namespace,
            metafieldKey: metafield.key,
            metafieldValue: metafield.value,
            metafieldType: metafield.type,
            fullKey: fullKey
          });
        }
      });
    });

    // Display results
    console.log(`\n📊 METAFIELD ANALYSIS (${Object.keys(metafieldAnalysis).length} unique metafields found)`);
    console.log('═'.repeat(80));

    const sortedMetafields = Object.entries(metafieldAnalysis)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15); // Show top 15

    sortedMetafields.forEach(([fullKey, data]) => {
      console.log(`${fullKey}`);
      console.log(`  📦 ${data.count} products | Type: ${data.type}`);
      console.log(`  📝 Samples: ${data.sampleValues.slice(0, 2).join(', ')}`);
      console.log('');
    });

    if (apexGLCodes.length > 0) {
      console.log(`\n🎯 FOUND ${apexGLCodes.length} GL CODE METAFIELDS:`);
      console.log('═'.repeat(80));
      
      apexGLCodes.forEach((item, index) => {
        console.log(`${index + 1}. "${item.productTitle}"`);
        console.log(`   🏷️  Type: ${item.productType} | Vendor: ${item.vendor}`);
        console.log(`   🔑 Metafield: ${item.fullKey}`);
        console.log(`   💼 Value: "${item.metafieldValue}"`);
        console.log('');
      });

      return apexGLCodes;
    } else {
      console.log('\n❌ No APEX GL Code metafields found');
      
      // Show potentially relevant metafields
      const relevantMetafields = Object.entries(metafieldAnalysis).filter(([fullKey]) => {
        const key = fullKey.toLowerCase();
        return key.includes('code') || 
               key.includes('gl') || 
               key.includes('category') || 
               key.includes('budget') ||
               key.includes('account');
      });

      if (relevantMetafields.length > 0) {
        console.log('\n🔍 POTENTIALLY RELEVANT METAFIELDS:');
        relevantMetafields.slice(0, 10).forEach(([fullKey, data]) => {
          console.log(`  ${fullKey} (${data.count} products)`);
          console.log(`    Sample: ${data.sampleValues[0]}`);
        });
      }

      return [];
    }

  } catch (error) {
    console.error('❌ Error fetching metafields:', error.message);
    return [];
  }
}

async function updateBudgetCategoriesFromGLCodes(glCodeMetafields) {
  if (glCodeMetafields.length === 0) {
    console.log('No GL codes to process for budget categories.');
    return;
  }

  try {
    console.log('\n📝 UPDATING BUDGET CATEGORIES FROM GL CODES...');
    console.log('═'.repeat(80));

    // Group by GL code value
    const glCodeGroups = {};
    glCodeMetafields.forEach(item => {
      const glCode = item.metafieldValue;
      if (!glCodeGroups[glCode]) {
        glCodeGroups[glCode] = {
          glCode: glCode,
          products: [],
          productTypes: new Set(),
          vendors: new Set(),
          metafieldKeys: new Set()
        };
      }
      glCodeGroups[glCode].products.push(item);
      glCodeGroups[glCode].productTypes.add(item.productType);
      glCodeGroups[glCode].vendors.add(item.vendor);
      glCodeGroups[glCode].metafieldKeys.add(item.fullKey);
    });

    console.log(`Found ${Object.keys(glCodeGroups).length} unique GL codes:`);

    for (const [glCode, group] of Object.entries(glCodeGroups)) {
      const categoryName = `GL-${glCode}`;
      const productTypes = Array.from(group.productTypes).join(', ');
      const vendors = Array.from(group.vendors).join(', ');
      const metafieldKeys = Array.from(group.metafieldKeys).join(', ');
      
      const description = `GL Code ${glCode} | Types: ${productTypes} | Vendors: ${vendors} | Source: ${metafieldKeys}`;
      
      console.log(`\n📊 GL Code: ${glCode}`);
      console.log(`   📦 Products: ${group.products.length}`);
      console.log(`   🏷️  Types: ${productTypes}`);
      console.log(`   🏢 Vendors: ${vendors}`);

      // Insert or update budget category
      const upsertQuery = `
        MERGE brdjdb.shopify.budget_categories_master AS target
        USING (VALUES (@categoryName, @glCode, @description)) AS source (category_name, category_code, description)
        ON target.category_name = source.category_name
        WHEN MATCHED THEN
          UPDATE SET 
            description = source.description,
            updated_at = GETDATE(),
            updated_by = 'shopify_gl_sync'
        WHEN NOT MATCHED THEN
          INSERT (category_name, category_code, description, sort_order, is_active, created_at, updated_at, created_by)
          VALUES (source.category_name, source.category_code, source.description, 1000, 1, GETDATE(), GETDATE(), 'shopify_gl_sync');
      `;

      await mssql.query(upsertQuery, {
        categoryName,
        glCode,
        description
      });

      console.log(`   ✅ Budget category "${categoryName}" updated`);
    }

    console.log(`\n🎉 Successfully processed ${Object.keys(glCodeGroups).length} GL codes!`);

  } catch (error) {
    console.error('❌ Error updating budget categories:', error);
  }
}

// Main execution
async function main() {
  console.log('🚀 SHOPIFY METAFIELDS TO BUDGET CATEGORIES SYNC');
  console.log('═'.repeat(80));
  
  try {
    const glCodeMetafields = await fetchAllProductMetafields();
    
    if (glCodeMetafields.length > 0) {
      await updateBudgetCategoriesFromGLCodes(glCodeMetafields);
    }
    
    console.log('\n✅ Script completed successfully!');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

main();
