import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit, useNavigation, Form, Link } from "@remix-run/react";
import {
  Page,
  Card,
  Button,
  DataTable,
  TextField,
  Select,
  FormLayout,
  PageActions,
  Toast,
  Frame,
  Modal,
  TextContainer,
  Text,
  InlineStack,
  Pagination,
  Filters,
  ResourceList,
  ResourceItem,
  Avatar,
  Badge,
  EmptyState,
  Layout,
  Banner
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { loadBudgetData, handleBudgetAction } from "../actions/budget-management.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const search = url.searchParams.get("search") || "";
  const view = url.searchParams.get("view") || "budgets"; // budgets, create, assign
  const includeStats = url.searchParams.get("stats") === "true";

  return json(await loadBudgetData({ page, limit, search, view, includeBudgetStats: includeStats }));
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const intent = formData.get("intent");
  
  const result = await handleBudgetAction({ intent, formData });
  
  if (result.redirect) {
    return redirect(result.redirect);
  }
  
  return json(result);
};

export default function BudgetManagement() {
  const { 
    budgets, 
    totalBudgets, 
    currentPage, 
    totalPages, 
    categories, 
    locations, 
    assignments, 
    budgetStats,
    filters, 
    view,
    error 
  } = useLoaderData();
  
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  
  // State management
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [modalActive, setModalActive] = useState(false);
  const [modalType, setModalType] = useState(""); // delete, assign
  const [searchValue, setSearchValue] = useState(filters.search);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    amount: "",
    period: "monthly",
    start_date: "",
    end_date: "",
    status: "active"
  });

  const [assignmentData, setAssignmentData] = useState({
    budgetId: "",
    locationId: "",
    assignedBy: ""
  });

  const isLoading = navigation.state === "submitting";

  // Effects
  useEffect(() => {
    if (actionData?.success) {
      setToastMessage(actionData.success);
      setToastActive(true);
      setModalActive(false);
      resetForm();
    } else if (actionData?.error) {
      setToastMessage(actionData.error);
      setToastActive(true);
    }
  }, [actionData]);

  // Handlers
  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      description: "",
      amount: "",
      period: "monthly",
      start_date: "",
      end_date: "",
      status: "active"
    });
    setAssignmentData({
      budgetId: "",
      locationId: "",
      assignedBy: ""
    });
    setSelectedBudget(null);
  }, []);

  const handleModalToggle = useCallback((type = "", budget = null) => {
    if (type === "") {
      // Close modal
      setModalActive(false);
      setModalType("");
      resetForm();
      return;
    }

    // Open modal with specific type
    setModalType(type);
    setModalActive(true);
    
    if (budget && type === "delete") {
      setSelectedBudget(budget);
    } else if (type === "assign") {
      setAssignmentData(prev => ({ ...prev, budgetId: budget?.id || "" }));
    } else {
      resetForm();
    }
  }, [resetForm]);

  const handleFormChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleAssignmentChange = useCallback((field, value) => {
    setAssignmentData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback((intent) => {
    const form = new FormData();
    form.append("intent", intent);
    
    if (intent === "assign") {
      Object.keys(assignmentData).forEach(key => {
        form.append(key, assignmentData[key]);
      });
    } else {
      if (selectedBudget?.id && (intent === "update" || intent === "delete")) {
        form.append("id", selectedBudget.id);
      }
      
      if (intent !== "delete") {
        Object.keys(formData).forEach(key => {
          form.append(key, formData[key]);
        });
      }
    }
    
    submit(form, { method: "post" });
  }, [formData, assignmentData, selectedBudget, submit]);

  const handleFilterChange = useCallback(() => {
    const params = new URLSearchParams();
    if (searchValue) params.set("search", searchValue);
    params.set("page", "1");
    
    submit(params, { method: "get" });
  }, [searchValue, submit]);

  const handlePagination = useCallback((page) => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    if (filters.search) params.set("search", filters.search);
    
    submit(params, { method: "get" });
  }, [filters, submit]);

  const periodOptions = [
    { label: "Monthly", value: "monthly" },
    { label: "Quarterly", value: "quarterly" },
    { label: "Yearly", value: "yearly" }
  ];

  const statusOptions = [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
    { label: "Draft", value: "draft" }
  ];

  // Render functions
  const renderBudgetList = () => {
    if (budgets.length === 0) {
      return (
        <Card>
          <EmptyState
            heading="No budgets found"
            action={{
              content: "Create Budget",
              url: "/app/budget-create"
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Start by creating your first budget to manage your finances.</p>
          </EmptyState>
        </Card>
      );
    }

    const tableRows = budgets.map((budget) => [
      budget.name || "Unnamed",
      budget.amount ? `$${budget.amount.toLocaleString()}` : "$0",
      budget.period || "N/A",
      <Badge status={budget.status === "active" ? "success" : "attention"}>
        {budget.status || "Unknown"}
      </Badge>,
      budget.start_date ? new Date(budget.start_date).toLocaleDateString() : "N/A",
      budget.end_date ? new Date(budget.end_date).toLocaleDateString() : "N/A",
      <InlineStack align="end" gap="200">
        <Button 
          size="slim" 
          url={`/app/budget-create?id=${budget.id}`}
        >
          Edit
        </Button>
        <Button size="slim" onClick={() => handleModalToggle("assign", budget)}>
          Assign
        </Button>
        <Button 
          size="slim" 
          destructive 
          onClick={() => handleModalToggle("delete", budget)}
        >
          Delete
        </Button>
      </InlineStack>
    ]);

    return (
      <Card>
        <DataTable
          columnContentTypes={[
            'text',
            'text',
            'text',
            'text',
            'text',
            'text',
            'text'
          ]}
          headings={[
            'Budget Name',
            'Amount',
            'Period',
            'Status',
            'Start Date',
            'End Date',
            'Actions'
          ]}
          rows={tableRows}
        />
      </Card>
    );
  };

  const renderModal = () => {
    const modalTitle = {
      delete: "Delete Budget",
      assign: "Assign Budget to Location"
    }[modalType];

    if (modalType === "delete") {
      return (
        <Modal
          open={modalActive}
          onClose={() => handleModalToggle()}
          title={modalTitle}
          primaryAction={{
            content: "Delete",
            destructive: true,
            loading: isLoading,
            onAction: () => handleSubmit("delete")
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => handleModalToggle()
            }
          ]}
        >
          <Modal.Section>
            <TextContainer>
              <p>Are you sure you want to delete "{selectedBudget?.name}"? This action cannot be undone.</p>
            </TextContainer>
          </Modal.Section>
        </Modal>
      );
    }

    if (modalType === "assign") {
      return (
        <Modal
          open={modalActive}
          onClose={() => handleModalToggle()}
          title={modalTitle}
          primaryAction={{
            content: "Assign",
            loading: isLoading,
            onAction: () => handleSubmit("assign")
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => handleModalToggle()
            }
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <Select
                label="Select Location"
                options={[
                  { label: "Choose a location", value: "" },
                  ...locations.map(loc => ({ 
                    label: loc.name || loc.location_id, 
                    value: loc.location_id 
                  }))
                ]}
                value={assignmentData.locationId}
                onChange={(value) => handleAssignmentChange("locationId", value)}
              />
              <TextField
                label="Assigned By"
                value={assignmentData.assignedBy}
                onChange={(value) => handleAssignmentChange("assignedBy", value)}
                placeholder="Enter who is making this assignment"
                helpText="Leave empty for system assignment"
              />
            </FormLayout>
          </Modal.Section>
        </Modal>
      );
    }

    // No other modal types supported
    return null;
  };

  return (
    <Page
      title="Budget Management"
      subtitle={`Managing ${totalBudgets} budget${totalBudgets !== 1 ? 's' : ''}`}
      primaryAction={{
        content: "Create Budget",
        url: "/app/budget-create"
      }}
    >
      {error && (
        <Banner status="critical">
          <p>{error}</p>
        </Banner>
      )}
      
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <FormLayout>
              <FormLayout.Group>
                <TextField
                  label="Search budgets"
                  value={searchValue}
                  onChange={setSearchValue}
                  placeholder="Search by name or description"
                  clearButton
                  onClearButtonClick={() => setSearchValue("")}
                />
                <div style={{ alignSelf: 'end' }}>
                  <InlineStack gap="200">
                    <Button onClick={handleFilterChange} loading={isLoading}>
                      Apply Filters
                    </Button>
                    <Button 
                      onClick={() => {
                        setSearchValue("");
                        const params = new URLSearchParams();
                        params.set("page", "1");
                        submit(params, { method: "get" });
                      }}
                      disabled={!searchValue}
                    >
                      Clear Filters
                    </Button>
                  </InlineStack>
                </div>
              </FormLayout.Group>
            </FormLayout>
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          {renderBudgetList()}
        </Layout.Section>
        
        {totalPages > 1 && (
          <Layout.Section>
            <Card sectioned>
              <Pagination
                hasPrevious={currentPage > 1}
                onPrevious={() => handlePagination(currentPage - 1)}
                hasNext={currentPage < totalPages}
                onNext={() => handlePagination(currentPage + 1)}
              />
            </Card>
          </Layout.Section>
        )}
      </Layout>

      {renderModal()}

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
