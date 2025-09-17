-- Create Budget Categories Master Table
-- This table will store the master list of budget categories that can be used across budgets

USE brdjdb;
GO

-- Create budget_categories_master table
CREATE TABLE shopify.budget_categories_master (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    category_name NVARCHAR(255) NOT NULL,
    category_code NVARCHAR(50) NULL,
    description NVARCHAR(MAX) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    parent_category NVARCHAR(255) NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    created_by NVARCHAR(255) NULL,
    updated_by NVARCHAR(255) NULL,
    
    -- Add constraints
    CONSTRAINT UQ_budget_categories_master_name UNIQUE (category_name)
);

-- Create indexes for better performance
CREATE INDEX IX_budget_categories_master_name ON shopify.budget_categories_master(category_name);
CREATE INDEX IX_budget_categories_master_parent ON shopify.budget_categories_master(parent_category);
CREATE INDEX IX_budget_categories_master_active ON shopify.budget_categories_master(is_active);
CREATE INDEX IX_budget_categories_master_sort ON shopify.budget_categories_master(sort_order);

-- Insert default categories from the hardcoded list
INSERT INTO shopify.budget_categories_master (category_name, category_code, parent_category, description, sort_order, created_by) VALUES 
-- General Nursing categories
('Gen Nsg>Medical Supplies', 'GN001', 'Gen Nsg', 'General nursing medical supplies', 10, 'system'),
('Gen Nsg>Incontinent Supplies', 'GN002', 'Gen Nsg', 'Incontinence and hygiene supplies', 20, 'system'), 
('Gen Nsg>Wound Care', 'GN003', 'Gen Nsg', 'Wound care and dressing supplies', 30, 'system'),
('Gen Nsg>Personal Care', 'GN004', 'Gen Nsg', 'Personal care items for patients', 40, 'system'),
('Gen Nsg>Nutrition', 'GN005', 'Gen Nsg', 'Nutritional supplements and feeding supplies', 50, 'system'),
('Gen Nsg>House', 'GN006', 'Gen Nsg', 'General housekeeping supplies for nursing', 60, 'system'),
('Gen Nsg>Minor Equip', 'GN007', 'Gen Nsg', 'Small equipment for nursing', 70, 'system'),
('Gen Nsg>PEN Supplies', 'GN008', 'Gen Nsg', 'PEN related nursing supplies', 80, 'system'),
('Gen Nsg>Urology & Ostomy', 'GN009', 'Gen Nsg', 'Urology and ostomy care supplies', 90, 'system'),
('Gen Nsg>Forms & Printing', 'GN010', 'Gen Nsg', 'Forms and printing materials', 100, 'system'),
('Gen Nsg>Personal Items', 'GN011', 'Gen Nsg', 'Personal items for patients', 110, 'system'),
('Gen Nsg>Rental Equip', 'GN012', 'Gen Nsg', 'Equipment rental for nursing', 120, 'system'),

-- Capital Equipment categories
('Capital>Fixed Equip', 'CAP001', 'Capital', 'Fixed capital equipment', 200, 'system'),
('Capital>Major Moveable Equip', 'CAP002', 'Capital', 'Major moveable capital equipment', 210, 'system'),
('Capital>Leasehold Improvements', 'CAP003', 'Capital', 'Leasehold improvements and renovations', 220, 'system'),
('Capital>Minor Equip', 'CAP004', 'Capital', 'Minor capital equipment', 230, 'system'),

-- Housekeeping categories
('Housekeeping>Minor Equip', 'HK001', 'Housekeeping', 'Small housekeeping equipment', 300, 'system'),
('Housekeeping>Supplies', 'HK002', 'Housekeeping', 'General housekeeping supplies', 310, 'system'),
('Housekeeping>Cleaning Supplies', 'HK003', 'Housekeeping', 'Cleaning chemicals and supplies', 320, 'system'),

-- Maintenance categories
('Maintenance>Supplies', 'MNT001', 'Maintenance', 'General maintenance supplies', 400, 'system'),
('Maintenance>Minor Equip', 'MNT002', 'Maintenance', 'Small maintenance equipment', 410, 'system'),
('Maintenance>Tools', 'MNT003', 'Maintenance', 'Tools and equipment for maintenance', 420, 'system'),

-- Administration categories
('Admin & Gen>Office Supplies', 'ADM001', 'Admin & Gen', 'General office supplies', 500, 'system'),
('Admin & Gen>Minor Equip', 'ADM002', 'Admin & Gen', 'Small office equipment', 510, 'system'),
('Administration>Technology', 'ADM003', 'Administration', 'Technology and IT equipment', 520, 'system'),
('Administration>Communications', 'ADM004', 'Administration', 'Communication equipment and services', 530, 'system'),

-- Dietary/Food Service categories
('Dietary>Minor Equip', 'DT001', 'Dietary', 'Small dietary equipment', 600, 'system'),
('Dietary>Supplements', 'DT002', 'Dietary', 'Nutritional supplements', 610, 'system'),
('Dietary>Dietary Supplies', 'DT003', 'Dietary', 'General dietary supplies', 620, 'system'),
('Food Service>Food & Beverages', 'FS001', 'Food Service', 'Food and beverage items', 630, 'system'),
('Food Service>Kitchen Supplies', 'FS002', 'Food Service', 'Kitchen supplies and utensils', 640, 'system'),
('Food Service>Equipment', 'FS003', 'Food Service', 'Kitchen and food service equipment', 650, 'system'),

-- Laundry categories
('Laundry>Linens', 'LND001', 'Laundry', 'Bed linens and towels', 700, 'system'),
('Laundry>Minor Equip', 'LND002', 'Laundry', 'Small laundry equipment', 710, 'system'),

-- Therapy categories
('Therapy>Minor Equip', 'TH001', 'Therapy', 'Small therapy equipment', 800, 'system'),
('Therapy>Therapy Supplies', 'TH002', 'Therapy', 'General therapy supplies', 810, 'system'),
('Therapy>Respiratory Supplies', 'TH003', 'Therapy', 'Respiratory therapy supplies', 820, 'system'),
('Therapeutic>Recreation Supplies', 'TH004', 'Therapeutic', 'Recreation and activity supplies', 830, 'system'),
('Therapeutic>Activity Materials', 'TH005', 'Therapeutic', 'Activity and craft materials', 840, 'system'),
('Therapeutic>Equipment', 'TH006', 'Therapeutic', 'Therapeutic equipment', 850, 'system'),

-- Activities categories
('Activities>Minor Equip', 'ACT001', 'Activities', 'Small activities equipment', 900, 'system'),
('Activities>Supplies', 'ACT002', 'Activities', 'Activity supplies and materials', 910, 'system');

PRINT 'Inserted default budget categories';
GO

-- Create view for active categories
CREATE VIEW shopify.v_budget_categories_master AS
SELECT 
    id,
    category_name,
    category_code,
    description,
    sort_order,
    parent_category,
    created_at,
    updated_at,
    created_by
FROM shopify.budget_categories_master
WHERE is_active = 1;
GO

PRINT 'Created view for active budget categories';
PRINT 'Budget categories master table created successfully!';
GO
