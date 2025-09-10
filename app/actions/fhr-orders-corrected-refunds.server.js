import mssql from "../mssql.server.js";

/**
 * Enhanced FHR Orders Actions with Refund Support (Based on Actual Database Schema)
 * Handles Full Historical Records operations for Shopify orders with refund calculations
 * 
 * Database Schema:
 * - shopify.[order] - Main orders (note: order is reserved keyword, needs brackets)
 * - shopify.order_line - Order line items
 * - shopify.refund - Refund headers (links to order_id)
 * - shopify.order_line_refund - Individual refunded line items (links to order_line_id)
 */

/**
 * Get monthly order products summary with refunds accounted for
 * @param {Object} filters - Filter criteria
 * @param {string} filters.customerId - Customer ID filter
 * @param {string} filters.locationId - Location ID filter
 * @param {string} filters.companyLocationId - Company Location ID filter
 * @param {string} filters.month - Month (01-12)
 * @param {string} filters.year - Year (YYYY)
 * @returns {Promise<Object>} Object containing products array and summary totals
 */
export async function getMonthlyOrderProductsWithRefunds(filters = {}) {
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

    // Enhanced query that calculates net quantities and values after refunds
    const query = `
      WITH OrderedProducts AS (
        -- Get all ordered products for the period
        SELECT 
          ol.id as order_line_id,
          ol.product_id,
          ol.variant_id,
          ol.name as product_name,
          ol.sku,
          ol.vendor,
          p.product_type,
          ol.quantity as ordered_quantity,
          CAST(ol.price AS DECIMAL(10,2)) as unit_price,
          CAST(ol.price AS DECIMAL(10,2)) * ol.quantity as ordered_value,
          o.id as order_id
        FROM brdjdb.shopify.[order] AS o
        INNER JOIN brdjdb.shopify.order_line AS ol ON o.id = ol.order_id
        LEFT JOIN brdjdb.shopify.product AS p ON ol.product_id = p.id
        ${whereClause}
      ),
      RefundedProducts AS (
        -- Get all refunded products for the same period
        SELECT 
          olr.order_line_id,
          SUM(olr.quantity) as total_refunded_quantity,
          SUM(olr.subtotal + olr.total_tax) as total_refunded_value
        FROM brdjdb.shopify.order_line_refund AS olr
        INNER JOIN brdjdb.shopify.refund AS r ON olr.refund_id = r.id
        INNER JOIN brdjdb.shopify.[order] AS o ON r.order_id = o.id
        ${whereClause.replace('WHERE', 'WHERE')}
        GROUP BY olr.order_line_id
      )
      SELECT 
        op.product_id,
        op.variant_id,
        op.product_name,
        op.sku,
        op.vendor,
        op.product_type,
        SUM(op.ordered_quantity) as gross_quantity,
        SUM(COALESCE(rp.total_refunded_quantity, 0)) as refunded_quantity,
        SUM(op.ordered_quantity - COALESCE(rp.total_refunded_quantity, 0)) as net_quantity,
        SUM(op.ordered_value) as gross_value,
        SUM(COALESCE(rp.total_refunded_value, 0)) as refunded_value,
        SUM(op.ordered_value - COALESCE(rp.total_refunded_value, 0)) as net_value,
        AVG(op.unit_price) as average_price,
        COUNT(DISTINCT op.order_id) as order_count,
        COUNT(DISTINCT CASE WHEN rp.order_line_id IS NOT NULL THEN op.order_id END) as orders_with_refunds,
        COUNT(*) as line_item_count
      FROM OrderedProducts op
      LEFT JOIN RefundedProducts rp ON op.order_line_id = rp.order_line_id
      GROUP BY 
        op.product_id,
        op.variant_id,
        op.product_name,
        op.sku,
        op.vendor,
        op.product_type
      HAVING SUM(op.ordered_quantity - COALESCE(rp.total_refunded_quantity, 0)) > 0
      ORDER BY net_quantity DESC, net_value DESC
    `;

    // Enhanced summary query with refund metrics
    const summaryQuery = `
      WITH OrderStats AS (
        SELECT 
          o.id as order_id,
          SUM(CAST(ol.price AS DECIMAL(10,2)) * ol.quantity) as order_value
        FROM brdjdb.shopify.[order] AS o
        INNER JOIN brdjdb.shopify.order_line AS ol ON o.id = ol.order_id
        ${whereClause}
        GROUP BY o.id
      ),
      RefundStats AS (
        SELECT 
          r.order_id,
          SUM(olr.subtotal + olr.total_tax) as refunded_value
        FROM brdjdb.shopify.refund AS r
        INNER JOIN brdjdb.shopify.order_line_refund AS olr ON r.id = olr.refund_id
        INNER JOIN brdjdb.shopify.[order] AS o ON r.order_id = o.id
        ${whereClause.replace('WHERE', 'WHERE')}
        GROUP BY r.order_id
      )
      SELECT 
        COUNT(DISTINCT os.order_id) as total_orders,
        COUNT(DISTINCT CASE WHEN rs.order_id IS NOT NULL THEN os.order_id END) as orders_with_refunds,
        COUNT(DISTINCT p.id) as total_products,
        SUM(os.order_value) as gross_value,
        SUM(COALESCE(rs.refunded_value, 0)) as total_refunded_value,
        SUM(os.order_value - COALESCE(rs.refunded_value, 0)) as net_value
      FROM OrderStats os
      LEFT JOIN RefundStats rs ON os.order_id = rs.order_id
      LEFT JOIN brdjdb.shopify.order_line ol ON os.order_id = ol.order_id
      LEFT JOIN brdjdb.shopify.product p ON ol.product_id = p.id
    `;

    // Execute both queries
    const [products, summaryResult] = await Promise.all([
      mssql.query(query, params),
      mssql.query(summaryQuery, params)
    ]);

    const summary = summaryResult[0] || { 
      total_orders: 0, 
      orders_with_refunds: 0,
      total_products: 0, 
      gross_value: 0,
      total_refunded_value: 0,
      net_value: 0 
    };

    return {
      products,
      totalOrders: summary.total_orders || 0,
      ordersWithRefunds: summary.orders_with_refunds || 0,
      totalProducts: summary.total_products || 0,
      grossValue: summary.gross_value || 0,
      refundedValue: summary.total_refunded_value || 0,
      totalValue: summary.net_value || 0, // Net value after refunds
      refundRate: summary.total_orders > 0 ? (summary.orders_with_refunds / summary.total_orders * 100) : 0
    };

  } catch (error) {
    console.error("Error fetching monthly order products with refunds:", error);
    throw new Error(`Failed to fetch monthly order products with refunds: ${error.message}`);
  }
}

