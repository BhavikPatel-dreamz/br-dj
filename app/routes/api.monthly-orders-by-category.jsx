import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getMonthlyOrderProductsByCategoryWithRefunds as getMonthlyOrderProductsByCategory } from "../actions/fhr-orders-corrected-refunds.server.js";
import { 
  validateShopifyProxyRequest, 
  createSecureProxyResponse 
} from "../utils/shopify-security.server.js";

/**
 * Secure API Route for Monthly Order Products by Category (with Refunds)
 * Supports both authenticated Shopify users and secure proxy access
 * Returns net quantities and values after subtracting refunds
 * GET /api/monthly-orders-by-category
 * 
 * Query Parameters:
 * - customerId: Customer ID to filter by
 * - locationId: Location ID to filter by  
 * - companyLocationId: Company Location ID to filter by
 * - month: Month (01-12, defaults to current month)
 * - year: Year (YYYY, defaults to current year)
 * - signature: HMAC signature for proxy requests (optional for enhanced security)
 * - secure: Set to 'true' to require signature validation
 * 
 * Response includes:
 * - categories: Array of product categories with net quantities/values
 * - summary: Total orders, refund metrics, net values
 */
export const loader = async ({ request }) => {
  try {
    console.log("Request received for /api/monthly-orders-by-category");

    const url = new URL(request.url);
    
    // Check if this is a Shopify proxy request (has signature parameter)
    const signature = url.searchParams.get("signature");
    const isShopifyProxyRequest = !!signature;
    
    // Also check for explicit secure mode
    const requireSecureAuth = url.searchParams.get("secure") === "true" || isShopifyProxyRequest;
    
    let isAuthenticated = false;
    let shopifySession = null;
    let customerInfo = null;

    console.log("Request analysis:", {
      hasSignature: !!signature,
      isShopifyProxyRequest,
      requireSecureAuth,
      queryParams: Object.fromEntries(url.searchParams)
    });

    // Validate Shopify proxy signature if present
    if (requireSecureAuth && signature) {
      const validation = validateShopifyProxyRequest(
        request, 
        process.env.SHOPIFY_API_SECRET,
        true // Require customer login
      );

      if (!validation.isValid) {
        console.warn("Invalid Shopify proxy validation:", validation.error);
        console.warn("Query parameters:", Object.fromEntries(url.searchParams));
        
        // Return the prepared response if available
        if (validation.response) {
          return validation.response;
        }
        
        return createSecureProxyResponse({
          success: false,
          error: validation.error || "Invalid signature - secure authentication required",
          data: null
        }, { status: 403 });
      }

      // Customer is authenticated and logged in
      customerInfo = validation.customerInfo;
      isAuthenticated = true;
      
      console.log("Authenticated Shopify proxy request with logged-in customer", {
        customerId: customerInfo?.customerId,
        shop: customerInfo?.shop || url.searchParams.get("shop"),
        isLoggedIn: customerInfo?.isLoggedIn
      });
      
    } else if (!requireSecureAuth) {
      // Optional authentication - check if user is logged in to Shopify (existing flow)
      try {
        const authResult = await authenticate.admin(request);
        if (authResult?.admin) {
          isAuthenticated = true;
          shopifySession = authResult.session;
        }
      } catch (error) {
        // Not authenticated via admin, continue as public request
        console.log("No admin authentication, proceeding as public request");
      }
    }

    // Parse query parameters
    const customerId = url.searchParams.get("customerId")?.trim() || "";
    const locationId = url.searchParams.get("locationId")?.trim() || "";
    const companyLocationId = url.searchParams.get("companyLocationId")?.trim() || "";
    const month = url.searchParams.get("month")?.trim() || "";
    const year = url.searchParams.get("year")?.trim() || "";

    // Validate that at least one filter is provided
    if (!customerId && !locationId && !companyLocationId) {
      return json({
        success: false,
        error: "At least one filter parameter is required (customerId, locationId, or companyLocationId)",
        data: null
      }, { status: 400 });
    }

    // Set default month/year to current if not provided
    const currentDate = new Date();
    const searchMonth = month || (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const searchYear = year || currentDate.getFullYear().toString();

    // Validate month and year
    const monthNum = parseInt(searchMonth);
    const yearNum = parseInt(searchYear);
    
    if (monthNum < 1 || monthNum > 12) {
      return json({
        success: false,
        error: "Invalid month. Must be between 01 and 12",
        data: null
      }, { status: 400 });
    }

    if (yearNum < 2020 || yearNum > currentDate.getFullYear() + 1) {
      return json({
        success: false,
        error: `Invalid year. Must be between 2020 and ${currentDate.getFullYear() + 1}`,
        data: null
      }, { status: 400 });
    }

    // Build filters object
    const filters = {};
    if (customerId) filters.customerId = customerId;
    if (locationId) filters.locationId = locationId;
    if (companyLocationId) filters.companyLocationId = companyLocationId;
    
    // Add date filters
    filters.month = searchMonth;
    filters.year = searchYear;

    // Get monthly order products grouped by category (with refunds accounted for)
    const result = await getMonthlyOrderProductsByCategory(filters);

    const responseData = {
      success: true,
      error: null,
      data: {
        categories: result.categories || [],
        summary: {
          totalOrders: result.totalOrders || 0,
          ordersWithRefunds: result.ordersWithRefunds || 0,
          totalCategories: result.totalCategories || 0,
          grossValue: result.grossValue || 0,
          refundedValue: result.refundedValue || 0,
          totalValue: result.totalValue || 0, // Net value after refunds
          refundRate: result.refundRate || 0,
          month: searchMonth,
          year: searchYear,
          isAuthenticated: isAuthenticated,
          shopifyUser: isAuthenticated 
            ? (shopifySession?.shop || customerInfo?.shop || 'authenticated') 
            : null,
          customerInfo: requireSecureAuth ? {
            customerId: customerInfo?.customerId || null,
            isLoggedIn: customerInfo?.isLoggedIn || false
          } : null,
          filters: {
            customerId: customerId || null,
            locationId: locationId || null,
            companyLocationId: companyLocationId || null
          },
          secureMode: requireSecureAuth,
          refundAware: true // Indicates this response includes refund calculations
        }
      }
    };

    // Return secure response if secure authentication was used
    if (requireSecureAuth) {
      return createSecureProxyResponse(responseData);
    }

    // Standard JSON response for regular requests
    return json(responseData);

  } catch (error) {
    console.error("API Error - Monthly Orders by Category:", error);
    
    const errorResponse = {
      success: false,
      error: "Failed to fetch monthly order data by category with refunds. Please try again.",
      data: null,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };

    // Return secure error response if secure authentication was used
    if (url.searchParams.get("secure") === "true") {
      return createSecureProxyResponse(errorResponse, { status: 500 });
    }
    
    return json(errorResponse, { status: 500 });
  }
};

