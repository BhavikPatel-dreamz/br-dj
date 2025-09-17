import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSessionsTable() {
  try {
    console.log('🔍 Testing Prisma connection to sessions table...');
    
    // Test creating a session
    const newSession = await prisma.session.create({
      data: {
        id: `session_test_${Date.now()}`,
        shop: 'test-shop.myshopify.com',
        state: 'active',
        accessToken: 'test_token_123',
        isOnline: true,
        accountOwner: true
      }
    });
    
    console.log('✅ Session created successfully:', {
      id: newSession.id,
      shop: newSession.shop,
      createdAt: newSession.createdAt
    });
    
    // Test reading sessions
    const sessions = await prisma.session.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('✅ Found sessions in database:', sessions.length);
    console.log('Recent sessions:', sessions.map(s => ({ id: s.id, shop: s.shop, createdAt: s.createdAt })));
    
    // Clean up test session
    await prisma.session.delete({
      where: { id: newSession.id }
    });
    
    console.log('✅ Test session cleaned up');
    console.log('🎉 Prisma sessions table test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing sessions table:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSessionsTable();