/**
 * Get monthly order products summary grouped by category with refunds accounted for
 * @param {Object} filters - Filter criteria
 * @param {string} filters.customerId - Customer ID filter
 * @param {string} filters.locationId - Location ID filter
 * @param {string} filters.companyLocationId - Company Location ID filter
 * @param {string} filters.month - Month (01-12)
 * @param {string} filters.year - Year (YYYY)
 * @returns {Promise<Object>} Object containing categories array and summary totals
 */
export async function getMonthlyOrderProductsByCategoryWithRefunds(filters = {}) {
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

    // Enhanced query that calculates net quantities and values by category
    const query = `
      WITH OrderedProducts AS (
        SELECT 
          COALESCE(p.product_type, 'Uncategorized') as category_name,
          ol.id as order_line_id,
          ol.product_id,
          ol.variant_id,
          ol.name as product_name,
          ol.sku,
          ol.vendor,
          ol.quantity as ordered_quantity,
          CAST(ol.price AS DECIMAL(10,2)) as unit_price,
          CAST(ol.price AS DECIMAL(10,2)) * ol.quantity as ordered_value,
          o.id as order_id
        FROM brdjdb.shopify.[order] AS o
        INNER JOIN brdjdb.shopify.order_line AS ol ON o.id = ol.order_id
        LEFT JOIN brdjdb.shopify.product AS p ON ol.product_id = p.id
        ${whereClause}
      ),
      RefundedProducts AS (
        SELECT 
          olr.order_line_id,
          SUM(olr.quantity) as total_refunded_quantity,
          SUM(olr.subtotal + olr.total_tax) as total_refunded_value
        FROM brdjdb.shopify.order_line_refund AS olr
        INNER JOIN brdjdb.shopify.refund AS r ON olr.refund_id = r.id
        INNER JOIN brdjdb.shopify.[order] AS o ON r.order_id = o.id
        ${whereClause.replace('WHERE', 'WHERE')}
        GROUP BY olr.order_line_id
      ),
      ProductSummary AS (
        SELECT 
          op.category_name,
          op.product_id,
          op.variant_id,
          op.product_name,
          op.sku,
          op.vendor,
          SUM(op.ordered_quantity) as gross_quantity,
          SUM(COALESCE(rp.total_refunded_quantity, 0)) as refunded_quantity,
          SUM(op.ordered_quantity - COALESCE(rp.total_refunded_quantity, 0)) as net_quantity,
          SUM(op.ordered_value) as gross_value,
          SUM(COALESCE(rp.total_refunded_value, 0)) as refunded_value,
          SUM(op.ordered_value - COALESCE(rp.total_refunded_value, 0)) as net_value,
          AVG(op.unit_price) as average_price,
          COUNT(DISTINCT op.order_id) as order_count
        FROM OrderedProducts op
        LEFT JOIN RefundedProducts rp ON op.order_line_id = rp.order_line_id
        GROUP BY 
          op.category_name,
          op.product_id,
          op.variant_id,
          op.product_name,
          op.sku,
          op.vendor
        HAVING SUM(op.ordered_quantity - COALESCE(rp.total_refunded_quantity, 0)) > 0
      )
      SELECT 
        category_name,
        product_id,
        variant_id,
        product_name,
        sku,
        vendor,
        net_quantity as total_quantity,
        net_value as total_price,
        average_price,
        order_count,
        gross_quantity,
        refunded_quantity,
        gross_value,
        refunded_value
      FROM ProductSummary
      ORDER BY category_name, net_quantity DESC, net_value DESC
    `;

    // Summary query for categories
    const summaryQuery = `
      WITH OrderStats AS (
        SELECT 
          o.id as order_id,
          SUM(CAST(ol.price AS DECIMAL(10,2)) * ol.quantity) as order_value
        FROM brdjdb.shopify.[order] AS o
        INNER JOIN brdjdb.shopify.order_line AS ol ON o.id = ol.order_id
        ${whereClause}
        GROUP BY o.id
      ),
      RefundStats AS (
        SELECT 
          r.order_id,
          SUM(olr.subtotal + olr.total_tax) as refunded_value
        FROM brdjdb.shopify.refund AS r
        INNER JOIN brdjdb.shopify.order_line_refund AS olr ON r.id = olr.refund_id
        INNER JOIN brdjdb.shopify.[order] AS o ON r.order_id = o.id
        ${whereClause.replace('WHERE', 'WHERE')}
        GROUP BY r.order_id
      )
      SELECT 
        COUNT(DISTINCT os.order_id) as total_orders,
        COUNT(DISTINCT CASE WHEN rs.order_id IS NOT NULL THEN os.order_id END) as orders_with_refunds,
        COUNT(DISTINCT COALESCE(p.product_type, 'Uncategorized')) as total_categories,
        SUM(os.order_value) as gross_value,
        SUM(COALESCE(rs.refunded_value, 0)) as total_refunded_value,
        SUM(os.order_value - COALESCE(rs.refunded_value, 0)) as net_value
      FROM OrderStats os
      LEFT JOIN RefundStats rs ON os.order_id = rs.order_id
      LEFT JOIN brdjdb.shopify.order_line ol ON os.order_id = ol.order_id
      LEFT JOIN brdjdb.shopify.product p ON ol.product_id = p.id
    `;

    // Execute both queries
    const [productResults, summaryResult] = await Promise.all([
      mssql.query(query, params),
      mssql.query(summaryQuery, params)
    ]);

    // Group products by category
    const categorizedData = {};
    productResults.forEach(product => {
      const categoryName = product.category_name || 'Uncategorized';
      
      if (!categorizedData[categoryName]) {
        categorizedData[categoryName] = {
          category_name: categoryName,
          products: [],
          total_quantity: 0,
          total_value: 0,
          gross_quantity: 0,
          gross_value: 0,
          refunded_quantity: 0,
          refunded_value: 0
        };
      }
      
      categorizedData[categoryName].products.push({
        product_name: product.product_name,
        sku: product.sku,
        vendor: product.vendor,
        total_quantity: product.total_quantity,
        total_price: product.total_price,
        average_price: product.average_price,
        order_count: product.order_count,
        gross_quantity: product.gross_quantity,
        refunded_quantity: product.refunded_quantity,
        gross_value: product.gross_value,
        refunded_value: product.refunded_value
      });
      
      categorizedData[categoryName].total_quantity += product.total_quantity || 0;
      categorizedData[categoryName].total_value += product.total_price || 0;
      categorizedData[categoryName].gross_quantity += product.gross_quantity || 0;
      categorizedData[categoryName].gross_value += product.gross_value || 0;
      categorizedData[categoryName].refunded_quantity += product.refunded_quantity || 0;
      categorizedData[categoryName].refunded_value += product.refunded_value || 0;
    });

    const categories = Object.values(categorizedData);
    const summary = summaryResult[0] || { 
      total_orders: 0, 
      orders_with_refunds: 0,
      total_categories: 0, 
      gross_value: 0,
      total_refunded_value: 0,
      net_value: 0 
    };

    return {
      categories,
      totalOrders: summary.total_orders || 0,
      ordersWithRefunds: summary.orders_with_refunds || 0,
      totalCategories: summary.total_categories || 0,
      grossValue: summary.gross_value || 0,
      refundedValue: summary.total_refunded_value || 0,
      totalValue: summary.net_value || 0, // Net value after refunds
      refundRate: summary.total_orders > 0 ? (summary.orders_with_refunds / summary.total_orders * 100) : 0
    };

  } catch (error) {
    console.error("Error fetching monthly order products by category with refunds:", error);
    throw new Error(`Failed to fetch monthly order products by category with refunds: ${error.message}`);
  }
}
