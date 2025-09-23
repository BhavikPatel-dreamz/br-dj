import { json } from "@remix-run/node";
import mssql from "../mssql.server.js";
import fs from "fs";
import path from "path";

/**
 * Generic Webhook API for external systems
 * POST /api/webhook
 * 
 * This endpoint can receive webhooks from external systems and process them.
 * Supports custom webhook data processing and validation.
 * 
 * Request Body:
 * {
 *   "type": "order_update" | "budget_sync" | "custom",
 *   "data": { ... webhook payload ... },
 *   "source": "external_system_name",
 *   "timestamp": "2025-09-23T10:00:00Z"
 * }
 */
export const action = async ({ request }) => {
    let result = []
  try {
    const body = await request.json();
    
     result = await handleShopifyWebhook(body);
    
    console.log('✅ Webhook processed successfully:', result);
    
    return json({
      success: true,
      result,
      processedAt: new Date().toISOString(),
      message: "Webhook processed successfully"
    });
    
  }
   catch (error) {
    console.error('❌ Error processing webhook:', error);
    return json({
      success: false,
      error: error.message,
      processedAt: new Date().toISOString(),
      message: "Failed to process webhook"
    }, { status: 500 });
  }

  
}

/**
 * Handle Shopify webhooks
 */
async function handleShopifyWebhook(orderData) {
  console.log(`🛍️  Processing Shopify webhook for order ${orderData.id}`);

  // Extract order details
  const orderId = '5561200083171';
  const orderNumber = orderData.order_number;
  const createdAt = orderData.created_at;
  
  // Extract order_budget_month from note_attributes
  let orderBudgetMonth = null;
  if (orderData.note_attributes && Array.isArray(orderData.note_attributes)) {
    const budgetAttribute = orderData.note_attributes.find(attr => 
      attr.name === 'order_budget_month'
    );
    orderBudgetMonth = budgetAttribute?.value || null;
  }
  
  // If no budget month in attributes, calculate from created_at
  if (!orderBudgetMonth && createdAt) {
    const date = new Date(createdAt);
    orderBudgetMonth = `${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
  }
  
  console.log(`📅 Order ${orderId} budget month: ${orderBudgetMonth}`);
  
  try {
    // Check if order exists in database
    const existingOrder = await mssql.query(`
      SELECT id, order_budget_month 
      FROM [shopify].[order] 
      WHERE id = @orderId
    `, { orderId });
    
    if (existingOrder.length > 0) {
      // Update existing order
      if (orderBudgetMonth) {
        await mssql.execute(`
          UPDATE [shopify].[order] 
          SET order_budget_month = @orderBudgetMonth,
              updated_at = GETDATE()
          WHERE id = @orderId
        `, { orderId, orderBudgetMonth });
        
        console.log(`✅ Updated order ${orderId} budget month to: ${orderBudgetMonth}`);
      }
      
      return {
        orderId,
        orderNumber,
        orderBudgetMonth,
        action: 'updated'
      };
      
    } else {
      console.log(`⚠️  Order ${orderId} not found in database - webhook processed but no update made`);
      
      return {
        orderId,
        orderNumber,
        orderBudgetMonth,
        action: 'not_found',
        message: 'Order not found in database'
      };
    }
    
  } catch (error) {
    console.error(`❌ Failed to process Shopify webhook for order ${orderId}:`, error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * GET handler for webhook status/info
 */
export const loader = async ({ request }) => {
  return json({
    message: "Webhook API endpoint",
    supportedTypes: [
      "order_update",
      "budget_sync", 
      "order_budget_month",
      "custom"
    ],
    shopifyWebhooks: [
      "orders/created",
      "orders/updated",
      "orders/paid",
      "orders/cancelled"
    ],
    method: "POST",
    contentType: "application/json"
  });
};