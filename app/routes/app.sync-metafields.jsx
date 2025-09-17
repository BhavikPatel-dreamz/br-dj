import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import mssql from "../mssql.server.js";

/**
 * Shopify Route to fetch metafields and update budget categories
 * Access via: GET /app/sync-metafields
 */

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

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    console.log('🔍 Starting metafields sync...');
    
    let allProducts = [];
    let hasNextPage = true;
    let cursor = null;
    let page = 1;

    // Fetch products with metafields
    while (hasNextPage && page <= 10) { // Limit to 10 pages
      console.log(`📄 Fetching page ${page}...`);
      
      const response = await admin.graphql(PRODUCTS_WITH_METAFIELDS_QUERY, {
        variables: {
          first: 25,
          after: cursor
        }
      });

      const data = await response.json();
      
      if (data.errors) {
        console.error('GraphQL errors:', data.errors);
        break;
      }

      const products = data.data.products.edges;
      products.forEach(edge => {
        allProducts.push(edge.node);
      });

      hasNextPage = data.data.products.pageInfo.hasNextPage;
      cursor = data.data.products.pageInfo.endCursor;
      page++;
    }

    console.log(`✅ Fetched ${allProducts.length} products`);

    // Analyze metafields
    const metafieldAnalysis = {};
    const glCodeMetafields = [];

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

        // Look for GL Code patterns
        const keyLower = metafield.key.toLowerCase();
        const namespaceLower = metafield.namespace.toLowerCase();

        if (
          keyLower.includes('apex') && (keyLower.includes('gl') || keyLower.includes('code')) ||
          keyLower === 'gl_code' ||
          keyLower === 'apex_gl_code_name' ||
          keyLower === 'apex_gl_code' ||
          namespaceLower.includes('apex') ||
          (keyLower.includes('gl') && keyLower.includes('code')) ||
          (keyLower.includes('budget') && keyLower.includes('code')) ||
          (keyLower.includes('account') && keyLower.includes('code'))
        ) {
          glCodeMetafields.push({
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

    // Update budget categories if GL codes found
    let budgetCategoriesUpdated = 0;
    
    if (glCodeMetafields.length > 0) {
      console.log(`🎯 Found ${glCodeMetafields.length} GL code metafields`);
      
      // Group by GL code value
      const glCodeGroups = {};
      glCodeMetafields.forEach(item => {
        const glCode = item.metafieldValue;
        if (!glCodeGroups[glCode]) {
          glCodeGroups[glCode] = {
            glCode: glCode,
            products: [],
            productTypes: new Set(),
            vendors: new Set()
          };
        }
        glCodeGroups[glCode].products.push(item);
        glCodeGroups[glCode].productTypes.add(item.productType);
        glCodeGroups[glCode].vendors.add(item.vendor);
      });

      // Update budget categories
      for (const [glCode, group] of Object.entries(glCodeGroups)) {
        const categoryName = `GL-${glCode}`;
        const productTypes = Array.from(group.productTypes).join(', ');
        const vendors = Array.from(group.vendors).join(', ');
        const description = `GL Code ${glCode} | Types: ${productTypes} | Vendors: ${vendors} | Source: Shopify Metafields`;
        
        const upsertQuery = `
          MERGE brdjdb.shopify.budget_categories_master AS target
          USING (VALUES (@categoryName, @glCode, @description)) AS source (category_name, category_code, description)
          ON target.category_name = source.category_name
          WHEN MATCHED THEN
            UPDATE SET 
              description = source.description,
              updated_at = GETDATE(),
              updated_by = 'shopify_metafield_sync'
          WHEN NOT MATCHED THEN
            INSERT (category_name, category_code, description, sort_order, is_active, created_at, updated_at, created_by)
            VALUES (source.category_name, source.category_code, source.description, 1000, 1, GETDATE(), GETDATE(), 'shopify_metafield_sync');
        `;

        try {
          await mssql.query(upsertQuery, {
            categoryName,
            glCode,
            description
          });
          budgetCategoriesUpdated++;
          console.log(`✅ Updated budget category: ${categoryName}`);
        } catch (error) {
          console.error(`❌ Failed to update budget category ${categoryName}:`, error);
        }
      }
    }

    // Return results
    const result = {
      success: true,
      totalProducts: allProducts.length,
      totalMetafieldTypes: Object.keys(metafieldAnalysis).length,
      glCodeMetafieldsFound: glCodeMetafields.length,
      budgetCategoriesUpdated,
      metafieldSummary: Object.entries(metafieldAnalysis)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20)
        .map(([fullKey, data]) => ({
          fullKey,
          namespace: data.namespace,
          key: data.key,
          type: data.type,
          productCount: data.count,
          sampleValues: data.sampleValues.slice(0, 2)
        })),
      glCodeDetails: glCodeMetafields.map(item => ({
        productTitle: item.productTitle,
        productType: item.productType,
        vendor: item.vendor,
        metafieldKey: item.fullKey,
        glCodeValue: item.metafieldValue
      }))
    };

    console.log('🎉 Metafields sync completed successfully');
    
    return json(result);

  } catch (error) {
    console.error('❌ Error in metafields sync:', error);
    
    return json({
      success: false,
      error: error.message,
      totalProducts: 0,
      totalMetafieldTypes: 0,
      glCodeMetafieldsFound: 0,
      budgetCategoriesUpdated: 0,
      metafieldSummary: [],
      glCodeDetails: []
    }, { status: 500 });
  }
};

export default function SyncMetafields() {
  return null; // This is an API route, no UI needed
}
