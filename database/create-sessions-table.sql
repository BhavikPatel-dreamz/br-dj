-- Create sessions table only if it doesn't exist
-- This script will NOT affect existing tables

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sessions' AND xtype='U')
BEGIN
    CREATE TABLE sessions (
        id NVARCHAR(255) NOT NULL PRIMARY KEY,
        shop NVARCHAR(500) NOT NULL,
        state NVARCHAR(500) NOT NULL,
        isOnline BIT NOT NULL DEFAULT 0,
        scope NVARCHAR(1000),
        expires DATETIME2,
        accessToken NVARCHAR(1000) NOT NULL,
        userId BIGINT,
        firstName NVARCHAR(255),
        lastName NVARCHAR(255),
        email NVARCHAR(255),
        accountOwner BIT NOT NULL DEFAULT 0,
        locale NVARCHAR(10),
        collaborator BIT DEFAULT 0,
        emailVerified BIT DEFAULT 0,
        createdAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    
    PRINT 'Sessions table created successfully.';
END
ELSE
BEGIN
    PRINT 'Sessions table already exists. No changes made.';
END
