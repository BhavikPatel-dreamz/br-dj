import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";
import { json } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  TextField,
  Button,
  InlineStack,
  DataTable,
  Spinner,
  Select,
  Badge,
  Box,
  Tooltip,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getMonthlyOrderProductsWithRefunds } from "../actions/fhr-orders-with-refunds.server.js";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId")?.trim() || "";
  const location = url.searchParams.get("location")?.trim() || "";
  const companyLocationId = url.searchParams.get("companyLocationId")?.trim() || "";
  const month = url.searchParams.get("month")?.trim() || "";
  const year = url.searchParams.get("year")?.trim() || "";

  let productSummary = [];
  let error = null;
  let totalOrders = 0;
  let ordersWithRefunds = 0;
  let totalProducts = 0;
  let grossValue = 0;
  let refundedValue = 0;
  let totalValue = 0;
  let refundRate = 0;

  // Set default month/year to current if not provided
  const currentDate = new Date();
  const searchMonth = month || (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const searchYear = year || currentDate.getFullYear().toString();

  if (customerId || location || companyLocationId) {
    try {
      // Build filters object
      const filters = {};
      if (customerId) filters.customerId = customerId;
      if (location) filters.locationId = location;
      if (companyLocationId) filters.companyLocationId = companyLocationId;
      
      // Add date filters
      filters.month = searchMonth;
      filters.year = searchYear;

      // Get monthly order products summary with refunds
      const result = await getMonthlyOrderProductsWithRefunds(filters);
      productSummary = result.products || [];
      totalOrders = result.totalOrders || 0;
      ordersWithRefunds = result.ordersWithRefunds || 0;
      totalProducts = result.totalProducts || 0;
      grossValue = result.grossValue || 0;
      refundedValue = result.refundedValue || 0;
      totalValue = result.totalValue || 0;
      refundRate = result.refundRate || 0;

    } catch (err) {
      console.error("Database query error:", err);
      error = "Failed to fetch monthly order data. Please try again.";
    }
  }

  return json({ 
    filters: { customerId, location, companyLocationId, month: searchMonth, year: searchYear }, 
    productSummary,
    error,
    totalOrders,
    ordersWithRefunds,
    totalProducts,
    grossValue,
    refundedValue,
    totalValue,
    refundRate
  });
};

