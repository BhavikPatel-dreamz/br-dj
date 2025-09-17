import 'dotenv/config';
import { authenticate } from "../app/shopify.server.js";
import mssql from "../app/mssql.server.js";

/**
 * Focused script to find and extract "APEX GL Code Name" metafield
 * and update budget categories accordingly
 */

// Query to get all products with their metafields
const ALL_METAFIELDS_QUERY = `
  query getAllProductMetafields($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          title
          handle
          productType
          vendor
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

async function findApexGLCodeName() {
  try {
    console.log('🔍 Searching for "APEX GL Code Name" metafields in Shopify...\n');

    // Get Shopify admin context
    const { admin } = await authenticate.admin({
      request: new Request('http://localhost:3000')
    });

    let allMetafields = [];
    let apexGLMetafields = [];
    let hasNextPage = true;
    let cursor = null;
    let totalProducts = 0;

    while (hasNextPage && totalProducts < 100) { // Analyze first 100 products
      const variables = {
        first: 20,
        after: cursor
      };

      console.log(`Fetching products ${totalProducts + 1}-${totalProducts + 20}...`);
      
      const response = await admin.graphql(ALL_METAFIELDS_QUERY, { variables });
      const data = await response.json();

      if (data.errors) {
        console.error('GraphQL errors:', data.errors);
        break;
      }

      const products = data.data.products.edges;
      
      products.forEach(edge => {
        const product = edge.node;
        totalProducts++;
        
        product.metafields.edges.forEach(metafieldEdge => {
          const metafield = metafieldEdge.node;
          
          // Store all metafields for analysis
          allMetafields.push({
            productId: product.id,
            productTitle: product.title,
            productType: product.productType,
            vendor: product.vendor,
            namespace: metafield.namespace,
            key: metafield.key,
            value: metafield.value,
            type: metafield.type,
            description: metafield.description
          });

          // Look for APEX GL Code Name specifically
          const keyLower = metafield.key.toLowerCase();
          const namespaceLower = metafield.namespace.toLowerCase();
          
          if (keyLower.includes('apex') && (keyLower.includes('gl') || keyLower.includes('code')) ||
              keyLower === 'apex_gl_code_name' ||
              keyLower === 'apex gl code name' ||
              keyLower.includes('gl_code') ||
              namespaceLower.includes('apex')) {
            
            apexGLMetafields.push({
              productId: product.id,
              productTitle: product.title,
              productType: product.productType,
              vendor: product.vendor,
              namespace: metafield.namespace,
              key: metafield.key,
              value: metafield.value,
              type: metafield.type,
              fullKey: `${metafield.namespace}.${metafield.key}`
            });
          }
        });
      });

      hasNextPage = data.data.products.pageInfo.hasNextPage;
      cursor = data.data.products.pageInfo.endCursor;
    }

    console.log(`\n✅ Analyzed ${totalProducts} products`);
    console.log(`📊 Found ${allMetafields.length} total metafields`);

    // Show unique metafield keys for analysis
    const uniqueMetafields = {};
    allMetafields.forEach(meta => {
      const fullKey = `${meta.namespace}.${meta.key}`;
      if (!uniqueMetafields[fullKey]) {
        uniqueMetafields[fullKey] = {
          namespace: meta.namespace,
          key: meta.key,
          type: meta.type,
          count: 0,
          sampleValues: []
        };
      }
      uniqueMetafields[fullKey].count++;
      if (uniqueMetafields[fullKey].sampleValues.length < 3) {
        uniqueMetafields[fullKey].sampleValues.push(meta.value);
      }
    });

    console.log(`\n=== TOP METAFIELDS FOUND (${Object.keys(uniqueMetafields).length} unique) ===`);
    const sortedMetafields = Object.entries(uniqueMetafields)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20);

    sortedMetafields.forEach(([fullKey, data]) => {
      console.log(`${fullKey} (${data.count} products)`);
      console.log(`  Type: ${data.type}`);
      console.log(`  Sample values: ${data.sampleValues.slice(0, 2).join(', ')}`);
      console.log('---');
    });

    // Show APEX GL Code findings
    if (apexGLMetafields.length > 0) {
      console.log(`\n🎯 FOUND ${apexGLMetafields.length} APEX GL CODE METAFIELDS:`);
      apexGLMetafields.forEach((meta, index) => {
        console.log(`${index + 1}. Product: "${meta.productTitle}"`);
        console.log(`   Type: ${meta.productType}`);
        console.log(`   Vendor: ${meta.vendor}`);
        console.log(`   Metafield: ${meta.fullKey}`);
        console.log(`   Value: "${meta.value}"`);
        console.log('   ---');
      });

      return apexGLMetafields;
    } else {
      console.log('\n❌ No APEX GL Code Name metafields found.');
      
      // Show similar metafields that might be relevant
      console.log('\n🔍 SEARCHING FOR SIMILAR METAFIELDS...');
      const relevantMetafields = Object.entries(uniqueMetafields).filter(([fullKey, data]) => {
        const key = fullKey.toLowerCase();
        return key.includes('code') || 
               key.includes('gl') || 
               key.includes('category') || 
               key.includes('budget') ||
               key.includes('accounting');
      });

      if (relevantMetafields.length > 0) {
        console.log('Found potentially relevant metafields:');
        relevantMetafields.forEach(([fullKey, data]) => {
          console.log(`  ${fullKey} (${data.count} products) - Sample: ${data.sampleValues[0]}`);
        });
      } else {
        console.log('No relevant metafields found.');
      }

      return [];
    }

  } catch (error) {
    console.error('Error searching for APEX GL Code Name:', error);
    return [];
  }
}

async function createBudgetCategoriesFromApexGL(apexGLMetafields) {
  if (apexGLMetafields.length === 0) {
    console.log('\nNo APEX GL codes to process.');
    return;
  }

  try {
    console.log('\n📝 CREATING BUDGET CATEGORIES FROM APEX GL CODES...');

    // Group by GL code value
    const glCodeGroups = {};
    apexGLMetafields.forEach(meta => {
      const glCode = meta.value;
      if (!glCodeGroups[glCode]) {
        glCodeGroups[glCode] = {
          glCode: glCode,
          products: [],
          productTypes: new Set(),
          vendors: new Set()
        };
      }
      glCodeGroups[glCode].products.push(meta);
      glCodeGroups[glCode].productTypes.add(meta.productType);
      glCodeGroups[glCode].vendors.add(meta.vendor);
    });

    console.log(`Found ${Object.keys(glCodeGroups).length} unique GL codes:`);

    for (const [glCode, group] of Object.entries(glCodeGroups)) {
      const categoryName = `APEX-${glCode}`;
      const productTypesList = Array.from(group.productTypes).join(', ');
      const vendorsList = Array.from(group.vendors).join(', ');
      const description = `APEX GL Code ${glCode} - Types: ${productTypesList} - Vendors: ${vendorsList}`;
      
      console.log(`\n  GL Code: ${glCode}`);
      console.log(`    Products: ${group.products.length}`);
      console.log(`    Types: ${productTypesList}`);
      console.log(`    Vendors: ${vendorsList}`);

      // Insert or update in budget categories
      const upsertQuery = `
        MERGE brdjdb.shopify.budget_categories_master AS target
        USING (VALUES (@categoryName, @glCode, @description)) AS source (category_name, category_code, description)
        ON target.category_name = source.category_name
        WHEN MATCHED THEN
          UPDATE SET 
            description = source.description,
            updated_at = GETDATE(),
            updated_by = 'apex_gl_sync'
        WHEN NOT MATCHED THEN
          INSERT (category_name, category_code, description, sort_order, is_active, created_at, updated_at, created_by)
          VALUES (source.category_name, source.category_code, source.description, 1000, 1, GETDATE(), GETDATE(), 'apex_gl_sync');
      `;

      const params = {
        categoryName,
        glCode,
        description
      };

      await mssql.query(upsertQuery, params);
      console.log(`    ✅ Budget category "${categoryName}" updated`);
    }

    console.log(`\n🎉 Successfully processed ${Object.keys(glCodeGroups).length} APEX GL codes!`);

  } catch (error) {
    console.error('Error creating budget categories:', error);
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 APEX GL Code Name Extraction Started\n');
    
    const apexGLMetafields = await findApexGLCodeName();
    
    if (apexGLMetafields.length > 0) {
      await createBudgetCategoriesFromApexGL(apexGLMetafields);
    }
    
    console.log('\n✅ Script completed successfully!');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

main();
