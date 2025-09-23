/**
 * Test script for webhook endpoints
 * Tests both Shopify webhooks and custom API webhook
 */
import fetch from 'node-fetch';

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

// Sample Shopify order payload for testing
const sampleOrderPayload = {
  id: 6686804508899,
  name: '#2683',
  email: 'customer@example.com',
  created_at: '2025-09-22T17:02:36.000Z',
  updated_at: '2025-09-23T10:00:00.000Z',
  processed_at: '2025-09-23T10:00:00.000Z',
  total_price: '497.14',
  subtotal_price: '450.00',
  total_tax: '47.14',
  currency: 'USD',
  financial_status: 'paid',
  fulfillment_status: 'fulfilled',
  customer_id: 123456789,
  line_items: [
    {
      id: 1,
      product_id: 7891234567,
      variant_id: 9876543210,
      title: 'Sample Product',
      price: '450.00',
      quantity: 1
    }
  ]
};

// Test functions
async function testCustomWebhookAPI() {
  console.log('🧪 Testing Custom Webhook API...');
  
  const testCases = [
    {
      name: 'Order Budget Month Update',
      payload: {
        type: 'order_budget_month',
        data: {
          orderId: '6686804508899',
          createdAt: '2025-09-22T17:02:36.000Z',
          budgetMonth: '2025-09'
        },
        source: 'test_script',
        timestamp: new Date().toISOString()
      }
    },
    {
      name: 'Order Update',
      payload: {
        type: 'order_update',
        data: {
          orderId: '6686804508899',
          budgetMonth: '2025-09'
        },
        source: 'test_script',
        timestamp: new Date().toISOString()
      }
    },
    {
      name: 'Budget Sync',
      payload: {
        type: 'budget_sync',
        data: {
          orders: [
            { orderId: '6686804508899', budgetMonth: '2025-09' },
            { orderId: '6686802378979', budgetMonth: '2025-09' }
          ]
        },
        source: 'test_script',
        timestamp: new Date().toISOString()
      }
    }
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`\n📝 Testing: ${testCase.name}`);
      
      const response = await fetch(`${BASE_URL}/api/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase.payload)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Success:', result.message);
        console.log('📊 Result:', result.result);
      } else {
        console.log('❌ Failed:', result.error);
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${testCase.name}:`, error.message);
    }
  }
}

async function testWebhookInfo() {
  console.log('\n📋 Testing Webhook Info Endpoint...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/webhook`, {
      method: 'GET'
    });
    
    const info = await response.json();
    console.log('✅ Webhook Info:', JSON.stringify(info, null, 2));
    
  } catch (error) {
    console.error('❌ Error getting webhook info:', error.message);
  }
}

// Note: Testing Shopify webhooks requires proper authentication headers
async function simulateShopifyWebhook(endpoint, payload) {
  console.log(`\n🔗 Simulating Shopify webhook: ${endpoint}`);
  
  try {
    // This would normally include Shopify webhook headers for authentication
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In real Shopify webhooks, these headers are required:
        // 'X-Shopify-Topic': 'orders/create',
        // 'X-Shopify-Hmac-Sha256': 'calculated_hmac',
        // 'X-Shopify-Shop-Domain': 'shop-name.myshopify.com'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.text();
    
    if (response.ok) {
      console.log('✅ Webhook processed successfully');
      if (result) {
        console.log('📊 Response:', result);
      }
    } else {
      console.log('❌ Webhook failed:', result);
    }
    
  } catch (error) {
    console.error(`❌ Error simulating webhook:`, error.message);
  }
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting Webhook API Tests...');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  
  // Test custom webhook API
  await testCustomWebhookAPI();
  
  // Test webhook info endpoint
  await testWebhookInfo();
  
  // Note about Shopify webhook testing
  console.log('\n⚠️  Shopify Webhook Testing Notes:');
  console.log('- Shopify webhooks require proper HMAC authentication');
  console.log('- Use ngrok or similar to test webhooks from Shopify');
  console.log('- Test webhooks in Shopify Partner Dashboard');
  console.log('- Check webhook delivery status in Shopify Admin');
  
  console.log('\n📖 To test Shopify webhooks:');
  console.log('1. Set up ngrok: ngrok http 3000');
  console.log('2. Update webhook URLs in Shopify with ngrok URL');
  console.log('3. Create/update orders in Shopify admin');
  console.log('4. Monitor console logs for webhook processing');
  
  console.log('\n✅ Test execution completed');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

export { runTests, testCustomWebhookAPI, simulateShopifyWebhook };