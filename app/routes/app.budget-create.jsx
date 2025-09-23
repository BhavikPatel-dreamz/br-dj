import { useNavigate, useSubmit, useNavigation, useActionData, useLoaderData } from "@remix-run/react";
import { useState, useEffect } from "react";
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
  Frame,
  Toast,
} from "@shopify/polaris";
import { DeleteIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server.js";
import { createBudget, getBudgetCategories, getBudgetById, updateBudget } from "../actions/index.server.js";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  
  const url = new URL(request.url);
  const budgetId = url.searchParams.get("id");
  
  // Return the categories from database with full details
  const categories = await getBudgetCategories();
  
  // Filter out any categories with null/undefined IDs
  const validCategories = categories.filter(cat => cat && cat.id != null);
  
  let budgetData = null;
  if (budgetId) {
    try {
      budgetData = await getBudgetById(budgetId);
    } catch (error) {
      console.error("Error loading budget for edit:", error);
      // If budget doesn't exist, we'll treat it as create mode
    }
  }
  
  return json({
    categories: validCategories,
    budgetData: budgetData,
    isEditMode: !!budgetData
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
        description: formData.get("description"),
        categories: JSON.parse(formData.get("categories") || "{}"),
      };
      
      const newBudget = await createBudget(budgetData);
      
      // Redirect back to the budget list after successful creation
      return json({ success: true, message: "Budget created successfully", budget: newBudget });
      //return redirect("/app");
    } else if (actionType === "update") 
      {
      const budgetId = formData.get("budgetId");
      const budgetData = {
        name: formData.get("name"),
        description: formData.get("description"),
        categories: JSON.parse(formData.get("categories") || "{}"),
      };
      
      const updatedBudget = await updateBudget(budgetId, budgetData);
      
      // Redirect back to the budget list after successful update
      return redirect("/app");
    }

    return json({ success: false, error: "Invalid action type" });
  } catch (error) {
    console.error("Error in budget action:", error);
    return json({ success: false, error: error.message });
  }
};

