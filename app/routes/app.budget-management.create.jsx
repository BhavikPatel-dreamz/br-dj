import { useNavigate, useSubmit, useNavigation, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { json, redirect } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  TextField,
  Button,
  InlineStack,
  FormLayout,
  Select,
  Icon,
} from "@shopify/polaris";
import { DeleteIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server.js";
import { createBudget, getBudgetCategories } from "../actions/index.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  
  // Return the categories from database with full details
  const categories = await getBudgetCategories();
  
  return json({
    categories
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
      
      // Redirect back to the budget list after successful creation
      return redirect("/app/budget-management");
    }

    return json({ success: false, error: "Invalid action type" });
  } catch (error) {
    console.error("Error in budget action:", error);
    return json({ success: false, error: error.message });
  }
};

export default function CreateBudget() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const actionData = useActionData();
  const { categories: availableCategories } = useLoaderData();

  const [budgetName, setBudgetName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categorySearchTerm, setCategorySearchTerm] = useState("");

  const isLoading = navigation.state === "submitting";

  // Handle budget creation
  const handleCreateBudget = () => {
    if (!budgetName.trim() || selectedCategories.length === 0) return;

    // Convert selected categories array to object format using category IDs
    const categoriesObject = {};
    selectedCategories.forEach(item => {
      if (item.value && parseFloat(item.value) > 0) {
        categoriesObject[item.categoryId] = item.value;
      }
    });

    const formData = new FormData();
    formData.append("actionType", "create");
    formData.append("name", budgetName);
    formData.append("categories", JSON.stringify(categoriesObject));

    submit(formData, { method: "post" });
  };

  // Handle cancel - go back to budget list
  const handleCancel = () => {
    navigate("/app/budget-management");
  };

  // Add a new category
  const addCategory = () => {
    if (!selectedCategory || selectedCategories.find(item => item.categoryId === selectedCategory)) {
      return;
    }

    const categoryData = availableCategories.find(cat => cat.id.toString() === selectedCategory);
    if (!categoryData) return;

    setSelectedCategories(prev => [
      ...prev,
      { 
        categoryId: categoryData.id,
        categoryName: categoryData.name,
        parentCategory: categoryData.parent_category,
        value: "" 
      }
    ]);
    setSelectedCategory("");
  };

  // Remove a category
  const removeCategory = (index) => {
    setSelectedCategories(prev => prev.filter((_, i) => i !== index));
  };

  // Update category value
  const updateCategoryValue = (index, value) => {
    setSelectedCategories(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, value } : item
      )
    );
  };

  // Get available options for the dropdown (excluding already selected ones)
  const getAvailableOptions = () => {
    const selectedCategoryIds = selectedCategories.map(item => item.categoryId.toString());
    let filtered = availableCategories
      .filter(category => !selectedCategoryIds.includes(category.id.toString()));
    
    // Apply search filter if there's a search term
    if (categorySearchTerm.trim()) {
      const searchLower = categorySearchTerm.toLowerCase();
      filtered = filtered.filter(category => 
        category.name.toLowerCase().includes(searchLower) ||
        category.parent_category.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered.map(category => ({ 
      label: `${category.parent_category} > ${category.name.split('>')[1] || category.name}`, 
      value: category.id.toString() 
    }));
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Calculate total budget amount
  const calculateTotal = () => {
    return selectedCategories.reduce((sum, item) => {
      return sum + (parseFloat(item.value) || 0);
    }, 0);
  };

  // Group categories by department for display
  const groupCategoriesByDepartment = (categories) => {
    const groups = {};
    categories.forEach((item, index) => {
      const department = item.parentCategory || item.categoryName.split('>')[0];
      if (!groups[department]) {
        groups[department] = [];
      }
      groups[department].push({ ...item, index });
    });
    return groups;
  };

  const categoriesByDepartment = groupCategoriesByDepartment(selectedCategories);

  return (
    <Page>
      <TitleBar title="Create New Budget" />
      
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">Budget Details</Text>
                <InlineStack gap="200">
                  <Button onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button 
                    primary 
                    onClick={handleCreateBudget}
                    loading={isLoading}
                    disabled={!budgetName.trim() || selectedCategories.length === 0}
                  >
                    Create Budget
                  </Button>
                </InlineStack>
              </InlineStack>

              {actionData?.error && (
                <Text tone="critical">{actionData.error}</Text>
              )}

              <FormLayout>
                <TextField
                  label="Budget Name"
                  value={budgetName}
                  onChange={setBudgetName}
                  placeholder="Enter budget name (e.g., Q4 2024 Budget)"
                  autoComplete="off"
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Add Categories</Text>
              <Text variant="bodySm" tone="subdued">
                Select categories from the dropdown and assign budget amounts. Categories are grouped by department for better organization.
              </Text>

              {/* Category Selection with Search */}
              <FormLayout>
                <TextField
                  label="Search Categories"
                  value={categorySearchTerm}
                  onChange={setCategorySearchTerm}
                  placeholder="Type to search categories..."
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setCategorySearchTerm("")}
                />
                <InlineStack gap="300" align="end">
                  <div style={{ flex: 1 }}>
                    <Select
                      label="Select Category"
                      options={[
                        { label: "Choose a category...", value: "", disabled: true },
                        ...getAvailableOptions()
                      ]}
                      value={selectedCategory}
                      onChange={setSelectedCategory}
                    />
                  </div>
                  <Button
                    onClick={addCategory}
                    disabled={!selectedCategory}
                  >
                    Add Category
                  </Button>
                </InlineStack>
                {categorySearchTerm && getAvailableOptions().length === 0 && (
                  <Text variant="bodySm" tone="subdued">
                    No categories match your search. Try a different search term.
                  </Text>
                )}
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Selected Categories */}
        {selectedCategories.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Category Allocations</Text>

                {/* Group categories by department */}
                {Object.entries(categoriesByDepartment).map(([department, departmentCategories]) => (
                  <Card key={department}>
                    <BlockStack gap="300">
                      <Text variant="headingSm" as="h3">{department}</Text>
                      <FormLayout>
                        {departmentCategories.map((item) => (
                          <InlineStack key={item.index} gap="200" align="end">
                            <div style={{ flex: 1 }}>
                              <TextField
                                label={item.categoryName.split('>')[1] || item.categoryName}
                                type="number"
                                value={item.value}
                                onChange={(newValue) => updateCategoryValue(item.index, newValue)}
                                placeholder="0.00"
                                prefix="$"
                                autoComplete="off"
                                helpText={`Category: ${item.categoryName}`}
                              />
                            </div>
                            <Button
                              icon={DeleteIcon}
                              onClick={() => removeCategory(item.index)}
                              accessibilityLabel={`Remove ${item.categoryName}`}
                            />
                          </InlineStack>
                        ))}
                      </FormLayout>
                    </BlockStack>
                  </Card>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Total Amount Summary */}
        {selectedCategories.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">Budget Summary</Text>
                <InlineStack align="space-between">
                  <Text variant="bodyLg" as="p">Total Budget Amount:</Text>
                  <Text variant="headingLg" as="p">
                    {formatCurrency(calculateTotal())}
                  </Text>
                </InlineStack>
                <Text variant="bodySm" tone="subdued">
                  {selectedCategories.length} categories selected
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Action buttons at bottom */}
        <Layout.Section>
          <Card>
            <InlineStack align="end" gap="200">
              <Button onClick={handleCancel}>
                Cancel
              </Button>
              <Button 
                primary 
                onClick={handleCreateBudget}
                loading={isLoading}
                disabled={!budgetName.trim() || selectedCategories.length === 0}
              >
                Create Budget
              </Button>
            </InlineStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
