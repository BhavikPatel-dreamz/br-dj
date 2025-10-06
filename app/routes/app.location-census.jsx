import { useLoaderData, useSubmit, useNavigation, useActionData, useNavigate, useSearchParams } from "@remix-run/react";
import { useState, useCallback, useEffect, useMemo } from "react";
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
  Autocomplete,
  Icon,
  DataTable,
  Modal,
  Toast,
  Frame,
  Spinner,
} from "@shopify/polaris";
import { SearchIcon } from '@shopify/polaris-icons';
import { TitleBar } from "@shopify/app-bridge-react";
import  { authenticate } from "../shopify.server.js";
import { getAllLocationCensus,getAvailableLocationsForCensus,deleteLocationCensus } from "../actions/fhr-location-census.server.js";



export const loader = async ({ request }) => {

  await authenticate.admin(request);

  try {
    const url = new URL(request.url);
    const locationId = url.searchParams.get("locationId");
    const censusMonth = url.searchParams.get("censusMonth");

    const filters = {};
    if (locationId) filters.locationId = locationId;
    if (censusMonth) filters.censusMonth = censusMonth;

    const locations = await getAvailableLocationsForCensus();
    const censusRecords = await getAllLocationCensus(filters);

    return json({
      locations,
      censusRecords
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
  const { locations, censusRecords, error } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const actionData = useActionData();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    locationId: "",
    censusMonth: "",
    censusAmount: ""
  });

  // Filter autocomplete states
  const [locationInputValue, setLocationInputValue] = useState('');
  const [selectedLocationOptions, setSelectedLocationOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);

  const [monthInputValue, setMonthInputValue] = useState('');
  const [selectedMonthOptions, setSelectedMonthOptions] = useState([]);
  const [monthOptions, setMonthOptions] = useState([]);

  // Modal autocomplete states
  const [modalLocationInputValue, setModalLocationInputValue] = useState('');
  const [modalLocationOptions, setModalLocationOptions] = useState([]);

  const [modalMonthInputValue, setModalMonthInputValue] = useState('');
  const [modalMonthOptions, setModalMonthOptions] = useState([]);

  // Generate month options
  const allMonthOptions = useMemo(() => {
    const options = [];
    const currentDate = new Date();

    for (let i = -3; i <= 3; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const monthName = date.toLocaleDateString('en-US', { month: 'long' });

      options.push({
        label: `${monthName} ${year}`,
        value: `${monthStr}-${year}`
      });
    }

    return options;
  }, []);

  // Location options with "All Locations"
  const locationAutocompleteOptions = useMemo(() => [
    { value: '', label: 'All Locations' },
    ...locations.map(loc => ({
      value: loc.location_id,
      label: `${loc.location_id}-${loc.location_name}`
    }))
  ], [locations]);

  // Modal location options (without "All")
  const modalLocationAutocompleteOptions = useMemo(() =>
    locations.map(loc => ({
      value: loc.location_id,
      label: `${loc.location_id}-${loc.location_name}`
    }))
  , [locations]);

  // Month options with "All Months"
  const monthAutocompleteOptions = useMemo(() => [
    { value: '', label: 'All Months' },
    ...allMonthOptions
  ], [allMonthOptions]);

  // Modal month options (without "All")
  const modalMonthAutocompleteOptions = useMemo(() => allMonthOptions, [allMonthOptions]);

  // Filter location autocomplete
  const updateLocationText = useCallback((value) => {
    setLocationInputValue(value);

    if (value === '') {
      setLocationOptions(locationAutocompleteOptions);
    } else {
      const filterRegex = new RegExp(value, 'i');
      const resultOptions = locationAutocompleteOptions.filter((option) =>
        option.label.match(filterRegex)
      );
      setLocationOptions(resultOptions);
    }
  }, [locationAutocompleteOptions]);

  const updateLocationSelection = useCallback((selected) => {
    if (selected.length === 0) {
      setSelectedLocationOptions([]);
      return;
    }

    const matchedOption = locationAutocompleteOptions.find((option) => option.value === selected[0]);

    setSelectedLocationOptions(selected);
    setLocationInputValue(matchedOption?.label || '');

    // Update URL params and trigger server fetch
    const newParams = new URLSearchParams(searchParams);
    if (selected[0]) {
      newParams.set('locationId', selected[0]);
    } else {
      newParams.delete('locationId');
    }
    setSearchParams(newParams);
  }, [locationAutocompleteOptions, searchParams, setSearchParams]);

  // Filter month autocomplete
  const updateMonthText = useCallback((value) => {
    setMonthInputValue(value);

    if (value === '') {
      setMonthOptions(monthAutocompleteOptions);
    } else {
      const filterRegex = new RegExp(value, 'i');
      const resultOptions = monthAutocompleteOptions.filter((option) =>
        option.label.match(filterRegex)
      );
      setMonthOptions(resultOptions);
    }
  }, [monthAutocompleteOptions]);

  const updateMonthSelection = useCallback((selected) => {
    if (selected.length === 0) {
      setSelectedMonthOptions([]);
      return;
    }

    const matchedOption = monthAutocompleteOptions.find((option) => option.value === selected[0]);

    setSelectedMonthOptions(selected);
    setMonthInputValue(matchedOption?.label || '');

    // Update URL params and trigger server fetch
    const newParams = new URLSearchParams(searchParams);
    if (selected[0]) {
      newParams.set('censusMonth', selected[0]);
    } else {
      newParams.delete('censusMonth');
    }
    setSearchParams(newParams);
  }, [monthAutocompleteOptions, searchParams, setSearchParams]);

  // Modal location autocomplete
  const updateModalLocationText = useCallback((value) => {
    setModalLocationInputValue(value);

    if (value === '') {
      setModalLocationOptions(modalLocationAutocompleteOptions);
    } else {
      const filterRegex = new RegExp(value, 'i');
      const resultOptions = modalLocationAutocompleteOptions.filter((option) =>
        option.label.match(filterRegex)
      );
      setModalLocationOptions(resultOptions);
    }
  }, [modalLocationAutocompleteOptions]);

  const updateModalLocationSelection = useCallback((selected) => {
    if (selected.length === 0) {
      setFormData(prev => ({ ...prev, locationId: '' }));
      return;
    }

    const matchedOption = modalLocationAutocompleteOptions.find((option) => option.value === selected[0]);

    setModalLocationInputValue(matchedOption?.label || '');
    setFormData(prev => ({ ...prev, locationId: selected[0] || '' }));
  }, [modalLocationAutocompleteOptions]);

  // Modal month autocomplete
  const updateModalMonthText = useCallback((value) => {
    setModalMonthInputValue(value);

    if (value === '') {
      setModalMonthOptions(modalMonthAutocompleteOptions);
    } else {
      const filterRegex = new RegExp(value, 'i');
      const resultOptions = modalMonthAutocompleteOptions.filter((option) =>
        option.label.match(filterRegex)
      );
      setModalMonthOptions(resultOptions);
    }
  }, [modalMonthAutocompleteOptions]);

  const updateModalMonthSelection = useCallback((selected) => {
    if (selected.length === 0) {
      setFormData(prev => ({ ...prev, censusMonth: '' }));
      return;
    }

    const matchedOption = modalMonthAutocompleteOptions.find((option) => option.value === selected[0]);

    setModalMonthInputValue(matchedOption?.label || '');
    setFormData(prev => ({ ...prev, censusMonth: selected[0] || '' }));
  }, [modalMonthAutocompleteOptions]);

  // Initialize options
  useEffect(() => {
    setLocationOptions(locationAutocompleteOptions);
    setModalLocationOptions(modalLocationAutocompleteOptions);
  }, [locations]);

  useEffect(() => {
    setMonthOptions(monthAutocompleteOptions);
    setModalMonthOptions(modalMonthAutocompleteOptions);
  }, []);

  // Update modal autocomplete when editing
  useEffect(() => {
    if (editingRecord) {
      const locationOption = locations.find(loc => loc.location_id === editingRecord.location_id);
      if (locationOption) {
        setModalLocationInputValue(`${locationOption.location_id}-${locationOption.location_name}`);
      }

      const monthOption = allMonthOptions.find(opt => opt.value === editingRecord.census_month);
      if (monthOption) {
        setModalMonthInputValue(monthOption.label);
      }
    } else if (showModal) {
      setModalLocationInputValue('');
      setModalMonthInputValue('');
    }
  }, [editingRecord, showModal, locations, allMonthOptions]);

  // Initialize filters from URL params on mount
  useEffect(() => {
    const locationId = searchParams.get('locationId');
    const censusMonth = searchParams.get('censusMonth');

    if (locationId) {
      setSelectedLocationOptions([locationId]);
      const matchedOption = locationAutocompleteOptions.find(opt => opt.value === locationId);
      if (matchedOption) setLocationInputValue(matchedOption.label);
    }

    if (censusMonth) {
      setSelectedMonthOptions([censusMonth]);
      const matchedOption = monthAutocompleteOptions.find(opt => opt.value === censusMonth);
      if (matchedOption) setMonthInputValue(matchedOption.label);
    }
  }, []); // Run only on mount

  const handleSubmit = useCallback(() => {
    const submitData = new FormData();
    submitData.append("actionType", editingRecord ? "update" : "create");
    submitData.append("locationId", formData.locationId);
    submitData.append("censusMonth", formData.censusMonth);
    submitData.append("censusAmount", formData.censusAmount);

    submit(submitData, { method: "post" });
  }, [formData, editingRecord, submit]);

  const handleEdit = useCallback((record) => {
    setEditingRecord(record);
    setFormData({
      locationId: record.location_id,
      censusMonth: record.census_month,
      censusAmount: record.census_amount.toString()
    });
    setShowModal(true);
  }, []);

  const handleDelete = useCallback((record) => {
    if (confirm(`Delete census data for ${record.location_id} in ${record.census_month}?`)) {
      const submitData = new FormData();
      submitData.append("actionType", "delete");
      submitData.append("locationId", record.location_id);
      submitData.append("censusMonth", record.census_month);
      submit(submitData, { method: "post" });
    }
  }, [submit]);

  const handleAddNew = () => {
    setEditingRecord(null);
    setFormData({
      locationId: "",
      censusMonth: "",
      censusAmount: ""
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecord(null);
    setFormData({
      locationId: "",
      censusMonth: "",
      censusAmount: ""
    });
    setModalLocationInputValue('');
    setModalMonthInputValue('');
  };

  useEffect(() => {
    if (actionData?.success) {
      closeModal();
      window.location.reload();
    }
  }, [actionData]);

  const clearFilters = () => {
    setLocationInputValue('');
    setSelectedLocationOptions([]);
    setMonthInputValue('');
    setSelectedMonthOptions([]);
    setSearchParams(new URLSearchParams()); // Clear URL params and trigger server fetch
  };

  // Prepare table rows
  const tableRows = censusRecords.map(record => {
    const locationInfo = locations.find(loc => loc.location_id === record.location_id);
    const locationDisplay = locationInfo 
      ? `${record.location_id}-${locationInfo.location_name}` 
      : record.location_id;

    return [
      `$${parseFloat(record.census_amount).toFixed(2)}`,
      locationDisplay,
      new Date(record.year_number, record.month_number - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
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
                  <div style={{minWidth: '200px'}}>
                    <Autocomplete
                      allowMultiple={false}
                      options={locationOptions}
                      selected={selectedLocationOptions}
                      onSelect={updateLocationSelection}
                      textField={
                        <Autocomplete.TextField
                          onChange={updateLocationText}
                          label="Filter by Location"
                          value={locationInputValue}
                          prefix={<Icon source={SearchIcon} tone="base" />}
                          placeholder="Search locations..."
                          autoComplete="off"
                        />
                      }
                    />
                  </div>
                  <div style={{minWidth: '200px'}}>
                    <Autocomplete
                      allowMultiple={false}
                      options={monthOptions}
                      selected={selectedMonthOptions}
                      onSelect={updateMonthSelection}
                      textField={
                        <Autocomplete.TextField
                          onChange={updateMonthText}
                          label="Filter by Month"
                          value={monthInputValue}
                          prefix={<Icon source={SearchIcon} tone="base" />}
                          placeholder="Search months..."
                          autoComplete="off"
                        />
                      }
                    />
                  </div>
                  {(selectedLocationOptions.length > 0 || selectedMonthOptions.length > 0) && (
                    <Button onClick={clearFilters} variant="tertiary">
                      Clear Filters
                    </Button>
                  )}
                </InlineStack>

                {navigation.state === "loading" ? (
                  <BlockStack align="center" gap="400">
                    <Spinner size="large" />
                    <Text variant="bodyMd" tone="subdued">Loading census records...</Text>
                  </BlockStack>
                ) : censusRecords.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
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
                      {selectedLocationOptions.length > 0 || selectedMonthOptions.length > 0
                        ? "No records found for selected filters"
                        : "No census records found"}
                    </Text>
                    <Text alignment="center" tone="subdued">
                      {selectedLocationOptions.length > 0 || selectedMonthOptions.length > 0
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
              <Autocomplete
                allowMultiple={false}
                options={modalLocationOptions}
                selected={formData.locationId ? [formData.locationId] : []}
                onSelect={updateModalLocationSelection}
                textField={
                  <Autocomplete.TextField
                    onChange={updateModalLocationText}
                    label="Location"
                    value={modalLocationInputValue}
                    prefix={<Icon source={SearchIcon} tone="base" />}
                    placeholder="Search and select location..."
                    autoComplete="off"
                    disabled={!!editingRecord}
                  />
                }
              />

              <Autocomplete
                allowMultiple={false}
                options={modalMonthOptions}
                selected={formData.censusMonth ? [formData.censusMonth] : []}
                onSelect={updateModalMonthSelection}
                textField={
                  <Autocomplete.TextField
                    onChange={updateModalMonthText}
                    label="Month"
                    value={modalMonthInputValue}
                    prefix={<Icon source={SearchIcon} tone="base" />}
                    placeholder="Search and select month..."
                    autoComplete="off"
                    disabled={!!editingRecord}
                  />
                }
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