export default function BudgetForm() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const actionData = useActionData();
  const { categories: availableCategories, budgetData, isEditMode } = useLoaderData();
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [budgetName, setBudgetName] = useState("");
  const [budgetDescription, setBudgetDescription] = useState("");
  const [budgetRows, setBudgetRows] = useState([
    { id: Date.now(), categoryId: "", amount: "" }
  ]);

  const isLoading = navigation.state === "submitting";

  useEffect(() => { 
    if(actionData?.success && actionData?.budget){ 
      setToastMessage(actionData.message);
        setToastActive(true);
      
      setTimeout(() => {
      navigate("/app");  
      }, 1500);
      
      
    }
  },[actionData])


  // Populate form data when in edit mode
  useEffect(() => {
    if (isEditMode && budgetData) {
      setBudgetName(budgetData.name || "");
      setBudgetDescription(budgetData.description || "");
      
      // Convert categories object to budget rows
      if (budgetData.categories) {
        const rows = Object.entries(budgetData.categories).map(([categoryId, categoryData]) => ({
          id: Date.now() + Math.random(), // Unique ID for each row
          categoryId: categoryId.toString(),
          amount: typeof categoryData === 'object' ? categoryData.amount : categoryData.toString()
        }));
        
        if (rows.length > 0) {
          setBudgetRows(rows);
        }
      }
    }
  }, [isEditMode, budgetData]);

  // Handle budget creation and update
  const handleSaveBudget = () => {
    if (!budgetName.trim()) return;
    
    const validRows = budgetRows.filter(row => row.categoryId && parseFloat(row.amount) > 0);
    if (validRows.length === 0) return;

    // Convert rows to categories object format
    const categoriesObject = {};
    validRows.forEach(row => {
      categoriesObject[row.categoryId] = row.amount;
    });

    const formData = new FormData();
    formData.append("actionType", isEditMode ? "update" : "create");
    if (isEditMode && budgetData?.id) {
      formData.append("budgetId", budgetData.id);
    }
    formData.append("name", budgetName);
    formData.append("description", budgetDescription);
    formData.append("categories", JSON.stringify(categoriesObject));

    submit(formData, { method: "post" });
  };

  // Handle cancel - go back to budget list
  const handleCancel = () => {
    navigate("/app");
  };

  // Add a new row
  const addRow = () => {
    setBudgetRows(prev => [
      ...prev,
      { id: Date.now(), categoryId: "", amount: "" }
    ]);
  };

  // Remove a row
  const removeRow = (rowId) => {
    if (budgetRows.length > 1) {
      setBudgetRows(prev => prev.filter(row => row.id !== rowId));
    }
  };

  // Update row category
  const updateRowCategory = (rowId, categoryId) => {
    setBudgetRows(prev => 
      prev.map(row => 
        row.id === rowId ? { ...row, categoryId } : row
      )
    );
  };

  // Update row amount
  const updateRowAmount = (rowId, amount) => {
    // Only allow positive numbers
    if (amount === '' || (!isNaN(amount) && parseFloat(amount) >= 0)) {
      setBudgetRows(prev => 
        prev.map(row => 
          row.id === rowId ? { ...row, amount } : row
        )
      );
    }
  };

  // Get available options for a specific row (excluding already selected ones)
  const getAvailableOptions = (currentRowId) => {
    const selectedCategoryIds = budgetRows
      .filter(row => row.id !== currentRowId && row.categoryId)
      .map(row => row.categoryId);
    
    return availableCategories
      .filter(category => category.id && !selectedCategoryIds.includes(category.id.toString()))
      .map(category => ({ 
        label: category.name, 
        value: category.id.toString() 
      }));
  };

  // Calculate total budget amount
  const calculateTotal = () => {
    return budgetRows.reduce((sum, row) => {
      return sum + (parseFloat(row.amount) || 0);
    }, 0);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Check if form is valid
  const isFormValid = () => {
    if (!budgetName.trim()) return false;
    const validRows = budgetRows.filter(row => row.categoryId && parseFloat(row.amount) > 0);
    return validRows.length > 0;
  };

  return (
    <Page>
      <TitleBar title={isEditMode ? "Edit Budget" : "Create New Budget"} />
      
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
                    onClick={handleSaveBudget}
                    loading={isLoading}
                    disabled={!isFormValid()}
                  >
                    {isEditMode ? "Update Budget" : "Create Budget"} ({formatCurrency(calculateTotal())})
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
                <TextField
                  label="Description"
                  value={budgetDescription}
                  onChange={setBudgetDescription}
                  placeholder="Enter budget description (optional)"
                  multiline={3}
                  autoComplete="off"
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">Budget Categories</Text>
                <Button 
                  onClick={addRow}
                  disabled={getAvailableOptions(Date.now()).length === 0}
                >
                  Add Category
                </Button>
              </InlineStack>
              
              <Text variant="bodySm" tone="subdued">
                Select categories and assign budget amounts. Each row represents a category allocation.
              </Text>

              {/* Budget Rows */}
              <BlockStack gap="300">
                {budgetRows.map((row, index) => {
                  const categoryData = availableCategories.find(cat => cat.id?.toString() === row.categoryId);
                  const isValidRow = row.categoryId && parseFloat(row.amount) > 0;
                  
                  return (
                    <Card key={row.id} sectioned>
                      <InlineStack gap="300" align="center">
                        <div style={{ flex: 2 }}>
                          <Select
                            label={index === 0 ? "Category" : ""}
                            labelHidden={index !== 0}
                            options={[
                              { label: "Choose a category...", value: "", disabled: true },
                              ...getAvailableOptions(row.id)
                            ]}
                            value={row.categoryId}
                            onChange={(value) => updateRowCategory(row.id, value)}
                            placeholder="Select category"
                            error={index > 0 && !row.categoryId ? "Please select a category" : undefined}
                          />
                          {/* {categoryData && (
                            <Text variant="bodySm" tone="subdued">
                              {categoryData.parent_category || 'General'} Department
                            </Text>
                          )} */}
                        </div>
                        
                        <div style={{ flex: 1 }}>
                          <TextField
                            label={index === 0 ? "PPD" : ""}
                            labelHidden={index !== 0}
                            type="number"
                            value={row.amount}
                            onChange={(value) => updateRowAmount(row.id, value)}
                            placeholder="0.00"
                            prefix="$"
                            autoComplete="off"
                            step="0.01"
                            min="0"
                            error={row.categoryId && row.amount && parseFloat(row.amount) <= 0 ? "Amount must be greater than 0" : undefined}
                          />
                        </div>
                        
                        <div style={{ flexShrink: 0, minWidth: '40px', textAlign: 'center' }}>
                          
                          <Text variant="bodySm" tone="success"></Text>

                          
                          <Button
                            icon={DeleteIcon}
                            onClick={() => removeRow(row.id)}
                            disabled={budgetRows.length === 1}
                            accessibilityLabel="Remove category"
                            plain
                            tone="critical"
                          />
                        </div>
                      </InlineStack>
                    </Card>
                  );
                })}
              </BlockStack>

              {budgetRows.length === 0 && (
                <Card sectioned>
                  <InlineStack align="center">
                    <Text variant="bodySm" tone="subdued">
                      No categories added yet. Click "Add Category" to get started.
                    </Text>
                  </InlineStack>
                </Card>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Total Amount Summary */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">Budget Summary</Text>
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="bodyLg" as="p">Total Budget Amount:</Text>
                <Text variant="headingLg" as="p" tone={calculateTotal() > 0 ? "success" : "subdued"}>
                  {formatCurrency(calculateTotal())}
                </Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text variant="bodySm" tone="subdued">
                  {budgetRows.filter(row => row.categoryId && parseFloat(row.amount) > 0).length} valid categories
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {budgetRows.length} total rows
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Action buttons at bottom */}
        <Layout.Section>
          <Card>
            <InlineStack align="end" gap="200">
              <Button onClick={handleCancel}>
                Cancel
              </Button>
              <Button 
                primary 
                onClick={handleSaveBudget}
                loading={isLoading}
                disabled={!isFormValid()}
              >
                {isEditMode ? "Update Budget" : "Create Budget"} ({formatCurrency(calculateTotal())})
              </Button>
            </InlineStack>
          </Card>
        </Layout.Section>
      </Layout>
      {toastActive && (
              <Frame>
                <Toast
                  content={toastMessage}
                  onDismiss={() => setToastActive(false)}
                />
              </Frame>
            )}
    </Page>
  );
}
