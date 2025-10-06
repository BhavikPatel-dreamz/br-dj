import 'dotenv/config';
import mssql from "../mssql.server.js";

/**
 * Decode HTML entities in category names
 * @param {string} str - The string containing HTML entities
 * @returns {string} - The decoded string
 */
function decodeHtmlEntities(str) {
  if (!str) return str;
  
  const htmlEntities = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '='
  };
  
  // Handle unicode escapes like \u003E
  let decoded = str.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  // Handle HTML entities
  decoded = decoded.replace(/&[#a-zA-Z0-9]+;/g, (entity) => {
    return htmlEntities[entity] || entity;
  });
  
  return decoded;
}

/**
 * Orders Actions with Refund Support (Based on Actual Database Schema)
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

// Helper function to get budget data for categories by location
async function getBudgetDataForLocation(locationId, budgetMonth = null) {
  try {
    // If budgetMonth is provided, calculate budget using census data
    console.log("Fetching budget data for location:", locationId, "and budgetMonth:", budgetMonth);
    if (budgetMonth && locationId) {
      return await calculateBudgetFromCensus(locationId, budgetMonth);
    }
    
    // Fallback to static budget data if no budget month provided
    const budgetQuery = `
      SELECT 
        bcm.category_name,
        bc.allocated_amount as budget_amount,
        b.name as budget_name,
        bla.location_id
      FROM shopify.budget_location_assignments bla
      INNER JOIN shopify.budget b ON bla.budget_id = b.id
      INNER JOIN shopify.budget_categories bc ON b.id = bc.budget_id
      INNER JOIN shopify.budget_categories_master bcm ON bc.category_id = bcm.id
      WHERE bla.location_id = @locationId 
        AND bla.status = 'active'
        AND b.status = 'active'
    `;
    
    const budgetData = await mssql.query(budgetQuery, { locationId });
    
    
    // Create a map of category_name to budget_amount
    const budgetMap = {};
    budgetData.forEach(item => {
      const decodedCategoryName = decodeHtmlEntities(item.category_name);
      budgetMap[decodedCategoryName] = item.budget_amount;
      // Also store the original in case it's needed
      budgetMap[item.category_name] = item.budget_amount;
    });
    
    return budgetMap;
  } catch (error) {
    console.error("Error fetching budget data for location:", error);
    return {};
  }
}

async function calculateBudgetFromCensus(locationId, budgetMonth) {
  try {
    // Get census data for the location and month
    const censusQuery = `
      SELECT 
        census_amount
      FROM shopify.location_census 
      WHERE location_id = @locationId 
        AND census_month = @budgetMonth
    `;
    
    const censusData = await mssql.query(censusQuery, { 
      locationId, 
      budgetMonth 
    });
    
    if (!censusData || censusData.length === 0) {
      console.log(`No census data found for location ${locationId} and month ${budgetMonth}`);
      return {};
    }
    
    const censusAmount = censusData[0].census_amount;
    
    // Calculate days in the budget month
    const [month, year] = budgetMonth.split('-');
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    
    // Get all budget categories with their PPD rates (allocated_amount as PPD)
    const categoriesQuery = `
      SELECT DISTINCT
        bcm.category_name,
        bc.allocated_amount as ppd_rate
      FROM shopify.budget_location_assignments bla
      INNER JOIN shopify.budget b ON bla.budget_id = b.id
      INNER JOIN shopify.budget_categories bc ON b.id = bc.budget_id
      INNER JOIN shopify.budget_categories_master bcm ON bc.category_id = bcm.id
      WHERE bla.location_id = @locationId 
        AND bla.status = 'active'
        AND b.status = 'active'
    `;
    
    const categoriesData = await mssql.query(categoriesQuery, { locationId });
    
    // Calculate budget for each category using the formula:
    // BUDGET OF CATEGORY = CENSUS OF LOCATION × DAYS OF THE CURRENT MONTH × PPD
    const budgetMap = {};
    //console.log(categoriesData)
    
    categoriesData.forEach(category => {
      const decodedCategoryName = decodeHtmlEntities(category.category_name);
      const ppdRate = parseFloat(category.ppd_rate) || 0;
      
      // Calculate budget: census × days × PPD
      const calculatedBudget = (censusAmount * daysInMonth * ppdRate).toFixed(2);
      
      budgetMap[decodedCategoryName] = calculatedBudget;
      // Also store the original in case it's needed
      budgetMap[category.category_name] = calculatedBudget;
    });
    
    // console.log(`Budget calculation for location ${locationId}, month ${budgetMonth}:`);
    // console.log(`Census: ${censusAmount}, Days: ${daysInMonth}`);
     //console.log('Calculated budgets:', budgetMap);
    
    return budgetMap;
    
  } catch (error) {
    console.error("Error calculating budget from census:", error);
    return {};
  }
}

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
          p.shopify_category,
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
          SUM(olr.subtotal) as total_refunded_value
        FROM brdjdb.shopify.order_line_refund AS olr
        INNER JOIN brdjdb.shopify.refund AS r ON olr.refund_id = r.id
        INNER JOIN brdjdb.shopify.[order] AS o ON r.order_id = o.id
        ${whereClause}
        GROUP BY olr.order_line_id
      )
      SELECT 
        op.product_id,
        op.variant_id,
        op.product_name,
        op.sku,
        op.vendor,
        op.shopify_category,
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
        op.shopify_category
      ORDER BY net_quantity DESC, net_value DESC
    `;

    // Enhanced summary query with refund metrics - includes ALL products (even fully refunded ones)
    const productSummaryQuery = `
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
          SUM(olr.subtotal) as refunded_value
        FROM brdjdb.shopify.refund AS r
        INNER JOIN brdjdb.shopify.order_line_refund AS olr ON r.id = olr.refund_id
        INNER JOIN brdjdb.shopify.[order] AS o ON r.order_id = o.id
        ${whereClause}
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
      mssql.query(productSummaryQuery, params)
    ]);

    // Decode HTML entities in shopify_category field for each product
    const decodedProducts = products.map(product => ({
      ...product,
      shopify_category: decodeHtmlEntities(product.shopify_category)
    }));

    const summary = summaryResult[0] || { 
      total_orders: 0, 
      orders_with_refunds: 0,
      total_products: 0, 
      gross_value: 0,
      total_refunded_value: 0,
      net_value: 0
    };

    return {
      products: decodedProducts,
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
/*
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

    // Get budget data for the location
    let budgetMap = {};
    if (filters.locationId || filters.companyLocationId) {
      const locationForBudget = filters.locationId || filters.companyLocationId;
      // Pass budgetMonth if available (constructed from month/year filters)
      const budgetMonth = filters.month && filters.year ? 
        `${filters.month.toString().padStart(2, '0')}-${filters.year}` : null;
        console.log("Fetching budget for month:=============", budgetMonth);
      budgetMap = await getBudgetDataForLocation(locationForBudget, budgetMonth);
    }

    console.log("Budget Map:", budgetMap);

    // Enhanced query that calculates net quantities and values by category
    const query = `
      WITH OrderedProducts AS (
        SELECT 
          COALESCE(p.shopify_category, 'Uncategorized') as category_name,
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
        -- Get all refunded products for orders from the same period (refunds can be from any date)
        SELECT 
          olr.order_line_id,
          SUM(olr.quantity) as total_refunded_quantity,
          SUM(olr.subtotal) as total_refunded_value
        FROM brdjdb.shopify.order_line_refund AS olr
        INNER JOIN brdjdb.shopify.refund AS r ON olr.refund_id = r.id
        INNER JOIN brdjdb.shopify.[order] AS o ON r.order_id = o.id
        INNER JOIN OrderedProducts op ON olr.order_line_id = op.order_line_id
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


    // Summary query for categories with proper refund aggregation - includes ALL products
    const categorySummaryQuery = `
      WITH OrderStats AS (
        SELECT 
          o.id as order_id,
          SUM(CAST(ol.price AS DECIMAL(10,2)) * ol.quantity) as order_value,
          COALESCE(p.shopify_category, 'Uncategorized') as category_name
        FROM brdjdb.shopify.[order] AS o
        INNER JOIN brdjdb.shopify.order_line AS ol ON o.id = ol.order_id
        LEFT JOIN brdjdb.shopify.product AS p ON ol.product_id = p.id
        ${whereClause}
        GROUP BY o.id, COALESCE(p.shopify_category, 'Uncategorized')
      ),
      RefundStats AS (
        SELECT 
          r.order_id,
          COALESCE(p.shopify_category, 'Uncategorized') as category_name,
          SUM(olr.subtotal) as refunded_value
        FROM brdjdb.shopify.refund AS r
        INNER JOIN brdjdb.shopify.order_line_refund AS olr ON r.id = olr.refund_id
        INNER JOIN brdjdb.shopify.order_line AS ol ON olr.order_line_id = ol.id
        INNER JOIN brdjdb.shopify.[order] AS o ON r.order_id = o.id
        LEFT JOIN brdjdb.shopify.product AS p ON ol.product_id = p.id
        ${whereClause}
        GROUP BY r.order_id, COALESCE(p.shopify_category, 'Uncategorized')
      )
      SELECT 
        COUNT(DISTINCT os.order_id) as total_orders,
        COUNT(DISTINCT CASE WHEN rs.order_id IS NOT NULL THEN os.order_id END) as orders_with_refunds,
        COUNT(DISTINCT os.category_name) as total_categories,
        SUM(os.order_value) as gross_value,
        SUM(COALESCE(rs.refunded_value, 0)) as total_refunded_value,
        SUM(os.order_value - COALESCE(rs.refunded_value, 0)) as net_value
      FROM OrderStats os
      LEFT JOIN RefundStats rs ON os.order_id = rs.order_id AND os.category_name = rs.category_name
    `;



    // Execute both queries
    const [productResults, summaryResult] = await Promise.all([
      mssql.query(query, params),
      mssql.query(categorySummaryQuery, params)
    ]);




    // Group products by category
    const categorizedData = {};
    productResults.forEach(product => {
      const categoryName = decodeHtmlEntities(product.category_name || 'Uncategorized');
      
      if (!categorizedData[categoryName]) {
        categorizedData[categoryName] = {
          category_name: categoryName,
          products: [],
          total_quantity: 0,
          total_value: 0,
          gross_quantity: 0,
          gross_value: 0,
          refunded_quantity: 0,
          refunded_value: 0,
          budget: budgetMap[categoryName] || 0 // Set budget from database or 0
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
} */

