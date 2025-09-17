import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseStructure() {
  try {
    console.log('🔍 Checking database structure...');
    
    // Check all tables
    const tables = await prisma.$queryRaw`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `;
    console.log('✅ Available tables:', tables);
    
    // Check sessions table structure
    const sessionColumns = await prisma.$queryRaw`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        IS_NULLABLE, 
        COLUMN_DEFAULT,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'sessions' 
      ORDER BY ORDINAL_POSITION
    `;
    
    console.log('📋 Sessions table structure:');
    sessionColumns.forEach(col => {
      console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'} ${col.COLUMN_DEFAULT ? `DEFAULT ${col.COLUMN_DEFAULT}` : ''}`);
    });
    
    // Check if Prisma schema matches database structure
    console.log('\n🔍 Checking Prisma schema consistency...');
    
    const sessionCount = await prisma.session.count();
    console.log(`✅ Total sessions in database: ${sessionCount}`);
    
  } catch (error) {
    console.error('❌ Error checking database structure:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseStructure();
