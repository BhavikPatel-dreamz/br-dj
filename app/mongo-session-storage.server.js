import { Session } from "@shopify/shopify-app-remix/server";
import { PrismaClient } from "@prisma/client";

/**
 * Custom MongoDB-compatible Session Storage for Shopify
 * Works around the limitation where MongoDB's _id field cannot be updated
 */
export class MongoSessionStorage {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async storeSession(session) {
    try {
      // For MongoDB, we need to handle the immutable _id field
      const sessionData = {
        shop: session.shop,
        state: session.state || "",
        isOnline: session.isOnline,
        scope: session.scope || null,
        expires: session.expires || null,
        accessToken: session.accessToken,
        userId: session.onlineAccessInfo?.associated_user?.id ? 
          BigInt(session.onlineAccessInfo.associated_user.id) : null,
        firstName: session.onlineAccessInfo?.associated_user?.first_name || null,
        lastName: session.onlineAccessInfo?.associated_user?.last_name || null,
        email: session.onlineAccessInfo?.associated_user?.email || null,
        accountOwner: session.onlineAccessInfo?.associated_user?.account_owner || false,
        locale: session.onlineAccessInfo?.associated_user?.locale || null,
        collaborator: session.onlineAccessInfo?.associated_user?.collaborator || false,
        emailVerified: session.onlineAccessInfo?.associated_user?.email_verified || false,
      };

      // Use upsert to avoid transaction requirements
      await this.prisma.session.upsert({
        where: { id: session.id },
        update: sessionData,
        create: {
          id: session.id,
          ...sessionData,
        },
      });

      return true;
    } catch (error) {
      console.error("Error storing session:", error);
      return false;
    }
  }

  async loadSession(id) {
    try {
      const sessionData = await this.prisma.session.findUnique({
        where: { id },
      });

      if (!sessionData) {
        return undefined;
      }

      const session = new Session({
        id: sessionData.id,
        shop: sessionData.shop,
        state: sessionData.state,
        isOnline: sessionData.isOnline,
        scope: sessionData.scope || undefined,
        expires: sessionData.expires || undefined,
        accessToken: sessionData.accessToken,
        onlineAccessInfo: sessionData.userId ? {
          expires_in: 0,
          associated_user_scope: sessionData.scope || "",
          session: "",
          account_owner: sessionData.accountOwner,
          associated_user: {
            id: Number(sessionData.userId),
            first_name: sessionData.firstName || "",
            last_name: sessionData.lastName || "",
            email: sessionData.email || "",
            account_owner: sessionData.accountOwner,
            locale: sessionData.locale || "",
            collaborator: sessionData.collaborator || false,
            email_verified: sessionData.emailVerified || false,
          },
        } : undefined,
      });

      return session;
    } catch (error) {
      console.error("Error loading session:", error);
      return undefined;
    }
  }

  async deleteSession(id) {
    try {
      await this.prisma.session.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      console.error("Error deleting session:", error);
      return false;
    }
  }

  async deleteSessions(ids) {
    try {
      await this.prisma.session.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      });
      return true;
    } catch (error) {
      console.error("Error deleting sessions:", error);
      return false;
    }
  }

  async findSessionsByShop(shop) {
    try {
      const sessions = await this.prisma.session.findMany({
        where: { shop },
      });

      return sessions.map(sessionData => new Session({
        id: sessionData.id,
        shop: sessionData.shop,
        state: sessionData.state,
        isOnline: sessionData.isOnline,
        scope: sessionData.scope || undefined,
        expires: sessionData.expires || undefined,
        accessToken: sessionData.accessToken,
        onlineAccessInfo: sessionData.userId ? {
          expires_in: 0,
          associated_user_scope: sessionData.scope || "",
          session: "",
          account_owner: sessionData.accountOwner,
          associated_user: {
            id: Number(sessionData.userId),
            first_name: sessionData.firstName || "",
            last_name: sessionData.lastName || "",
            email: sessionData.email || "",
            account_owner: sessionData.accountOwner,
            locale: sessionData.locale || "",
            collaborator: sessionData.collaborator || false,
            email_verified: sessionData.emailVerified || false,
          },
        } : undefined,
      }));
    } catch (error) {
      console.error("Error finding sessions by shop:", error);
      return [];
    }
  }
}
