import crypto from "crypto";

/**
 * Shopify Security Utilities
 * Provides functions for validating Shopify signatures and proxy requests
 */

/**
 * Verifies Shopify proxy signature
 * Used for Shopify proxy requests where signature verification is required
 * 
 * @param {Object} queryParams - All query parameters from the request
 * @param {string} signature - The signature to verify
 * @param {string} secret - The Shopify API secret key
 * @returns {boolean} - True if signature is valid, false otherwise
 */
export function verifyShopifyProxySignature(queryParams, signature, secret) {
  if (!signature || !secret) {
    console.log("Missing signature or secret:", { hasSignature: !!signature, hasSecret: !!secret });
    return false;
  }

  try {
    // Remove signature from params to build message
    const { signature: _, ...params } = queryParams;

    // Build the message string by sorting params and concatenating
    // This matches Shopify's expected format exactly
    const message = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('');

    console.log("Signature verification details:", {
      params: params,
      sortedKeys: Object.keys(params).sort(),
      message: message,
      receivedSignature: signature
    });

    // Create HMAC digest
    const digest = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');

    console.log("Generated signature:", digest);
    console.log("Signature match:", digest === signature);

    return digest === signature;
  } catch (error) {
    console.error("Error verifying Shopify proxy signature:", error);
    return false;
  }
}

/**
 * Verifies Shopify webhook signature
 * Used for webhook endpoints to verify the request is from Shopify
 * 
 * @param {string} body - Raw request body
 * @param {string} signature - The X-Shopify-Hmac-Sha256 header value
 * @param {string} secret - The Shopify API secret key
 * @returns {boolean} - True if signature is valid, false otherwise
 */
export function verifyShopifyWebhookSignature(body, signature, secret) {
  if (!signature || !secret || !body) {
    return false;
  }

  // Remove 'sha256=' prefix if present
  const cleanSignature = signature.replace('sha256=', '');

  // Create HMAC digest
  const digest = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  return digest === cleanSignature;
}

/**
 * Middleware-like function for Remix routes to verify Shopify proxy signature
 * and ensure customer is logged in
 * 
 * @param {Request} request - The request object
 * @param {string} secret - The Shopify API secret key
 * @param {boolean} requireLogin - Whether to require customer login (default: true)
 * @returns {Object} - { isValid: boolean, customerInfo?: object, error?: string, response?: Response }
 */
export function validateShopifyProxyRequest(request, secret, requireLogin = true) {
  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    const signature = queryParams.signature;

    if (!signature) {
      return {
        isValid: false,
        error: "Missing signature parameter"
      };
    }

    const isValid = verifyShopifyProxySignature(queryParams, signature, secret);

    if (!isValid) {
      return {
        isValid: false,
        error: "Invalid signature"
      };
    }

    // Extract customer information
    const customerInfo = extractShopifyCustomerInfo(request);

    // Check if customer login is required
    if (requireLogin && (!customerInfo?.isLoggedIn || !customerInfo?.customerId)) {
      return {
        isValid: false,
        customerInfo,
        error: "Customer login required",
        response: createSecureProxyResponse({
          success: false,
          error: "Access denied - Customer must be logged in to Shopify to access this resource",
          data: {
            loginRequired: true,
            shop: customerInfo?.shop,
            message: "Please log in to your Shopify customer account to access this resource"
          }
        }, { status: 401 })
      };
    }

    return {
      isValid: true,
      customerInfo,
      error: null
    };

  } catch (error) {
    return {
      isValid: false,
      error: "Failed to validate signature"
    };
  }
}

/**
 * Extract customer information from Shopify proxy headers and query parameters
 * 
 * @param {Request} request - The request object
 * @returns {Object} - Customer information from headers and query params
 */
export function extractShopifyCustomerInfo(request) {
  const url = new URL(request.url);
  
  // Try to get customer info from headers first (for embedded app requests)
  const headerCustomerId = request.headers.get("X-Shopify-Logged-In-Customer-Id");
  const headerCustomerEmail = request.headers.get("X-Shopify-Logged-In-Customer-Email");
  const headerShop = request.headers.get("X-Shopify-Shop-Domain");
  
  // For proxy requests, get info from query parameters
  const queryCustomerId = url.searchParams.get("logged_in_customer_id");
  const queryShop = url.searchParams.get("shop");
  
  // Use query params if headers are not available (proxy requests)
  const customerId = headerCustomerId || queryCustomerId;
  const shop = headerShop || queryShop;

  return {
    customerId: customerId || null,
    customerEmail: headerCustomerEmail || null,
    shop: shop || null,
    isLoggedIn: !!customerId,
    source: headerCustomerId ? 'headers' : 'query'
  };
}

/**
 * Creates a secure response with appropriate headers for Shopify proxy
 * 
 * @param {any} data - The data to return
 * @param {Object} options - Response options
 * @returns {Response} - Remix Response with security headers
 */
export function createSecureProxyResponse(data, options = {}) {
  const { status = 200, headers = {} } = options;

  // Add security headers
  const securityHeaders = {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...headers
  };

  return new Response(JSON.stringify(data), {
    status,
    headers: securityHeaders
  });
}
