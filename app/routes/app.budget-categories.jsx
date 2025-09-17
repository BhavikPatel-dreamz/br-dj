import { json } from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  useNavigation,
  useSearchParams,
  Form,
} from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  Page,
  Card,
  DataTable,
  Button,
  TextField,
  Modal,
  FormLayout,
  Badge,
  Pagination,
  Filters,
  ChoiceList,
  Banner,
  Toast,
  Frame,
  Loading,
  EmptySearchResult,
  EmptyState,
  Tooltip,
  ButtonGroup,
  Checkbox,
} from "@shopify/polaris";
import {
  createBudgetCategory,
  updateBudgetCategory,
  deleteBudgetCategory,
  getBudgetCategoriesWithPagination as getBudgetCategories,
} from "../actions/index.server.js";

// Loader function - handles GET requests
export async function loader({ request }) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const search = url.searchParams.get("search") || "";
  const sortBy = url.searchParams.get("sortBy") || "category_name";
  const sortOrder = url.searchParams.get("sortOrder") || "ASC";
  const activeOnly = url.searchParams.get("activeOnly") !== "false";

  const categoriesResult = await getBudgetCategories({
    page,
    limit,
    search,
    sortBy,
    sortOrder,
    activeOnly,
  });

  return json({
    categories: categoriesResult.data || [],
    pagination: categoriesResult.pagination || null,
    success: categoriesResult.success,
    error: categoriesResult.error || null,
  });
}

// Action function - handles POST, PUT, DELETE requests
export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  switch (intent) {
    case "create":
      const createData = {
        category_name: formData.get("category_name"),
        category_code: formData.get("category_code"),
        description: formData.get("description"),
        sort_order: parseInt(formData.get("sort_order") || "0"),
        created_by: "admin",
      };
      return json(await createBudgetCategory(createData));

    case "update":
      const updateId = formData.get("id");
      const updateData = {
        category_name: formData.get("category_name"),
        category_code: formData.get("category_code"),
        description: formData.get("description"),
        sort_order: parseInt(formData.get("sort_order") || "0"),
        is_active: formData.get("is_active") === "true",
        updated_by: "admin",
      };
      return json(await updateBudgetCategory(updateId, updateData));

    case "delete":
      const deleteId = formData.get("id");
      return json(await deleteBudgetCategory(deleteId));

    default:
      return json({ success: false, error: "Invalid action intent" });
  }
}

