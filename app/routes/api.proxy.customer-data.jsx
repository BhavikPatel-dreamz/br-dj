import { json } from "@remix-run/node";
import { 
  validateShopifyProxyRequest, 
  extractShopifyCustomerInfo,
  createSecureProxyResponse 
} from "../utils/shopify-security.server.js";

/**
 * Secure API Route for Customer Data with Shopify Proxy Authentication
 * GET /api/proxy/customer-data
 * 
 * This endpoint validates Shopify proxy signatures to ensure secure access
 * Query Parameters:
 * - signature: Required HMAC signature from Shopify
 * - Other proxy parameters from Shopify
 * 
 * Headers:
 * - X-Shopify-Logged-In-Customer-Id: Customer ID if logged in
 * - X-Shopify-Logged-In-Customer-Email: Customer email if logged in
 * - X-Shopify-Shop-Domain: Shop domain
 */
export const loader = async ({ request }) => {
  try {
    console.log("Secure proxy request received for customer data");

    // Validate Shopify proxy signature
    const validation = validateShopifyProxyRequest(
      request, 
      process.env.SHOPIFY_API_SECRET,
      true // Require customer login
    );

    if (!validation.isValid) {
      console.warn("Invalid Shopify proxy validation:", validation.error);
      
      // Return the prepared response if available
      if (validation.response) {
        return validation.response;
      }
      
      return createSecureProxyResponse({
        success: false,
        error: validation.error || "Invalid signature",
        data: null
      }, { status: 403 });
    }

    // Customer is authenticated and logged in
    const customerInfo = validation.customerInfo;

    // Log successful authentication (without sensitive data)
    console.log("Authenticated Shopify proxy request", {
      hasCustomerId: !!customerInfo.customerId,
      shop: customerInfo.shop,
      isLoggedIn: customerInfo.isLoggedIn,
      timestamp: new Date().toISOString()
    });

    // Return customer data
    const responseData = {
      success: true,
      error: null,
      data: {
        customerId: customerInfo.customerId,
        customerEmail: customerInfo.customerEmail,
        shop: customerInfo.shop,
        isLoggedIn: customerInfo.isLoggedIn,
        message: customerInfo.isLoggedIn 
          ? "Customer is authenticated and logged in" 
          : "Guest user - not logged in",
        timestamp: new Date().toISOString()
      }
    };

    return createSecureProxyResponse(responseData);

  } catch (error) {
    console.error("Secure API Error - Customer Data:", error);
    
    return createSecureProxyResponse({
      success: false,
      error: "Internal server error",
      data: null,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};