export default function MonthlyOrdersWithRefunds() {
  const { 
    filters, 
    productSummary, 
    error, 
    totalOrders, 
    ordersWithRefunds,
    totalProducts, 
    grossValue,
    refundedValue,
    totalValue,
    refundRate
  } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  
  const [customerId, setCustomerId] = useState(filters.customerId || "");
  const [location, setLocation] = useState(filters.location || "");
  const [companyLocationId, setCompanyLocationId] = useState(filters.companyLocationId || "");
  const [month, setMonth] = useState(filters.month || "");
  const [year, setYear] = useState(filters.year || "");

  // Update state when URL parameters change
  useEffect(() => {
    setCustomerId(filters.customerId || "");
    setLocation(filters.location || "");
    setCompanyLocationId(filters.companyLocationId || "");
    setMonth(filters.month || "");
    setYear(filters.year || "");
  }, [filters]);

  // Generate month options
  const monthOptions = [
    { label: 'January', value: '01' },
    { label: 'February', value: '02' },
    { label: 'March', value: '03' },
    { label: 'April', value: '04' },
    { label: 'May', value: '05' },
    { label: 'June', value: '06' },
    { label: 'July', value: '07' },
    { label: 'August', value: '08' },
    { label: 'September', value: '09' },
    { label: 'October', value: '10' },
    { label: 'November', value: '11' },
    { label: 'December', value: '12' },
  ];

  // Generate year options (current year and previous 2 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let i = 0; i < 3; i++) {
    const yearValue = (currentYear - i).toString();
    yearOptions.push({ label: yearValue, value: yearValue });
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    
    const formData = new FormData();
    if (customerId.trim()) formData.append("customerId", customerId.trim());
    if (location.trim()) formData.append("location", location.trim());
    if (companyLocationId.trim()) formData.append("companyLocationId", companyLocationId.trim());
    if (month) formData.append("month", month);
    if (year) formData.append("year", year);
    
    submit(formData, { method: "get" });
  };

  const handleClear = () => {
    setCustomerId("");
    setLocation("");
    setCompanyLocationId("");
    // Keep current month/year as default
    const currentDate = new Date();
    setMonth((currentDate.getMonth() + 1).toString().padStart(2, '0'));
    setYear(currentDate.getFullYear().toString());
    
    // Navigate to the same route with only date parameters
    const formData = new FormData();
    formData.append("month", (currentDate.getMonth() + 1).toString().padStart(2, '0'));
    formData.append("year", currentDate.getFullYear().toString());
    submit(formData, { method: "get" });
  };

  const isSearching = navigation.state === "loading";

  // Prepare data table rows for products with refund information
  const rows = (productSummary || []).map((product, index) => [
    String(index + 1),
    product.product_name || "Unknown Product",
    product.sku || "N/A",
    product.vendor || "N/A",
    product.product_type || "N/A",
    String(product.net_quantity || 0),
    `$${(product.net_value || 0).toFixed(2)}`,
    `$${(product.average_price || 0).toFixed(2)}`,
    String(product.order_count || 0),
    product.refunded_quantity > 0 ? `${product.refunded_quantity} refunded` : "No refunds",
  ]);

  // Get selected month name
  const selectedMonthName = monthOptions.find(m => m.value === month)?.label || month;

  return (
    <Page>
      <TitleBar title="Monthly Order Analysis (with Refunds)" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Monthly Product Summary by Customer & Location (Net of Refunds)
              </Text>
              <form onSubmit={handleSubmit}>
                <BlockStack gap="400">
                  <InlineStack gap="300" align="start">
                    <div style={{ minWidth: 240 }}>
                      <TextField
                        label="Customer ID"
                        placeholder="Enter Customer ID"
                        value={customerId}
                        onChange={setCustomerId}
                        autoComplete="off"
                        disabled={isSearching}
                      />
                    </div>
                    <div style={{ minWidth: 240 }}>
                      <TextField
                        label="Location ID"
                        placeholder="Enter Location ID"
                        value={location}
                        onChange={setLocation}
                        autoComplete="off"
                        disabled={isSearching}
                      />
                    </div>
                  </InlineStack>
                  <InlineStack gap="300" align="start">
                    <div style={{ minWidth: 240 }}>
                      <TextField
                        label="Company Location ID"
                        placeholder="Enter Company Location ID"
                        value={companyLocationId}
                        onChange={setCompanyLocationId}
                        autoComplete="off"
                        disabled={isSearching}
                      />
                    </div>
                  </InlineStack>
                  <InlineStack gap="300" align="start">
                    <div style={{ minWidth: 150 }}>
                      <Select
                        label="Month"
                        options={monthOptions}
                        value={month}
                        onChange={setMonth}
                        disabled={isSearching}
                      />
                    </div>
                    <div style={{ minWidth: 150 }}>
                      <Select
                        label="Year"
                        options={yearOptions}
                        value={year}
                        onChange={setYear}
                        disabled={isSearching}
                      />
                    </div>
                  </InlineStack>
                  <InlineStack gap="200" align="start">
                    <Button 
                      submit 
                      primary 
                      loading={isSearching}
                      disabled={!customerId && !location && !companyLocationId}
                    >
                      {isSearching ? "Analyzing..." : "Get Monthly Summary"}
                    </Button>
                    <Button onClick={handleClear} disabled={isSearching}>
                      Clear Filters
                    </Button>
                  </InlineStack>
                </BlockStack>
              </form>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Enhanced Summary Cards with Refund Information */}
        {!isSearching && productSummary && productSummary.length > 0 && (
          <Layout.Section>
            <InlineStack gap="400" align="start" wrap={false}>
              <Card>
                <Box padding="400">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd" color="success">
                      Total Orders
                    </Text>
                    <Text as="p" variant="bodyLg" fontWeight="bold">
                      {totalOrders}
                    </Text>
                    <Badge tone="info">
                      {selectedMonthName} {year}
                    </Badge>
                    {ordersWithRefunds > 0 && (
                      <Tooltip content={`${ordersWithRefunds} orders had refunds (${refundRate.toFixed(1)}%)`}>
                        <Badge tone="warning">
                          {ordersWithRefunds} with refunds
                        </Badge>
                      </Tooltip>
                    )}
                  </BlockStack>
                </Box>
              </Card>
              
              <Card>
                <Box padding="400">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd" color="success">
                      Unique Products
                    </Text>
                    <Text as="p" variant="bodyLg" fontWeight="bold">
                      {totalProducts}
                    </Text>
                    <Badge tone="success">
                      Different SKUs
                    </Badge>
                  </BlockStack>
                </Box>
              </Card>
              
              <Card>
                <Box padding="400">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd" color="success">
                      Net Revenue
                    </Text>
                    <Text as="p" variant="bodyLg" fontWeight="bold">
                      ${totalValue.toFixed(2)}
                    </Text>
                    <Badge tone="warning">
                      After Refunds
                    </Badge>
                    {refundedValue > 0 && (
                      <Tooltip content={`Gross: $${grossValue.toFixed(2)} - Refunds: $${refundedValue.toFixed(2)} = Net: $${totalValue.toFixed(2)}`}>
                        <Badge tone="critical">
                          ${refundedValue.toFixed(2)} refunded
                        </Badge>
                      </Tooltip>
                    )}
                  </BlockStack>
                </Box>
              </Card>
            </InlineStack>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Product Summary (Net of Refunds)
                {productSummary && productSummary.length > 0 && 
                  ` - ${selectedMonthName} ${year} (${productSummary.length} products)`
                }
              </Text>
              
              {error && (
                <Text as="p" color="critical">
                  {error}
                </Text>
              )}
              
              {isSearching && (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <Spinner size="small" />
                  <Text as="p">Analyzing monthly orders...</Text>
                </div>
              )}
              
              {!isSearching && productSummary && productSummary.length === 0 && (customerId || location || companyLocationId) && (
                <Text as="p" color="subdued">
                  No net orders found for {selectedMonthName} {year} matching your criteria (all orders may have been fully refunded).
                </Text>
              )}
              
              {!isSearching && productSummary && productSummary.length > 0 && (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "numeric", "numeric", "numeric", "numeric", "text"]}
                  headings={[
                    "#", 
                    "Product Name", 
                    "SKU", 
                    "Vendor", 
                    "Type", 
                    "Net Qty", 
                    "Net Value", 
                    "Avg Price", 
                    "Orders",
                    "Refund Status"
                  ]}
                  rows={rows}
                />
              )}
              
              {!customerId && !location && !companyLocationId && (
                <Text as="p" color="subdued">
                  Enter at least one search criterion (Customer ID, Location ID, or Company Location ID) to analyze monthly orders.
                </Text>
              )}
              
              {refundedValue > 0 && (
                <Box padding="400" background="bg-surface-caution">
                  <Text as="p" variant="bodyMd" color="subdued">
                    💡 <strong>Note:</strong> This report shows net quantities and values after subtracting refunds. 
                    Gross revenue was ${grossValue.toFixed(2)}, with ${refundedValue.toFixed(2)} in refunds, 
                    resulting in net revenue of ${totalValue.toFixed(2)}.
                  </Text>
                </Box>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
