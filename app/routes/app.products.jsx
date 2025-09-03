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
  Badge,
  Select,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

import { 
  getProducts, 
  getProductsCount, 
  getUniqueVendors,
  getUniqueProductTypes,
  getProductInventoryStats
} from "../actions/fhr-products.server.js";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId")?.trim() || "";
  const handle = url.searchParams.get("handle")?.trim() || "";
  const vendor = url.searchParams.get("vendor")?.trim() || "";
  const productType = url.searchParams.get("productType")?.trim() || "";
  const status = url.searchParams.get("status")?.trim() || "";
  const title = url.searchParams.get("title")?.trim() || "";
  const isGiftCard = url.searchParams.get("isGiftCard");

  let products = [];
  let error = null;
  let totalCount = 0;
  let vendors = [];
  let productTypes = [];
  let inventoryStats = {};

  try {
    // Get filter options and stats
    [vendors, productTypes, inventoryStats] = await Promise.all([
      getUniqueVendors(),
      getUniqueProductTypes(),
      getProductInventoryStats()
    ]);

    // If any search criteria provided, search for products
    if (productId || handle || vendor || productType || status || title || isGiftCard) {
      const filters = {};
      if (productId) filters.productId = productId;
      if (handle) filters.handle = handle;
      if (vendor) filters.vendor = vendor;
      if (productType) filters.productType = productType;
      if (status) filters.status = status;
      if (title) filters.title = title;
      if (isGiftCard !== null) filters.isGiftCard = isGiftCard === 'true';

      [products, totalCount] = await Promise.all([
        getProducts(filters, 100, 0),
        getProductsCount(filters)
      ]);
    }

  } catch (err) {
    console.error("Database query error:", err);
    error = "Failed to fetch products. Please try again.";
  }

  return json({ 
    filters: { productId, handle, vendor, productType, status, title, isGiftCard }, 
    products, 
    error,
    totalCount,
    vendors,
    productTypes,
    inventoryStats
  });
};

