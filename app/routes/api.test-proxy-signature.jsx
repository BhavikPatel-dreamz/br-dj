import { json } from "@remix-run/node";
import { 
  validateShopifyProxyRequest, 
  extractShopifyCustomerInfo,
  createSecureProxyResponse,
  verifyShopifyProxySignature
} from "../utils/shopify-security.server.js";

/**
 * Test API Route for Shopify Proxy Signature Validation
 * GET /api/test-proxy-signature
 * 
 * This endpoint is for testing Shopify proxy signature validation
 * Example URL: /api/test-proxy-signature?customerId=7436043714787&month=08&year=2025&shop=findash-shipping-1.myshopify.com&logged_in_customer_id=&path_prefix=%2Fapps%2Fmonthly-orders-by-category&timestamp=1756883092&signature=f891fecda9488272b9fde6b1518f18938f17de1c9ae4571a9f5a01be3c878808
 */
export const loader = async ({ request }) => {
  try {
    console.log("=== TESTING PROXY SIGNATURE VALIDATION ===");
    
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    
    console.log("All query parameters:", queryParams);
    
    const signature = url.searchParams.get("signature");
    
    if (!signature) {
      return json({
        success: false,
        error: "No signature parameter found",
        data: { queryParams }
      });
    }

    // Test the signature validation
    console.log("Testing signature validation...");
    
    const validation = validateShopifyProxyRequest(
      request, 
      process.env.SHOPIFY_API_SECRET
    );

    // Also test direct verification
    const directVerification = verifyShopifyProxySignature(
      queryParams,
      signature,
      process.env.SHOPIFY_API_SECRET
    );

    // Extract customer info
    const customerInfo = extractShopifyCustomerInfo(request);

    console.log("=== VALIDATION RESULTS ===");
    console.log("Validation result:", validation);
    console.log("Direct verification:", directVerification);
    console.log("Customer info:", customerInfo);

    const responseData = {
      success: true,
      error: null,
      data: {
        signature: {
          received: signature,
          isValid: validation.isValid,
          directVerification: directVerification,
          error: validation.error
        },
        queryParams: queryParams,
        customerInfo: customerInfo,
        environment: {
          hasSecret: !!process.env.SHOPIFY_API_SECRET,
          secretLength: process.env.SHOPIFY_API_SECRET?.length || 0
        }
      }
    };

    return json(responseData);

  } catch (error) {
    console.error("Test API Error:", error);
    
    return json({
      success: false,
      error: "Test failed",
      data: {
        errorMessage: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }, { status: 500 });
  }
};
