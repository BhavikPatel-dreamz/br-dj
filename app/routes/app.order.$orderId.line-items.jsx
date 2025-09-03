import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  DataTable,
  Badge,
  InlineStack,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);
  
  // Import server-only actions inside the loader
  const { 
    getOrderById, 
    getOrderLineItemsByOrderId, 
    getOrderLineItemStats,
    getOrderWithLineItems 
  } = await import("../actions/index.server.js");

  const orderId = params.orderId;
  
  if (!orderId) {
    throw new Response("Order ID is required", { status: 400 });
  }

  let order = null;
  let lineItems = [];
  let stats = {};
  let error = null;

  try {
    // Get order with line items and stats
    [order, lineItems, stats] = await Promise.all([
      getOrderById(orderId),
      getOrderLineItemsByOrderId(orderId),
      getOrderLineItemStats(orderId)
    ]);

    

    if (!order) {
      throw new Response("Order not found", { status: 404 });
    }

  } catch (err) {
    console.error("Error fetching order details:", err);
    error = "Failed to fetch order details. Please try again.";
  }

  return json({ order, lineItems, stats, error });
};

export default function OrderLineItems() {
    console.log(useLoaderData());
  const { order, lineItems, stats, error } = useLoaderData();

  const lineItemRows = (lineItems || []).map((item) => [
    item.name || "",
    item.sku || "",
    item.vendor || "",
    String(item.quantity || 0),
    item.currency ? `${item.currency} ${parseFloat(item.price || 0).toFixed(2)}` : `$${parseFloat(item.price || 0).toFixed(2)}`,
    item.currency ? `${item.currency} ${(parseFloat(item.price || 0) * parseInt(item.quantity || 0)).toFixed(2)}` : `$${(parseFloat(item.price || 0) * parseInt(item.quantity || 0)).toFixed(2)}`,
    item.fulfillment_status ? (
      <Badge tone={item.fulfillment_status === 'fulfilled' ? 'success' : 'attention'}>
        {item.fulfillment_status}
      </Badge>
    ) : "",
    item.gift_card ? "Yes" : "No",
    item.requires_shipping ? "Yes" : "No",
    item.taxable ? "Yes" : "No",
  ]);

  return (
    <Page
      backAction={{
        content: "Orders",
        url: "/app/search"
      }}
    >
      <TitleBar 
        title={`Order #${order?.order_number || 'N/A'} - Line Items`} 
      />
      
      <Layout>
        {error && (
          <Layout.Section>
            <Card>
              <Text as="p" color="critical">
                {error}
              </Text>
            </Card>
          </Layout.Section>
        )}

        {order && (
          <>
            {/* Order Summary */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Order Summary
                  </Text>
                  
                  <InlineStack gap="400" wrap>
                    <Box>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySmall" color="subdued">Order Number</Text>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">#{order.order_number}</Text>
                      </BlockStack>
                    </Box>
                    
                    <Box>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySmall" color="subdued">Customer ID</Text>
                        <Text as="p" variant="bodyMd">{order.customer_id || 'N/A'}</Text>
                      </BlockStack>
                    </Box>
                    
                    <Box>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySmall" color="subdued">Total Price</Text>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          {order.currency} {parseFloat(order.total_price || 0).toFixed(2)}
                        </Text>
                      </BlockStack>
                    </Box>
                    
                    <Box>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySmall" color="subdued">Financial Status</Text>
                        <Badge tone={order.financial_status === 'paid' ? 'success' : 'attention'}>
                          {order.financial_status || 'N/A'}
                        </Badge>
                      </BlockStack>
                    </Box>
                    
                    <Box>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySmall" color="subdued">Fulfillment Status</Text>
                        <Badge tone={order.fulfillment_status === 'fulfilled' ? 'success' : 'attention'}>
                          {order.fulfillment_status || 'N/A'}
                        </Badge>
                      </BlockStack>
                    </Box>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Line Items Statistics */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Line Items Statistics
                  </Text>
                  
                  <InlineStack gap="400" wrap>
                    <Box>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySmall" color="subdued">Total Items</Text>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">{stats.total_line_items || 0}</Text>
                      </BlockStack>
                    </Box>
                    
                    <Box>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySmall" color="subdued">Total Quantity</Text>
                        <Text as="p" variant="bodyMd" fontWeight="semibold">{stats.total_quantity || 0}</Text>
                      </BlockStack>
                    </Box>
                    
                    <Box>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySmall" color="subdued">Unique Products</Text>
                        <Text as="p" variant="bodyMd">{stats.unique_products || 0}</Text>
                      </BlockStack>
                    </Box>
                    
                    <Box>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySmall" color="subdued">Unique Vendors</Text>
                        <Text as="p" variant="bodyMd">{stats.unique_vendors || 0}</Text>
                      </BlockStack>
                    </Box>
                    
                    <Box>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySmall" color="subdued">Gift Card Items</Text>
                        <Text as="p" variant="bodyMd">{stats.gift_card_items || 0}</Text>
                      </BlockStack>
                    </Box>
                    
                    <Box>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodySmall" color="subdued">Items Requiring Shipping</Text>
                        <Text as="p" variant="bodyMd">{stats.shipping_required_items || 0}</Text>
                      </BlockStack>
                    </Box>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Line Items Table */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Line Items ({lineItems?.length || 0} items)
                  </Text>
                  
                  {lineItems && lineItems.length > 0 ? (
                    <DataTable
                      columnContentTypes={[
                        "text",      // Name
                        "text",      // SKU
                        "text",      // Vendor
                        "numeric",   // Quantity
                        "text",      // Unit Price
                        "text",      // Total Price
                        "text",      // Fulfillment Status
                        "text",      // Gift Card
                        "text",      // Requires Shipping
                        "text",      // Taxable
                      ]}
                      headings={[
                        "Product Name",
                        "SKU",
                        "Vendor",
                        "Quantity",
                        "Unit Price",
                        "Total Price",
                        "Fulfillment Status",
                        "Gift Card",
                        "Requires Shipping",
                        "Taxable"
                      ]}
                      rows={lineItemRows}
                    />
                  ) : (
                    <Text as="p" color="subdued">
                      No line items found for this order.
                    </Text>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}
