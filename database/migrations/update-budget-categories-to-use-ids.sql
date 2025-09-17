-- Migration: Update budget_categories table to use category IDs instead of names
-- This migration will modify the budget_categories table to reference budget_categories_master by ID

USE brdjdb;
GO

-- Step 1: Add the new category_id column
ALTER TABLE shopify.budget_categories 
ADD category_id BIGINT NULL;
GO

-- Step 2: Add foreign key constraint to budget_categories_master
ALTER TABLE shopify.budget_categories
ADD CONSTRAINT FK_budget_categories_category_id 
FOREIGN KEY (category_id) REFERENCES shopify.budget_categories_master(id);
GO

-- Step 3: Populate category_id based on existing category_name
UPDATE bc
SET category_id = bcm.id
FROM shopify.budget_categories bc
INNER JOIN shopify.budget_categories_master bcm ON bc.category_name = bcm.name
WHERE bc.category_id IS NULL;
GO

-- Step 4: Check for any unmapped categories (should be handled)
SELECT 
    bc.id as budget_category_id,
    bc.category_name,
    'No matching master category found' as issue
FROM shopify.budget_categories bc
LEFT JOIN shopify.budget_categories_master bcm ON bc.category_name = bcm.name
WHERE bc.category_id IS NULL;
GO

-- Step 5: Once all categories are mapped, make category_id NOT NULL
-- (Only run this after confirming all categories are mapped)
-- ALTER TABLE shopify.budget_categories 
-- ALTER COLUMN category_id BIGINT NOT NULL;

-- Step 6: Drop the old category_name column (run this after testing)
-- ALTER TABLE shopify.budget_categories 
-- DROP COLUMN category_name;

-- Step 7: Update unique constraint to use category_id instead of category_name
-- (Run this after dropping category_name column)
-- ALTER TABLE shopify.budget_categories 
-- DROP CONSTRAINT UQ_budget_categories_budget_category;

-- ALTER TABLE shopify.budget_categories
-- ADD CONSTRAINT UQ_budget_categories_budget_category_id UNIQUE (budget_id, category_id);

-- Step 8: Create index on category_id for performance
CREATE INDEX IX_budget_categories_category_id ON shopify.budget_categories(category_id);
GO

PRINT 'Migration completed: budget_categories now uses category_id';
PRINT 'NOTE: Steps 5-7 are commented out for safety. Run them after verification.';
GO
