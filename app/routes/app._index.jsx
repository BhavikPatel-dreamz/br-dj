import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit, useNavigation, Form, Link, useNavigate } from "@remix-run/react";
import {
  Page,
  Card,
  Button,
  DataTable,
  TextField,
  FormLayout,
  Toast,
  Frame,
  Modal,
  TextContainer,
  Text,
  InlineStack,
  Pagination,
  
  Badge,
  EmptyState,
  Layout,
  Banner,
  Combobox,
  Listbox,
  Icon
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
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
  const navigate = useNavigate();
  
  // State management
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [modalActive, setModalActive] = useState(false);
  const [modalType, setModalType] = useState(""); // delete, assign
  const [searchValue, setSearchValue] = useState(filters.search);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [assignmentError, setAssignmentError] = useState("");

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

  // Location search state
  const [locationSearchValue, setLocationSearchValue] = useState("");
  const [locationSearchActive, setLocationSearchActive] = useState(false);

  // Get the budget being assigned for display purposes
  const budgetBeingAssigned = selectedBudget || budgets.find(b => b.id === assignmentData.budgetId);

  const isLoading = navigation.state === "submitting";

  // Effects
  useEffect(() => {
    if (actionData?.success) {
      setToastMessage(actionData.success);
      setToastActive(true);
      setModalActive(false);
      setAssignmentError("");
      resetForm();
    } else if (actionData?.error) {
      // Handle assignment-specific errors differently
      if (modalType === "assign" && modalActive) {
        setAssignmentError(actionData.error);
      } else {
        setToastMessage(actionData.error);
        setToastActive(true);
      }
    }
  }, [actionData, modalType, modalActive]);

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
    setLocationSearchValue("");
    setLocationSearchActive(false);
    setSelectedBudget(null);
    setAssignmentError("");
  }, []);

  const handleModalToggle = useCallback((type = "", budget = null) => {
    if (type === "") {
      // Close modal
      setModalActive(false);
      setModalType("");
      setAssignmentError("");
      resetForm();
      return;
    }

    // Open modal with specific type
    setModalType(type);
    setModalActive(true);
    setAssignmentError("");
    
    if (budget && type === "delete") {
      setSelectedBudget(budget);
    } else if (type === "assign" && budget) {
      // Set the budget for assignment and clear previous location selection
      setSelectedBudget(budget);
      setAssignmentData(prev => ({ 
        ...prev, 
        budgetId: budget.id || "",
        locationId: "", // Clear previous selection
        assignedBy: "" // Clear previous assignedBy
      }));
      setLocationSearchValue("");
      setLocationSearchActive(false);
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

  // Location search handlers
  const filteredLocations = locations.filter(location => 
    location.name?.toLowerCase().includes(locationSearchValue.toLowerCase()) ||
    location.id?.toLowerCase().includes(locationSearchValue.toLowerCase())
  );

  const selectedLocation = locations.find(location => location.id === assignmentData.locationId);

  const handleLocationSelect = useCallback((locationId) => {
    setAssignmentData(prev => ({ ...prev, locationId }));
    setLocationSearchActive(false);
    setLocationSearchValue("");
    setAssignmentError(""); // Clear any previous assignment errors
  }, []);

  const handleSubmit = useCallback((intent) => {
    const form = new FormData();
    form.append("intent", intent);
    
    if (intent === "assign") {
      // Debug logging for assignment
      console.log("Assignment data being sent:", assignmentData);
      Object.keys(assignmentData).forEach(key => {
        if (assignmentData[key]) { // Only append non-empty values
          form.append(key, assignmentData[key]);
        }
      });
      console.log("FormData entries for assignment:");
      for (let [key, value] of form.entries()) {
        console.log(`${key}: ${value}`);
      }
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
              onAction: () => navigate("/app/budget-create")
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
      budget.amount,
      //budget.period || "N/A",
      <Badge status={budget.status === "active" ? "success" : "attention"}>
         {budget.status || "Unknown"} 
      </Badge>,
     // budget.start_date ? new Date(budget.start_date).toLocaleDateString() : "N/A",
      //budget.end_date ? new Date(budget.end_date).toLocaleDateString() : "N/A",
      <InlineStack align="end" gap="200">
        <Button 
          size="slim" 
          onClick={() => navigate(`/app/budget-create?id=${budget.id}`)}
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
           // 'text',
            'text',
           // 'text',
           // 'text',
            'text'
          ]}
          headings={[
            'Budget Name',
            'Amount',
            //'Period',
            'Status',
            //'Start Date',
            //'End Date',
            ''
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
            disabled: !assignmentData.locationId,
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
            {budgetBeingAssigned && (
              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f6f6f7', borderRadius: '6px' }}>
                <Text variant="bodyMd" fontWeight="medium">
                  Assigning Budget: {budgetBeingAssigned.name}
                </Text>
                <Text variant="bodySm" color="subdued">
                  Amount: {budgetBeingAssigned.amount ? `$${budgetBeingAssigned.amount.toLocaleString()}` : 'N/A'} | 
                  Period: {budgetBeingAssigned.period || 'N/A'} |
                  Status: {budgetBeingAssigned.status || 'N/A'}
                </Text>
              </div>
            )}
            
            {assignmentError && (
              <div style={{ 
                marginBottom: '16px', 
                padding: '12px', 
                backgroundColor: '#fef2f2', 
                borderRadius: '6px',
                border: '1px solid #fecaca'
              }}>
                <Text variant="bodyMd" fontWeight="medium" color="critical">
                  Assignment Failed
                </Text>
                <Text variant="bodySm" color="critical">
                  {assignmentError.includes('already assigned') 
                    ? 'This budget is already assigned to the selected location. Please choose a different location or remove the existing assignment first.'
                    : assignmentError
                  }
                </Text>
              </div>
            )}
            
            <FormLayout>
              <div>
                <Text variant="bodyMd" fontWeight="medium" as="label">
                  Select Location *
                </Text>
                <div style={{ marginTop: '4px' }}>
                  <Combobox
                    activator={
                      <Combobox.TextField
                        prefix={<Icon source={SearchIcon} />}
                        onChange={setLocationSearchValue}
                        value={locationSearchValue}
                        placeholder="Search locations..."
                        autoComplete="off"
                      />
                    }
                  >
                    {filteredLocations.length > 0 ? (
                      <Listbox onSelect={handleLocationSelect}>
                        {filteredLocations.map(location => (
                          <Listbox.Option
                            key={location.id}
                            value={location.id}
                            selected={assignmentData.locationId === location.id}
                          >
                            <div style={{ 
                              padding: '12px 16px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'background-color 0.15s ease',
                              backgroundColor: assignmentData.locationId === location.id ? '#f1f5f9' : 'transparent'
                            }}>
                              <div style={{ marginBottom: '4px' }}>
                                <Text variant="bodyMd" fontWeight="medium" color="base">
                                  {location.name}
                                </Text>
                              </div>
                              {/* <div style={{ marginBottom: '2px' }}>
                                <Text variant="bodySm" color="subdued">
                                  ID: {location.id}
                                </Text>
                              </div> */}
                              {/* {location.orderCount && (
                                <div style={{ 
                                  display: 'inline-block',
                                  marginTop: '6px',
                                  padding: '2px 8px',
                                  backgroundColor: '#e0f2fe',
                                  borderRadius: '12px',
                                  border: '1px solid #b3e5fc'
                                }}>
                                  <Text variant="bodySm" color="base" fontWeight="medium">
                                    {location.orderCount} orders
                                  </Text>
                                </div>
                              )} */}
                            </div>
                          </Listbox.Option>
                        ))}
                      </Listbox>
                    ) : (
                      <Listbox>
                        <Listbox.Option disabled>
                          <Text color="subdued">No locations found</Text>
                        </Listbox.Option>
                      </Listbox>
                    )}
                  </Combobox>
                  {selectedLocation && (
                    <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#f6f6f7', borderRadius: '6px' }}>
                      <Text variant="bodyMd" fontWeight="medium">
                        Selected: {selectedLocation.id}
                      </Text>
                      <Text variant="bodySm" color="subdued">
                        {selectedLocation.name}
                      </Text>
                      <Button
                        size="slim"
                        onClick={() => {
                          setAssignmentData(prev => ({ ...prev, locationId: "" }));
                          setAssignmentError(""); // Clear assignment error when clearing selection
                        }}
                        style={{ marginTop: '4px' }}
                      >
                        Clear Selection
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <TextField
                label="Assigned By"
                value={assignmentData.assignedBy}
                onChange={(value) => handleAssignmentChange("assignedBy", value)}
                placeholder="Enter who is making this assignment"
                helpText="Leave empty for system assignment"
              />
              {!assignmentData.locationId && (
                <Text color="critical" variant="bodySm">
                  Please select a location to assign the budget to.
                </Text>
              )}
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
        onAction: () => navigate("/app/budget-create")
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
                  value={searchValue}
                  onChange={setSearchValue}
                  placeholder="Search by name or description"
                  clearButton
                  onClearButtonClick={() => setSearchValue("")}
                />
                <div style={{ alignSelf: 'end' }}>
                  <InlineStack gap="200">
                  
                    <Button onClick={handleFilterChange} loading={isLoading}>
                      Search
                    </Button>
                    {searchValue && (
                      <Button
                        onClick={() => {
                          setSearchValue("");
                          const params = new URLSearchParams();
                          params.set("page", "1");
                        submit(params, { method: "get" });
                      }}
                      disabled={!searchValue}
                    >
                      Clear
                    </Button>
                    )}
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
            error={toastMessage.toLowerCase().includes('error') || toastMessage.toLowerCase().includes('failed')}
            onDismiss={() => setToastActive(false)}
          />
        </Frame>
      )}
    </Page>
  );
}
