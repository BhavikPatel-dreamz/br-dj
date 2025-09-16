-- ========================================
-- BRDJ Budget Management Database Tables
-- Execute this script with database admin privileges
-- ========================================

USE brdjdb;
GO

-- Create schema if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'shopify')
BEGIN
    EXEC('CREATE SCHEMA shopify')
    PRINT 'Created shopify schema'
END
ELSE
BEGIN
    PRINT 'Shopify schema already exists'
END
GO

-- Drop existing tables if they exist (for clean reinstall)
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'shopify' AND TABLE_NAME = 'budget_categories')
BEGIN
    DROP TABLE shopify.budget_categories;
    PRINT 'Dropped existing budget_categories table'
END

IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'shopify' AND TABLE_NAME = 'budget')
BEGIN
    DROP TABLE shopify.budget;
    PRINT 'Dropped existing budget table'
END
GO

-- Create budget table
CREATE TABLE brdjdb.shopify.budget (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NULL,
    total_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    status NVARCHAR(50) NOT NULL DEFAULT 'active',
    fiscal_year INT NULL,
    fiscal_quarter NVARCHAR(10) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    created_by NVARCHAR(255) NULL,
    updated_by NVARCHAR(255) NULL,
    
    -- Add constraints
    CONSTRAINT CK_budget_status CHECK (status IN ('active', 'inactive', 'draft', 'archived')),
    CONSTRAINT CK_budget_total_amount CHECK (total_amount >= 0),
    CONSTRAINT UQ_budget_name UNIQUE (name)
);
PRINT 'Created budget table'
GO

-- Create budget_categories table
CREATE TABLE shopify.budget_categories (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    budget_id BIGINT NOT NULL,
    category_name NVARCHAR(255) NOT NULL,
    allocated_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    spent_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    remaining_amount AS (allocated_amount - spent_amount) PERSISTED,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    -- Foreign key constraint
    CONSTRAINT FK_budget_categories_budget_id FOREIGN KEY (budget_id) REFERENCES shopify.budget(id) ON DELETE CASCADE,
    
    -- Check constraints
    CONSTRAINT CK_budget_categories_allocated_amount CHECK (allocated_amount >= 0),
    CONSTRAINT CK_budget_categories_spent_amount CHECK (spent_amount >= 0),
    
    -- Unique constraint
    CONSTRAINT UQ_budget_categories_budget_category UNIQUE (budget_id, category_name)
);
PRINT 'Created budget_categories table'
GO

-- Create indexes for better performance
CREATE INDEX IX_budget_status ON shopify.budget(status);
CREATE INDEX IX_budget_fiscal_year ON shopify.budget(fiscal_year);
CREATE INDEX IX_budget_created_at ON shopify.budget(created_at);
CREATE INDEX IX_budget_categories_budget_id ON shopify.budget_categories(budget_id);
CREATE INDEX IX_budget_categories_category_name ON shopify.budget_categories(category_name);
PRINT 'Created indexes'
GO

-- Grant permissions to your application user
-- Replace 'dynamic_dreamz_login' with your actual application user if different
GRANT SELECT, INSERT, UPDATE, DELETE ON shopify.budget TO dynamic_dreamz_login;
GRANT SELECT, INSERT, UPDATE, DELETE ON shopify.budget_categories TO dynamic_dreamz_login;
PRINT 'Granted permissions to dynamic_dreamz_login'
GO

-- Insert sample data
INSERT INTO shopify.budget (name, description, fiscal_year, fiscal_quarter, created_by)
VALUES 
    ('Q4 2024 Medical Supplies Budget', 'Budget for medical supplies and equipment for Q4 2024', 2024, 'Q4', 'system'),
    ('Annual Capital Equipment Budget 2024', 'Capital expenditure budget for equipment and infrastructure', 2024, 'Annual', 'system'),
    ('Housekeeping & Maintenance Budget Q4', 'Operational budget for housekeeping and maintenance supplies', 2024, 'Q4', 'system');
PRINT 'Inserted sample budgets'
GO

-- Get the budget IDs for inserting categories
DECLARE @budget1_id BIGINT = (SELECT id FROM shopify.budget WHERE name = 'Q4 2024 Medical Supplies Budget');
DECLARE @budget2_id BIGINT = (SELECT id FROM shopify.budget WHERE name = 'Annual Capital Equipment Budget 2024');
DECLARE @budget3_id BIGINT = (SELECT id FROM shopify.budget WHERE name = 'Housekeeping & Maintenance Budget Q4');

