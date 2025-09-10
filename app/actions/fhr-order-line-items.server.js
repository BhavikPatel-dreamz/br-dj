

/**
 * FHR Order Line Items Actions
 * Handles Full Historical Records operations for Shopify order line items
 */

import mssql from "../mssql.server.js";

/**
 * Get order line items with comprehensive FHR schema
 * @param {Object} filters - Filter criteria
 * @param {string} filters.orderId - Order ID filter
 * @param {string} filters.lineItemId - Line item ID filter
 * @param {string} filters.productId - Product ID filter
 * @param {string} filters.variantId - Variant ID filter
 * @param {string} filters.sku - SKU filter
 * @param {string} filters.vendor - Vendor filter
 * @param {string} filters.fulfillmentStatus - Fulfillment status filter
 * @param {number} limit - Number of records to return (default: 100)
 * @param {number} offset - Number of records to skip (default: 0)
 * @returns {Promise<Array>} Array of order line item objects with full FHR schema
 */
export async function getOrderLineItems(filters = {}, limit = 100, offset = 0) {
  try {
    const conditions = [];
    const params = {};
    
    // Build dynamic WHERE conditions with parameters
    if (filters.orderId) {
      conditions.push('ol.order_id = @orderId');
      params.orderId = filters.orderId;
    }
    if (filters.lineItemId) {
      conditions.push('ol.id = @lineItemId');
      params.lineItemId = filters.lineItemId;
    }
    if (filters.productId) {
      conditions.push('ol.product_id = @productId');
      params.productId = filters.productId;
    }
    if (filters.variantId) {
      conditions.push('ol.variant_id = @variantId');
      params.variantId = filters.variantId;
    }
    if (filters.sku) {
      conditions.push('ol.sku = @sku');
      params.sku = filters.sku;
    }
    if (filters.vendor) {
      conditions.push('ol.vendor = @vendor');
      params.vendor = filters.vendor;
    }
    if (filters.fulfillmentStatus) {
      conditions.push('ol.fulfillment_status = @fulfillmentStatus');
      params.fulfillmentStatus = filters.fulfillmentStatus;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // If offset is needed, use ROW_NUMBER() for pagination
    const query = offset > 0 ? `
      SELECT * FROM (
        SELECT 
          ol.order_id,
          ol.id,
          ol.product_id,
          ol.variant_id,
          ol.name,
          ol.title,
          ol.vendor,
          ol.price,
          ol.price_set,
          ol.quantity,
          ol.grams,
          ol.sku,
          ol.fulfillable_quantity,
          ol.gift_card,
          ol.requires_shipping,
          ol.taxable,
          ol.variant_title,
          ol.properties,
          ol.[index],
          ol.total_discount,
          ol.total_discount_set,
          ol.pre_tax_price,
          ol.pre_tax_price_set,
          ol.product_exists,
          ol.fulfillment_status,
          ol.variant_inventory_management,
          ol.tax_code,
          ol._fivetran_synced,
          ROW_NUMBER() OVER (ORDER BY ol.order_id, ol.[index]) as rn
        FROM brdjdb.shopify.order_line AS ol
        ${whereClause}
      ) AS numbered
      WHERE rn > @offset AND rn <= (@offset + @limit)
      ORDER BY order_id, [index]
    ` : `
      SELECT TOP (@limit)
        ol.order_id,
        ol.id,
        ol.product_id,
        ol.variant_id,
        ol.name,
        ol.title,
        ol.vendor,
        ol.price,
        ol.price_set,
        ol.quantity,
        ol.grams,
        ol.sku,
        ol.fulfillable_quantity,
        ol.gift_card,
        ol.requires_shipping,
        ol.taxable,
        ol.variant_title,
        ol.properties,
        ol.[index],
        ol.total_discount,
        ol.total_discount_set,
        ol.pre_tax_price,
        ol.pre_tax_price_set,
        ol.product_exists,
        ol.fulfillment_status,
        ol.variant_inventory_management,
        ol.tax_code,
        ol._fivetran_synced
      FROM brdjdb.shopify.order_line AS ol
      ${whereClause}
      ORDER BY ol.order_id, ol.[index]
    `;

    // Add pagination parameters
    params.limit = parseInt(limit) || 100;
    if (offset > 0) {
      params.offset = parseInt(offset) || 0;
    }



    const lineItems = await mssql.query(query, params);
    return lineItems;
  } catch (error) {
    console.error("Error fetching FHR order line items:", error);
    throw new Error(`Failed to fetch order line items: ${error.message}`);
  }
}

/**
 * Get order line items by order ID
 * @param {string} orderId - Order ID
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of line items for the order
 */
export async function getOrderLineItemsByOrderId(orderId, limit = 100, offset = 0) {
  return await getOrderLineItems({ orderId }, limit, offset);
}

/**
 * Get a single order line item by ID
 * @param {string} lineItemId - Line item ID
 * @returns {Promise<Object|null>} Line item object or null if not found
 */
export async function getOrderLineItemById(lineItemId) {
  try {
    const query = `
      SELECT 
        ol.order_id,
        ol.id,
        ol.product_id,
        ol.variant_id,
        ol.name,
        ol.title,
        ol.vendor,
        ol.price,
        ol.price_set,
        ol.quantity,
        ol.grams,
        ol.sku,
        ol.fulfillable_quantity,
        ol.gift_card,
        ol.requires_shipping,
        ol.taxable,
        ol.variant_title,
        ol.properties,
        ol.[index],
        ol.total_discount,
        ol.total_discount_set,
        ol.pre_tax_price,
        ol.pre_tax_price_set,
        ol.product_exists,
        ol.fulfillment_status,
        ol.variant_inventory_management,
        ol.tax_code,
        ol._fivetran_synced
      FROM brdjdb.shopify.order_line AS ol
      WHERE ol.id = @lineItemId
    `;

    const lineItems = await mssql.query(query, { lineItemId });
    return lineItems.length > 0 ? lineItems[0] : null;
  } catch (error) {
    console.error(`Error fetching line item ${lineItemId}:`, error);
    throw new Error(`Failed to fetch line item: ${error.message}`);
  }
}

/**
 * Get order line items by product ID
 * @param {string} productId - Product ID
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of line items for the product
 */
export async function getOrderLineItemsByProductId(productId, limit = 100, offset = 0) {
  return await getOrderLineItems({ productId }, limit, offset);
}

/**
 * Get order line items by variant ID
 * @param {string} variantId - Variant ID
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of line items for the variant
 */
export async function getOrderLineItemsByVariantId(variantId, limit = 100, offset = 0) {
  return await getOrderLineItems({ variantId }, limit, offset);
}

/**
 * Get order line items by SKU
 * @param {string} sku - SKU
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of line items with the SKU
 */
export async function getOrderLineItemsBySku(sku, limit = 100, offset = 0) {
  return await getOrderLineItems({ sku }, limit, offset);
}

/**
 * Get order line items by vendor
 * @param {string} vendor - Vendor name
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of line items for the vendor
 */
export async function getOrderLineItemsByVendor(vendor, limit = 100, offset = 0) {
  return await getOrderLineItems({ vendor }, limit, offset);
}

/**
 * Get order line items by fulfillment status
 * @param {string} fulfillmentStatus - Fulfillment status (e.g., 'fulfilled', 'unfulfilled', 'partial')
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of line items with the specified fulfillment status
 */
export async function getOrderLineItemsByFulfillmentStatus(fulfillmentStatus, limit = 100, offset = 0) {
  return await getOrderLineItems({ fulfillmentStatus }, limit, offset);
}

/**
 * Get order line items count based on filters
 * @param {Object} filters - Filter criteria (same as getOrderLineItems)
 * @returns {Promise<number>} Total count of line items matching filters
 */
export async function getOrderLineItemsCount(filters = {}) {
  try {
    const conditions = [];
    const params = {};
    
    // Build dynamic WHERE conditions (same logic as getOrderLineItems)
    if (filters.orderId) {
      conditions.push('ol.order_id = @orderId');
      params.orderId = filters.orderId;
    }
    if (filters.lineItemId) {
      conditions.push('ol.id = @lineItemId');
      params.lineItemId = filters.lineItemId;
    }
    if (filters.productId) {
      conditions.push('ol.product_id = @productId');
      params.productId = filters.productId;
    }
    if (filters.variantId) {
      conditions.push('ol.variant_id = @variantId');
      params.variantId = filters.variantId;
    }
    if (filters.sku) {
      conditions.push('ol.sku = @sku');
      params.sku = filters.sku;
    }
    if (filters.vendor) {
      conditions.push('ol.vendor = @vendor');
      params.vendor = filters.vendor;
    }
    if (filters.fulfillmentStatus) {
      conditions.push('ol.fulfillment_status = @fulfillmentStatus');
      params.fulfillmentStatus = filters.fulfillmentStatus;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT COUNT(*) as total_count
      FROM brdjdb.shopify.order_line AS ol
      ${whereClause}
    `;

    const result = await mssql.query(query, params);
    return result[0]?.total_count || 0;
  } catch (error) {
    console.error("Error getting order line items count:", error);
    throw new Error(`Failed to get order line items count: ${error.message}`);
  }
}

/**
 * Get order with its line items (joined query)
 * @param {string} orderId - Order ID
 * @returns {Promise<Object|null>} Order object with line items array, or null if not found
 */
export async function getOrderWithLineItems(orderId) {
  try {
    // First get the order details
    const orderQuery = `
      SELECT 
        o.id,
        o.order_number,
        o.customer_id,
        o.total_price,
        o.currency,
        o.created_at,
        o.financial_status,
        o.fulfillment_status
      FROM brdjdb.shopify.[order] AS o
      WHERE o.id = @orderId
    `;

    const orders = await mssql.query(orderQuery, { orderId });
    if (orders.length === 0) {
      return null;
    }

    const order = orders[0];

    // Then get the line items
    const lineItems = await getOrderLineItemsByOrderId(orderId);
    
    return {
      ...order,
      line_items: lineItems
    };
  } catch (error) {
    console.error(`Error fetching order with line items ${orderId}:`, error);
    throw new Error(`Failed to fetch order with line items: ${error.message}`);
  }
}

/**
 * Get aggregated line item statistics for an order
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Aggregated statistics
 */
export async function getOrderLineItemStats(orderId) {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_line_items,
        SUM(ol.quantity) as total_quantity,
        SUM(ol.price * ol.quantity) as total_line_items_price,
        COUNT(CASE WHEN ol.gift_card = 1 THEN 1 END) as gift_card_items,
        COUNT(CASE WHEN ol.requires_shipping = 1 THEN 1 END) as shipping_required_items,
        COUNT(CASE WHEN ol.taxable = 1 THEN 1 END) as taxable_items,
        COUNT(DISTINCT ol.vendor) as unique_vendors,
        COUNT(DISTINCT ol.product_id) as unique_products
      FROM brdjdb.shopify.order_line AS ol
      WHERE ol.order_id = @orderId
    `;

    const result = await mssql.query(query, { orderId });
    return result[0] || {};
  } catch (error) {
    console.error(`Error fetching order line item stats ${orderId}:`, error);
    throw new Error(`Failed to fetch order line item stats: ${error.message}`);
  }
}
