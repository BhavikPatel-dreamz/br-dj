USE brdjdb;
GO

-- Check if table exists and create if it doesn't
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'shopify' AND TABLE_NAME = 'location_census')
BEGIN
    -- Create location_census table
    CREATE TABLE shopify.location_census (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        location_id NVARCHAR(255) NOT NULL,
        census_month NVARCHAR(10) NOT NULL, -- Format: MM-YYYY (e.g., "09-2025")
        census_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        
        -- Check constraints
        CONSTRAINT CK_location_census_amount CHECK (census_amount >= 0),
        
        -- Unique constraint to prevent duplicate census for same location/month
        CONSTRAINT UQ_location_census_location_month 
            UNIQUE (location_id, census_month)
    );

    -- Create indexes for better performance
    CREATE INDEX IX_location_census_location_id ON shopify.location_census(location_id);
    CREATE INDEX IX_location_census_month ON shopify.location_census(census_month);

    PRINT 'Location census table created successfully';
END
ELSE
BEGIN
    PRINT 'Location census table already exists';
END
GO

-- Check if view exists and create if it doesn't
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA = 'shopify' AND TABLE_NAME = 'v_location_census')
BEGIN
    -- Create view for easier querying
    EXEC('CREATE VIEW shopify.v_location_census AS
    SELECT 
        lc.id,
        lc.location_id,
        lc.census_month,
        lc.census_amount,
        -- Parse month and year for easier filtering
        LEFT(lc.census_month, 2) as month_number,
        RIGHT(lc.census_month, 4) as year_number
    FROM shopify.location_census lc');

    PRINT 'Location census view created successfully';
END
ELSE
BEGIN
    PRINT 'Location census view already exists';
END
GO

PRINT 'Location census setup completed';