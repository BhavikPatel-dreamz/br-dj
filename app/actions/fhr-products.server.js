import mssql from "../mssql.server.js";

/**
 * FHR Products Actions
 * Handles Full Historical Records operations for Shopify products
 */

/**
 * Get products with comprehensive FHR schema
 * @param {Object} filters - Filter criteria
 * @param {string} filters.productId - Product ID filter
 * @param {string} filters.handle - Product handle filter
 * @param {string} filters.vendor - Vendor filter
 * @param {string} filters.productType - Product type filter
 * @param {string} filters.status - Product status filter (active, draft, archived)
 * @param {boolean} filters.isGiftCard - Filter for gift cards
 * @param {boolean} filters.hasVariants - Filter products with/without variants
 * @param {string} filters.title - Product title search (partial match)
 * @param {number} limit - Number of records to return (default: 100)
 * @param {number} offset - Number of records to skip (default: 0)
 * @returns {Promise<Array>} Array of product objects with full FHR schema
 */
export async function getProducts(filters = {}, limit = 100, offset = 0) {
  try {
    const conditions = [];
    const params = {};
    
    // Build dynamic WHERE conditions with parameters
    if (filters.productId) {
      conditions.push('p.id = @productId');
      params.productId = filters.productId;
    }
    if (filters.handle) {
      conditions.push('p.handle = @handle');
      params.handle = filters.handle;
    }
    if (filters.vendor) {
      conditions.push('p.vendor = @vendor');
      params.vendor = filters.vendor;
    }
    if (filters.productType) {
      conditions.push('p.product_type = @productType');
      params.productType = filters.productType;
    }
    if (filters.status) {
      conditions.push('p.status = @status');
      params.status = filters.status;
    }
    if (filters.isGiftCard !== undefined) {
      conditions.push('p.is_gift_card = @isGiftCard');
      params.isGiftCard = filters.isGiftCard ? 1 : 0;
    }
    if (filters.hasVariants !== undefined) {
      conditions.push('p.has_only_default_variant = @hasOnlyDefaultVariant');
      params.hasOnlyDefaultVariant = filters.hasVariants ? 0 : 1;
    }
    if (filters.title) {
      conditions.push('p.title LIKE @titleSearch');
      params.titleSearch = `%${filters.title}%`;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        p.id,
        p.featured_media_id,
        p.compare_at_price_range_max_variant_compare_at_price_amount,
        p.compare_at_price_range_max_variant_compare_at_price_currency_code,
        p.compare_at_price_range_min_variant_compare_at_price_amount,
        p.compare_at_price_range_min_variant_compare_at_price_currency_code,
        p.created_at,
        p.description,
        p.description_html,
        p.gift_card_template_suffix,
        p.handle,
        p.has_only_default_variant,
        p.has_out_of_stock_variants,
        p.has_variants_that_requires_components,
        p.is_gift_card,
        p.legacy_resource_id,
        p.metafield,
        p.online_store_preview_url,
        p.max_variant_price_amount,
        p.max_variant_price_currency_code,
        p.min_variant_price_amount,
        p.min_variant_price_currency_code,
        p.product_type,
        p.published_at,
        p.requires_selling_plan,
        p.seo_description,
        p.seo_title,
        p.status,
        p.template_suffix,
        p.title,
        p.total_inventory,
        p.tracks_inventory,
        p.updated_at,
        p.vendor,
        p._fivetran_deleted,
        p._fivetran_synced
      FROM brdjdb.shopify.product AS p
      ${whereClause}
      ORDER BY p.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    // Add pagination parameters
    params.offset = offset;
    params.limit = limit;

    const products = await mssql.query(query, params);
    return products;
  } catch (error) {
    console.error("Error fetching FHR products:", error);
    throw new Error(`Failed to fetch products: ${error.message}`);
  }
}

/**
 * Get a single product by ID with full FHR schema
 * @param {string} productId - The product ID
 * @returns {Promise<Object|null>} Product object or null if not found
 */
export async function getProductById(productId) {
  try {
    const query = `
      SELECT 
        p.id,
        p.featured_media_id,
        p.compare_at_price_range_max_variant_compare_at_price_amount,
        p.compare_at_price_range_max_variant_compare_at_price_currency_code,
        p.compare_at_price_range_min_variant_compare_at_price_amount,
        p.compare_at_price_range_min_variant_compare_at_price_currency_code,
        p.created_at,
        p.description,
        p.description_html,
        p.gift_card_template_suffix,
        p.handle,
        p.has_only_default_variant,
        p.has_out_of_stock_variants,
        p.has_variants_that_requires_components,
        p.is_gift_card,
        p.legacy_resource_id,
        p.metafield,
        p.online_store_preview_url,
        p.max_variant_price_amount,
        p.max_variant_price_currency_code,
        p.min_variant_price_amount,
        p.min_variant_price_currency_code,
        p.product_type,
        p.published_at,
        p.requires_selling_plan,
        p.seo_description,
        p.seo_title,
        p.status,
        p.template_suffix,
        p.title,
        p.total_inventory,
        p.tracks_inventory,
        p.updated_at,
        p.vendor,
        p._fivetran_deleted,
        p._fivetran_synced
      FROM brdjdb.shopify.product AS p
      WHERE p.id = @productId
    `;

    const products = await mssql.query(query, { productId });
    return products.length > 0 ? products[0] : null;
  } catch (error) {
    console.error(`Error fetching product ${productId}:`, error);
    throw new Error(`Failed to fetch product: ${error.message}`);
  }
}

/**
 * Get product by handle
 * @param {string} handle - Product handle
 * @returns {Promise<Object|null>} Product object or null if not found
 */
export async function getProductByHandle(handle) {
  try {
    const products = await getProducts({ handle }, 1, 0);
    return products.length > 0 ? products[0] : null;
  } catch (error) {
    console.error(`Error fetching product by handle ${handle}:`, error);
    throw error;
  }
}

/**
 * Get products by vendor
 * @param {string} vendor - Vendor name
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of products for the vendor
 */
export async function getProductsByVendor(vendor, limit = 100, offset = 0) {
  return await getProducts({ vendor }, limit, offset);
}

/**
 * Get products by type
 * @param {string} productType - Product type
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of products of the specified type
 */
export async function getProductsByType(productType, limit = 100, offset = 0) {
  return await getProducts({ productType }, limit, offset);
}

/**
 * Get products by status
 * @param {string} status - Product status (active, draft, archived)
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of products with the specified status
 */
export async function getProductsByStatus(status, limit = 100, offset = 0) {
  return await getProducts({ status }, limit, offset);
}

/**
 * Get gift card products
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of gift card products
 */
export async function getGiftCardProducts(limit = 100, offset = 0) {
  return await getProducts({ isGiftCard: true }, limit, offset);
}

/**
 * Search products by title
 * @param {string} titleQuery - Search term for product title
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of products matching the title search
 */
export async function searchProductsByTitle(titleQuery, limit = 100, offset = 0) {
  return await getProducts({ title: titleQuery }, limit, offset);
}

/**
 * Get products count based on filters
 * @param {Object} filters - Filter criteria (same as getProducts)
 * @returns {Promise<number>} Total count of products matching filters
 */
export async function getProductsCount(filters = {}) {
  try {
    const conditions = [];
    const params = {};
    
    // Build dynamic WHERE conditions (same logic as getProducts)
    if (filters.productId) {
      conditions.push('p.id = @productId');
      params.productId = filters.productId;
    }
    if (filters.handle) {
      conditions.push('p.handle = @handle');
      params.handle = filters.handle;
    }
    if (filters.vendor) {
      conditions.push('p.vendor = @vendor');
      params.vendor = filters.vendor;
    }
    if (filters.productType) {
      conditions.push('p.product_type = @productType');
      params.productType = filters.productType;
    }
    if (filters.status) {
      conditions.push('p.status = @status');
      params.status = filters.status;
    }
    if (filters.isGiftCard !== undefined) {
      conditions.push('p.is_gift_card = @isGiftCard');
      params.isGiftCard = filters.isGiftCard ? 1 : 0;
    }
    if (filters.hasVariants !== undefined) {
      conditions.push('p.has_only_default_variant = @hasOnlyDefaultVariant');
      params.hasOnlyDefaultVariant = filters.hasVariants ? 0 : 1;
    }
    if (filters.title) {
      conditions.push('p.title LIKE @titleSearch');
      params.titleSearch = `%${filters.title}%`;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT COUNT(*) as total_count
      FROM brdjdb.shopify.product AS p
      ${whereClause}
    `;

    const result = await mssql.query(query, params);
    return result[0]?.total_count || 0;
  } catch (error) {
    console.error("Error getting products count:", error);
    throw new Error(`Failed to get products count: ${error.message}`);
  }
}

/**
 * Get product inventory statistics
 * @param {string} productId - Product ID (optional, if not provided gets overall stats)
 * @returns {Promise<Object>} Inventory statistics
 */
export async function getProductInventoryStats(productId = null) {
  try {
    let query;
    let params = {};

    if (productId) {
      query = `
        SELECT 
          COUNT(*) as total_products,
          SUM(CASE WHEN p.total_inventory > 0 THEN 1 ELSE 0 END) as in_stock_products,
          SUM(CASE WHEN p.total_inventory = 0 THEN 1 ELSE 0 END) as out_of_stock_products,
          SUM(p.total_inventory) as total_inventory,
          AVG(p.total_inventory) as average_inventory,
          MAX(p.total_inventory) as max_inventory,
          MIN(p.total_inventory) as min_inventory
        FROM brdjdb.shopify.product AS p
        WHERE p.id = @productId
      `;
      params.productId = productId;
    } else {
      query = `
        SELECT 
          COUNT(*) as total_products,
          SUM(CASE WHEN p.total_inventory > 0 THEN 1 ELSE 0 END) as in_stock_products,
          SUM(CASE WHEN p.total_inventory = 0 THEN 1 ELSE 0 END) as out_of_stock_products,
          SUM(p.total_inventory) as total_inventory,
          AVG(p.total_inventory) as average_inventory,
          MAX(p.total_inventory) as max_inventory,
          MIN(p.total_inventory) as min_inventory,
          COUNT(DISTINCT p.vendor) as unique_vendors,
          COUNT(DISTINCT p.product_type) as unique_product_types
        FROM brdjdb.shopify.product AS p
        WHERE p._fivetran_deleted = 0
      `;
    }

    const result = await mssql.query(query, params);
    return result[0] || {};
  } catch (error) {
    console.error("Error getting product inventory stats:", error);
    throw new Error(`Failed to get product inventory stats: ${error.message}`);
  }
}

/**
 * Get products with low inventory
 * @param {number} threshold - Inventory threshold (default: 10)
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of products with inventory below threshold
 */
export async function getLowInventoryProducts(threshold = 10, limit = 100, offset = 0) {
  try {
    const query = `
      SELECT 
        p.id,
        p.title,
        p.handle,
        p.vendor,
        p.product_type,
        p.total_inventory,
        p.status,
        p.created_at,
        p.updated_at
      FROM brdjdb.shopify.product AS p
      WHERE p.total_inventory <= @threshold 
        AND p.total_inventory >= 0
        AND p._fivetran_deleted = 0
      ORDER BY p.total_inventory ASC, p.updated_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const products = await mssql.query(query, { 
      threshold, 
      offset, 
      limit 
    });
    return products;
  } catch (error) {
    console.error("Error fetching low inventory products:", error);
    throw new Error(`Failed to fetch low inventory products: ${error.message}`);
  }
}

/**
 * Get all unique vendors
 * @returns {Promise<Array>} Array of unique vendor names
 */
export async function getUniqueVendors() {
  try {
    const query = `
      SELECT DISTINCT p.vendor
      FROM brdjdb.shopify.product AS p
      WHERE p.vendor IS NOT NULL 
        AND p.vendor != ''
        AND p._fivetran_deleted = 0
      ORDER BY p.vendor ASC
    `;

    const result = await mssql.query(query);
    return result.map(row => row.vendor);
  } catch (error) {
    console.error("Error fetching unique vendors:", error);
    throw new Error(`Failed to fetch unique vendors: ${error.message}`);
  }
}

/**
 * Get all unique product types
 * @returns {Promise<Array>} Array of unique product types
 */
export async function getUniqueProductTypes() {
  try {
    const query = `
      SELECT DISTINCT p.product_type
      FROM brdjdb.shopify.product AS p
      WHERE p.product_type IS NOT NULL 
        AND p.product_type != ''
        AND p._fivetran_deleted = 0
      ORDER BY p.product_type ASC
    `;

    const result = await mssql.query(query);
    return result.map(row => row.product_type);
  } catch (error) {
    console.error("Error fetching unique product types:", error);
    throw new Error(`Failed to fetch unique product types: ${error.message}`);
  }
}
