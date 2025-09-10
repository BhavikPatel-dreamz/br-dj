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
  Divider,
  Tooltip,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getMonthlyOrderProductsByCategoryWithRefunds as getMonthlyOrderProductsByCategory } from "../actions/fhr-orders-refunds.server.js";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId")?.trim() || "";
  const location = url.searchParams.get("location")?.trim() || "";
  const companyLocationId = url.searchParams.get("companyLocationId")?.trim() || "";
  const month = url.searchParams.get("month")?.trim() || "";
  const year = url.searchParams.get("year")?.trim() || "";

  let categorizedData = [];
  let error = null;
  let totalOrders = 0;
  let ordersWithRefunds = 0;
  let totalCategories = 0;
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

      // Get monthly order products grouped by category (with refunds accounted for)
      const result = await getMonthlyOrderProductsByCategory(filters);
      categorizedData = result.categories || [];
      totalOrders = result.totalOrders || 0;
      ordersWithRefunds = result.ordersWithRefunds || 0;
      totalCategories = result.totalCategories || 0;
      grossValue = result.grossValue || 0;
      refundedValue = result.refundedValue || 0;
      totalValue = result.totalValue || 0;
      refundRate = result.refundRate || 0;

    } catch (err) {
      console.error("Database query error:", err);
      error = "Failed to fetch monthly order data by category. Please try again.";
    }
  }

  return json({ 
    filters: { customerId, location, companyLocationId, month: searchMonth, year: searchYear }, 
    categorizedData,
    error,
    totalOrders,
    ordersWithRefunds,
    totalCategories,
    grossValue,
    refundedValue,
    totalValue,
    refundRate
  });
};

export default function MonthlyOrdersByCategory() {
  const { 
    filters, 
    categorizedData, 
    error, 
    totalOrders, 
    ordersWithRefunds,
    totalCategories, 
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

  // Get selected month name
  const selectedMonthName = monthOptions.find(m => m.value === month)?.label || month;

  return (
    <Page>
      <TitleBar title="Monthly Orders by Category (with Refunds)" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Monthly Product Analysis Grouped by Category (Net of Refunds)
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
                      {isSearching ? "Analyzing..." : "Get Category Summary"}
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
        {!isSearching && categorizedData && categorizedData.length > 0 && (
          <Layout.Section>
            <InlineStack gap="400" align="start">
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
                      Product Categories
                    </Text>
                    <Text as="p" variant="bodyLg" fontWeight="bold">
                      {totalCategories}
                    </Text>
                    <Badge tone="success">
                      Categories
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
                Products by Category (Net of Refunds)
                {categorizedData && categorizedData.length > 0 && 
                  ` - ${selectedMonthName} ${year}`
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
                  <Text as="p">Analyzing orders by category...</Text>
                </div>
              )}
              
              {!isSearching && categorizedData && categorizedData.length === 0 && (customerId || location || companyLocationId) && (
                <Text as="p" color="subdued">
                  No orders found for {selectedMonthName} {year} matching your criteria.
                </Text>
              )}
              
              {!isSearching && categorizedData && categorizedData.length > 0 && (
                <BlockStack gap="500">
                  {categorizedData.map((category, categoryIndex) => (
                    <div key={categoryIndex}>
                      <Card>
                        <Box padding="400">
                          <BlockStack gap="400">
                            <InlineStack gap="300" align="space-between">
                              <Text as="h3" variant="headingLg">
                                {category.category_name || "Uncategorized"}
                              </Text>
                              <InlineStack gap="200">
                                <Badge tone="info">
                                  {category.products.length} products
                                </Badge>
                                <Badge tone="success">
                                  {category.total_quantity} items
                                </Badge>
                                <Badge tone="warning">
                                  ${category.total_value.toFixed(2)}
                                </Badge>
                              </InlineStack>
                            </InlineStack>
                            
                            <DataTable
                              columnContentTypes={["text", "text", "text", "numeric", "numeric", "numeric", "numeric"]}
                              headings={[
                                "Product Name", 
                                "SKU", 
                                "Vendor", 
                                "Quantity", 
                                "Total Price", 
                                "Avg Price", 
                                "Orders"
                              ]}
                              rows={category.products.map((product) => [
                                product.product_name || "Unknown Product",
                                product.sku || "N/A",
                                product.vendor || "N/A",
                                String(product.total_quantity || 0),
                                `$${(product.total_price || 0).toFixed(2)}`,
                                `$${(product.average_price || 0).toFixed(2)}`,
                                String(product.order_count || 0),
                              ])}
                            />
                          </BlockStack>
                        </Box>
                      </Card>
                      {categoryIndex < categorizedData.length - 1 && <Divider />}
                    </div>
                  ))}
                </BlockStack>
              )}
              
              {!customerId && !location && !companyLocationId && (
                <Text as="p" color="subdued">
                  Enter at least one search criterion (Customer ID, Location ID, or Company Location ID) to analyze monthly orders by category.
                </Text>
              )}
              
              {refundedValue > 0 && (
                <Box padding="400" background="bg-surface-caution">
                  <Text as="p" variant="bodyMd" color="subdued">
                    💡 <strong>Refund Impact:</strong> This report shows accurate net quantities and values by category after subtracting refunds. 
                    Gross revenue was ${grossValue.toFixed(2)}, with ${refundedValue.toFixed(2)} in refunds ({refundRate.toFixed(1)}% of orders), 
                    resulting in net revenue of ${totalValue.toFixed(2)}.
                    <br />
                    📊 <strong>Database Source:</strong> shopify.refund + shopify.order_line_refund tables
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
