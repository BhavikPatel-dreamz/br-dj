import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const SessionService = {
  // Create a new session
  async create(sessionData) {
    try {
      return await prisma.session.create({
        data: sessionData
      });
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  },

  // Find session by ID
  async findById(sessionId) {
    try {
      return await prisma.session.findUnique({
        where: { id: sessionId }
      });
    } catch (error) {
      console.error('Error finding session:', error);
      throw error;
    }
  },

  // Find sessions by shop
  async findByShop(shopDomain) {
    try {
      return await prisma.session.findMany({
        where: { shop: shopDomain },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error('Error finding sessions by shop:', error);
      throw error;
    }
  },

  // Update session
  async update(sessionId, updateData) {
    try {
      return await prisma.session.update({
        where: { id: sessionId },
        data: updateData
      });
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  },

  // Delete session
  async delete(sessionId) {
    try {
      return await prisma.session.delete({
        where: { id: sessionId }
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  },

  // Delete expired sessions
  async deleteExpired() {
    try {
      const now = new Date();
      return await prisma.session.deleteMany({
        where: {
          expires: {
            lt: now
          }
        }
      });
    } catch (error) {
      console.error('Error deleting expired sessions:', error);
      throw error;
    }
  },

  // Count total sessions
  async count() {
    try {
      return await prisma.session.count();
    } catch (error) {
      console.error('Error counting sessions:', error);
      throw error;
    }
  }
};

// Clean up function to close Prisma connection
export const closePrismaConnection = async () => {
  await prisma.$disconnect();
};

export default SessionService;
