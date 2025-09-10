import { useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { useState } from "react";
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
  TextField,
  FormLayout,
  Select,
  List,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getBudgets, createBudget } from "../actions/fhr-budget.server.js";

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

export const action = async ({ request }) => {
  await authenticate.admin(request);
  
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  try {
    if (actionType === "create") {
      const budgetData = {
        name: formData.get("name"),
        categories: JSON.parse(formData.get("categories") || "{}"),
      };
      
      const newBudget = await createBudget(budgetData);
      return json({ success: true, budget: newBudget });
    }

    return json({ success: false, error: "Invalid action type" });
  } catch (error) {
    console.error("Error in budget action:", error);
    return json({ success: false, error: error.message });
  }
};

export default function BudgetManagement() {
  const { budgets, error } = useLoaderData();
  const navigation = useNavigation();
  const submit = useSubmit();

  // State for create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [budgetName, setBudgetName] = useState("");
  
  // Predefined category options
  const predefinedCategories = [
    "Gen Nsg>Medical Supplies",
    "Gen Nsg>Incontinent Supplies", 
    "Capital>Fixed Equip",
    "Capital>Leasehold Improvements",
    "Capital>Major Moveable Equip",
    "Housekeeping>Minor Equip",
    "Dietary>Minor Equip",
    "Housekeeping>Supplies",
    "Admin & Gen>Office Supplies",
    "Therapy>Minor Equip",
    "Maintenance>Supplies",
    "Dietary>Supplements",
    "Activities>Minor Equip",
    "Activities>Supplies",
    "Admin & Gen>Minor Equip",
    "Gen Nsg>House",
    "Gen Nsg>Minor Equip",
    "Laundry>Linens",
    "Laundry>Minor Equip",
    "Therapy>Therapy Supplies",
    "Gen Nsg>Wound Care",
    "Maintenance>Minor Equip",
    "Gen Nsg>PEN Supplies",
    "Gen Nsg>Urology & Ostomy",
    "Therapy>Respiratory Supplies",
    "Gen Nsg>Forms & Printing",
    "Dietary>Dietary Supplies",
    "Gen Nsg>Personal Items",
    "Gen Nsg>Rental Equip"
  ];

  // State for current category/price inputs
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categoryPrice, setCategoryPrice] = useState("");
  
  // State for added categories (final list)
  const [addedCategories, setAddedCategories] = useState([]);

  const isLoading = navigation.state === "loading" || navigation.state === "submitting";

  // Add category to budget
  const handleAddCategory = () => {
    if (!selectedCategory || !categoryPrice || parseFloat(categoryPrice) <= 0) return;
    
    // Check if category already exists
    const existingIndex = addedCategories.findIndex(item => item.category === selectedCategory);
    
    if (existingIndex >= 0) {
      // Update existing category
      const updatedCategories = [...addedCategories];
      updatedCategories[existingIndex].price = parseFloat(categoryPrice);
      setAddedCategories(updatedCategories);
    } else {
      // Add new category
      setAddedCategories(prev => [
        ...prev,
        {
          category: selectedCategory,
          price: parseFloat(categoryPrice)
        }
      ]);
    }
    
    // Reset inputs
    setSelectedCategory("");
    setCategoryPrice("");
  };

  // Remove category from budget
  const handleRemoveCategory = (categoryToRemove) => {
    setAddedCategories(prev => prev.filter(item => item.category !== categoryToRemove));
  };

  // Handle budget creation
  const handleCreateBudget = () => {
    if (!budgetName.trim() || addedCategories.length === 0) return;

    // Convert added categories to the format expected by the server
    const categoriesObject = {};
    addedCategories.forEach(item => {
      categoriesObject[item.category] = item.price.toString();
    });

    const formData = new FormData();
    formData.append("actionType", "create");
    formData.append("name", budgetName);
    formData.append("categories", JSON.stringify(categoriesObject));

    submit(formData, { method: "post" });
    
    // Reset form
    setBudgetName("");
    setAddedCategories([]);
    setSelectedCategory("");
    setCategoryPrice("");
    setShowCreateForm(false);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Calculate total budget amount
  const calculateTotal = (categoriesList) => {
    if (Array.isArray(categoriesList)) {
      return categoriesList.reduce((sum, item) => sum + (item.price || 0), 0);
    }
    // Fallback for object format (existing budgets)
    return Object.values(categoriesList || {}).reduce((sum, value) => {
      return sum + (parseFloat(value) || 0);
    }, 0);
  };

  // Get category dropdown options (exclude already added categories)
  const availableCategories = predefinedCategories.filter(
    category => !addedCategories.some(item => item.category === category)
  );

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
                <Button primary onClick={() => setShowCreateForm(!showCreateForm)}>
                  {showCreateForm ? "Cancel" : "Create New Budget"}
                </Button>
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

        {/* Create Budget Form */}
        {showCreateForm && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Create New Budget</Text>

                <FormLayout>
                  <TextField
                    label="Budget Name"
                    value={budgetName}
                    onChange={setBudgetName}
                    placeholder="Enter budget name (e.g., Q4 2024 Budget)"
                    autoComplete="off"
                  />
                </FormLayout>

                <Text variant="headingSm" as="h3">Add Categories</Text>
                <Text variant="bodySm" tone="subdued">
                  Select a category from the dropdown and enter the budget amount, then click "Add Category".
                </Text>

                {/* Add Category Section */}
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingSm" as="h4">Add New Category</Text>
                    <InlineStack gap="400" align="end">
                      <Box minWidth="300px">
                        <Select
                          label="Category"
                          options={[
                            { label: "Select a category", value: "" },
                            ...availableCategories.map(category => ({ 
                              label: category, 
                              value: category 
                            }))
                          ]}
                          value={selectedCategory}
                          onChange={setSelectedCategory}
                        />
                      </Box>
                      <Box minWidth="200px">
                        <TextField
                          label="Budget Amount"
                          type="number"
                          value={categoryPrice}
                          onChange={setCategoryPrice}
                          placeholder="0.00"
                          prefix="$"
                          autoComplete="off"
                        />
                      </Box>
                      <Button 
                        onClick={handleAddCategory}
                        disabled={!selectedCategory || !categoryPrice || parseFloat(categoryPrice) <= 0}
                      >
                        Add Category
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>

                {/* Added Categories List */}
                {addedCategories.length > 0 && (
                  <Card>
                    <BlockStack gap="300">
                      <Text variant="headingSm" as="h4">Added Categories</Text>
                      <List type="bullet">
                        {addedCategories.map((item, index) => (
                          <List.Item key={index}>
                            <InlineStack align="space-between">
                              <Text>
                                <strong>{item.category}</strong>: {formatCurrency(item.price)}
                              </Text>
                              <Button 
                                size="micro" 
                                onClick={() => handleRemoveCategory(item.category)}
                                destructive
                              >
                                Remove
                              </Button>
                            </InlineStack>
                          </List.Item>
                        ))}
                      </List>
                    </BlockStack>
                  </Card>
                )}

                {/* Total Amount Summary */}
                {addedCategories.length > 0 && (
                  <Card>
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h4">Budget Summary</Text>
                      <InlineStack align="space-between">
                        <Text variant="bodyLg" as="p">Total Budget Amount:</Text>
                        <Text variant="headingLg" as="p">
                          {formatCurrency(calculateTotal(addedCategories))}
                        </Text>
                      </InlineStack>
                      <Text variant="bodySm" tone="subdued">
                        {addedCategories.length} {addedCategories.length === 1 ? 'category' : 'categories'} added
                      </Text>
                    </BlockStack>
                  </Card>
                )}

                {/* Action buttons */}
                <InlineStack align="end" gap="200">
                  <Button onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                  <Button 
                    primary 
                    onClick={handleCreateBudget}
                    loading={isLoading}
                    disabled={!budgetName.trim() || addedCategories.length === 0}
                  >
                    Create Budget
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
