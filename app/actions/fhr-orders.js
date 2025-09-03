import mssql from "../mssql.server.js";

/**
 * FHR Orders Actions
 * Handles Full Historical Records operations for Shopify orders
 */

/**
 * Get orders with comprehensive FHR schema
 * @param {Object} filters - Filter criteria
 * @param {string} filters.customerId - Customer ID filter
 * @param {string} filters.companyId - Company ID filter
 * @param {string} filters.locationId - Location ID filter
 * @param {string} filters.companyLocationId - Company Location ID filter
 * @param {string} filters.orderId - Order ID filter
 * @param {string} filters.orderNumber - Order number filter
 * @param {string} filters.financialStatus - Financial status filter
 * @param {string} filters.fulfillmentStatus - Fulfillment status filter
 * @param {number} limit - Number of records to return (default: 100)
 * @param {number} offset - Number of records to skip (default: 0)
 * @returns {Promise<Array>} Array of order objects with full FHR schema
 */
export async function getOrders(filters = {}, limit = 100, offset = 0) {
  try {
    const conditions = [];
    const params = {};
    
    // Build dynamic WHERE conditions with parameters
    if (filters.customerId) {
      conditions.push('o.customer_id = @customerId');
      params.customerId = filters.customerId;
    }
    if (filters.companyId) {
      conditions.push('o.company_id = @companyId');
      params.companyId = filters.companyId;
    }
    if (filters.locationId) {
      conditions.push('o.location_id = @locationId');
      params.locationId = filters.locationId;
    }
    if (filters.companyLocationId) {
      conditions.push('o.company_location_id = @companyLocationId');
      params.companyLocationId = filters.companyLocationId;
    }
    if (filters.orderId) {
      conditions.push('o.id = @orderId');
      params.orderId = filters.orderId;
    }
    if (filters.orderNumber) {
      conditions.push('o.order_number = @orderNumber');
      params.orderNumber = filters.orderNumber;
    }
    if (filters.financialStatus) {
      conditions.push('o.financial_status = @financialStatus');
      params.financialStatus = filters.financialStatus;
    }
    if (filters.fulfillmentStatus) {
      conditions.push('o.fulfillment_status = @fulfillmentStatus');
      params.fulfillmentStatus = filters.fulfillmentStatus;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        o.id,
        o.note,
        o.email,
        o.taxes_included,
        o.currency,
        o.subtotal_price,
        o.subtotal_price_set,
        o.total_tax,
        o.total_tax_set,
        o.total_price,
        o.total_price_set,
        o.created_at,
        o.updated_at,
        o.name,
        o.shipping_address_name,
        o.shipping_address_first_name,
        o.shipping_address_last_name,
        o.shipping_address_company,
        o.shipping_address_phone,
        o.shipping_address_address_1,
        o.shipping_address_address_2,
        o.shipping_address_city,
        o.shipping_address_country,
        o.shipping_address_country_code,
        o.shipping_address_province,
        o.shipping_address_province_code,
        o.shipping_address_zip,
        o.shipping_address_latitude,
        o.shipping_address_longitude,
        o.billing_address_name,
        o.billing_address_first_name,
        o.billing_address_last_name,
        o.billing_address_company,
        o.billing_address_phone,
        o.billing_address_address_1,
        o.billing_address_address_2,
        o.billing_address_city,
        o.billing_address_country,
        o.billing_address_country_code,
        o.billing_address_province,
        o.billing_address_province_code,
        o.billing_address_zip,
        o.billing_address_latitude,
        o.billing_address_longitude,
        o.customer_id,
        o.location_id,
        o.user_id,
        o.company_id,
        o.company_location_id,
        o.app_id,
        o.number,
        o.order_number,
        o.financial_status,
        o.fulfillment_status,
        o.processed_at,
        o.referring_site,
        o.cancel_reason,
        o.cancelled_at,
        o.closed_at,
        o.total_discounts,
        o.total_tip_received,
        o.current_total_price,
        o.current_total_discounts,
        o.current_subtotal_price,
        o.current_total_tax,
        o.current_total_discounts_set,
        o.current_total_duties_set,
        o.current_total_price_set,
        o.current_subtotal_price_set,
        o.current_total_tax_set,
        o.total_discounts_set,
        o.total_shipping_price_set,
        o.total_line_items_price,
        o.total_line_items_price_set,
        o.original_total_duties_set,
        o.total_weight,
        o.source_name,
        o.browser_ip,
        o.buyer_accepts_marketing,
        o.confirmed,
        o.token,
        o.cart_token,
        o.checkout_token,
        o.checkout_id,
        o.customer_locale,
        o.device_id,
        o.landing_site_ref,
        o.presentment_currency,
        o.reference,
        o.source_identifier,
        o.source_url,
        o._fivetran_deleted,
        o.order_status_url,
        o.test,
        o.payment_gateway_names,
        o.note_attributes,
        o.client_details_user_agent,
        o.landing_site_base_url,
        o._fivetran_synced
      FROM brdjdb.shopify.[order] AS o
      ${whereClause}
      ORDER BY o.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    // Add pagination parameters
    params.offset = offset;
    params.limit = limit;

    const orders = await mssql.query(query, params);
    return orders;
  } catch (error) {
    console.error("Error fetching FHR orders:", error);
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }
}

/**
 * Get a single order by ID with full FHR schema
 * @param {string} orderId - The order ID
 * @returns {Promise<Object|null>} Order object or null if not found
 */
export async function getOrderById(orderId) {
  try {
    const query = `
      SELECT 
        o.id,
        o.note,
        o.email,
        o.taxes_included,
        o.currency,
        o.subtotal_price,
        o.subtotal_price_set,
        o.total_tax,
        o.total_tax_set,
        o.total_price,
        o.total_price_set,
        o.created_at,
        o.updated_at,
        o.name,
        o.shipping_address_name,
        o.shipping_address_first_name,
        o.shipping_address_last_name,
        o.shipping_address_company,
        o.shipping_address_phone,
        o.shipping_address_address_1,
        o.shipping_address_address_2,
        o.shipping_address_city,
        o.shipping_address_country,
        o.shipping_address_country_code,
        o.shipping_address_province,
        o.shipping_address_province_code,
        o.shipping_address_zip,
        o.shipping_address_latitude,
        o.shipping_address_longitude,
        o.billing_address_name,
        o.billing_address_first_name,
        o.billing_address_last_name,
        o.billing_address_company,
        o.billing_address_phone,
        o.billing_address_address_1,
        o.billing_address_address_2,
        o.billing_address_city,
        o.billing_address_country,
        o.billing_address_country_code,
        o.billing_address_province,
        o.billing_address_province_code,
        o.billing_address_zip,
        o.billing_address_latitude,
        o.billing_address_longitude,
        o.customer_id,
        o.location_id,
        o.user_id,
        o.company_id,
        o.company_location_id,
        o.app_id,
        o.number,
        o.order_number,
        o.financial_status,
        o.fulfillment_status,
        o.processed_at,
        o.referring_site,
        o.cancel_reason,
        o.cancelled_at,
        o.closed_at,
        o.total_discounts,
        o.total_tip_received,
        o.current_total_price,
        o.current_total_discounts,
        o.current_subtotal_price,
        o.current_total_tax,
        o.current_total_discounts_set,
        o.current_total_duties_set,
        o.current_total_price_set,
        o.current_subtotal_price_set,
        o.current_total_tax_set,
        o.total_discounts_set,
        o.total_shipping_price_set,
        o.total_line_items_price,
        o.total_line_items_price_set,
        o.original_total_duties_set,
        o.total_weight,
        o.source_name,
        o.browser_ip,
        o.buyer_accepts_marketing,
        o.confirmed,
        o.token,
        o.cart_token,
        o.checkout_token,
        o.checkout_id,
        o.customer_locale,
        o.device_id,
        o.landing_site_ref,
        o.presentment_currency,
        o.reference,
        o.source_identifier,
        o.source_url,
        o._fivetran_deleted,
        o.order_status_url,
        o.test,
        o.payment_gateway_names,
        o.note_attributes,
        o.client_details_user_agent,
        o.landing_site_base_url,
        o._fivetran_synced
      FROM brdjdb.shopify.[order] AS o
      WHERE o.id = @orderId
    `;

    const orders = await mssql.query(query, { orderId });
    return orders.length > 0 ? orders[0] : null;
  } catch (error) {
    console.error(`Error fetching order ${orderId}:`, error);
    throw new Error(`Failed to fetch order: ${error.message}`);
  }
}

/**
 * Get order count based on filters
 * @param {Object} filters - Filter criteria (same as getOrders)
 * @returns {Promise<number>} Total count of orders matching filters
 */
export async function getOrdersCount(filters = {}) {
  try {
    const conditions = [];
    const params = {};
    
    // Build dynamic WHERE conditions (same logic as getOrders)
    if (filters.customerId) {
      conditions.push('o.customer_id = @customerId');
      params.customerId = filters.customerId;
    }
    if (filters.companyId) {
      conditions.push('o.company_id = @companyId');
      params.companyId = filters.companyId;
    }
    if (filters.locationId) {
      conditions.push('o.location_id = @locationId');
      params.locationId = filters.locationId;
    }
    if (filters.companyLocationId) {
      conditions.push('o.company_location_id = @companyLocationId');
      params.companyLocationId = filters.companyLocationId;
    }
    if (filters.orderId) {
      conditions.push('o.id = @orderId');
      params.orderId = filters.orderId;
    }
    if (filters.orderNumber) {
      conditions.push('o.order_number = @orderNumber');
      params.orderNumber = filters.orderNumber;
    }
    if (filters.financialStatus) {
      conditions.push('o.financial_status = @financialStatus');
      params.financialStatus = filters.financialStatus;
    }
    if (filters.fulfillmentStatus) {
      conditions.push('o.fulfillment_status = @fulfillmentStatus');
      params.fulfillmentStatus = filters.fulfillmentStatus;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT COUNT(*) as total_count
      FROM brdjdb.shopify.[order] AS o
      ${whereClause}
    `;

    const result = await mssql.query(query, params);
    return result[0]?.total_count || 0;
  } catch (error) {
    console.error("Error getting orders count:", error);
    throw new Error(`Failed to get orders count: ${error.message}`);
  }
}

/**
 * Get orders by customer ID with pagination
 * @param {string} customerId - Customer ID
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of orders for the customer
 */
export async function getOrdersByCustomerId(customerId, limit = 100, offset = 0) {
  return await getOrders({ customerId }, limit, offset);
}

/**
 * Get orders by company ID with pagination
 * @param {string} companyId - Company ID
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of orders for the company
 */
export async function getOrdersByCompanyId(companyId, limit = 100, offset = 0) {
  return await getOrders({ companyId }, limit, offset);
}

/**
 * Get orders by financial status
 * @param {string} financialStatus - Financial status (e.g., 'paid', 'pending', 'refunded')
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of orders with the specified financial status
 */
export async function getOrdersByFinancialStatus(financialStatus, limit = 100, offset = 0) {
  return await getOrders({ financialStatus }, limit, offset);
}

/**
 * Get orders by fulfillment status
 * @param {string} fulfillmentStatus - Fulfillment status (e.g., 'fulfilled', 'unfulfilled', 'partial')
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of orders with the specified fulfillment status
 */
export async function getOrdersByFulfillmentStatus(fulfillmentStatus, limit = 100, offset = 0) {
  return await getOrders({ fulfillmentStatus }, limit, offset);
}

/**
 * Search orders by order number
 * @param {string} orderNumber - Order number to search for
 * @returns {Promise<Object|null>} Order object or null if not found
 */
export async function getOrderByOrderNumber(orderNumber) {
  try {
    const orders = await getOrders({ orderNumber }, 1, 0);
    return orders.length > 0 ? orders[0] : null;
  } catch (error) {
    console.error(`Error fetching order by number ${orderNumber}:`, error);
    throw error;
  }
}

/**
 * Get monthly order products summary with aggregated data
 * @param {Object} filters - Filter criteria
 * @param {string} filters.customerId - Customer ID filter
 * @param {string} filters.locationId - Location ID filter
 * @param {string} filters.companyLocationId - Company Location ID filter
 * @param {string} filters.month - Month (01-12)
 * @param {string} filters.year - Year (YYYY)
 * @returns {Promise<Object>} Object containing products array and summary totals
 */
export async function getMonthlyOrderProducts(filters = {}) {
  try {
    const conditions = [];
    const params = {};
    
    // Build dynamic WHERE conditions for orders
    if (filters.customerId) {
      conditions.push('o.customer_id = @customerId');
      params.customerId = filters.customerId;
    }
    if (filters.locationId) {
      conditions.push('o.location_id = @locationId');
      params.locationId = filters.locationId;
    }
    if (filters.companyLocationId) {
      conditions.push('o.company_location_id = @companyLocationId');
      params.companyLocationId = filters.companyLocationId;
    }

    // Add date filters for the specified month/year
    if (filters.month && filters.year) {
      conditions.push('MONTH(o.created_at) = @month');
      conditions.push('YEAR(o.created_at) = @year');
      params.month = parseInt(filters.month);
      params.year = parseInt(filters.year);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Main query to get product summary for the month
    const query = `
      SELECT 
        ol.product_id,
        ol.variant_id,
        ol.name as product_name,
        ol.sku,
        ol.vendor,
        p.product_type,
        SUM(ol.quantity) as total_quantity,
        SUM(CAST(ol.price AS DECIMAL(10,2)) * ol.quantity) as total_price,
        AVG(CAST(ol.price AS DECIMAL(10,2))) as average_price,
        COUNT(DISTINCT o.id) as order_count,
        COUNT(*) as line_item_count
      FROM brdjdb.shopify.[order] AS o
      INNER JOIN brdjdb.shopify.order_line AS ol ON o.id = ol.order_id
      LEFT JOIN brdjdb.shopify.product AS p ON ol.product_id = p.id
      ${whereClause}
      GROUP BY 
        ol.product_id,
        ol.variant_id,
        ol.name,
        ol.sku,
        ol.vendor,
        p.product_type
      ORDER BY total_quantity DESC, total_price DESC
    `;

    // Query to get summary totals
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT ol.product_id) as total_products,
        SUM(CAST(ol.price AS DECIMAL(10,2)) * ol.quantity) as total_value
      FROM brdjdb.shopify.[order] AS o
      INNER JOIN brdjdb.shopify.order_line AS ol ON o.id = ol.order_id
      ${whereClause}
    `;

    // Execute both queries
    const [products, summaryResult] = await Promise.all([
      mssql.query(query, params),
      mssql.query(summaryQuery, params)
    ]);

    const summary = summaryResult[0] || { total_orders: 0, total_products: 0, total_value: 0 };

    return {
      products,
      totalOrders: summary.total_orders || 0,
      totalProducts: summary.total_products || 0,
      totalValue: summary.total_value || 0
    };

  } catch (error) {
    console.error("Error fetching monthly order products:", error);
    throw new Error(`Failed to fetch monthly order products: ${error.message}`);
  }
}

/**
 * Get monthly order products summary grouped by category
 * @param {Object} filters - Filter criteria
 * @param {string} filters.customerId - Customer ID filter
 * @param {string} filters.locationId - Location ID filter
 * @param {string} filters.companyLocationId - Company Location ID filter
 * @param {string} filters.month - Month (01-12)
 * @param {string} filters.year - Year (YYYY)
 * @returns {Promise<Object>} Object containing categories array and summary totals
 */
export async function getMonthlyOrderProductsByCategory(filters = {}) {
  try {
    const conditions = [];
    const params = {};
    
    // Build dynamic WHERE conditions for orders
    if (filters.customerId) {
      conditions.push('o.customer_id = @customerId');
      params.customerId = filters.customerId;
    }
    if (filters.locationId) {
      conditions.push('o.location_id = @locationId');
      params.locationId = filters.locationId;
    }
    if (filters.companyLocationId) {
      conditions.push('o.company_location_id = @companyLocationId');
      params.companyLocationId = filters.companyLocationId;
    }

    // Add date filters for the specified month/year
    if (filters.month && filters.year) {
      conditions.push('MONTH(o.created_at) = @month');
      conditions.push('YEAR(o.created_at) = @year');
      params.month = parseInt(filters.month);
      params.year = parseInt(filters.year);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Main query to get product data grouped by category
    const query = `
      SELECT 
        COALESCE(p.product_type, 'Uncategorized') as category_name,
        ol.product_id,
        ol.variant_id,
        ol.name as product_name,
        ol.sku,
        ol.vendor,
        SUM(ol.quantity) as total_quantity,
        SUM(CAST(ol.price AS DECIMAL(10,2)) * ol.quantity) as total_price,
        AVG(CAST(ol.price AS DECIMAL(10,2))) as average_price,
        COUNT(DISTINCT o.id) as order_count
      FROM brdjdb.shopify.[order] AS o
      INNER JOIN brdjdb.shopify.order_line AS ol ON o.id = ol.order_id
      LEFT JOIN brdjdb.shopify.product AS p ON ol.product_id = p.id
      ${whereClause}
      GROUP BY 
        COALESCE(p.product_type, 'Uncategorized'),
        ol.product_id,
        ol.variant_id,
        ol.name,
        ol.sku,
        ol.vendor
      ORDER BY 
        COALESCE(p.product_type, 'Uncategorized'),
        SUM(ol.quantity) DESC,
        SUM(CAST(ol.price AS DECIMAL(10,2)) * ol.quantity) DESC
    `;

    // Query to get summary totals
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT COALESCE(p.product_type, 'Uncategorized')) as total_categories,
        SUM(CAST(ol.price AS DECIMAL(10,2)) * ol.quantity) as total_value
      FROM brdjdb.shopify.[order] AS o
      INNER JOIN brdjdb.shopify.order_line AS ol ON o.id = ol.order_id
      LEFT JOIN brdjdb.shopify.product AS p ON ol.product_id = p.id
      ${whereClause}
    `;

    // Execute both queries
    const [products, summaryResult] = await Promise.all([
      mssql.query(query, params),
      mssql.query(summaryQuery, params)
    ]);

    const summary = summaryResult[0] || { total_orders: 0, total_categories: 0, total_value: 0 };

    // Group products by category
    const categoriesMap = {};
    products.forEach(product => {
      const categoryName = product.category_name || 'Uncategorized';
      
      if (!categoriesMap[categoryName]) {
        categoriesMap[categoryName] = {
          category_name: categoryName,
          products: [],
          total_quantity: 0,
          total_value: 0
        };
      }
      
      categoriesMap[categoryName].products.push({
        product_id: product.product_id,
        variant_id: product.variant_id,
        product_name: product.product_name,
        sku: product.sku,
        vendor: product.vendor,
        total_quantity: product.total_quantity,
        total_price: product.total_price,
        average_price: product.average_price,
        order_count: product.order_count
      });
      
      categoriesMap[categoryName].total_quantity += Number(product.total_quantity) || 0;
      categoriesMap[categoryName].total_value += Number(product.total_price) || 0;
    });

    // Convert to array and sort by total value
    const categories = Object.values(categoriesMap).sort((a, b) => b.total_value - a.total_value);

    return {
      categories,
      totalOrders: summary.total_orders || 0,
      totalCategories: summary.total_categories || 0,
      totalValue: summary.total_value || 0
    };

  } catch (error) {
    console.error("Error fetching monthly order products by category:", error);
    throw new Error(`Failed to fetch monthly order products by category: ${error.message}`);
  }
}
