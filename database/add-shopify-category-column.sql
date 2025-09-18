-- Add shopify_category column to products table
-- This script adds a new column to store Shopify category information from metafields

USE brdjdb;
GO

-- Check if the shopify.products table exists
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='products' AND xtype='U' AND uid = SCHEMA_ID('shopify'))
BEGIN
    -- Create products table if it doesn't exist
    CREATE TABLE shopify.products (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        shopify_product_id NVARCHAR(50) UNIQUE,
        title NVARCHAR(500),
        handle NVARCHAR(255),
        product_type NVARCHAR(200),
        vendor NVARCHAR(200),
        status NVARCHAR(50),
        shopify_category NVARCHAR(500),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    
    PRINT 'Created shopify.products table with shopify_category column';
END
ELSE
BEGIN
    -- Add shopify_category column if table exists but column doesn't
    IF NOT EXISTS (
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'products' 
        AND TABLE_SCHEMA = 'shopify'
        AND COLUMN_NAME = 'shopify_category'
    )
    BEGIN
        ALTER TABLE shopify.products 
        ADD shopify_category NVARCHAR(500) NULL;
        
        PRINT 'Added shopify_category column to shopify.products table';
    END
    ELSE
    BEGIN
        PRINT 'shopify_category column already exists in shopify.products table';
    END
END

-- Create indexes for better performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_products_shopify_category')
BEGIN
    CREATE INDEX IX_products_shopify_category 
    ON shopify.products (shopify_category);
    
    PRINT 'Created index on shopify_category column';
END

-- Show current table structure
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'products' 
AND TABLE_SCHEMA = 'shopify'
ORDER BY ORDINAL_POSITION;

PRINT 'Current shopify.products table structure displayed above';
