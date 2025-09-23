# Webhook API Documentation

This document describes the webhook endpoints created for handling Shopify order events and custom webhook integrations.

## 🎯 Overview

We've created several webhook endpoints to automatically update the `order_budget_month` field when orders are created, updated, or paid in Shopify.

## 📋 Available Webhooks

### 1. Shopify Order Webhooks

#### `/webhooks/orders/create`
- **Purpose**: Handles new order creation
- **Trigger**: When a new order is created in Shopify
- **Action**: Sets the `order_budget_month` field based on order creation date

#### `/webhooks/orders/updated`
- **Purpose**: Handles order updates
- **Trigger**: When an existing order is modified in Shopify
- **Action**: Updates `order_budget_month`, `financial_status`, and `fulfillment_status`

#### `/webhooks/orders/paid`
- **Purpose**: Handles order payment events
- **Trigger**: When an order payment is processed
- **Action**: Updates `financial_status` to 'paid' and ensures `order_budget_month` is set

### 2. Custom API Webhook

#### `/api/webhook`
- **Purpose**: Generic webhook endpoint for external systems
- **Method**: `POST` (JSON payload)
- **Authentication**: None (add as needed)

## 🔧 Setup Instructions

### Step 1: Register Shopify Webhooks

You need to register the webhooks with Shopify. Choose one method:

#### Option A: Shopify Partner Dashboard
1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Navigate to your app → App setup → Webhooks
3. Add these webhooks:
   - **orders/create** → `https://your-domain.com/webhooks/orders/create`
   - **orders/updated** → `https://your-domain.com/webhooks/orders/updated`
   - **orders/paid** → `https://your-domain.com/webhooks/orders/paid`

#### Option B: Shopify CLI
```bash
shopify app generate webhook
# Follow prompts to create webhooks
```

#### Option C: Manual Registration Script
```bash
node scripts/register-webhooks.js
```

### Step 2: Update Environment Variables

Make sure your `.env` file includes:
```bash
SHOPIFY_APP_URL=https://your-domain.com
```

### Step 3: Test Webhooks

Run the test script to verify webhook functionality:
```bash
node scripts/test-webhooks.js
```

## 📊 Webhook Payloads

### Custom API Webhook Payload

```json
{
  "type": "order_budget_month",
  "data": {
    "orderId": "6686804508899",
    "createdAt": "2025-09-22T17:02:36.000Z",
    "budgetMonth": "2025-09"
  },
  "source": "external_system",
  "timestamp": "2025-09-23T10:00:00Z"
}
```

### Supported Webhook Types

#### 1. `order_budget_month`
Updates the budget month for a specific order.

**Data fields:**
- `orderId` (required): Shopify order ID
- `budgetMonth` (optional): Budget month in YYYY-MM format
- `createdAt` (optional): Order creation date (used to calculate budget month if not provided)

#### 2. `order_update`
Updates order information.

**Data fields:**
- `orderId` (required): Shopify order ID
- `budgetMonth` (optional): Budget month to set
- Additional order fields as needed

#### 3. `budget_sync`
Bulk update budget months for multiple orders.

**Data fields:**
- `orders` (required): Array of order objects
  ```json
  {
    "orders": [
      { "orderId": "123", "budgetMonth": "2025-09" },
      { "orderId": "456", "budgetMonth": "2025-09" }
    ]
  }
  ```

#### 4. `custom`
Generic webhook for custom processing.

## 🔍 Monitoring and Debugging

### Console Logs
All webhooks log their processing to the console:
- ✅ Success messages with green checkmarks
- ❌ Error messages with red X marks
- 📊 Data processing information
- 🔍 Debug information

### Example Logs
```
📦 Received orders/create webhook for shop: your-shop.myshopify.com
🔍 Order ID: 6686804508899, Order Name: #2683
💰 Order details: ID=6686804508899, Name=#2683, Total=497.14, BudgetMonth=2025-09
✅ Updated order #2683 with budget month: 2025-09
```

### Testing Webhook Delivery

1. **Shopify Admin**: Check webhook delivery logs in Settings → Notifications
2. **Application Logs**: Monitor your server console for webhook processing
3. **Database**: Verify `order_budget_month` field is being updated

## 🛠️ Customization

### Adding New Webhook Types

1. Edit `/app/routes/api.webhook.jsx`
2. Add new case in the switch statement
3. Create handler function
4. Test with custom payload

### Modifying Budget Month Calculation

The budget month is calculated as:
```javascript
const budgetMonth = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
```

To use different logic (e.g., fiscal year), modify this calculation in the webhook handlers.

### Adding Authentication

For production, add authentication to `/api/webhook`:

```javascript
// Add to the action function
const apiKey = request.headers.get('Authorization');
if (apiKey !== `Bearer ${process.env.WEBHOOK_API_KEY}`) {
  return json({ error: 'Unauthorized' }, { status: 401 });
}
```

## 🚨 Error Handling

### Common Issues

1. **Order not found**: Order hasn't been synced to local database yet
2. **Permission errors**: Database user lacks UPDATE permissions
3. **Invalid date formats**: Ensure dates are ISO 8601 format
4. **Network timeouts**: Shopify webhook timeouts after 5 seconds

### Error Responses

Webhooks return status 200 even on errors to prevent Shopify retries:

```json
{
  "success": false,
  "error": "Internal server error processing webhook"
}
```

## 📈 Performance Considerations

1. **Database Connection Pooling**: Handled by mssql.server.js
2. **Webhook Timeouts**: Keep processing under 5 seconds
3. **Bulk Operations**: Use `budget_sync` for multiple order updates
4. **Logging**: Consider log levels for production

## 🔒 Security Notes

1. **HMAC Verification**: Shopify webhooks include HMAC signatures for verification
2. **IP Whitelisting**: Consider restricting webhook endpoints to Shopify IPs
3. **Rate Limiting**: Implement if receiving high webhook volumes
4. **Input Validation**: All webhook inputs are validated

## 📞 Support

For issues with webhooks:
1. Check server logs for error details
2. Verify webhook registration in Shopify
3. Test with sample payloads using the test script
4. Ensure database connectivity and permissions