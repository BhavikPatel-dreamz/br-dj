# Fetch Orders by Month Script

This script allows you to fetch and analyze Shopify orders from the MSSQL database, organized by month.

## Features

- **Monthly Summary**: Get order counts, revenue, and statistics by month for the current year
- **12-Month Analysis**: View trends over the last 12 months
- **Current Month Details**: See detailed order information for the current month
- **Financial Status Breakdown**: Analyze orders by payment status
- **Budget Month Analysis**: View orders using the order_budget_month column
- **Overall Statistics**: Get comprehensive database statistics
- **Specific Month Query**: Fetch orders for any specific month and year
- **Date Range Export**: Export orders within a custom date range

## Usage

### Basic Analysis (Default)
```bash
node scripts/fetch-orders-by-month.js
```
This runs the complete analysis including:
- Current year monthly summary
- Last 12 months trends
- Current month detailed orders
- Financial status breakdown
- Budget month analysis
- Overall statistics

### Specific Month Query
```bash
node scripts/fetch-orders-by-month.js specific YYYY MM
```
**Examples:**
```bash
# Get all orders from September 2025
node scripts/fetch-orders-by-month.js specific 2025 9

# Get all orders from January 2024
node scripts/fetch-orders-by-month.js specific 2024 1
```

### Date Range Export
```bash
node scripts/fetch-orders-by-month.js export YYYY-MM-DD YYYY-MM-DD
```
**Examples:**
```bash
# Export orders from 2024
node scripts/fetch-orders-by-month.js export 2024-01-01 2024-12-31

# Export orders from Q1 2025
node scripts/fetch-orders-by-month.js export 2025-01-01 2025-03-31
```

## Database Structure

The script connects to the MSSQL database and queries the `shopify.order` table with the following key columns:
- `id`: Order ID
- `name`: Order name (e.g., #2714)
- `email`: Customer email
- `total_price`: Order total amount
- `currency`: Currency code
- `financial_status`: Payment status (paid, pending, etc.)
- `fulfillment_status`: Shipping status
- `created_at`: Order creation date
- `customer_id`: Customer ID
- `order_budget_month`: Budget month (format: MM-YYYY)
- `_fivetran_deleted`: Indicates if order is soft-deleted

## Output Information

### Monthly Summary
- Order count per month
- Total revenue per month
- Average order value
- Minimum and maximum order values

### Detailed Orders
- Individual order details including customer information
- Shipping addresses
- Order status information

### Financial Analysis
- Breakdown by payment status
- Revenue analysis by status

## Database Connection

The script uses the MSSQL connection configured in `../app/mssql.server.js`. Ensure your database credentials are properly configured in your environment variables:
- `MS_SQL_HOST`
- `MS_SQL_DATABASE`
- `MS_SQL_USERNAME`
- `MS_SQL_PASSWORD`

## Error Handling

The script includes comprehensive error handling:
- Database connection issues
- Invalid command line arguments
- SQL query errors
- Graceful connection cleanup

## Dependencies

- Node.js with ES modules support
- MSSQL database connection
- Configured environment variables

## Notes

- The script excludes soft-deleted orders (`_fivetran_deleted != 1`)
- Times are displayed in UTC timezone
- All monetary values are in the original currency (typically USD)
- The script automatically closes database connections when finished