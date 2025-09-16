# Budget Management System Documentation

## Overview
This system provides comprehensive budget management functionality for the BRDJ application, allowing users to create, manage, and track budgets with predefined categories.

## Database Structure

### Tables Created

#### 1. `shopify.budget`
Main budget table storing budget information.

**Columns:**
- `id` (BIGINT, IDENTITY, PRIMARY KEY) - Unique budget identifier
- `name` (NVARCHAR(255), NOT NULL, UNIQUE) - Budget name
- `description` (NVARCHAR(MAX), NULL) - Optional budget description
- `total_amount` (DECIMAL(18,2), DEFAULT 0.00) - Total budget amount (calculated from categories)
- `status` (NVARCHAR(50), DEFAULT 'active') - Budget status (active, inactive, draft, archived)
- `fiscal_year` (INT, NULL) - Fiscal year for the budget
- `fiscal_quarter` (NVARCHAR(10), NULL) - Fiscal quarter (Q1, Q2, Q3, Q4, Annual)
- `created_at` (DATETIME2, DEFAULT GETUTCDATE()) - Creation timestamp
- `updated_at` (DATETIME2, DEFAULT GETUTCDATE()) - Last update timestamp
- `created_by` (NVARCHAR(255), NULL) - User who created the budget
- `updated_by` (NVARCHAR(255), NULL) - User who last updated the budget

**Constraints:**
- `CK_budget_status` - Status must be one of: active, inactive, draft, archived
- `CK_budget_total_amount` - Total amount must be >= 0
- `UQ_budget_name` - Budget name must be unique

#### 2. `shopify.budget_categories`
Budget category allocations table.

**Columns:**
- `id` (BIGINT, IDENTITY, PRIMARY KEY) - Unique category allocation identifier
- `budget_id` (BIGINT, NOT NULL) - Foreign key to budget table
- `category_name` (NVARCHAR(255), NOT NULL) - Predefined category name
- `allocated_amount` (DECIMAL(18,2), DEFAULT 0.00) - Amount allocated to this category
- `spent_amount` (DECIMAL(18,2), DEFAULT 0.00) - Amount spent from this category
- `remaining_amount` (COMPUTED) - Calculated as (allocated_amount - spent_amount)
- `created_at` (DATETIME2, DEFAULT GETUTCDATE()) - Creation timestamp
- `updated_at` (DATETIME2, DEFAULT GETUTCDATE()) - Last update timestamp

**Constraints:**
- `FK_budget_categories_budget_id` - Foreign key to budget(id) with CASCADE DELETE
- `CK_budget_categories_allocated_amount` - Allocated amount must be >= 0
- `CK_budget_categories_spent_amount` - Spent amount must be >= 0
- `UQ_budget_categories_budget_category` - Unique combination of budget_id and category_name

### Views Created

#### 1. `shopify.v_budget_summary`
Provides summary information for each budget including totals and spending statistics.

#### 2. `shopify.v_budget_categories_detail`
Provides detailed view of all budget categories with spending percentages.

### Indexes Created
- `IX_budget_status` - Index on budget status
- `IX_budget_fiscal_year` - Index on fiscal year
- `IX_budget_created_at` - Index on creation date
- `IX_budget_categories_budget_id` - Index on budget_id foreign key
- `IX_budget_categories_category_name` - Index on category name

## Predefined Categories

The system includes 24 predefined budget categories organized by department:

### General Nursing
- Gen Nsg>Medical Supplies
- Gen Nsg>Incontinent Supplies
- Gen Nsg>Wound Care
- Gen Nsg>Personal Care
- Gen Nsg>Nutrition

### Capital Equipment
- Capital>Fixed Equip
- Capital>Major Moveable Equip
- Capital>Leasehold Improvements
- Capital>Minor Equip

### Housekeeping
- Housekeeping>Minor Equip
- Housekeeping>Supplies
- Housekeeping>Cleaning Supplies

### Maintenance
- Maintenance>Supplies
- Maintenance>Minor Equip
- Maintenance>Tools

### Administration
- Administration>Office Supplies
- Administration>Technology
- Administration>Communications

### Food Service
- Food Service>Food & Beverages
- Food Service>Kitchen Supplies
- Food Service>Equipment

### Therapeutic
- Therapeutic>Recreation Supplies
- Therapeutic>Activity Materials
- Therapeutic>Equipment

## API Functions

### Server-Side Functions (`app/actions/fhr-budget.server.js`)

#### Core Functions
- `getBudgets()` - Get all budgets with category details
- `createBudget(budgetData)` - Create new budget with categories
- `getBudgetById(budgetId)` - Get specific budget by ID
- `updateBudget(budgetId, updateData)` - Update existing budget
- `deleteBudget(budgetId)` - Delete budget
- `getBudgetStats()` - Get budget statistics

#### Utility Functions
- `getBudgetCategories()` - Get list of predefined categories
- `validateBudgetCategories(categories)` - Validate category data

#### Constants
- `BUDGET_CATEGORIES` - Array of predefined category names

## Frontend Components

### Budget Creation Form (`app/routes/app.budget-management.create.jsx`)

**Features:**
- Dynamic budget name input
- Dropdown selection of predefined categories
- Add/remove categories dynamically
- Real-time total calculation
- Input validation
- Grouped display by department
- Currency formatting

**User Interface:**
1. **Budget Details Section**
   - Budget name input field
   - Action buttons (Cancel, Create)

2. **Add Categories Section**
   - Dropdown with available categories
   - Add button to include selected category

3. **Category Allocations Section**
   - Grouped by department for better organization
   - Amount input fields with currency formatting
   - Remove buttons for each category

4. **Budget Summary Section**
   - Total budget amount display
   - Category count display

## Setup Instructions

### 1. Database Setup
Execute the SQL script `/database/setup-budget-tables.sql` using SQL Server Management Studio or Azure Data Studio with database admin privileges.

### 2. Permissions
Ensure your application user (`dynamic_dreamz_login`) has the following permissions:
- SELECT, INSERT, UPDATE, DELETE on `shopify.budget`
- SELECT, INSERT, UPDATE, DELETE on `shopify.budget_categories`
- SELECT on `shopify.v_budget_summary`
- SELECT on `shopify.v_budget_categories_detail`

### 3. Application Configuration
The budget system is already integrated into your Remix application with:
- Server actions for database operations
- Frontend components for budget creation
- Validation and error handling

## Usage Examples

### Creating a Budget
1. Navigate to `/app/budget-management/create`
2. Enter a budget name
3. Select categories from the dropdown
4. Assign dollar amounts to each category
5. Review the total and click "Create Budget"

### Validation Rules
- Budget name is required and must be unique
- At least one category must be selected
- Category amounts must be positive numbers
- Only predefined categories are allowed

## Security Features
- Input validation on both client and server
- SQL injection protection through parameterized queries
- Foreign key constraints to maintain data integrity
- Transaction support for data consistency

## Future Enhancements
- Budget spending tracking
- Budget vs. actual reporting
- Budget approval workflows
- Budget templates
- Email notifications for budget thresholds
- Integration with order tracking for automatic spending updates
