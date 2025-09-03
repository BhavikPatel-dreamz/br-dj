import { useLoaderData, useSubmit, useNavigation, Link } from "@remix-run/react";
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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

import { getOrders, getOrdersCount } from "../actions/fhr-orders.server.js";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId")?.trim() || "";
  const location = url.searchParams.get("location")?.trim() || "";
  const companyId = url.searchParams.get("companyId")?.trim() || "";
  const companyLocationId = url.searchParams.get("companyLocationId")?.trim() || "";

  let orders = [];
  let error = null;
  let totalCount = 0;

  if (customerId || location || companyId || companyLocationId) {
    try {
      // Build filters object
      const filters = {};
      if (customerId) filters.customerId = customerId;
      if (companyId) filters.companyId = companyId;
      if (location) filters.locationId = location;
      if (companyLocationId) filters.companyLocationId = companyLocationId;

      // Get orders and count using the FHR actions
      [orders, totalCount] = await Promise.all([
        getOrders(filters, 100, 0),
        getOrdersCount(filters)
      ]);

    } catch (err) {
      console.error("Database query error:", err);
      error = "Failed to fetch orders. Please try again.";
    }
  }

  return json({ 
    filters: { customerId, location, companyId, companyLocationId }, 
    orders, 
    error,
    totalCount
  });
};

export default function SearchOrders() {
  
  const { filters, orders, error, totalCount } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  
  const [customerId, setCustomerId] = useState(filters.customerId || "");
  const [companyId, setCompanyId] = useState(filters.companyId || "");
  const [location, setLocation] = useState(filters.location || "");
  const [companyLocationId, setCompanyLocationId] = useState(filters.companyLocationId || "");

  // Update state when URL parameters change
  useEffect(() => {
    setCustomerId(filters.customerId || "");
    setCompanyId(filters.companyId || "");
    setLocation(filters.location || "");
    setCompanyLocationId(filters.companyLocationId || "");
  }, [filters]);

  const handleSubmit = (event) => {
    event.preventDefault();
    
    const formData = new FormData();
    if (customerId.trim()) formData.append("customerId", customerId.trim());
    if (companyId.trim()) formData.append("companyId", companyId.trim());
    if (location.trim()) formData.append("location", location.trim());
    if (companyLocationId.trim()) formData.append("companyLocationId", companyLocationId.trim());
    
    submit(formData, { method: "get" });
  };

  const handleClear = () => {
    setCustomerId("");
    setCompanyId("");
    setLocation("");
    setCompanyLocationId("");
    // Navigate to the same route without parameters
    submit(new FormData(), { method: "get" });
  };

  const isSearching = navigation.state === "loading";

  console.log("Orders:", orders);
  const rows = (orders || []).map((o) => [
    o.order_number ? (
      <Link 
        to={`/app/order/${o.id}/line-items`} 
        style={{ color: '#1976d2', textDecoration: 'underline' }}
      >
        {o.order_number}
      </Link>
    ) : "",
    String(o.customer_id ?? ""),
    String(o.company_id ?? ""),
    String(o.location_id ?? ""),
    String(o.company_location_id ?? ""),
    String(o.currency ?? ""),
    typeof o.total_price === "number" ? o.total_price.toFixed(2) : String(o.total_price ?? ""),
    o.created_at ? new Date(o.created_at).toLocaleString() : "",
  ]);

  return (
    <Page>
      <TitleBar title="Search Orders" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Find orders by Customer ID and Location
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
                        label="Company ID (fallback)"
                        placeholder="Enter Company ID"
                        value={companyId}
                        onChange={setCompanyId}
                        autoComplete="off"
                        disabled={isSearching}
                        helpText="Used if no Customer ID provided"
                      />
                    </div>
                  </InlineStack>
                  <InlineStack gap="300" align="start">
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
                    <div style={{ minWidth: 240 }}>
                      <TextField
                        label="Company Location ID (fallback)"
                        placeholder="Enter Company Location ID"
                        value={companyLocationId}
                        onChange={setCompanyLocationId}
                        autoComplete="off"
                        disabled={isSearching}
                        helpText="Used if no Location ID provided"
                      />
                    </div>
                  </InlineStack>
                  <InlineStack gap="200" align="start">
                    <Button 
                      submit 
                      primary 
                      loading={isSearching}
                      disabled={!customerId && !companyId && !location && !companyLocationId}
                    >
                      {isSearching ? "Searching..." : "Search"}
                    </Button>
                    <Button onClick={handleClear} disabled={isSearching}>
                      Clear
                    </Button>
                  </InlineStack>
                </BlockStack>
              </form>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Results {orders && orders.length > 0 && totalCount && `(${orders.length} of ${totalCount} orders found)`}
              </Text>
              
              {error && (
                <Text as="p" color="critical">
                  {error}
                </Text>
              )}
              
              {isSearching && (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <Spinner size="small" />
                  <Text as="p">Searching orders...</Text>
                </div>
              )}
              
              {!isSearching && orders && orders.length === 0 && (customerId || companyId || location || companyLocationId) && (
                <Text as="p" color="subdued">
                  No orders found matching your search criteria.
                </Text>
              )}
              
              {!isSearching && orders && orders.length > 0 && (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text", "numeric", "text"]}
                  headings={["Order # (Click to View)", "Customer ID", "Company ID", "Location ID", "Company Location ID", "Currency", "Total", "Created at"]}
                  rows={rows}
                />
              )}
              
              {!customerId && !companyId && !location && !companyLocationId && (
                <Text as="p" color="subdued">
                  Enter at least one search criterion to find orders.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}