/**
 * Get monthly order products summary grouped by category with refunds accounted for (Budget Month Based)
 * This function uses order_budget_month field instead of created_at for period determination
 * @param {Object} filters - Filter criteria
 * @param {string} filters.customerId - Customer ID filter
 * @param {string} filters.locationId - Location ID filter
 * @param {string} filters.companyLocationId - Company Location ID filter
 * @param {string} filters.budgetMonth - Budget month period (MM-YYYY format, e.g., "01-2025")
 * @returns {Promise<Object>} Object containing categories array and summary totals
 */
export async function getMonthlyOrderProductsByCategoryWithRefundsByBudgetMonth(filters = {}) {
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

    // Add budget month filter with fallback to created_at - this is the key difference from the original function
    if (filters.budgetMonth) {
      // Parse the budget month to extract month and year for fallback
      const [month, year] = filters.budgetMonth.split('-');
      const paddedMonth = month.padStart(2, '0');
      const fallbackBudgetMonth = `${paddedMonth}-${year}`;
      
      conditions.push(`(
        o.order_budget_month = @budgetMonth 
        OR (
          o.order_budget_month IS NULL 
          AND FORMAT(o.created_at, 'MM-yyyy') = @fallbackBudgetMonth
        )
      )`);
      params.budgetMonth = filters.budgetMonth;
      params.fallbackBudgetMonth = fallbackBudgetMonth;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get budget data for the location
    let budgetMap = {};
    if (filters.locationId || filters.companyLocationId) {
      const locationForBudget = filters.locationId || filters.companyLocationId;
      // Pass budgetMonth if available (constructed from month/year filters)
      const budgetMonth = filters.month && filters.year ? 
        `${filters.month.toString().padStart(2, '0')}-${filters.year}` : null;
       
      //console.log("Fetching budget for month (Budget Month Based):", budgetMonth);
      budgetMap = await getBudgetDataForLocation(locationForBudget, budgetMonth);
    }

     //console.log("Budget Map:", budgetMap);
    // console.log("Budget Month Filter:", filters.budgetMonth);
    // console.log("Fallback Budget Month:", params.fallbackBudgetMonth);
    // console.log("Where Clause:", whereClause);
    // console.log("Query Params:", conditions);


    // Enhanced query that calculates net quantities and values by category using budget month
    const query = `
      WITH OrderedProducts AS (
        SELECT 
          COALESCE(p.shopify_category, 'Uncategorized') as category_name,
          ol.id as order_line_id,
          ol.product_id,
          ol.variant_id,
          ol.name as product_name,
          ol.sku,
          ol.vendor,
          ol.quantity as ordered_quantity,
          CAST(ol.price AS DECIMAL(10,2)) as unit_price,
          CAST(ol.price AS DECIMAL(10,2)) * ol.quantity as ordered_value,
          o.id as order_id,
          o.order_budget_month,
          o.created_at
        FROM brdjdb.shopify.[order] AS o
        INNER JOIN brdjdb.shopify.order_line AS ol ON o.id = ol.order_id
        LEFT JOIN brdjdb.shopify.product AS p ON ol.product_id = p.id
        ${whereClause}
      ),
      RefundedProducts AS (
        -- Get all refunded products for orders from the same budget period (refunds can be from any date)
        SELECT 
          olr.order_line_id,
          SUM(olr.quantity) as total_refunded_quantity,
          SUM(olr.subtotal) as total_refunded_value
        FROM brdjdb.shopify.order_line_refund AS olr
        INNER JOIN brdjdb.shopify.refund AS r ON olr.refund_id = r.id
        INNER JOIN brdjdb.shopify.[order] AS o ON r.order_id = o.id
        INNER JOIN OrderedProducts op ON olr.order_line_id = op.order_line_id
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

    // Summary query for categories with proper refund aggregation using budget month
    const categorySummaryQuery = `
      WITH OrderStats AS (
        SELECT 
          o.id as order_id,
          SUM(CAST(ol.price AS DECIMAL(10,2)) * ol.quantity) as order_value,
          COALESCE(p.shopify_category, 'Uncategorized') as category_name,
          o.order_budget_month
        FROM brdjdb.shopify.[order] AS o
        INNER JOIN brdjdb.shopify.order_line AS ol ON o.id = ol.order_id
        LEFT JOIN brdjdb.shopify.product AS p ON ol.product_id = p.id
        ${whereClause}
        GROUP BY o.id, COALESCE(p.shopify_category, 'Uncategorized'), o.order_budget_month
      ),
      RefundStats AS (
        SELECT 
          r.order_id,
          COALESCE(p.shopify_category, 'Uncategorized') as category_name,
          SUM(olr.subtotal) as refunded_value
        FROM brdjdb.shopify.refund AS r
        INNER JOIN brdjdb.shopify.order_line_refund AS olr ON r.id = olr.refund_id
        INNER JOIN brdjdb.shopify.order_line AS ol ON olr.order_line_id = ol.id
        INNER JOIN brdjdb.shopify.[order] AS o ON r.order_id = o.id
        LEFT JOIN brdjdb.shopify.product AS p ON ol.product_id = p.id
        ${whereClause}
        GROUP BY r.order_id, COALESCE(p.shopify_category, 'Uncategorized')
      )
      SELECT 
        COUNT(DISTINCT os.order_id) as total_orders,
        COUNT(DISTINCT CASE WHEN rs.order_id IS NOT NULL THEN os.order_id END) as orders_with_refunds,
        COUNT(DISTINCT os.category_name) as total_categories,
        SUM(os.order_value) as gross_value,
        SUM(COALESCE(rs.refunded_value, 0)) as total_refunded_value,
        SUM(os.order_value - COALESCE(rs.refunded_value, 0)) as net_value
      FROM OrderStats os
      LEFT JOIN RefundStats rs ON os.order_id = rs.order_id AND os.category_name = rs.category_name
    `;

    // Simple test query to check if products exist
    const testProductQuery = `SELECT TOP 5 id, title, status, shopify_category FROM brdjdb.shopify.product`;
    
    // Simple query to fetch ALL products grouped by category
    const allProductsByCategoryQuery = `
      SELECT 
        COALESCE(p.shopify_category, 'Uncategorized') as category_name,
        p.id as product_id,
        p.title as product_name,
        p.vendor,
        p.product_type,
        p.status
      FROM brdjdb.shopify.product p
      WHERE p.status = 'ACTIVE'
      ORDER BY category_name, p.title
    `;

    // Execute all queries including test query
    const [productResults, summaryResult, testProductsResults, allProductsResults] = await Promise.all([
      mssql.query(query, params),
      mssql.query(categorySummaryQuery, params),
      mssql.query(testProductQuery, {}),
      mssql.query(allProductsByCategoryQuery, {})
    ]);

    console.log("Debug - Test Products Query Results:", {
      count: testProductsResults.length,
      sample: testProductsResults.slice(0, 2)
    });

    console.log("Debug - All Products Query Results:", {
      count: allProductsResults.length,
      sample: allProductsResults.slice(0, 3),
      firstProduct: allProductsResults[0]
    });

    // Group products by category
    const categorizedData = {};
    productResults.forEach(product => {
      const categoryName = decodeHtmlEntities(product.category_name || 'Uncategorized');
      
      if (!categorizedData[categoryName]) {
        categorizedData[categoryName] = {
          category_name: categoryName,
          products: [],
          total_quantity: 0,
          total_value: 0,
          gross_quantity: 0,
          gross_value: 0,
          refunded_quantity: 0,
          refunded_value: 0,
          budget: budgetMap[categoryName] || 0 // Set budget from database or 0
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
      
      categorizedData[categoryName].total_quantity += parseFloat(product.total_quantity) || 0;
      categorizedData[categoryName].total_value += parseFloat(product.total_price) || 0;
      categorizedData[categoryName].gross_quantity += parseFloat(product.gross_quantity) || 0;
      categorizedData[categoryName].gross_value += parseFloat(product.gross_value) || 0;
      categorizedData[categoryName].refunded_quantity += parseFloat(product.refunded_quantity) || 0;
      categorizedData[categoryName].refunded_value += parseFloat(product.refunded_value) || 0;
    });

    // Add budget categories that have no orders in this period
    Object.keys(budgetMap).forEach(budgetCategoryName => {
      if (!categorizedData[budgetCategoryName]) {
        categorizedData[budgetCategoryName] = {
          category_name: budgetCategoryName,
          products: [],
          total_quantity: 0,
          total_value: 0,
          gross_quantity: 0,
          gross_value: 0,
          refunded_quantity: 0,
          refunded_value: 0,
          budget: budgetMap[budgetCategoryName]
        };
      }
    });


    console.log("All Products Results Count:", allProductsResults.length);

    // Group ALL products by category (not just ordered products)
    const allProductsByCategory = {};
    allProductsResults.forEach(product => {
      const categoryName = decodeHtmlEntities(product.category_name || 'Uncategorized');
      
      if (!allProductsByCategory[categoryName]) {
        allProductsByCategory[categoryName] = {
          category_name: categoryName,
          products: [],
          total_products: 0,
          budget: budgetMap[categoryName] || 0
        };
      }
      
      allProductsByCategory[categoryName].products.push({
        product_id: product.product_id,
        product_name: product.product_name,
        vendor: product.vendor,
        product_type: product.product_type,
        status: product.status
      });
      
      allProductsByCategory[categoryName].total_products += 1;
    });

    // Add budget categories that have no products
    Object.keys(budgetMap).forEach(budgetCategoryName => {
      if (!allProductsByCategory[budgetCategoryName]) {
        allProductsByCategory[budgetCategoryName] = {
          category_name: budgetCategoryName,
          products: [],
          total_products: 0,
          budget: budgetMap[budgetCategoryName]
        };
      }
    });

    const categories = Object.values(categorizedData);
    const allProductsByCategoryArray = Object.values(allProductsByCategory);
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
      allProducts: allProductsByCategoryArray, // Return as array of categories with nested products
      totalOrders: summary.total_orders || 0,
      ordersWithRefunds: summary.orders_with_refunds || 0,
      totalCategories: summary.total_categories || 0,
      grossValue: summary.gross_value || 0,
      refundedValue: summary.total_refunded_value || 0,
      totalValue: summary.net_value || 0, // Net value after refunds
      refundRate: summary.total_orders > 0 ? (summary.orders_with_refunds / summary.total_orders * 100) : 0,
      budgetMonth: filters.budgetMonth // Return the budget month used for filtering
    };

  } catch (error) {
    console.error("Error fetching monthly order products by category with refunds (budget month):", error);
    throw new Error(`Failed to fetch monthly order products by category with refunds (budget month): ${error.message}`);
  }
}
