import 'dotenv/config';
import { authenticate } from "../app/shopify.server.js";
import mssql from "../app/mssql.server.js";

/**
 * Script to fetch product metafields from Shopify GraphQL API
 * and update budget categories based on metadata like "APEX GL Code Name"
 */

const METAFIELDS_QUERY = `
  query getProductsWithMetafields($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          title
          handle
          productType
          vendor
          metafields(first: 20) {
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

const PRODUCT_METAFIELDS_BY_KEY_QUERY = `
  query getProductMetafieldsByKey($first: Int!, $after: String, $namespace: String!, $key: String!) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          title
          handle
          productType
          vendor
          metafield(namespace: $namespace, key: $key) {
            id
            key
            namespace
            value
            type
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

async function fetchProductMetafields() {
  try {
    console.log('Starting Shopify GraphQL metafields extraction...\n');

    // Get Shopify admin context
    const { admin } = await authenticate.admin({
      request: new Request('http://localhost:3000')
    });

    console.log('✅ Shopify admin authenticated\n');

    let allProducts = [];
    let hasNextPage = true;
    let cursor = null;
    let totalFetched = 0;

    // First, let's fetch a sample of products to see what metafields exist
    console.log('=== FETCHING SAMPLE PRODUCTS WITH METAFIELDS ===');
    
    while (hasNextPage && totalFetched < 50) { // Limit to 50 products for initial analysis
      const variables = {
        first: 10,
        after: cursor
      };

      const response = await admin.graphql(METAFIELDS_QUERY, { variables });
      const data = await response.json();

      if (data.errors) {
        console.error('GraphQL errors:', data.errors);
        break;
      }

      const products = data.data.products.edges;
      products.forEach(edge => {
        const product = edge.node;
        allProducts.push(product);
        totalFetched++;
      });

      hasNextPage = data.data.products.pageInfo.hasNextPage;
      cursor = data.data.products.pageInfo.endCursor;
      
      console.log(`Fetched ${totalFetched} products so far...`);
    }

    console.log(`\n=== ANALYSIS OF ${allProducts.length} PRODUCTS ===\n`);

    // Analyze metafields
    const metafieldSummary = {};
    const apexGLCodes = [];
    
    allProducts.forEach(product => {
      const metafields = product.metafields.edges;
      
      metafields.forEach(metafieldEdge => {
        const metafield = metafieldEdge.node;
        const key = `${metafield.namespace}.${metafield.key}`;
        
        if (!metafieldSummary[key]) {
          metafieldSummary[key] = {
            namespace: metafield.namespace,
            key: metafield.key,
            type: metafield.type,
            sampleValues: new Set(),
            count: 0
          };
        }
        
        metafieldSummary[key].count++;
        
        // Store sample values (limit to 5 samples)
        if (metafieldSummary[key].sampleValues.size < 5) {
          metafieldSummary[key].sampleValues.add(metafield.value);
        }
        
        // Look for APEX GL Code specifically
        if (metafield.key.toLowerCase().includes('apex') || 
            metafield.key.toLowerCase().includes('gl') ||
            metafield.key.toLowerCase().includes('code')) {
          apexGLCodes.push({
            productId: product.id,
            productTitle: product.title,
            productType: product.productType,
            vendor: product.vendor,
            metafieldKey: metafield.key,
            metafieldNamespace: metafield.namespace,
            metafieldValue: metafield.value,
            metafieldType: metafield.type
          });
        }
      });
    });

    // Display metafield summary
    console.log('=== ALL METAFIELDS FOUND ===');
    Object.keys(metafieldSummary).forEach(key => {
      const meta = metafieldSummary[key];
      console.log(`${key}:`);
      console.log(`  Type: ${meta.type}`);
      console.log(`  Count: ${meta.count} products`);
      console.log(`  Sample values: ${Array.from(meta.sampleValues).slice(0, 3).join(', ')}`);
      console.log('---');
    });

    // Display APEX GL Codes if found
    if (apexGLCodes.length > 0) {
      console.log('\n=== APEX GL CODE METAFIELDS FOUND ===');
      apexGLCodes.forEach(item => {
        console.log(`Product: "${item.productTitle}"`);
        console.log(`  Type: ${item.productType}`);
        console.log(`  Vendor: ${item.vendor}`);
        console.log(`  Metafield: ${item.metafieldNamespace}.${item.metafieldKey}`);
        console.log(`  Value: "${item.metafieldValue}"`);
        console.log('---');
      });
    } else {
      console.log('\n❌ No APEX GL Code metafields found in the sample');
    }

    // Now let's search specifically for common GL code patterns
    console.log('\n=== SEARCHING FOR SPECIFIC GL CODE PATTERNS ===');
    const glPatterns = ['gl_code', 'apex_gl', 'accounting_code', 'budget_code', 'category_code'];
    
    for (const pattern of glPatterns) {
      console.log(`\nSearching for metafields containing: "${pattern}"`);
      
      // Search in custom namespace
      const customNamespaces = ['custom', 'app', 'global', 'system'];
      
      for (const namespace of customNamespaces) {
        try {
          const variables = {
            first: 5,
            namespace: namespace,
            key: pattern
          };

          const response = await admin.graphql(PRODUCT_METAFIELDS_BY_KEY_QUERY, { variables });
          const data = await response.json();

          if (!data.errors && data.data.products.edges.length > 0) {
            console.log(`  ✅ Found metafield: ${namespace}.${pattern}`);
            data.data.products.edges.forEach(edge => {
              const product = edge.node;
              if (product.metafield) {
                console.log(`    Product: "${product.title}" -> Value: "${product.metafield.value}"`);
              }
            });
          }
        } catch (error) {
          // Continue searching other patterns
        }
      }
    }

    return {
      totalProducts: allProducts.length,
      metafieldSummary,
      apexGLCodes
    };

  } catch (error) {
    console.error('Error fetching metafields from Shopify:', error);
    throw error;
  }
}

async function updateBudgetCategoriesFromMetafields(metafieldsData) {
  try {
    console.log('\n=== UPDATING BUDGET CATEGORIES FROM METAFIELDS ===');
    
    if (metafieldsData.apexGLCodes.length === 0) {
      console.log('No APEX GL codes found to update budget categories.');
      return;
    }

    // Group by GL code value
    const glCodeGroups = {};
    metafieldsData.apexGLCodes.forEach(item => {
      const code = item.metafieldValue;
      if (!glCodeGroups[code]) {
        glCodeGroups[code] = {
          glCode: code,
          products: [],
          productTypes: new Set()
        };
      }
      glCodeGroups[code].products.push(item);
      glCodeGroups[code].productTypes.add(item.productType);
    });

    // Insert/Update budget categories based on GL codes
    for (const [glCode, group] of Object.entries(glCodeGroups)) {
      const categoryName = `GL-${glCode}`;
      const description = `Budget category for GL Code ${glCode} - Product types: ${Array.from(group.productTypes).join(', ')}`;
      
      const insertQuery = `
        IF NOT EXISTS (SELECT 1 FROM brdjdb.shopify.budget_categories_master WHERE category_name = @categoryName)
        BEGIN
          INSERT INTO brdjdb.shopify.budget_categories_master 
          (category_name, category_code, description, sort_order, is_active, created_at, updated_at, created_by)
          VALUES 
          (@categoryName, @glCode, @description, 999, 1, GETDATE(), GETDATE(), 'shopify_metafield_sync')
        END
        ELSE
        BEGIN
          UPDATE brdjdb.shopify.budget_categories_master 
          SET description = @description, updated_at = GETDATE(), updated_by = 'shopify_metafield_sync'
          WHERE category_name = @categoryName
        END
      `;

      const params = {
        categoryName,
        glCode,
        description
      };

      await mssql.query(insertQuery, params);
      console.log(`✅ Updated budget category: "${categoryName}" for ${group.products.length} products`);
    }

  } catch (error) {
    console.error('Error updating budget categories:', error);
  }
}

// Main execution
async function main() {
  try {
    const metafieldsData = await fetchProductMetafields();
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total products analyzed: ${metafieldsData.totalProducts}`);
    console.log(`Total metafield types found: ${Object.keys(metafieldsData.metafieldSummary).length}`);
    console.log(`APEX GL codes found: ${metafieldsData.apexGLCodes.length}`);
    
    if (metafieldsData.apexGLCodes.length > 0) {
      await updateBudgetCategoriesFromMetafields(metafieldsData);
    }
    
  } catch (error) {
    console.error('Script failed:', error);
  }
}

main();
