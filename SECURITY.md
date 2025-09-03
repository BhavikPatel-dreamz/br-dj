# Secure Shopify Proxy API Documentation

## Overview

This documentation explains how the secure Shopify proxy API endpoints work to ensure that only authenticated Shopify customers can access protected resources.

## Security Features

### 1. HMAC Signature Verification
All proxy requests must include a valid HMAC SHA256 signature to verify they come from Shopify.

### 2. Customer Login Requirement
The API checks that the customer is actually logged in to their Shopify account before allowing access.

## API Endpoints

### 1. Monthly Orders by Category
**Endpoint:** `GET /api/monthly-orders-by-category`

**Security Modes:**
- **Automatic Detection:** If a `signature` parameter is present, the API automatically enables secure mode
- **Explicit Mode:** Add `secure=true` to force signature validation

**Example Secure Request:**
```
GET /api/monthly-orders-by-category?customerId=7436043714787&month=08&year=2025&shop=findash-shipping-1.myshopify.com&logged_in_customer_id=7436043714787&path_prefix=%2Fapps%2Fmonthly-orders-by-category&timestamp=1756883092&signature=f891fecda9488272b9fde6b1518f18938f17de1c9ae4571a9f5a01be3c878808
```

**Response (when customer is not logged in):**
```json
{
  "success": false,
  "error": "Access denied - Customer must be logged in to Shopify to access this resource",
  "data": {
    "loginRequired": true,
    "shop": "findash-shipping-1.myshopify.com",
    "message": "Please log in to your Shopify customer account to access this resource"
  }
}
```

### 2. Customer Data
**Endpoint:** `GET /api/proxy/customer-data`

**Required Parameters:**
- `signature`: HMAC SHA256 signature from Shopify
- Other Shopify proxy parameters

**Response (when customer is logged in):**
```json
{
  "success": true,
  "error": null,
  "data": {
    "customerId": "7436043714787",
    "customerEmail": "customer@example.com",
    "shop": "findash-shipping-1.myshopify.com",
    "isLoggedIn": true,
    "message": "Customer is authenticated and logged in",
    "timestamp": "2025-09-03T10:30:00.000Z"
  }
}
```

## Shopify Proxy Parameters

When Shopify makes a proxy request, it includes these parameters:

- `signature`: HMAC SHA256 signature for verification
- `shop`: The shop domain (e.g., "findash-shipping-1.myshopify.com")
- `logged_in_customer_id`: Customer ID if logged in (empty if guest)
- `path_prefix`: The app proxy path prefix
- `timestamp`: Unix timestamp of the request
- Custom parameters: Any additional query parameters you send

## Security Validation Process

1. **Signature Check**: Verify the HMAC signature matches Shopify's calculation
2. **Customer Authentication**: Check if `logged_in_customer_id` has a value
3. **Access Control**: Deny access if customer is not logged in

## Error Responses

### Invalid Signature (403 Forbidden)
```json
{
  "success": false,
  "error": "Invalid signature - secure authentication required",
  "data": null
}
```

### Customer Not Logged In (401 Unauthorized)
```json
{
  "success": false,
  "error": "Access denied - Customer must be logged in to Shopify to access this resource",
  "data": {
    "loginRequired": true,
    "shop": "your-shop.myshopify.com",
    "message": "Please log in to your Shopify customer account to access this resource"
  }
}
```

## Implementation Notes

- The API automatically detects proxy requests by checking for a `signature` parameter
- All responses include appropriate security headers
- Debug logging is available in development mode
- The HMAC secret key is read from `process.env.SHOPIFY_API_SECRET`

## Testing

Use the test endpoint to verify signature validation:
```
GET /api/test-proxy-signature?[proxy-parameters-with-signature]
```

This will show you the validation results and help debug any issues with the signature calculation.
