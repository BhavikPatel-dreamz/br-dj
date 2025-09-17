import { useNavigate, useSubmit, useNavigation, useActionData, useLoaderData } from "@remix-run/react";
import { useState, useCallback } from "react";
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
  Badge,
  DataTable,
  Pagination,
  Filters,
  Modal,
  Toast,
  Frame,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server.js";
import { 
  getBudgets, 
  getAvailableLocations, 
  assignBudgetToLocation,
  getAllBudgetAssignments
} from "../actions/fhr-budget.server.js";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const searchQuery = url.searchParams.get("search") || "";
  const budgetFilter = url.searchParams.get("budget") || "";
  const locationFilter = url.searchParams.get("location") || "";
  
  try {
    // Load all necessary data
    const [budgets, locations, allAssignments] = await Promise.all([
      getBudgets(),
      getAvailableLocations(),
      getAllBudgetAssignments()
    ]);

    // Filter assignments
    let filteredAssignments = allAssignments || [];
    
    if (searchQuery) {
      filteredAssignments = filteredAssignments.filter(assignment => 
        assignment.budget_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assignment.location_id?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (budgetFilter) {
      filteredAssignments = filteredAssignments.filter(assignment => 
        assignment.budget_id == budgetFilter
      );
    }
    
    if (locationFilter) {
      filteredAssignments = filteredAssignments.filter(assignment => 
        assignment.location_id === locationFilter
      );
    }

    // Apply pagination
    const totalAssignments = filteredAssignments.length;
    const startIndex = (page - 1) * limit;
    const paginatedAssignments = filteredAssignments.slice(startIndex, startIndex + limit);

    return json({
      assignments: paginatedAssignments,
      budgets: budgets || [],
      locations: locations || [],
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalAssignments / limit),
        totalItems: totalAssignments,
        itemsPerPage: limit
      },
      filters: {
        search: searchQuery,
        budget: budgetFilter,
        location: locationFilter
      }
    });
  } catch (error) {
    console.error("Error loading budget location assignments:", error);
    return json({
      assignments: [],
      budgets: [],
      locations: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: limit
      },
      filters: {
        search: "",
        budget: "",
        location: ""
      },
      error: "Failed to load assignment data"
    });
  }
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  try {
    if (actionType === "assign") {
      const assignmentData = {
        budgetId: parseInt(formData.get("budget_id")),
        locationId: formData.get("location_id"),
        assignedBy: formData.get("assigned_by") || "system"
      };
      
      try {
        const result = await assignBudgetToLocation(assignmentData);
        
        return json({ 
          success: true, 
          message: "Budget successfully assigned to location!",
          assignment: result
        });
      } catch (error) {
        return json({ 
          success: false, 
          error: error.message || "Failed to assign budget to location" 
        });
      }
    }

    return json({ success: false, error: "Invalid action type" });
  } catch (error) {
    console.error("Error processing budget location assignment:", error);
    return json({ 
      success: false, 
      error: error.message || "Failed to process assignment" 
    });
  }
};

