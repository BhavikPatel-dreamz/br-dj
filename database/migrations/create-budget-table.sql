-- Create Budget Table for BRDJ Budget Management
-- Database: brdjdb.shopify.budget

USE brdjdb;
GO

-- Create schema if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'shopify')
BEGIN
    EXEC('CREATE SCHEMA shopify')
END
GO

-- Drop table if exists (for development purposes)
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'shopify' AND TABLE_NAME = 'budget')
BEGIN
    DROP TABLE shopify.budget;
END
GO

-- Create budget table
CREATE TABLE shopify.budget (
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
GO

-- Create budget_categories table for category allocations
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
GO

-- Create indexes for better performance
CREATE INDEX IX_budget_status ON shopify.budget(status);
CREATE INDEX IX_budget_fiscal_year ON shopify.budget(fiscal_year);
CREATE INDEX IX_budget_created_at ON shopify.budget(created_at);
CREATE INDEX IX_budget_categories_budget_id ON shopify.budget_categories(budget_id);
CREATE INDEX IX_budget_categories_category_name ON shopify.budget_categories(category_name);
GO

-- Create trigger to update updated_at timestamp
CREATE TRIGGER TR_budget_update_timestamp
ON shopify.budget
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE shopify.budget 
    SET updated_at = GETUTCDATE()
    WHERE id IN (SELECT DISTINCT id FROM inserted);
END
GO

CREATE TRIGGER TR_budget_categories_update_timestamp
ON shopify.budget_categories
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE shopify.budget_categories 
    SET updated_at = GETUTCDATE()
    WHERE id IN (SELECT DISTINCT id FROM inserted);
END
GO

-- Create trigger to update budget total when categories are modified
CREATE TRIGGER TR_budget_update_total
ON shopify.budget_categories
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Update total for affected budgets
    WITH affected_budgets AS (
        SELECT budget_id FROM inserted
        UNION
        SELECT budget_id FROM deleted
    )
    UPDATE b
    SET total_amount = ISNULL(
        (SELECT SUM(allocated_amount) 
         FROM shopify.budget_categories bc 
         WHERE bc.budget_id = b.id), 0)
    FROM shopify.budget b
    INNER JOIN affected_budgets ab ON b.id = ab.budget_id;
END
GO

-- Insert some sample data for testing
INSERT INTO shopify.budget (name, description, fiscal_year, fiscal_quarter, created_by)
VALUES 
    ('Q4 2024 Medical Supplies Budget', 'Budget for medical supplies and equipment for Q4 2024', 2024, 'Q4', 'system'),
    ('Annual Capital Equipment Budget 2024', 'Capital expenditure budget for equipment and infrastructure', 2024, 'Annual', 'system'),
    ('Housekeeping & Maintenance Budget Q4', 'Operational budget for housekeeping and maintenance supplies', 2024, 'Q4', 'system');
GO

-- Insert sample budget categories
DECLARE @budget1_id BIGINT = (SELECT id FROM shopify.budget WHERE name = 'Q4 2024 Medical Supplies Budget');
DECLARE @budget2_id BIGINT = (SELECT id FROM shopify.budget WHERE name = 'Annual Capital Equipment Budget 2024');
DECLARE @budget3_id BIGINT = (SELECT id FROM shopify.budget WHERE name = 'Housekeeping & Maintenance Budget Q4');

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
GO

-- Grant permissions (adjust as needed for your security requirements)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON shopify.budget TO [your_app_user];
-- GRANT SELECT, INSERT, UPDATE, DELETE ON shopify.budget_categories TO [your_app_user];
-- GRANT SELECT ON shopify.v_budget_summary TO [your_app_user];
-- GRANT SELECT ON shopify.v_budget_categories_detail TO [your_app_user];

PRINT 'Budget tables created successfully!';
PRINT 'Tables created:';
PRINT '- shopify.budget';
PRINT '- shopify.budget_categories';
PRINT 'Views created:';
PRINT '- shopify.v_budget_summary';
PRINT '- shopify.v_budget_categories_detail';
GO
