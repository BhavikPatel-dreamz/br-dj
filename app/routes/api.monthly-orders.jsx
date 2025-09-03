import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getMonthlyOrderProducts } from "../actions/fhr-orders.server.js";

/**
 * Public API Route for Monthly Order Products
 * Supports both authenticated Shopify users and public access
 * GET /api/monthly-orders
 * 
 * Query Parameters:
 * - customerId: Customer ID to filter by
 * - locationId: Location ID to filter by  
 * - companyLocationId: Company Location ID to filter by
 * - month: Month (01-12, defaults to current month)
 * - year: Year (YYYY, defaults to current year)
 */
export const loader = async ({ request }) => {
  try {
    // Optional authentication - check if user is logged in to Shopify
    let isAuthenticated = false;
    let shopifySession = null;
    
    try {
      const authResult = await authenticate.admin(request);
      isAuthenticated = true;
      shopifySession = authResult.session;
    } catch (authError) {
      // Authentication failed - continue as public user
      console.log("Public access - no Shopify authentication");
    }
    
    const url = new URL(request.url);
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

    // Get monthly order products
    const result = await getMonthlyOrderProducts(filters);

    return json({
      success: true,
      error: null,
      data: {
        products: result.products || [],
        summary: {
          totalOrders: result.totalOrders || 0,
          totalProducts: result.totalProducts || 0,
          totalValue: result.totalValue || 0,
          month: searchMonth,
          year: searchYear,
          isAuthenticated: isAuthenticated,
          shopifyUser: isAuthenticated ? shopifySession?.shop || 'authenticated' : null,
          filters: {
            customerId: customerId || null,
            locationId: locationId || null,
            companyLocationId: companyLocationId || null
          }
        }
      }
    });

  } catch (error) {
    console.error("API Error - Monthly Orders:", error);
    
    return json({
      success: false,
      error: "Failed to fetch monthly order data. Please try again.",
      data: null,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};

/**
 * POST method for the same functionality (alternative to GET)
 * Accepts JSON body with filters
 */
export const action = async ({ request }) => {
  try {
    // Optional authentication - check if user is logged in to Shopify
    let isAuthenticated = false;
    let shopifySession = null;
    
    try {
      const authResult = await authenticate.admin(request);
      isAuthenticated = true;
      shopifySession = authResult.session;
    } catch (authError) {
      // Authentication failed - continue as public user
      console.log("Public access - no Shopify authentication");
    }

    if (request.method !== "POST") {
      return json({
        success: false,
        error: "Method not allowed. Use GET or POST.",
        data: null
      }, { status: 405 });
    }

    const body = await request.json();
    const { customerId, locationId, companyLocationId, month, year } = body;

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

    // Get monthly order products
    const result = await getMonthlyOrderProducts(filters);

    return json({
      success: true,
      error: null,
      data: {
        products: result.products || [],
        summary: {
          totalOrders: result.totalOrders || 0,
          totalProducts: result.totalProducts || 0,
          totalValue: result.totalValue || 0,
          month: searchMonth,
          year: searchYear,
          isAuthenticated: isAuthenticated,
          shopifyUser: isAuthenticated ? shopifySession?.shop || 'authenticated' : null,
          filters: {
            customerId: customerId || null,
            locationId: locationId || null,
            companyLocationId: companyLocationId || null
          }
        }
      }
    });

  } catch (error) {
    console.error("API Error - Monthly Orders (POST):", error);
    
    return json({
      success: false,
      error: "Failed to fetch monthly order data. Please try again.",
      data: null,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
};
