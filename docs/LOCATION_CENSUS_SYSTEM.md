# Location Census & Budget Management System

## Overview

The Location Census & Budget Management System allows administrators to assign census data to locations on a monthly basis and automatically calculate budget allocations based on the formula:

**BUDGET OF CATEGORY = CENSUS OF LOCATION × DAYS OF THE CURRENT MONTH × PPD (Per Person Day rate)**

## Features

### 1. Census Management
- **Create/Update Census Data**: Set monthly census amounts, PPD rates, and location details
- **Location Selection**: Choose from available locations in the system
- **Month Selection**: Support for various month formats (MM-YYYY, MMM-YYYY)
- **Automatic Calculation**: Days in month are automatically calculated
- **Status Management**: Active/Inactive status for census records

### 2. Budget Breakdown Analysis
- **Category-wise Budget Allocation**: View how budget is distributed across product categories
- **Spending vs Budget Comparison**: Compare actual spending against allocated budget
- **Variance Analysis**: See over/under budget amounts for each category
- **Utilization Metrics**: Track budget utilization percentages

### 3. Monthly Summary Reports
- **Location Overview**: See all locations' census and budget data for a given month
- **Performance Metrics**: Compare actual orders and spending vs allocated budgets
- **Budget Variance**: Identify locations over or under budget

## Database Schema

### Location Census Table (`shopify.location_census`)
```sql
- id: Primary key
- location_id: Location identifier
- census_month: Month in MM-YYYY format
- census_amount: Number of people/patients at location
- ppd_rate: Per Person Day rate (cost per person per day)
- days_in_month: Days in the specified month (28-31)
- total_budget_allocation: Calculated field (census_amount × ppd_rate × days_in_month)
- notes: Optional notes
- status: active/inactive/draft
- created_by/updated_by: Audit fields
- created_at/updated_at: Timestamps
```

## API Endpoints

### Web Interface
- `/app/location-census` - Main management interface

### API Routes
- `GET /api/location-census?action=locations` - Get available locations
- `GET /api/location-census?action=census&locationId=X&censusMonth=MM-YYYY` - Get specific census
- `GET /api/location-census?action=calculate&locationId=X&censusMonth=MM-YYYY` - Calculate budget allocation
- `GET /api/location-census?action=breakdown&locationId=X&censusMonth=MM-YYYY` - Get category breakdown
- `GET /api/location-census?action=summary&censusMonth=MM-YYYY` - Get monthly summary
- `POST /api/location-census` - Create/update census data

## Usage Examples

### 1. Setting Up Census Data
1. Navigate to "Location Census & Budget Management"
2. Click "Add New Census"
3. Select location and month
4. Enter census amount (e.g., 50 patients)
5. Enter PPD rate (e.g., $25.50 per person per day)
6. Days in month are auto-calculated
7. Total budget allocation is calculated automatically

### 2. Viewing Budget Breakdown
1. Select "Budget Breakdown" view
2. Choose location and month
3. View category-wise spending vs allocated budget
4. Analyze variance and utilization metrics

### 3. Monthly Performance Review
1. Select "Monthly Summary" view
2. Choose month to analyze
3. Compare all locations' performance
4. Identify locations needing attention

## Integration with Existing Systems

### Connection to Order Data
The system integrates with the existing `getMonthlyOrderProductsWithRefunds` function to:
- Pull actual spending data by category
- Compare against allocated budgets
- Calculate variance and utilization metrics

### Budget Categories Integration
- Uses existing product categories from orders
- Supports HTML entity decoding for category names
- Works with the existing budget management system

## Installation

### 1. Database Setup
```bash
node scripts/setup-location-census.js
```

### 2. Verify Installation
- Check that the `shopify.location_census` table exists
- Verify the view `shopify.v_location_census` is created
- Test by creating a sample census record

## Configuration

### Month Format Support
The system supports various month input formats:
- `09-2025` (MM-YYYY)
- `sep-2025` (MMM-YYYY) 
- `aug-2026` (MMM-YYYY)

All formats are internally converted to MM-YYYY for consistency.

### PPD Rate Configuration
Per Person Day rates can be set per location per month, allowing for:
- Seasonal adjustments
- Location-specific cost variations
- Inflation adjustments over time

## Calculations

### Budget Allocation Formula
```
Total Budget = Census Amount × PPD Rate × Days in Month
```

### Category Budget Distribution
Categories receive budget allocation proportional to their historical spending patterns:
```
Category Budget = Total Budget × (Category Spending / Total Spending)
```

### Utilization Metrics
```
Budget Utilization % = (Actual Spending / Allocated Budget) × 100
Budget Variance = Actual Spending - Allocated Budget
```

## Security & Permissions

- Requires admin authentication through Shopify App Bridge
- All database operations use parameterized queries
- Audit trail maintained with created_by/updated_by fields
- Input validation on all forms and API endpoints

## Error Handling

- Graceful handling of missing census data
- Validation of required fields
- User-friendly error messages
- Automatic rollback on database errors

## Performance Considerations

- Indexed database queries for optimal performance
- Cached calculations where appropriate
- Pagination support for large datasets
- Efficient joins between orders and census data

## Future Enhancements

1. **Automated Alerts**: Notify when locations exceed budget thresholds
2. **Trend Analysis**: Historical budget vs actual spending trends
3. **Forecasting**: Predict future budget needs based on trends
4. **Export Features**: CSV/Excel export of reports
5. **Mobile Optimization**: Responsive design for mobile access