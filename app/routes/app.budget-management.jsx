import { useLoaderData, useNavigation, Link } from "@remix-run/react";
import { json } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
  DataTable,
  Spinner,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getBudgets } from "../actions/fhr-budget.server.js";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  let budgets = [];
  let error = null;

  try {
    budgets = await getBudgets();
  } catch (err) {
    error = err.message;
    console.error("Error in budget loader:", err);
  }

  return json({
    budgets,
    error
  });
};

export default function BudgetManagement() {
  const { budgets, error } = useLoaderData();
  const navigation = useNavigation();

  const isLoading = navigation.state === "loading";

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Calculate total budget amount
  const calculateTotal = (categories) => {
    return Object.values(categories).reduce((sum, value) => {
      return sum + (parseFloat(value) || 0);
    }, 0);
  };

  // Prepare data for table
  const tableRows = budgets.map(budget => [
    budget.name,
    formatCurrency(calculateTotal(budget.categories || {})),
    new Date(budget.createdAt).toLocaleDateString(),
    Object.entries(budget.categories || {})
      .filter(([_, value]) => value && parseFloat(value) > 0)
      .map(([category, value]) => `${category}: ${formatCurrency(value)}`)
      .join(", ") || "No categories assigned"
  ]);

  const tableHeadings = [
    "Budget Name",
    "Total Amount",
    "Created Date",
    "Category Breakdown"
  ];

  return (
    <Page fullWidth >
      <TitleBar title="Budget Management" />
      
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">Budget List</Text>
                <Link to="/app/budget-management/create">
                  <Button primary>
                    Create New Budget
                  </Button>
                </Link>
              </InlineStack>

              {error && (
                <Text tone="critical">{error}</Text>
              )}

              {isLoading ? (
                <Box padding="400">
                  <InlineStack align="center">
                    <Spinner size="small" />
                    <Text>Loading budgets...</Text>
                  </InlineStack>
                </Box>
              ) : budgets.length > 0 ? (
                <DataTable
                  columnContentTypes={[
                    'text',     // Budget Name
                    'text',     // Total Amount
                    'text',     // Created Date
                    'text',     // Category Breakdown
                  ]}
                  headings={tableHeadings}
                  rows={tableRows}
                />
              ) : (
                <Box padding="400">
                  <InlineStack align="center">
                    <Text>No budgets found. Create your first budget to get started.</Text>
                  </InlineStack>
                </Box>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
