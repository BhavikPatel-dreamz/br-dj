-- Create Budget Location Assignments Table
-- This table links budgets to specific company locations

USE brdjdb;
GO

-- Create budget_location_assignments table
CREATE TABLE shopify.budget_location_assignments (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    budget_id BIGINT NOT NULL,
    location_id NVARCHAR(255) NOT NULL,
    status NVARCHAR(50) NOT NULL DEFAULT 'active',
    assigned_by NVARCHAR(255) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    -- Foreign key constraint to budget table
    CONSTRAINT FK_budget_location_assignments_budget_id 
        FOREIGN KEY (budget_id) REFERENCES shopify.budget(id) 
        ON DELETE CASCADE,
    
    -- Check constraints
    CONSTRAINT CK_budget_location_assignments_status 
        CHECK (status IN ('active', 'inactive')),
    
    -- Unique constraint to prevent duplicate assignments
    CONSTRAINT UQ_budget_location_assignments_budget_location 
        UNIQUE (budget_id, location_id, status)
);

-- Create indexes for better performance
CREATE INDEX IX_budget_location_assignments_budget_id ON shopify.budget_location_assignments(budget_id);
CREATE INDEX IX_budget_location_assignments_location_id ON shopify.budget_location_assignments(location_id);
CREATE INDEX IX_budget_location_assignments_status ON shopify.budget_location_assignments(status);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON shopify.budget_location_assignments TO dynamic_dreamz_login;

-- Create view for easier querying
CREATE VIEW shopify.v_budget_location_assignments AS
SELECT 
    bla.id,
    bla.budget_id,
    b.name as budget_name,
    b.total_amount as budget_total,
    b.status as budget_status,
    bla.location_id,
    bla.status as assignment_status,
    bla.assigned_by,
    bla.created_at as assigned_at,
    bla.updated_at
FROM shopify.budget_location_assignments bla
INNER JOIN shopify.budget b ON bla.budget_id = b.id
WHERE bla.status = 'active';

-- Grant view permissions
GRANT SELECT ON shopify.v_budget_location_assignments TO dynamic_dreamz_login;

PRINT 'Budget location assignments table created successfully!';
PRINT 'Table: shopify.budget_location_assignments';
PRINT 'View: shopify.v_budget_location_assignments';
GO