export default function BudgetCategoriesManagement() {
  const { categories, pagination, success, error } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();

  // State for modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // State for form data
  const [formData, setFormData] = useState({
    category_name: "",
    category_code: "",
    description: "",
    sort_order: 0,
    is_active: true,
  });

  // State for filters
  const [searchValue, setSearchValue] = useState(
    searchParams.get("search") || ""
  );
  const [sortBy, setSortBy] = useState(
    searchParams.get("sortBy") || "category_name"
  );
  const [sortOrder, setSortOrder] = useState(
    searchParams.get("sortOrder") || "ASC"
  );
  const [activeOnly, setActiveOnly] = useState(
    searchParams.get("activeOnly") !== "false"
  );

  // State for toast notifications
  const [toast, setToast] = useState(null);

  // State for form errors
  const [formErrors, setFormErrors] = useState({});

  const isLoading = navigation.state !== "idle";

  // Handle action data (form submissions)
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        setToast({
          content: actionData.message || "Operation completed successfully",
          duration: 3000,
        });

        // Close modals and reset form
        setIsCreateModalOpen(false);
        setIsEditModalOpen(false);
        setIsDeleteModalOpen(false);
        resetForm();

        // Refresh data by navigating to current page
        window.location.reload();
      } else {
        setToast({
          content: actionData.error || "Operation failed",
          error: true,
          duration: 5000,
        });
      }
    }
  }, [actionData]);

  const resetForm = () => {
    setFormData({
      category_name: "",
      category_code: "",
      description: "",
      sort_order: 0,
      is_active: true,
    });
    setSelectedCategory(null);
    setFormErrors({});
  };

  const handleSearch = () => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (searchValue.trim()) {
      newSearchParams.set("search", searchValue.trim());
    } else {
      newSearchParams.delete("search");
    }
    newSearchParams.set("page", "1"); // Reset to first page
    setSearchParams(newSearchParams);
  };

  const handleSort = (column) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (sortBy === column) {
      // Toggle sort order
      const newOrder = sortOrder === "ASC" ? "DESC" : "ASC";
      newSearchParams.set("sortOrder", newOrder);
      setSortOrder(newOrder);
    } else {
      // Set new sort column
      newSearchParams.set("sortBy", column);
      newSearchParams.set("sortOrder", "ASC");
      setSortBy(column);
      setSortOrder("ASC");
    }
    newSearchParams.set("page", "1");
    setSearchParams(newSearchParams);
  };

  const handlePageChange = (page) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set("page", page.toString());
    setSearchParams(newSearchParams);
  };

  const handleActiveFilter = (value) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (value) {
      newSearchParams.set("activeOnly", "true");
    } else {
      newSearchParams.set("activeOnly", "false");
    }
    newSearchParams.set("page", "1");
    setSearchParams(newSearchParams);
    setActiveOnly(value);
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const openEditModal = (category) => {
    setSelectedCategory(category);
    setFormData({
      category_name: category.category_name || "",
      category_code: category.category_code || "",
      description: category.description || "",
      sort_order: category.sort_order || 0,
      is_active: category.is_active,
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (category) => {
    setSelectedCategory(category);
    setIsDeleteModalOpen(true);
  };

  // Form validation
  const validateForm = () => {
    const errors = {};

    if (!formData.category_name.trim()) {
      errors.category_name = "Category name is required";
    }

    if (formData.sort_order < 0) {
      errors.sort_order = "Sort order must be a positive number";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateSubmit = () => {
    if (validateForm()) {
      document.getElementById("create-category-form").requestSubmit();
    }
  };

  const handleEditSubmit = () => {
    if (validateForm()) {
      document.getElementById("edit-category-form").requestSubmit();
    }
  };

  // Prepare data for DataTable
  const tableHeaders = [
    { content: "ID", key: "id" },
    { content: "Category Name", key: "category_name" },
    { content: "Code", key: "category_code" },
    { content: "Description", key: "description" },
    { content: "Sort Order", key: "sort_order" },
    { content: "Status", key: "status" },
    { content: "Actions", key: "actions" },
  ];

  const tableRows = categories.map((category) => [
    category.id,
    <Button variant='plain' onClick={() => openEditModal(category)}>
      {category.category_name}
    </Button>,
    category.category_code || "-",
    <div
      style={{
        maxWidth: "200px",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {category.description || "-"}
    </div>,
    category.sort_order || 0,
    <Badge status={category.is_active ? "success" : "critical"}>
      {category.is_active ? "Active" : "Inactive"}
    </Badge>,
    <ButtonGroup segmented>
      <Tooltip content='Edit category'>
        <Button onClick={() => openEditModal(category)} size='slim'>
          Edit
        </Button>
      </Tooltip>
      <Tooltip content='Delete category'>
        <Button
          onClick={() => openDeleteModal(category)}
          size='slim'
          tone='critical'
        >
          Delete
        </Button>
      </Tooltip>
    </ButtonGroup>,
  ]);

  const filters = [
    {
      key: "activeOnly",
      label: "Status",
      filter: (
        <ChoiceList
          title='Status'
          titleHidden
          choices={[
            { label: "Active only", value: "true" },
            { label: "All categories", value: "false" },
          ]}
          selected={[activeOnly.toString()]}
          onChange={(values) => handleActiveFilter(values[0] === "true")}
        />
      ),
    },
  ];

  return (
    <Frame>
      <Page
        title='Budget Categories Management'
        subtitle='Manage budget categories for your organization'
        primaryAction={{
          content: "Create Category",
          onAction: openCreateModal,
        }}
        secondaryActions={[
          {
            content: "Back to Budget Management",
            url: "/app",
          },
        ]}
      >
        {error && (
          <Banner status='critical' title='Error loading categories'>
            <p>{error}</p>
          </Banner>
        )}

        <Card>
          <div style={{ padding: "16px" }}>
            {/* Search and Filters */}
            <div style={{ marginBottom: "16px" }}>
              <Filters
                queryValue={searchValue}
                queryPlaceholder='Search categories...'
                onQueryChange={setSearchValue}
                onQueryClear={() => {
                  setSearchValue("");
                  const newSearchParams = new URLSearchParams(searchParams);
                  newSearchParams.delete("search");
                  setSearchParams(newSearchParams);
                }}
                onClearAll={() => {
                  setSearchValue("");
                  setActiveOnly(true);
                  setSearchParams({});
                }}
                filters={filters}
              >
                <Button onClick={handleSearch}>Search</Button>
              </Filters>
            </div>

            {/* Data Table */}
            {categories.length > 0 ? (
              <>
                <DataTable
                  columnContentTypes={[
                    "text",
                    "text",
                    "text",
                    "text",
                    "numeric",
                    "text",
                    "text",
                  ]}
                  headings={tableHeaders.map((header) => (
                    <Button
                      variant='plain'
                      onClick={() => handleSort(header.key)}
                    >
                      {header.content}
                      {sortBy === header.key &&
                        (sortOrder === "ASC" ? " ↑" : " ↓")}
                    </Button>
                  ))}
                  rows={tableRows}
                  footerContent={
                    pagination && pagination.totalRecords > 0
                      ? `Showing ${(pagination.currentPage - 1) * pagination.pageSize + 1}-${Math.min(pagination.currentPage * pagination.pageSize, pagination.totalRecords)} of ${pagination.totalRecords} categories`
                      : null
                  }
                />

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginTop: "16px",
                    }}
                  >
                    <Pagination
                      hasPrevious={pagination.hasPrevious}
                      onPrevious={() =>
                        handlePageChange(pagination.currentPage - 1)
                      }
                      hasNext={pagination.hasNext}
                      onNext={() =>
                        handlePageChange(pagination.currentPage + 1)
                      }
                      label={`Page ${pagination.currentPage} of ${pagination.totalPages}`}
                    />
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                heading='No budget categories found'
                action={{
                  content: "Create Category",
                  onAction: openCreateModal,
                }}
                image='https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png'
              >
                <p>
                  Start by creating your first budget category to organize your
                  budget allocations.
                </p>
              </EmptyState>
            )}
          </div>
        </Card>

        {/* Create Category Modal */}
        <Modal
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title='Create New Budget Category'
          primaryAction={{
            content: "Create",
            onAction: handleCreateSubmit,
            loading: isLoading,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setIsCreateModalOpen(false),
            },
          ]}
        >
          <Modal.Section>
            <Form method='post' id='create-category-form'>
              <input type='hidden' name='intent' value='create' />
              <FormLayout>
                <TextField
                  label='Category Name'
                  name='category_name'
                  value={formData.category_name}
                  onChange={(value) =>
                    setFormData({ ...formData, category_name: value })
                  }
                  placeholder='e.g., Gen Nsg>Medical Supplies'
                  autoComplete='off'
                  requiredIndicator
                  error={formErrors.category_name}
                />
                <TextField
                  label='Category Code'
                  name='category_code'
                  value={formData.category_code}
                  onChange={(value) =>
                    setFormData({ ...formData, category_code: value })
                  }
                  placeholder='Optional category code'
                  autoComplete='off'
                />
                <TextField
                  label='Description'
                  name='description'
                  value={formData.description}
                  onChange={(value) =>
                    setFormData({ ...formData, description: value })
                  }
                  placeholder='Optional description'
                  multiline={3}
                  autoComplete='off'
                />
                <TextField
                  label='Sort Order'
                  name='sort_order'
                  type='number'
                  value={formData.sort_order.toString()}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      sort_order: parseInt(value) || 0,
                    })
                  }
                  placeholder='0'
                  autoComplete='off'
                  error={formErrors.sort_order}
                />
              </FormLayout>
            </Form>
          </Modal.Section>
        </Modal>

        {/* Edit Category Modal */}
        <Modal
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title='Edit Budget Category'
          primaryAction={{
            content: "Update",
            onAction: handleEditSubmit,
            loading: isLoading,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setIsEditModalOpen(false),
            },
          ]}
        >
          <Modal.Section>
            <Form method='post' id='edit-category-form'>
              <input type='hidden' name='intent' value='update' />
              <input
                type='hidden'
                name='id'
                value={selectedCategory?.id || ""}
              />
              <FormLayout>
                <TextField
                  label='Category Name'
                  name='category_name'
                  value={formData.category_name}
                  onChange={(value) =>
                    setFormData({ ...formData, category_name: value })
                  }
                  placeholder='e.g., Gen Nsg>Medical Supplies'
                  autoComplete='off'
                  requiredIndicator
                  error={formErrors.category_name}
                />
                <TextField
                  label='Category Code'
                  name='category_code'
                  value={formData.category_code}
                  onChange={(value) =>
                    setFormData({ ...formData, category_code: value })
                  }
                  placeholder='Optional category code'
                  autoComplete='off'
                />
                <TextField
                  label='Description'
                  name='description'
                  value={formData.description}
                  onChange={(value) =>
                    setFormData({ ...formData, description: value })
                  }
                  placeholder='Optional description'
                  multiline={3}
                  autoComplete='off'
                />
                <TextField
                  label='Sort Order'
                  name='sort_order'
                  type='number'
                  value={formData.sort_order.toString()}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      sort_order: parseInt(value) || 0,
                    })
                  }
                  autoComplete='off'
                  error={formErrors.sort_order}
                />
                <Checkbox
                  label='Active'
                  checked={formData.is_active}
                  onChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <input
                  type='hidden'
                  name='is_active'
                  value={formData.is_active.toString()}
                />
              </FormLayout>
            </Form>
          </Modal.Section>
        </Modal>

        {/* Delete Category Modal */}
        <Modal
          open={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title='Delete Budget Category'
          primaryAction={{
            content: "Delete",
            destructive: true,
            onAction: () =>
              document.getElementById("delete-category-form").requestSubmit(),
            loading: isLoading,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setIsDeleteModalOpen(false),
            },
          ]}
        >
          <Modal.Section>
            <p>
              Are you sure you want to delete the category "
              <strong>{selectedCategory?.category_name}</strong>"?
            </p>
            <p style={{ marginTop: "8px", color: "#bf0711" }}>
              This action will deactivate the category and it won't be available
              for new budgets. Existing budget allocations using this category
              will not be affected.
            </p>
            <Form method='post' id='delete-category-form'>
              <input type='hidden' name='intent' value='delete' />
              <input
                type='hidden'
                name='id'
                value={selectedCategory?.id || ""}
              />
            </Form>
          </Modal.Section>
        </Modal>

        {/* Toast Notifications */}
        {toast && (
          <Toast
            content={toast.content}
            error={toast.error}
            onDismiss={() => setToast(null)}
            duration={toast.duration}
          />
        )}

        {/* Loading overlay */}
        {isLoading && <Loading />}
      </Page>
    </Frame>
  );
}
