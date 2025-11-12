import mssql from '../app/mssql.server.js';

/**
 * Fetch orders by date range (month-wise breakdown)
 * Usage: node scripts/fetch-orders-by-date-range.js <startDate> <endDate> [companyLocationIds]
 * Example: node scripts/fetch-orders-by-date-range.js 2024-01-01 2024-12-31
 * Example: node scripts/fetch-orders-by-date-range.js 2024-01-01 2024-12-31 123
 * Example: node scripts/fetch-orders-by-date-range.js 2024-01-01 2024-12-31 123,456,789
 */

async function fetchOrdersByDateRange(startDate, endDate, companyLocationIds = null) {
  try {
    console.log(`\n📊 Fetching orders from ${startDate} to ${endDate}...\n`);
    
    // Parse location IDs (can be single ID or comma-separated list)
    let locationIdArray = null;
    let locationFilter = '';
    let locationParams = { startDate, endDate };
    
    if (companyLocationIds) {
      if (typeof companyLocationIds === 'string' && companyLocationIds.includes(',')) {
        locationIdArray = companyLocationIds.split(',').map(id => id.trim()).filter(id => id);
      } else if (typeof companyLocationIds === 'string') {
        locationIdArray = [companyLocationIds];
      } else if (Array.isArray(companyLocationIds)) {
        locationIdArray = companyLocationIds;
      } else {
        locationIdArray = [companyLocationIds.toString()];
      }
      
      if (locationIdArray.length > 0) {
        console.log(`🏢 Filtering by Company Location ID(s): ${locationIdArray.join(', ')}\n`);
        
        // Build IN clause for multiple locations
        const locationPlaceholders = locationIdArray.map((_, i) => `@locationId${i}`).join(', ');
        locationFilter = `AND company_location_id IN (${locationPlaceholders})`;
        
        // Add each location ID to params
        locationIdArray.forEach((id, i) => {
          locationParams[`locationId${i}`] = id;
        });
      }
    }

    // 1. Month-wise summary
    console.log('📅 Month-wise Order Summary:');
    console.log('━'.repeat(80));
    
    const monthWiseSummary = await mssql.query(`
      SELECT 
        FORMAT(created_at, 'yyyy-MM') as year_month,
        DATENAME(month, created_at) + ' ' + CAST(YEAR(created_at) AS VARCHAR) as month_name,
        COUNT(*) as order_count,
        SUM(total_price) as total_revenue,
        AVG(total_price) as avg_order_value,
        MIN(total_price) as min_order_value,
        MAX(total_price) as max_order_value,
        COUNT(DISTINCT customer_id) as unique_customers
      FROM [shopify].[order] 
      WHERE created_at >= @startDate 
        AND created_at <= @endDate
        AND _fivetran_deleted != 1
        AND created_at IS NOT NULL
        ${locationFilter}
      GROUP BY FORMAT(created_at, 'yyyy-MM'), DATENAME(month, created_at), YEAR(created_at)
      ORDER BY year_month DESC
    `, locationParams);

    console.table(monthWiseSummary);

    // 2. Overall summary for the date range
    console.log('\n📊 Overall Summary:');
    console.log('━'.repeat(80));
    
    const overallSummary = await mssql.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_price) as total_revenue,
        AVG(total_price) as avg_order_value,
        MIN(total_price) as min_order_value,
        MAX(total_price) as max_order_value,
        COUNT(DISTINCT customer_id) as unique_customers,
        MIN(created_at) as earliest_order,
        MAX(created_at) as latest_order
      FROM [shopify].[order] 
      WHERE created_at >= @startDate 
        AND created_at <= @endDate
        AND _fivetran_deleted != 1
        AND created_at IS NOT NULL
        ${locationFilter}
    `, locationParams);

    console.table(overallSummary);

    // 3. Orders by financial status
    console.log('\n💰 Orders by Financial Status:');
    console.log('━'.repeat(80));
    
    const ordersByStatus = await mssql.query(`
      SELECT 
        ISNULL(financial_status, 'unknown') as financial_status,
        COUNT(*) as order_count,
        SUM(total_price) as total_revenue,
        AVG(total_price) as avg_order_value
      FROM [shopify].[order] 
      WHERE created_at >= @startDate 
        AND created_at <= @endDate
        AND _fivetran_deleted != 1
        AND created_at IS NOT NULL
        ${locationFilter}
      GROUP BY financial_status
      ORDER BY order_count DESC
    `, locationParams);

    console.table(ordersByStatus);

    // 4. Orders by fulfillment status
    console.log('\n📦 Orders by Fulfillment Status:');
    console.log('━'.repeat(80));
    
    const ordersByFulfillment = await mssql.query(`
      SELECT 
        ISNULL(fulfillment_status, 'unfulfilled') as fulfillment_status,
        COUNT(*) as order_count,
        SUM(total_price) as total_revenue
      FROM [shopify].[order] 
      WHERE created_at >= @startDate 
        AND created_at <= @endDate
        AND _fivetran_deleted != 1
        AND created_at IS NOT NULL
        ${locationFilter}
      GROUP BY fulfillment_status
      ORDER BY order_count DESC
    `, locationParams);

    console.table(ordersByFulfillment);

    // 5. Top 10 recent orders
    console.log('\n📋 Top 10 Most Recent Orders:');
    console.log('━'.repeat(80));
    
    const recentOrders = await mssql.query(`
      SELECT TOP 10
        id,
        name as order_name,
        email,
        total_price,
        currency,
        financial_status,
        fulfillment_status,
        FORMAT(created_at, 'yyyy-MM-dd HH:mm:ss') as created_at,
        customer_id,
        company_location_id,
        order_budget_month
      FROM [shopify].[order] 
      WHERE created_at >= @startDate 
        AND created_at <= @endDate
        AND _fivetran_deleted != 1
        AND created_at IS NOT NULL
        ${locationFilter}
      ORDER BY created_at DESC
    `, locationParams);

    console.table(recentOrders);

    console.log('\n✅ Orders fetched successfully!');
    console.log(`📊 Total months in range: ${monthWiseSummary.length}`);
    
    return {
      monthWiseSummary,
      overallSummary,
      ordersByStatus,
      ordersByFulfillment,
      recentOrders
    };

  } catch (error) {
    console.error('❌ Error fetching orders by date range:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    throw error;
  } finally {
    await mssql.close();
  }
}

/**
 * Fetch detailed order list for a specific month
 */
async function fetchOrdersForMonth(year, month, companyLocationIds = null) {
  try {
    console.log(`\n📊 Fetching orders for ${month}/${year}...\n`);
    
    // Parse location IDs (can be single ID or comma-separated list)
    let locationIdArray = null;
    let locationFilter = '';
    let locationParams = { year, month };
    
    if (companyLocationIds) {
      if (typeof companyLocationIds === 'string' && companyLocationIds.includes(',')) {
        locationIdArray = companyLocationIds.split(',').map(id => id.trim()).filter(id => id);
      } else if (typeof companyLocationIds === 'string') {
        locationIdArray = [companyLocationIds];
      } else if (Array.isArray(companyLocationIds)) {
        locationIdArray = companyLocationIds;
      } else {
        locationIdArray = [companyLocationIds.toString()];
      }
      
      if (locationIdArray.length > 0) {
        console.log(`🏢 Filtering by Company Location ID(s): ${locationIdArray.join(', ')}\n`);
        
        // Build IN clause for multiple locations
        const locationPlaceholders = locationIdArray.map((_, i) => `@locationId${i}`).join(', ');
        locationFilter = `AND company_location_id IN (${locationPlaceholders})`;
        
        // Add each location ID to params
        locationIdArray.forEach((id, i) => {
          locationParams[`locationId${i}`] = id;
        });
      }
    }

    // Get all orders for the specific month
    console.log('📋 All Orders:');
    console.log('━'.repeat(80));
    
    const orders = await mssql.query(`
      SELECT 
        id,
        name as order_name,
        email,
        total_price,
        currency,
        financial_status,
        fulfillment_status,
        FORMAT(created_at, 'yyyy-MM-dd HH:mm:ss') as created_at,
        customer_id,
        shipping_address_city,
        shipping_address_country,
        company_location_id,
        order_budget_month
      FROM [shopify].[order] 
      WHERE YEAR(created_at) = @year 
        AND MONTH(created_at) = @month
        AND _fivetran_deleted != 1
        AND created_at IS NOT NULL
        ${locationFilter}
      ORDER BY created_at DESC
    `, locationParams);

    console.log(`\nFound ${orders.length} orders for ${month}/${year}\n`);
    console.table(orders);

    // Get summary for the month
    console.log('\n📊 Month Summary:');
    console.log('━'.repeat(80));
    
    const summary = await mssql.query(`
      SELECT 
        COUNT(*) as order_count,
        SUM(total_price) as total_revenue,
        AVG(total_price) as avg_order_value,
        MIN(total_price) as min_order_value,
        MAX(total_price) as max_order_value,
        COUNT(DISTINCT customer_id) as unique_customers
      FROM [shopify].[order] 
      WHERE YEAR(created_at) = @year 
        AND MONTH(created_at) = @month
        AND _fivetran_deleted != 1
        AND created_at IS NOT NULL
        ${locationFilter}
    `, locationParams);

    console.table(summary);

    console.log('\n✅ Month data fetched successfully!');
    
    return {
      orders,
      summary
    };

  } catch (error) {
    console.error('❌ Error fetching orders for month:', error);
    throw error;
  } finally {
    await mssql.close();
  }
}

/**
 * Export orders to JSON format
 */
async function exportOrdersToJSON(startDate, endDate, companyLocationIds = null) {
  try {
    console.log(`\n📤 Exporting orders from ${startDate} to ${endDate}...\n`);
    
    // Parse location IDs (can be single ID or comma-separated list)
    let locationIdArray = null;
    let locationFilter = '';
    let locationParams = { startDate, endDate };
    
    if (companyLocationIds) {
      if (typeof companyLocationIds === 'string' && companyLocationIds.includes(',')) {
        locationIdArray = companyLocationIds.split(',').map(id => id.trim()).filter(id => id);
      } else if (typeof companyLocationIds === 'string') {
        locationIdArray = [companyLocationIds];
      } else if (Array.isArray(companyLocationIds)) {
        locationIdArray = companyLocationIds;
      } else {
        locationIdArray = [companyLocationIds.toString()];
      }
      
      if (locationIdArray.length > 0) {
        console.log(`🏢 Filtering by Company Location ID(s): ${locationIdArray.join(', ')}\n`);
        
        // Build IN clause for multiple locations
        const locationPlaceholders = locationIdArray.map((_, i) => `@locationId${i}`).join(', ');
        locationFilter = `AND company_location_id IN (${locationPlaceholders})`;
        
        // Add each location ID to params
        locationIdArray.forEach((id, i) => {
          locationParams[`locationId${i}`] = id;
        });
      }
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
        FORMAT(created_at, 'yyyy-MM-dd HH:mm:ss') as created_at,
        FORMAT(created_at, 'yyyy-MM') as year_month,
        customer_id,
        shipping_address_city,
        shipping_address_province,
        shipping_address_country,
        shipping_address_zip,
        company_location_id,
        order_budget_month
      FROM [shopify].[order] 
      WHERE created_at >= @startDate 
        AND created_at <= @endDate
        AND _fivetran_deleted != 1
        AND created_at IS NOT NULL
        ${locationFilter}
      ORDER BY created_at DESC
    `, locationParams);

    console.log(`✅ Exported ${orders.length} orders\n`);
    
    // Save to file
    const fs = await import('fs');
    const locationSuffix = locationIdArray && locationIdArray.length > 0 
      ? `_locations_${locationIdArray.join('-')}` 
      : '';
    const filename = `orders_${startDate}_to_${endDate}${locationSuffix}.json`;
    fs.writeFileSync(filename, JSON.stringify(orders, null, 2));
    console.log(`💾 Saved to file: ${filename}`);
    
    return orders;

  } catch (error) {
    console.error('❌ Error exporting orders:', error);
    throw error;
  } finally {
    await mssql.close();
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('\n📖 Usage:');
    console.log('━'.repeat(80));
    console.log('1. Fetch orders by date range:');
    console.log('   node scripts/fetch-orders-by-date-range.js <startDate> <endDate> [locationIds]');
    console.log('   Example: node scripts/fetch-orders-by-date-range.js 2024-01-01 2024-12-31');
    console.log('   Example: node scripts/fetch-orders-by-date-range.js 2024-01-01 2024-12-31 123');
    console.log('   Example: node scripts/fetch-orders-by-date-range.js 2024-01-01 2024-12-31 123,456,789\n');
    
    console.log('2. Fetch orders for a specific month:');
    console.log('   node scripts/fetch-orders-by-date-range.js month <year> <month> [locationIds]');
    console.log('   Example: node scripts/fetch-orders-by-date-range.js month 2024 10');
    console.log('   Example: node scripts/fetch-orders-by-date-range.js month 2024 10 123');
    console.log('   Example: node scripts/fetch-orders-by-date-range.js month 2024 10 123,456\n');
    
    console.log('3. Export orders to JSON:');
    console.log('   node scripts/fetch-orders-by-date-range.js export <startDate> <endDate> [locationIds]');
    console.log('   Example: node scripts/fetch-orders-by-date-range.js export 2024-01-01 2024-12-31');
    console.log('   Example: node scripts/fetch-orders-by-date-range.js export 2024-01-01 2024-12-31 123');
    console.log('   Example: node scripts/fetch-orders-by-date-range.js export 2024-01-01 2024-12-31 123,456,789\n');
    
    process.exit(1);
  }

  // Handle different command modes
  if (args[0] === 'month' && args.length >= 3) {
    // Fetch orders for a specific month
    const year = parseInt(args[1]);
    const month = parseInt(args[2]);
    const companyLocationIds = args[3] || null;
    
    if (!year || !month || month < 1 || month > 12) {
      console.error('❌ Invalid year or month. Month should be between 1-12');
      process.exit(1);
    }
    
    fetchOrdersForMonth(year, month, companyLocationIds);
    
  } else if (args[0] === 'export' && args.length >= 3) {
    // Export orders to JSON
    const startDate = args[1];
    const endDate = args[2];
    const companyLocationIds = args[3] || null;
    
    exportOrdersToJSON(startDate, endDate, companyLocationIds);
    
  } else {
    // Fetch orders by date range (default mode)
    const startDate = args[0];
    const endDate = args[1];
    const companyLocationIds = args[2] || null;
    
    fetchOrdersByDateRange(startDate, endDate, companyLocationIds);
  }
}

export { fetchOrdersByDateRange, fetchOrdersForMonth, exportOrdersToJSON };