export default function BudgetLocationAssignments() {
  const { assignments, budgets, locations, pagination, filters, error } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  
  // State for assignment modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [assignedBy, setAssignedBy] = useState("");

  // State for filters
  const [searchValue, setSearchValue] = useState(filters.search || "");
  const [budgetFilter, setBudgetFilter] = useState(filters.budget || "");
  const [locationFilter, setLocationFilter] = useState(filters.location || "");

  // Toast state
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);

  const isLoading = navigation.state === "submitting";

  // Handle action data (success/error messages)
  if (actionData) {
    if (actionData.success && !toastActive) {
      setToastMessage(actionData.message);
      setToastError(false);
      setToastActive(true);
      setIsAssignModalOpen(false);
      // Reset form
      setSelectedBudget("");
      setSelectedLocation("");
      setAssignedBy("");
    } else if (!actionData.success && !toastActive) {
      setToastMessage(actionData.error);
      setToastError(true);
      setToastActive(true);
    }
  }

  const handleAssignSubmit = useCallback(() => {
    if (!selectedBudget || !selectedLocation) {
      setToastMessage("Please select both a budget and location");
      setToastError(true);
      setToastActive(true);
      return;
    }

    const formData = new FormData();
    formData.append("actionType", "assign");
    formData.append("budget_id", selectedBudget);
    formData.append("location_id", selectedLocation);
    formData.append("assigned_by", assignedBy);

    submit(formData, { method: "post" });
  }, [selectedBudget, selectedLocation, assignedBy, submit]);

  const handleFiltersQueryChange = useCallback((value) => {
    setSearchValue(value);
  }, []);

  const handleBudgetFilterChange = useCallback((value) => {
    setBudgetFilter(value);
  }, []);

  const handleLocationFilterChange = useCallback((value) => {
    setLocationFilter(value);
  }, []);

  const handleFiltersApply = useCallback(() => {
    const params = new URLSearchParams();
    if (searchValue) params.set("search", searchValue);
    if (budgetFilter) params.set("budget", budgetFilter);
    if (locationFilter) params.set("location", locationFilter);
    params.set("page", "1"); // Reset to first page when filtering
    
    navigate(`?${params.toString()}`);
  }, [searchValue, budgetFilter, locationFilter, navigate]);

  const handleFiltersClear = useCallback(() => {
    setSearchValue("");
    setBudgetFilter("");
    setLocationFilter("");
    navigate("?page=1");
  }, [navigate]);

  // Prepare budget options for select
  const budgetOptions = [
    { label: "All Budgets", value: "" },
    ...budgets.map(budget => ({
      label: `${budget.name} ($${budget.total_amount?.toLocaleString() || "0"})`,
      value: budget.id.toString()
    }))
  ];

  // Prepare location options for select
  const locationOptions = [
    { label: "All Locations", value: "" },
    ...locations.map(location => ({
      label: location.name || location.id,
      value: location.id
    }))
  ];

  // Prepare assignment options for the modal
  const assignBudgetOptions = [
    { label: "Select a budget", value: "" },
    ...budgets.map(budget => ({
      label: `${budget.name} ($${budget.total_amount?.toLocaleString() || "0"})`,
      value: budget.id.toString()
    }))
  ];

  const assignLocationOptions = [
    { label: "Select a location", value: "" },
    ...locations.map(location => ({
      label: location.name || location.id,
      value: location.id
    }))
  ];

  // Prepare table data
  const tableRows = assignments.map(assignment => [
    assignment.budget_name || "Unknown Budget",
    `$${assignment.total_amount?.toLocaleString() || "0"}`,
    assignment.location_id,
    <Badge 
      key={assignment.id}
      status={assignment.status === "active" ? "success" : "critical"}
    >
      {assignment.status}
    </Badge>,
    assignment.assigned_by || "System",
    new Date(assignment.created_at).toLocaleDateString()
  ]);

  const handlePreviousPage = useCallback(() => {
    if (pagination.currentPage > 1) {
      const params = new URLSearchParams(window.location.search);
      params.set("page", (pagination.currentPage - 1).toString());
      navigate(`?${params.toString()}`);
    }
  }, [pagination.currentPage, navigate]);

  const handleNextPage = useCallback(() => {
    if (pagination.currentPage < pagination.totalPages) {
      const params = new URLSearchParams(window.location.search);
      params.set("page", (pagination.currentPage + 1).toString());
      navigate(`?${params.toString()}`);
    }
  }, [pagination.currentPage, pagination.totalPages, navigate]);

  const toastMarkup = toastActive ? (
    <Toast
      content={toastMessage}
      error={toastError}
      onDismiss={() => setToastActive(false)}
    />
  ) : null;

  return (
    <Frame>
      {toastMarkup}
      <Page>
        <TitleBar title="Budget Location Assignments" />
        <Layout>
          <Layout.Section>
            {error && (
              <Card>
                <Text as="p" color="critical">
                  {error}
                </Text>
              </Card>
            )}

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Budget Location Assignments
                  </Text>
                  <Button 
                    primary 
                    onClick={() => setIsAssignModalOpen(true)}
                  >
                    Assign Budget to Location
                  </Button>
                </InlineStack>

                <Filters
                  queryValue={searchValue}
                  queryPlaceholder="Search by budget name or location"
                  onQueryChange={handleFiltersQueryChange}
                  onQueryClear={() => setSearchValue("")}
                  onClearAll={handleFiltersClear}
                  filters={[
                    {
                      key: "budget",
                      label: "Budget",
                      filter: (
                        <Select
                          options={budgetOptions}
                          value={budgetFilter}
                          onChange={handleBudgetFilterChange}
                        />
                      ),
                      shortcut: true,
                    },
                    {
                      key: "location",
                      label: "Location", 
                      filter: (
                        <Select
                          options={locationOptions}
                          value={locationFilter}
                          onChange={handleLocationFilterChange}
                        />
                      ),
                      shortcut: true,
                    },
                  ]}
                  appliedFilters={[
                    ...(budgetFilter ? [{
                      key: "budget",
                      label: `Budget: ${budgetOptions.find(opt => opt.value === budgetFilter)?.label}`,
                      onRemove: () => setBudgetFilter(""),
                    }] : []),
                    ...(locationFilter ? [{
                      key: "location", 
                      label: `Location: ${locationOptions.find(opt => opt.value === locationFilter)?.label}`,
                      onRemove: () => setLocationFilter(""),
                    }] : []),
                  ]}
                  onApply={handleFiltersApply}
                />

                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                  headings={[
                    "Budget Name",
                    "Budget Total", 
                    "Location ID",
                    "Status",
                    "Assigned By",
                    "Assigned Date"
                  ]}
                  rows={tableRows}
                  pagination={{
                    hasNext: pagination.currentPage < pagination.totalPages,
                    onNext: handleNextPage,
                    hasPrevious: pagination.currentPage > 1,
                    onPrevious: handlePreviousPage,
                  }}
                />

                {pagination.totalItems > 0 && (
                  <Text as="p" variant="bodySm" color="subdued" alignment="center">
                    Showing {Math.min(pagination.itemsPerPage, pagination.totalItems)} of {pagination.totalItems} assignments
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Modal
          open={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title="Assign Budget to Location"
          primaryAction={{
            content: "Assign",
            onAction: handleAssignSubmit,
            loading: isLoading,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setIsAssignModalOpen(false),
            },
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <Select
                label="Budget"
                options={assignBudgetOptions}
                value={selectedBudget}
                onChange={setSelectedBudget}
                placeholder="Select a budget to assign"
              />
              
              <Select
                label="Location"
                options={assignLocationOptions}
                value={selectedLocation}
                onChange={setSelectedLocation}
                placeholder="Select a location"
              />
              
              <TextField
                label="Assigned By (Optional)"
                value={assignedBy}
                onChange={setAssignedBy}
                placeholder="Enter who is making this assignment"
                helpText="Leave empty for system assignment"
              />
            </FormLayout>
          </Modal.Section>
        </Modal>
      </Page>
    </Frame>
  );
}