export default function SearchProducts() {
  const { filters, products, error, totalCount, vendors, productTypes, inventoryStats } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  
  const [productId, setProductId] = useState(filters.productId || "");
  const [handle, setHandle] = useState(filters.handle || "");
  const [vendor, setVendor] = useState(filters.vendor || "");
  const [productType, setProductType] = useState(filters.productType || "");
  const [status, setStatus] = useState(filters.status || "");
  const [title, setTitle] = useState(filters.title || "");
  const [isGiftCard, setIsGiftCard] = useState(filters.isGiftCard || "");

  // Update state when URL parameters change
  useEffect(() => {
    setProductId(filters.productId || "");
    setHandle(filters.handle || "");
    setVendor(filters.vendor || "");
    setProductType(filters.productType || "");
    setStatus(filters.status || "");
    setTitle(filters.title || "");
    setIsGiftCard(filters.isGiftCard || "");
  }, [filters]);

  const handleSubmit = (event) => {
    event.preventDefault();
    
    const formData = new FormData();
    if (productId.trim()) formData.append("productId", productId.trim());
    if (handle.trim()) formData.append("handle", handle.trim());
    if (vendor.trim()) formData.append("vendor", vendor.trim());
    if (productType.trim()) formData.append("productType", productType.trim());
    if (status.trim()) formData.append("status", status.trim());
    if (title.trim()) formData.append("title", title.trim());
    if (isGiftCard.trim()) formData.append("isGiftCard", isGiftCard.trim());
    
    submit(formData, { method: "get" });
  };

  const handleClear = () => {
    setProductId("");
    setHandle("");
    setVendor("");
    setProductType("");
    setStatus("");
    setTitle("");
    setIsGiftCard("");
    // Navigate to the same route without parameters
    submit(new FormData(), { method: "get" });
  };

  const isSearching = navigation.state === "loading";

  // Prepare vendor options
  const vendorOptions = [
    { label: 'All Vendors', value: '' },
    ...vendors.map(v => ({ label: v, value: v }))
  ];

  // Prepare product type options
  const productTypeOptions = [
    { label: 'All Product Types', value: '' },
    ...productTypes.map(pt => ({ label: pt, value: pt }))
  ];

  // Prepare status options
  const statusOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Draft', value: 'draft' },
    { label: 'Archived', value: 'archived' }
  ];

  // Prepare gift card options
  const giftCardOptions = [
    { label: 'All Products', value: '' },
    { label: 'Gift Cards Only', value: 'true' },
    { label: 'Regular Products Only', value: 'false' }
  ];

  const rows = (products || []).map((product) => [
    String(product.id || ""),
    product.title || "",
    product.handle || "",
    product.vendor || "",
    product.product_type || "",
    product.status ? (
      <Badge tone={product.status === 'active' ? 'success' : product.status === 'draft' ? 'attention' : 'critical'}>
        {product.status}
      </Badge>
    ) : "",
    String(product.total_inventory || 0),
    product.is_gift_card ? "Yes" : "No",
    product.min_variant_price_currency_code && product.min_variant_price_amount 
      ? `${product.min_variant_price_currency_code} ${parseFloat(product.min_variant_price_amount || 0).toFixed(2)}`
      : "",
    product.created_at ? new Date(product.created_at).toLocaleString() : "",
  ]);

  return (
    <Page>
      <TitleBar title="Search Products" />
      <Layout>
        {/* Inventory Statistics */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Inventory Overview
              </Text>
              
              <InlineStack gap="400" wrap>
                <Box>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySmall" color="subdued">Total Products</Text>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">{inventoryStats.total_products || 0}</Text>
                  </BlockStack>
                </Box>
                
                <Box>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySmall" color="subdued">In Stock</Text>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">{inventoryStats.in_stock_products || 0}</Text>
                  </BlockStack>
                </Box>
                
                <Box>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySmall" color="subdued">Out of Stock</Text>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">{inventoryStats.out_of_stock_products || 0}</Text>
                  </BlockStack>
                </Box>
                
                <Box>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySmall" color="subdued">Total Inventory</Text>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">{inventoryStats.total_inventory || 0}</Text>
                  </BlockStack>
                </Box>
                
                <Box>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySmall" color="subdued">Unique Vendors</Text>
                    <Text as="p" variant="bodyMd">{inventoryStats.unique_vendors || 0}</Text>
                  </BlockStack>
                </Box>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Search Form */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Find Products
              </Text>
              <form onSubmit={handleSubmit}>
                <BlockStack gap="400">
                  <InlineStack gap="300" align="start">
                    <div style={{ minWidth: 200 }}>
                      <TextField
                        label="Product ID"
                        placeholder="Enter Product ID"
                        value={productId}
                        onChange={setProductId}
                        autoComplete="off"
                        disabled={isSearching}
                      />
                    </div>
                    <div style={{ minWidth: 200 }}>
                      <TextField
                        label="Handle"
                        placeholder="Enter Handle"
                        value={handle}
                        onChange={setHandle}
                        autoComplete="off"
                        disabled={isSearching}
                      />
                    </div>
                    <div style={{ minWidth: 200 }}>
                      <TextField
                        label="Title Search"
                        placeholder="Search in title"
                        value={title}
                        onChange={setTitle}
                        autoComplete="off"
                        disabled={isSearching}
                      />
                    </div>
                  </InlineStack>

                  <InlineStack gap="300" align="start">
                    <div style={{ minWidth: 200 }}>
                      <Select
                        label="Vendor"
                        options={vendorOptions}
                        value={vendor}
                        onChange={setVendor}
                        disabled={isSearching}
                      />
                    </div>
                    <div style={{ minWidth: 200 }}>
                      <Select
                        label="Product Type"
                        options={productTypeOptions}
                        value={productType}
                        onChange={setProductType}
                        disabled={isSearching}
                      />
                    </div>
                    <div style={{ minWidth: 200 }}>
                      <Select
                        label="Status"
                        options={statusOptions}
                        value={status}
                        onChange={setStatus}
                        disabled={isSearching}
                      />
                    </div>
                    <div style={{ minWidth: 200 }}>
                      <Select
                        label="Gift Cards"
                        options={giftCardOptions}
                        value={isGiftCard}
                        onChange={setIsGiftCard}
                        disabled={isSearching}
                      />
                    </div>
                  </InlineStack>

                  <InlineStack gap="200">
                    <Button submit variant="primary" loading={isSearching}>
                      Search Products
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

        {/* Results */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Results {products && products.length > 0 && totalCount && `(${products.length} of ${totalCount} products found)`}
              </Text>
              
              {error && (
                <Text as="p" color="critical">
                  {error}
                </Text>
              )}
              
              {isSearching && (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <Spinner size="small" />
                  <Text as="p">Searching products...</Text>
                </div>
              )}
              
              {!isSearching && products && products.length === 0 && (productId || handle || vendor || productType || status || title || isGiftCard) && (
                <Text as="p" color="subdued">
                  No products found matching your search criteria.
                </Text>
              )}
              
              {!isSearching && products && products.length > 0 && (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text", "numeric", "text", "text", "text"]}
                  headings={["ID", "Title", "Handle", "Vendor", "Product Type", "Status", "Inventory", "Gift Card", "Min Price", "Created At"]}
                  rows={rows}
                />
              )}
              
              {!productId && !handle && !vendor && !productType && !status && !title && !isGiftCard && (
                <Text as="p" color="subdued">
                  Use the filters above to search for products.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
