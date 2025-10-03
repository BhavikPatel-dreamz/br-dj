import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
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
  FormLayout,
  Select,
  DataTable,
  Modal,
  Toast,
  Frame,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server.js");
  const {
    getAvailableLocationsForCensus,
    getAllLocationCensus
  } = await import("../actions/fhr-location-census.server.js");
  
  await authenticate.admin(request);
  
  const url = new URL(request.url);
  const selectedMonth = url.searchParams.get("month") || "";
  const selectedLocation = url.searchParams.get("location") || "";
  
  try {
    const locations = await getAvailableLocationsForCensus();
    
    // Apply filters if provided
    const filters = {};
    if (selectedLocation) filters.locationId = selectedLocation;
    if (selectedMonth) {
      const [month, year] = selectedMonth.split('-');
      filters.month = month;
      filters.year = year;
    }
    
    const censusRecords = await getAllLocationCensus(filters);

    return json({
      locations,
      censusRecords,
      selectedMonth,
      selectedLocation
    });
  } catch (error) {
    console.error("Loader error:", error);
    return json({
      error: error.message,
      locations: [],
      censusRecords: []
    });
  }
};

export const action = async ({ request }) => {
  const { authenticate } = await import("../shopify.server.js");
  const {
    createOrUpdateLocationCensus,
    deleteLocationCensus
  } = await import("../actions/fhr-location-census.server.js");
  
  await authenticate.admin(request);

  const formData = await request.formData();
  const actionType = formData.get("actionType");

  try {
    switch (actionType) {
      case "create":
      case "update": {
        const censusData = {
          locationId: formData.get("locationId"),
          censusMonth: formData.get("censusMonth"),
          censusAmount: parseFloat(formData.get("censusAmount"))
        };

        await createOrUpdateLocationCensus(censusData);
        
        return json({
          success: true,
          message: `Census data ${actionType === "create" ? "created" : "updated"} successfully`
        });
      }

      case "delete": {
        const locationId = formData.get("locationId");
        const censusMonth = formData.get("censusMonth");
        
        await deleteLocationCensus(locationId, censusMonth);
        
        return json({
          success: true,
          message: "Census data deleted successfully"
        });
      }

      default:
        return json({
          success: false,
          message: "Invalid action type"
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Action error:", error);
    return json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
};

export default function LocationCensusManagement() {  
  const { locations, censusRecords, selectedMonth, selectedLocation, error } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const actionData = useActionData();

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    locationId: "",
    censusMonth: "",
    censusAmount: ""
  });

  // Generate month options (2 years past to 2 years future)
  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    for (let year = currentYear - 0; year <= currentYear + 0; year++) {
      for (let month = 1; month <= 12; month++) {
        const monthStr = month.toString().padStart(2, '0');
        const date = new Date(year, month - 1, 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'long' });
        
        options.push({
          label: `${monthName} ${year}`,
          value: `${monthStr}-${year}`
        });
      }
    }
    
    return options;
  };

  const monthOptions = generateMonthOptions();

  // Handle form submission
  const handleSubmit = useCallback(() => {
    const submitData = new FormData();
    submitData.append("actionType", editingRecord ? "update" : "create");
    submitData.append("locationId", formData.locationId);
    submitData.append("censusMonth", formData.censusMonth);
    submitData.append("censusAmount", formData.censusAmount);

    submit(submitData, { method: "post" });
  }, [formData, editingRecord, submit]);

  // Handle edit
  const handleEdit = useCallback((record) => {
    setEditingRecord(record);
    setFormData({
      locationId: record.location_id,
      censusMonth: record.census_month,
      censusAmount: record.census_amount.toString()
    });
    setShowModal(true);
  }, []);

  // Handle delete
  const handleDelete = useCallback((record) => {
    if (confirm(`Delete census data for ${record.location_id} in ${record.census_month}?`)) {
      const submitData = new FormData();
      submitData.append("actionType", "delete");
      submitData.append("locationId", record.location_id);
      submitData.append("censusMonth", record.census_month);
      submit(submitData, { method: "post" });
    }
  }, [submit]);

  // Handle add new
  const handleAddNew = () => {
    setEditingRecord(null);
    setFormData({
      locationId: "",
      censusMonth: "",
      censusAmount: ""
    });
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setEditingRecord(null);
    setFormData({
      locationId: "",
      censusMonth: "",
      censusAmount: ""
    });
  };

  // Handle action completion
  useEffect(() => {
    if (actionData?.success) {
      closeModal();
      window.location.reload(); // Refresh to show updated data
    }
  }, [actionData]);

  // Handle filter changes
  const handleFilterChange = useCallback((type, value) => {
    const url = new URL(window.location);
    if (value) {
      url.searchParams.set(type, value);
    } else {
      url.searchParams.delete(type);
    }
    window.location.href = url.toString();
  }, []);

  // Prepare table rows
  const tableRows = censusRecords.map(record => {
    const locationInfo = locations.find(loc => loc.location_id === record.location_id);
    const locationDisplay = locationInfo 
      ? `${record.location_id}-${locationInfo.location_name}` 
      : record.location_id;
      
      console.log('Record:', record);

    return [
      `$${parseFloat(record.census_amount).toFixed(2)}`,
      locationDisplay,
      //show MM-YY only 
      new Date(record.year_number, record.month_number - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' } ),
      <InlineStack key={record.id} gap="200">
        <Button size="slim" onClick={() => handleEdit(record)}>
          Edit
        </Button>
        <Button size="slim" variant="primary" tone="critical" onClick={() => handleDelete(record)}>
          Delete
        </Button>
      </InlineStack>
    ];
  });

  return (
    <Frame>
      <Page title="Location Census Management">
        <TitleBar title="Location Census Management" />

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd">Census Records</Text>
                  <Button variant="primary" onClick={handleAddNew}>
                    Add New Census
                  </Button>
                </InlineStack>

                {/* Filters */}
                <InlineStack gap="300" align="end">
                  <Select
                    label="Filter by Location"
                    options={[
                      { label: "All Locations", value: "" },
                      ...locations.map(loc => {
                        return {
                          label: `${loc.location_id}-${loc.location_name}`,
                          value: loc.location_id
                        };
                      })
                    ]}
                    value={selectedLocation}
                    onChange={(value) => handleFilterChange("location", value)}
                  />
                  <Select
                    label="Filter by Month"
                    options={[{ label: "All Months", value: "" }, ...monthOptions]}
                    value={selectedMonth}
                    onChange={(value) => handleFilterChange("month", value)}
                  />
                  {(selectedLocation || selectedMonth) && (
                    <Button 
                      onClick={() => {
                        const url = new URL(window.location);
                        url.searchParams.delete("location");
                        url.searchParams.delete("month");
                        window.location.href = url.toString();
                      }}
                      variant="tertiary"
                    >
                      Clear Filters
                    </Button>
                  )}
                </InlineStack>

                {censusRecords.length > 0 ? (
                  <DataTable
                    columnContentTypes={[ "text", "text", "text",  "text"]}
                    headings={[
                      "Census Total", 
                      "Location ID & Name",
                      "Month",
                      "Actions"
                    ]}
                    rows={tableRows}
                  />
                ) : (
                  <BlockStack align="center" gap="300">
                    <Text variant="headingMd" alignment="center">
                      {selectedLocation || selectedMonth ? "No records found for selected filters" : "No census records found"}
                    </Text>
                    <Text alignment="center" tone="subdued">
                      {selectedLocation || selectedMonth 
                        ? "Try adjusting your filters or add a new census record." 
                        : "Add your first census record to get started."
                      }
                    </Text>
                    <Button variant="primary" onClick={handleAddNew}>
                      Add New Census
                    </Button>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Modal */}
        <Modal
          open={showModal}
          onClose={closeModal}
          title={editingRecord ? "Edit Census Data" : "Add New Census"}
          primaryAction={{
            content: navigation.state === "submitting" ? "Saving..." : "Save",
            onAction: handleSubmit,
            disabled: navigation.state === "submitting" || !formData.locationId || !formData.censusMonth || !formData.censusAmount
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: closeModal
            }
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <Select
                label="Location"
                options={[
                  { label: "Select Location", value: "" }, 
                  ...locations.map(loc => {
                    return {
                      label: `${loc.location_id}-${loc.location_name}`,
                      value: loc.location_id
                    };
                  })
                ]}
                value={formData.locationId}
                onChange={(value) => setFormData(prev => ({ ...prev, locationId: value }))}
                disabled={!!editingRecord}
              />

              <Select
                label="Month"
                options={[{ label: "Select Month", value: "" }, ...monthOptions]}
                value={formData.censusMonth}
                onChange={(value) => setFormData(prev => ({ ...prev, censusMonth: value }))}
                disabled={!!editingRecord}
              />

              <TextField
                label="Census Rate"
                type="number"
                value={formData.censusAmount}
                onChange={(value) => setFormData(prev => ({ ...prev, censusAmount: value }))}
                autoComplete="off"
                min="0"
                step="0.1"
                helpText="Enter census rate (e.g., 1 or 0.1)"
              />
            </FormLayout>
          </Modal.Section>
        </Modal>

        {/* Toast */}
        {actionData && (
          <Toast
            content={actionData.message}
            onDismiss={() => window.location.reload()}
            error={!actionData.success}
          />
        )}
      </Page>
    </Frame>
  );
}