-- Insert sample budget categories
INSERT INTO shopify.budget_categories (budget_id, category_name, allocated_amount)
VALUES 
    -- Medical Supplies Budget
    (@budget1_id, 'Gen Nsg>Medical Supplies', 15000.00),
    (@budget1_id, 'Gen Nsg>Incontinent Supplies', 8000.00),
    (@budget1_id, 'Gen Nsg>Wound Care', 5000.00),
    (@budget1_id, 'Gen Nsg>Personal Care', 3000.00),
    
    -- Capital Equipment Budget
    (@budget2_id, 'Capital>Fixed Equip', 50000.00),
    (@budget2_id, 'Capital>Major Moveable Equip', 25000.00),
    (@budget2_id, 'Capital>Leasehold Improvements', 15000.00),
    (@budget2_id, 'Capital>Minor Equip', 10000.00),
    
    -- Housekeeping & Maintenance Budget
    (@budget3_id, 'Housekeeping>Minor Equip', 3000.00),
    (@budget3_id, 'Housekeeping>Supplies', 8000.00),
    (@budget3_id, 'Maintenance>Supplies', 6000.00),
    (@budget3_id, 'Maintenance>Minor Equip', 4000.00);
PRINT 'Inserted sample budget categories'
GO

-- Update budget totals based on category allocations
UPDATE b
SET total_amount = cat_totals.total
FROM shopify.budget b
INNER JOIN (
    SELECT budget_id, SUM(allocated_amount) as total
    FROM shopify.budget_categories
    GROUP BY budget_id
) cat_totals ON b.id = cat_totals.budget_id;
PRINT 'Updated budget totals'
GO

-- Create views for easier querying
CREATE VIEW shopify.v_budget_summary AS
SELECT 
    b.id,
    b.name,
    b.description,
    b.total_amount,
    b.status,
    b.fiscal_year,
    b.fiscal_quarter,
    COUNT(bc.id) as category_count,
    ISNULL(SUM(bc.spent_amount), 0) as total_spent,
    ISNULL(SUM(bc.remaining_amount), 0) as total_remaining,
    CASE 
        WHEN b.total_amount > 0 THEN (ISNULL(SUM(bc.spent_amount), 0) / b.total_amount) * 100
        ELSE 0 
    END as spend_percentage,
    b.created_at,
    b.updated_at
FROM shopify.budget b
LEFT JOIN shopify.budget_categories bc ON b.id = bc.budget_id
GROUP BY 
    b.id, b.name, b.description, b.total_amount, b.status, 
    b.fiscal_year, b.fiscal_quarter, b.created_at, b.updated_at;
PRINT 'Created v_budget_summary view'
GO

CREATE VIEW shopify.v_budget_categories_detail AS
SELECT 
    b.id as budget_id,
    b.name as budget_name,
    bc.id as category_id,
    bc.category_name,
    bc.allocated_amount,
    bc.spent_amount,
    bc.remaining_amount,
    CASE 
        WHEN bc.allocated_amount > 0 THEN (bc.spent_amount / bc.allocated_amount) * 100
        ELSE 0 
    END as category_spend_percentage,
    bc.created_at as category_created_at,
    bc.updated_at as category_updated_at
FROM shopify.budget b
INNER JOIN shopify.budget_categories bc ON b.id = bc.budget_id;
PRINT 'Created v_budget_categories_detail view'
GO

-- Grant permissions on views
GRANT SELECT ON shopify.v_budget_summary TO dynamic_dreamz_login;
GRANT SELECT ON shopify.v_budget_categories_detail TO dynamic_dreamz_login;
PRINT 'Granted view permissions'
GO

-- Verify the installation
SELECT 'Budget Tables Created Successfully!' as Status;
SELECT COUNT(*) as BudgetCount FROM shopify.budget;
SELECT COUNT(*) as CategoryCount FROM shopify.budget_categories;

-- Show sample data
SELECT 
    b.name as BudgetName,
    b.total_amount as TotalAmount,
    COUNT(bc.id) as CategoryCount
FROM shopify.budget b
LEFT JOIN shopify.budget_categories bc ON b.id = bc.budget_id
GROUP BY b.id, b.name, b.total_amount
ORDER BY b.name;

PRINT 'Budget database setup completed successfully!'
