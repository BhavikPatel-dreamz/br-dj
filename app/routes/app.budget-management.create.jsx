import { useNavigate, useSubmit, useNavigation, useActionData } from "@remix-run/react";
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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server.js";
import { createBudget } from "../actions/fhr-budget.server.js";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return json({});
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

  const [budgetName, setBudgetName] = useState("");
  
  // Predefined categories with values
  const [categories, setCategories] = useState({
    "Gen Nsg>Medical Supplies": "",
    "Gen Nsg>Incontinent Supplies": "",
    "Capital>Fixed Equip": "",
    "Capital>Leasehold Improvements": "",
    "Capital>Major Moveable Equip": "",
    "Housekeeping>Minor Equip": "",
    "Dietary>Minor Equip": "",
    "Housekeeping>Supplies": "",
    "Admin & Gen>Office Supplies": "",
    "Therapy>Minor Equip": "",
    "Maintenance>Supplies": "",
    "Dietary>Supplements": "",
    "Activities>Minor Equip": "",
    "Activities>Supplies": "",
    "Admin & Gen>Minor Equip": "",
    "Gen Nsg>House": "",
    "Gen Nsg>Minor Equip": "",
    "Laundry>Linens": "",
    "Laundry>Minor Equip": "",
    "Therapy>Therapy Supplies": "",
    "Gen Nsg>Wound Care": "",
    "Maintenance>Minor Equip": "",
    "Gen Nsg>PEN Supplies": "",
    "Gen Nsg>Urology & Ostomy": "",
    "Therapy>Respiratory Supplies": "",
    "Gen Nsg>Forms & Printing": "",
    "Dietary>Dietary Supplies": "",
    "Gen Nsg>Personal Items": "",
    "Gen Nsg>Rental Equip": ""
  });

  const isLoading = navigation.state === "submitting";

  // Handle budget creation
  const handleCreateBudget = () => {
    if (!budgetName.trim()) return;

    const formData = new FormData();
    formData.append("actionType", "create");
    formData.append("name", budgetName);
    formData.append("categories", JSON.stringify(categories));

    submit(formData, { method: "post" });
  };

  // Handle cancel - go back to budget list
  const handleCancel = () => {
    navigate("/app/budget-management");
  };

  // Update category value
  const updateCategoryValue = (categoryName, value) => {
    setCategories(prev => ({
      ...prev,
      [categoryName]: value
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
  const calculateTotal = (categories) => {
    return Object.values(categories).reduce((sum, value) => {
      return sum + (parseFloat(value) || 0);
    }, 0);
  };

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
                    disabled={!budgetName.trim()}
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
              <Text variant="headingMd" as="h2">Category Allocations</Text>
              <Text variant="bodySm" tone="subdued">
                Assign dollar amounts to each category. Leave empty for categories you don't want to include.
              </Text>

              {/* Group categories by department for better organization */}
              <BlockStack gap="400">
                {/* General Nursing Categories */}
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingSm" as="h3">General Nursing</Text>
                    <FormLayout>
                      {Object.entries(categories)
                        .filter(([categoryName]) => categoryName.startsWith("Gen Nsg>"))
                        .map(([categoryName, value]) => (
                          <TextField
                            key={categoryName}
                            label={categoryName}
                            type="number"
                            value={value}
                            onChange={(newValue) => updateCategoryValue(categoryName, newValue)}
                            placeholder="0.00"
                            prefix="$"
                            autoComplete="off"
                          />
                        ))}
                    </FormLayout>
                  </BlockStack>
                </Card>

                {/* Capital Categories */}
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingSm" as="h3">Capital</Text>
                    <FormLayout>
                      {Object.entries(categories)
                        .filter(([categoryName]) => categoryName.startsWith("Capital>"))
                        .map(([categoryName, value]) => (
                          <TextField
                            key={categoryName}
                            label={categoryName}
                            type="number"
                            value={value}
                            onChange={(newValue) => updateCategoryValue(categoryName, newValue)}
                            placeholder="0.00"
                            prefix="$"
                            autoComplete="off"
                          />
                        ))}
                    </FormLayout>
                  </BlockStack>
                </Card>

                {/* Other Department Categories */}
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingSm" as="h3">Other Departments</Text>
                    <FormLayout>
                      {Object.entries(categories)
                        .filter(([categoryName]) => 
                          !categoryName.startsWith("Gen Nsg>") && 
                          !categoryName.startsWith("Capital>")
                        )
                        .map(([categoryName, value]) => (
                          <TextField
                            key={categoryName}
                            label={categoryName}
                            type="number"
                            value={value}
                            onChange={(newValue) => updateCategoryValue(categoryName, newValue)}
                            placeholder="0.00"
                            prefix="$"
                            autoComplete="off"
                          />
                        ))}
                    </FormLayout>
                  </BlockStack>
                </Card>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Total Amount Summary */}
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h3">Budget Summary</Text>
              <InlineStack align="space-between">
                <Text variant="bodyLg" as="p">Total Budget Amount:</Text>
                <Text variant="headingLg" as="p">
                  {formatCurrency(calculateTotal(categories))}
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
                onClick={handleCreateBudget}
                loading={isLoading}
                disabled={!budgetName.trim()}
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
