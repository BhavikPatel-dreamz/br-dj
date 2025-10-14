import mssql from '../app/mssql.server.js';

/**
 * Fetch orders grouped by month from MSSQL database
 * This script provides several different ways to analyze orders by month
 */

async function fetchOrdersByMonth(companyLocationId = null) {
  try {
    console.log('📊 Fetching orders by month from MSSQL database...\n');
    if (companyLocationId) {
      console.log(`🏢 Filtering by Company Location ID: ${companyLocationId}\n`);
    }

    // 1. Get orders count and total value by month (current year)
    console.log('🗓️  Orders summary by month (Current Year):');
    const ordersByMonth = await mssql.query(`
      SELECT 
        YEAR(created_at) as year,
        MONTH(created_at) as month,
        DATENAME(month, created_at) as month_name,
        COUNT(*) as order_count,
        SUM(total_price) as total_revenue,
        AVG(total_price) as avg_order_value,
        MIN(total_price) as min_order_value,
        MAX(total_price) as max_order_value
      FROM [shopify].[order] 
      WHERE created_at IS NOT NULL 
        AND YEAR(created_at) = YEAR(GETDATE())
        AND _fivetran_deleted != 1
        ${companyLocationId ? 'AND company_location_id = @companyLocationId' : ''}
      GROUP BY YEAR(created_at), MONTH(created_at), DATENAME(month, created_at)
      ORDER BY year DESC, month DESC
    `, companyLocationId ? { companyLocationId } : {});

    console.table(ordersByMonth);

    // 2. Get orders by month for the last 12 months
    console.log('\n📈 Orders by month (Last 12 months):');
    const ordersLast12Months = await mssql.query(`
      SELECT 
        FORMAT(created_at, 'yyyy-MM') as year_month,
        DATENAME(month, created_at) + ' ' + CAST(YEAR(created_at) AS VARCHAR) as month_year,
        COUNT(*) as order_count,
        SUM(total_price) as total_revenue,
        AVG(total_price) as avg_order_value
      FROM [shopify].[order] 
      WHERE created_at IS NOT NULL 
        AND created_at >= DATEADD(month, -12, GETDATE())
        AND _fivetran_deleted != 1
        ${companyLocationId ? 'AND company_location_id = @companyLocationId' : ''}
      GROUP BY FORMAT(created_at, 'yyyy-MM'), DATENAME(month, created_at), YEAR(created_at)
      ORDER BY year_month DESC
    `, companyLocationId ? { companyLocationId } : {});

    console.table(ordersLast12Months);

    // 3. Get detailed order information for a specific month (current month)
    console.log('\n📋 Detailed orders for current month:');
    const currentMonthOrders = await mssql.query(`
      SELECT TOP 10
        id,
        name as order_name,
        email,
        total_price,
        currency,
        financial_status,
        fulfillment_status,
        created_at,
        customer_id,
        order_budget_month,
        company_location_id
      FROM [shopify].[order] 
      WHERE YEAR(created_at) = YEAR(GETDATE()) 
        AND MONTH(created_at) = MONTH(GETDATE())
        AND _fivetran_deleted != 1
        ${companyLocationId ? 'AND company_location_id = @companyLocationId' : ''}
      ORDER BY created_at DESC
    `, companyLocationId ? { companyLocationId } : {});

    console.table(currentMonthOrders);

    // 4. Get orders by financial status for current month
    console.log('\n💰 Orders by financial status (Current month):');
    const ordersByStatus = await mssql.query(`
      SELECT 
        financial_status,
        COUNT(*) as order_count,
        SUM(total_price) as total_revenue
      FROM [shopify].[order] 
      WHERE YEAR(created_at) = YEAR(GETDATE()) 
        AND MONTH(created_at) = MONTH(GETDATE())
        AND _fivetran_deleted != 1
        ${companyLocationId ? 'AND company_location_id = @companyLocationId' : ''}
      GROUP BY financial_status
      ORDER BY order_count DESC
    `, companyLocationId ? { companyLocationId } : {});

    console.table(ordersByStatus);

    // 5. Get orders using the order_budget_month column if populated
    console.log('\n📅 Orders by budget month (using order_budget_month column):');
    const ordersByBudgetMonth = await mssql.query(`
      SELECT 
        order_budget_month,
        COUNT(*) as order_count,
        SUM(total_price) as total_revenue,
        AVG(total_price) as avg_order_value
      FROM [shopify].[order] 
      WHERE order_budget_month IS NOT NULL 
        AND _fivetran_deleted != 1
        ${companyLocationId ? 'AND company_location_id = @companyLocationId' : ''}
      GROUP BY order_budget_month
      ORDER BY order_budget_month DESC
    `, companyLocationId ? { companyLocationId } : {});

    console.table(ordersByBudgetMonth);

    // 6. Summary statistics
    console.log('\n📊 Overall Statistics:');
    const overallStats = await mssql.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_price) as total_revenue,
        AVG(total_price) as avg_order_value,
        MIN(created_at) as earliest_order,
        MAX(created_at) as latest_order,
        COUNT(DISTINCT customer_id) as unique_customers
      FROM [shopify].[order] 
      WHERE _fivetran_deleted != 1
        AND created_at IS NOT NULL
        ${companyLocationId ? 'AND company_location_id = @companyLocationId' : ''}
    `, companyLocationId ? { companyLocationId } : {});

    console.table(overallStats);

    console.log('\n✅ Orders by month analysis completed successfully!');

  } catch (error) {
    console.error('❌ Error fetching orders by month:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
  } finally {
    await mssql.close();
  }
}

// Function to fetch orders for a specific month and year
async function fetchOrdersForSpecificMonth(year, month, companyLocationId = null) {
  try {
    console.log(`📊 Fetching orders for ${month}/${year}...\n`);
    if (companyLocationId) {
      console.log(`🏢 Filtering by Company Location ID: ${companyLocationId}\n`);
    }

    const orders = await mssql.query(`
      SELECT 
        id,
        name as order_name,
        email,
        total_price,
        currency,
        financial_status,
        fulfillment_status,
        created_at,
        customer_id,
        shipping_address_city,
        shipping_address_country,
        company_location_id
      FROM [shopify].[order] 
      WHERE YEAR(created_at) = @year 
        AND MONTH(created_at) = @month
        AND _fivetran_deleted != 1
        ${companyLocationId ? 'AND company_location_id = @companyLocationId' : ''}
      ORDER BY created_at DESC
    `, companyLocationId ? { year, month, companyLocationId } : { year, month });

    console.log(`Found ${orders.length} orders for ${month}/${year}`);
    console.table(orders);

    // Get summary for the specific month
    const summary = await mssql.query(`
      SELECT 
        COUNT(*) as order_count,
        SUM(total_price) as total_revenue,
        AVG(total_price) as avg_order_value,
        MIN(total_price) as min_order_value,
        MAX(total_price) as max_order_value
      FROM [shopify].[order] 
      WHERE YEAR(created_at) = @year 
        AND MONTH(created_at) = @month
        AND _fivetran_deleted != 1
        ${companyLocationId ? 'AND company_location_id = @companyLocationId' : ''}
    `, companyLocationId ? { year, month, companyLocationId } : { year, month });

    console.log(`\nSummary for ${month}/${year}:`);
    console.table(summary);

  } catch (error) {
    console.error('❌ Error fetching orders for specific month:', error);
  } finally {
    await mssql.close();
  }
}

// Function to export orders by month to a structured format
async function exportOrdersByMonth(startDate, endDate, companyLocationId = null) {
  try {
    console.log(`📤 Exporting orders from ${startDate} to ${endDate}...\n`);
    if (companyLocationId) {
      console.log(`🏢 Filtering by Company Location ID: ${companyLocationId}\n`);
    }

    const ordersExport = await mssql.query(`
      SELECT 
        id,
        name as order_name,
        email,
        total_price,
        currency,
        financial_status,
        fulfillment_status,
        FORMAT(created_at, 'yyyy-MM-dd HH:mm:ss') as created_at_formatted,
        FORMAT(created_at, 'yyyy-MM') as year_month,
        customer_id,
        shipping_address_city,
        shipping_address_country,
        order_budget_month,
        company_location_id
      FROM [shopify].[order] 
      WHERE created_at >= @startDate 
        AND created_at <= @endDate
        AND _fivetran_deleted != 1
        ${companyLocationId ? 'AND company_location_id = @companyLocationId' : ''}
      ORDER BY created_at DESC
    `, companyLocationId ? { startDate, endDate, companyLocationId } : { startDate, endDate });

    console.log(`📊 Exported ${ordersExport.length} orders`);
    return ordersExport;

  } catch (error) {
    console.error('❌ Error exporting orders:', error);
    return [];
  } finally {
    await mssql.close();
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  // Check command line arguments for specific operations
  const args = process.argv.slice(2);
  
  if (args.length >= 2 && args[0] === 'specific') {
    // Usage: node fetch-orders-by-month.js specific 2024 10 [companyLocationId]
    const year = parseInt(args[1]);
    const month = parseInt(args[2]);
    const companyLocationId = args[3] ? parseInt(args[3]) : null;
    
    if (year && month >= 1 && month <= 12) {
      fetchOrdersForSpecificMonth(year, month, companyLocationId);
    } else {
      console.error('❌ Invalid year or month. Usage: node fetch-orders-by-month.js specific YYYY MM [companyLocationId]');
    }
  } else if (args.length >= 3 && args[0] === 'export') {
    // Usage: node fetch-orders-by-month.js export 2024-01-01 2024-12-31 [companyLocationId]
    const startDate = args[1];
    const endDate = args[2];
    const companyLocationId = args[3] ? parseInt(args[3]) : null;
    exportOrdersByMonth(startDate, endDate, companyLocationId);
  } else if (args.length >= 3 && !isNaN(parseInt(args[0])) && !isNaN(parseInt(args[1])) && !isNaN(parseInt(args[2]))) {
    // Usage: node fetch-orders-by-month.js companyLocationId year month
    const companyLocationId = parseInt(args[0]);
    const year = parseInt(args[1]);
    const month = parseInt(args[2]);
    
    if (year && month >= 1 && month <= 12) {
      fetchOrdersForSpecificMonth(year, month, companyLocationId);
    } else {
      console.error('❌ Invalid year or month. Usage: node fetch-orders-by-month.js companyLocationId YYYY MM');
    }
  } else {
    // Default: run the general analysis
    // Usage: node fetch-orders-by-month.js [companyLocationId]
    const companyLocationId = args[0] ? parseInt(args[0]) : null;
    fetchOrdersByMonth(companyLocationId);
  }
}

export { fetchOrdersByMonth, fetchOrdersForSpecificMonth, exportOrdersByMonth };