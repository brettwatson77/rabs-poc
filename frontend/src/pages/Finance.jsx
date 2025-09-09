import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../api/api';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO } from 'date-fns';
import { FiDollarSign, FiFileText, FiBarChart2, FiPieChart, FiClipboard, FiPlusCircle, FiUpload, FiCheckCircle, FiX, FiPlus, FiCheck } from 'react-icons/fi';
import * as XLSX from 'xlsx';

import BillingTab from './finance/tabs/BillingTab';
import RatesTab from './finance/tabs/RatesTab';
import ReportsTab from './finance/tabs/ReportsTab';
import InvoicesTab from './finance/tabs/InvoicesTab';
import BillingModal from './finance/modals/BillingModal';
import RateModal from './finance/modals/RateModal';
import ExportModal from './finance/modals/ExportModal';

// Page-specific styles
import '../styles/Finance.css';

// Helper function to convert data to CSV format
function toCSV(rows) {
  if (!rows || !rows.length) return '';
  
  // Get all unique keys from all rows
  const keys = Array.from(
    new Set(
      rows.flatMap(row => Object.keys(row))
    )
  );
  
  // Create header row
  const header = keys.join(',');
  
  // Create data rows
  const dataRows = rows.map(row => {
    return keys.map(key => {
      let value = row[key] || '';
      
      // Convert to string and escape if needed
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      
      // Escape quotes and wrap in quotes if contains comma, newline or quote
      value = String(value).replace(/"/g, '""');
      if (value.includes(',') || value.includes('\n') || value.includes('"')) {
        value = `"${value}"`;
      }
      
      return value;
    }).join(',');
  });
  
  return [header, ...dataRows].join('\n');
}

// Helper function to download file
function downloadFile(content, filename, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Helper function to build and download an XLSX file from an array of rows
function downloadXLSXFromRows(rows, filename) {
  const ws = XLSX.utils.json_to_sheet(rows || []);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Helper function to build and download export files
function buildExportFiles(resp, format, type, start, end) {
  if (!resp || !resp.data) return;
  
  const formatDate = (dateStr) => dateStr.replace(/-/g, '');
  const startFormatted = formatDate(start);
  const endFormatted = formatDate(end);
  
  // Handle different export types
  if (type === 'bulk' || type === 'both') {
    const bulkData = resp.data.bulk || [];
    if (bulkData.length > 0) {
      if (format === 'csv') {
        const csvContent = toCSV(bulkData);
        downloadFile(csvContent, `finance-bulk-${startFormatted}-${endFormatted}.csv`, 'text/csv');
      } else if (format === 'json') {
        const jsonContent = JSON.stringify(bulkData, null, 2);
        downloadFile(jsonContent, `finance-bulk-${startFormatted}-${endFormatted}.json`, 'application/json');
      } else if (format === 'xlsx') {
        downloadXLSXFromRows(bulkData, `finance-bulk-${startFormatted}-${endFormatted}.xlsx`);
      }
    }
  }
  
  if (type === 'invoices' || type === 'both') {
    const invoiceData = resp.data.invoices || [];
    if (invoiceData.length > 0) {
      if (format === 'csv') {
        const csvContent = toCSV(invoiceData);
        downloadFile(csvContent, `finance-invoices-${startFormatted}-${endFormatted}.csv`, 'text/csv');
      } else if (format === 'json') {
        const jsonContent = JSON.stringify(invoiceData, null, 2);
        downloadFile(jsonContent, `finance-invoices-${startFormatted}-${endFormatted}.json`, 'application/json');
      } else if (format === 'xlsx') {
        downloadXLSXFromRows(invoiceData, `finance-invoices-${startFormatted}-${endFormatted}.xlsx`);
      }
    }
  }
}

const Finance = () => {
  const queryClient = useQueryClient();
  // For reports and invoices tabs
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [selectedTab, setSelectedTab] = useState('billing');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState({ participant: 'all', program: 'all', status: 'all', dateRange: 'current-month' });
  
  // New date range state for billing
  const [dateRange, setDateRange] = useState({ 
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), 
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd') 
  });
  
  // Management filter for billing
  const [managementFilter, setManagementFilter] = useState('all');

  const [selectedBilling, setSelectedBilling] = useState(null);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  /* ------------------------------------------------------------------
   *  Rate editing state (needed by modal handlers)
   * ----------------------------------------------------------------*/
  const [selectedRate, setSelectedRate] = useState(null);

  // New bulk billing state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    dates: [],
    participant_ids: [],
    program_id: '',
    rate_code: '',
    hours: 1,
    notes: '',
    selected_rate_option_id: '',
    unit_price: 0
  });

  // Updated billing state with new fields for option selection
  const [newBilling, setNewBilling] = useState({
    participant_id: '',
    program_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    hours: 1,
    quantity: 1,
    rate_code: '',
    unit_price: 0,
    notes: '',
    selected_rate_option_id: ''
  });

  // Updated rate state with new schema including single_rate, ratio_1_5, and autoCalc
  const [newRate, setNewRate] = useState({ 
    code: '', 
    description: '', 
    active: true, 
    base_rate: 0, 
    ratio_1_1: 0, 
    ratio_1_2: 0, 
    ratio_1_3: 0, 
    ratio_1_4: 0,
    ratio_1_5: 0,
    single_rate: false,
    autoCalc: true
  });

  /* ------------------------------------------------------------------
   *  Dirty-tracking / pristine copy / validation state
   * ----------------------------------------------------------------*/
  const [pristineRate, setPristineRate] = useState(null);
  const [rateErrors, setRateErrors] = useState({});
  const [rateFocusField, setRateFocusField] = useState(null);

  const computeDirty = (draft, pristine) => {
    if (!pristine) return true;
    return ['code','description','active','base_rate',
            'ratio_1_1','ratio_1_2','ratio_1_3','ratio_1_4',
            'ratio_1_5','single_rate']
      .some(k => String(draft[k] ?? '') !== String(pristine[k] ?? ''));
  };

  const isRateDirty = computeDirty(newRate, pristineRate);

  const validateRate = (draft) => {
    const errs = {};
    if (!draft.code.trim())         errs.code        = 'Required';
    if (!draft.description.trim())  errs.description = 'Required';
    const curFields = ['base_rate','ratio_1_1','ratio_1_2','ratio_1_3','ratio_1_4','ratio_1_5'];
    curFields.forEach(f => {
      let v = (draft[f] ?? '').toString().replace(/[$,]/g,'');
      if (v === '') v = '0';
      if (isNaN(parseFloat(v)) || parseFloat(v) < 0) errs[f] = '>= 0';
    });
    return errs;
  };

  /* ------------------------------------------------------------------
   *  Currency blur mask
   * ----------------------------------------------------------------*/
  const onRateFieldBlur = (name, value) => {
    if (['base_rate','ratio_1_1','ratio_1_2','ratio_1_3','ratio_1_4','ratio_1_5'].includes(name)) {
      const cleaned = value.toString().replace(/[$,]/g,'');
      const num = cleaned === '' ? '' : parseFloat(cleaned).toFixed(2);
      setNewRate(r => ({ ...r, [name]: isNaN(num) ? '' : num }));
    }
  };

  // Import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importDryRun, setImportDryRun] = useState(true);
  const [importResult, setImportResult] = useState(null);

  const [exportOptions, setExportOptions] = useState({
    format: 'csv',
    start_date: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end_date: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    participant_ids: [],
    include_details: true
  });

  // Keep these for reports/invoices tabs
  const formattedMonthStart = format(selectedMonth, 'yyyy-MM-dd');
  const formattedMonthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

  // Updated billing query to use dateRange
  const { data: billingData, isLoading: billingLoading, refetch: refetchBilling } = useQuery(
    ['billingData', dateRange.start, dateRange.end, filterOptions, managementFilter],
    async () => {
      const params = { 
        start_date: dateRange.start, 
        end_date: dateRange.end 
      };
      
      if (filterOptions.participant !== 'all') params.participant_id = filterOptions.participant;
      if (filterOptions.program !== 'all') params.program_id = filterOptions.program;
      if (filterOptions.status !== 'all') params.status = filterOptions.status;
      if (managementFilter !== 'all') params.management = managementFilter;
      
      const response = await api.get('/finance/billing', { params });
      return response.data;
    }
  );

  // Updated rates query to use api client and search params
  const { data: ratesData, isLoading: ratesLoading, refetch: refetchRates } = useQuery(
    ['billingRates', searchQuery],
    async () => {
      const response = await api.get('/finance/rates', { 
        params: { code: searchQuery || undefined }
      });
      return response.data;
    }
  );
  
  // New query for billing codes
  const { data: codesData } = useQuery(
    ['billingCodes'], 
    async () => (await api.get('/finance/billing-codes')).data
  );

  const { data: participantsData } = useQuery(
    ['participantsList'],
    async () => (await api.get('/participants')).data
  );

  const { data: programsData } = useQuery(
    ['programsList'],
    async () => (await api.get('/programs')).data
  );

  const { data: reportData, isLoading: reportLoading, error: reportError, refetch: refetchReport } = useQuery(
    ['financialReport', formattedMonthStart, formattedMonthEnd],
    async () => (await api.get('/finance/reports', { params: { report_type: 'participant_summary', start_date: formattedMonthStart, end_date: formattedMonthEnd } })).data
  );

  // Updated billing mutation to use new payload structure
  const createBillingMutation = useMutation(
    async (billing) => (await api.post('/finance/billing', billing)).data,
    { onSuccess: () => { queryClient.invalidateQueries(['billingData']); setIsBillingModalOpen(false); resetNewBilling(); } }
  );

  // New bulk billing mutation
  const bulkCreateBilling = useMutation(
    async (payload) => (await api.post('/finance/billing/bulk', payload)).data,
    { onSuccess: () => { 
        queryClient.invalidateQueries(['billingData']); 
        setIsBulkModalOpen(false); 
        resetBulkForm();
        toast.success('Bulk billing entries created successfully');
      } 
    }
  );

  const updateBillingMutation = useMutation(
    async ({ billingId, billing }) => (await api.put(`/finance/billing/${billingId}`, billing)).data,
    { onSuccess: () => { queryClient.invalidateQueries(['billingData']); setIsBillingModalOpen(false); } }
  );

  const deleteBillingMutation = useMutation(
    async (billingId) => (await api.delete(`/finance/billing/${billingId}`)).data,
    { onSuccess: () => queryClient.invalidateQueries(['billingData']) }
  );

  // Updated rate mutations to use api client
  const createRateMutation = useMutation(
    async (rate) => (await api.post('/finance/rates', rate)).data,
    { 
      onSuccess: () => { 
        queryClient.invalidateQueries(['billingRates']); 
        setIsRateModalOpen(false); 
        toast.success('Rate created successfully');
      } 
    }
  );

  const updateRateMutation = useMutation(
    async ({ rateId, rate }) => (await api.patch(`/finance/rates/${rateId}`, rate)).data,
    { 
      onSuccess: (data, variables) => { 
        // Update the cache directly to avoid a full refetch
        queryClient.setQueryData(['billingRates', searchQuery], (oldData) => {
          if (!oldData) return oldData;
          
          // Ensure data is an array and filter out null values
          const safeData = Array.isArray(oldData?.data) 
            ? oldData.data.filter(Boolean) 
            : [];
          
          // Find and update the specific rate
          const updatedData = {
            ...oldData,
            data: safeData.map(r => {
              if (!r) return r; // Skip null items
              if (r.id === variables.rateId) {
                // Start with existing ratios and only update those that changed
                const existingRatioMap = {};
                if (r.ratios && Array.isArray(r.ratios) && r.ratios.length) {
                  r.ratios.forEach(ratio => {
                    if (ratio && ratio.ratio) {
                      existingRatioMap[ratio.ratio] = ratio.rate;
                    }
                  });
                }
                
                // Update ratios based on changed fields
                const ratioFields = [
                  { field: 'ratio_1_1', label: '1:1' },
                  { field: 'ratio_1_2', label: '1:2' },
                  { field: 'ratio_1_3', label: '1:3' },
                  { field: 'ratio_1_4', label: '1:4' },
                  { field: 'ratio_1_5', label: '1:5' }
                ];
                
                ratioFields.forEach(({ field, label }) => {
                  if (variables.rate[field] !== undefined) {
                    const value = parseFloat(variables.rate[field]);
                    if (!isNaN(value) && value > 0) {
                      existingRatioMap[label] = value;
                    } else {
                      delete existingRatioMap[label]; // Remove ratio if set to 0
                    }
                  }
                });
                
                // Convert back to array format
                const updatedRatios = Object.entries(existingRatioMap).map(
                  ([ratio, rate]) => ({ ratio, rate })
                );
                
                return {
                  ...r,
                  description: variables.rate.description !== undefined ? variables.rate.description : r.description,
                  active: variables.rate.active !== undefined ? variables.rate.active : r.active,
                  base_rate: variables.rate.base_rate !== undefined ? variables.rate.base_rate : r.base_rate,
                  single_rate: variables.rate.single_rate !== undefined ? variables.rate.single_rate : r.single_rate,
                  updated_at: new Date().toISOString(),
                  ratios: updatedRatios
                };
              }
              return r;
            })
          };
          
          return updatedData;
        });
        
        setIsRateModalOpen(false);
        toast.success('Rate updated successfully');
      } 
    }
  );

  // Add delete mutation for rates
  const deleteRateMutation = useMutation(
    async (id) => (await api.delete(`/finance/rates/${id}`)).data,
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['billingRates']);
        toast.success('Rate deleted successfully');
      },
      onError: (error) => {
        console.error('Error deleting rate:', error);
        toast.error('Failed to delete rate');
      }
    }
  );

  // Import mutations
  const importDryRunMutation = useMutation(
    async (csvText) => (await api.post('/finance/rates/import?dryRun=true', { csvText })).data,
    { 
      onSuccess: (data) => { 
        setImportResult(data);
      } 
    }
  );

  const importCommitMutation = useMutation(
    async (csvText) => (await api.post('/finance/rates/import?dryRun=false', { csvText })).data,
    { 
      onSuccess: (data) => { 
        setImportResult(data);
        queryClient.invalidateQueries(['billingRates']);
        if (!data.dryRun) {
          setImportCsvText('');
          setIsImportOpen(false);
          toast.success('Rates imported successfully');
        }
      } 
    }
  );

  // Updated export mutation with file download handling
  const exportBillingMutation = useMutation(
    async (payload) => (await api.post('/finance/export', payload)).data,
    { 
      onSuccess: (response) => {
        setIsExportModalOpen(false);
        
        // Build and download export files
        buildExportFiles(
          response, 
          exportOptions.format, 
          exportOptions.type || 'both', 
          exportOptions.start_date, 
          exportOptions.end_date
        );
        
        toast.success('Export completed successfully');
      },
      onError: (error) => {
        console.error('Export error:', error);
        
        // Handle 404 specifically
        if (error.response && error.response.status === 404) {
          toast.info(error.response.data?.message || 'No data found for the specified criteria');
        } else {
          toast.error('Failed to export data: ' + (error.response?.data?.message || error.message));
        }
      }
    }
  );

  // Reset billing form with new schema including selected_rate_option_id
  const resetNewBilling = () => setNewBilling({ 
    participant_id: '', 
    program_id: '', 
    date: format(new Date(), 'yyyy-MM-dd'), 
    hours: 1, 
    quantity: 1, 
    rate_code: '', 
    unit_price: 0, 
    notes: '',
    selected_rate_option_id: ''
  });

  // Reset bulk form with new fields
  const resetBulkForm = () => setBulkForm({
    dates: [],
    participant_ids: [],
    program_id: '',
    rate_code: '',
    hours: 1,
    notes: '',
    selected_rate_option_id: '',
    unit_price: 0
  });

  // Updated calculation function
  const calculateBillingAmount = (rate, hours, quantity) => (rate * hours * quantity);

  // Keep these for reports/invoices tabs
  const onPrevMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
  const onNextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));
  const onCurrentMonth = () => setSelectedMonth(startOfMonth(new Date()));

  const handleBillingSelect = (billing) => {
    setSelectedBilling(billing);
    setNewBilling({ 
      participant_id: billing.participant_id, 
      program_id: billing.program_id, 
      date: billing.date, 
      hours: billing.hours, 
      quantity: billing.quantity || 1,
      rate_code: billing.rate_code, 
      unit_price: billing.unit_price || 0,
      notes: billing.notes || '',
      selected_rate_option_id: '' // Will be set when user selects a rate option
    });
    setIsBillingModalOpen(true);
  };

  const handleBillingSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    
    // Use unit_price directly from state instead of searching by code
    const unitPrice = parseFloat(newBilling.unit_price) || 0;
    
    // Parse numeric values
    const hours = parseFloat(newBilling.hours) || 0;
    const quantity = parseFloat(newBilling.quantity) || 1;
    
    const payload = {
      participant_id: newBilling.participant_id,
      program_id: newBilling.program_id,
      date: newBilling.date,
      hours: hours,
      quantity: quantity,
      rate_code: newBilling.rate_code,
      unit_price: unitPrice,
      notes: newBilling.notes
    };
    
    if (selectedBilling) {
      updateBillingMutation.mutate({ billingId: selectedBilling.id, billing: payload });
    } else {
      createBillingMutation.mutate(payload);
    }
  };

  // Handler for bulk billing submit - updated to use unit_price from state
  const handleBulkSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    
    // Validate required fields
    if (!bulkForm.participant_ids.length) {
      toast.error('Please select at least one participant');
      return;
    }
    
    if (!bulkForm.rate_code) {
      toast.error('Please select a rate code');
      return;
    }
    
    if (bulkForm.dates.length === 0) {
      toast.error('Please add at least one date');
      return;
    }
    
    // Use unit_price directly from state
    const unitPrice = parseFloat(bulkForm.unit_price) || 0;
    
    // Build payload
    const payload = {
      dates: bulkForm.dates,
      participant_ids: bulkForm.participant_ids,
      program_id: bulkForm.program_id || null,
      rate_code: bulkForm.rate_code,
      unit_price: unitPrice,
      hours: parseFloat(bulkForm.hours) || 0,
      notes: bulkForm.notes || ''
    };
    
    // Submit to API
    bulkCreateBilling.mutate(payload);
  };

  // Handler for adding a date to bulk form
  const handleAddDate = () => {
    const dateInput = document.getElementById('bulk-date-input');
    if (dateInput && dateInput.value) {
      const newDate = dateInput.value;
      if (!bulkForm.dates.includes(newDate)) {
        setBulkForm(prev => ({
          ...prev,
          dates: [...prev.dates, newDate].sort()
        }));
        dateInput.value = '';
      }
    }
  };

  // Handler for removing a date from bulk form
  const handleRemoveDate = (date) => {
    setBulkForm(prev => ({
      ...prev,
      dates: prev.dates.filter(d => d !== date)
    }));
  };

  // Handler for selecting all participants
  const handleSelectAllParticipants = () => {
    if (!participantsData?.data) return;
    
    const allIds = participantsData.data.map(p => p.id);
    
    // If all are already selected, deselect all
    if (allIds.length === bulkForm.participant_ids.length) {
      setBulkForm(prev => ({ ...prev, participant_ids: [] }));
    } else {
      setBulkForm(prev => ({ ...prev, participant_ids: allIds }));
    }
  };

  // Handler for deleting a rate
  const handleDeleteRate = (rate) => {
    if (rate?.id && window.confirm(`Delete rate "${rate.code}"? This cannot be undone.`)) {
      deleteRateMutation.mutate(rate.id);
    }
  };

  // Handler for adding a new rate
  const handleAddRate = () => {
    setSelectedRate(null);
    setPristineRate(null);
    setRateErrors({});
    setRateFocusField('code');
    setNewRate({ 
      code: '', 
      description: '', 
      active: true, 
      base_rate: 0, 
      ratio_1_1: 0, 
      ratio_1_2: 0, 
      ratio_1_3: 0, 
      ratio_1_4: 0,
      ratio_1_5: 0,
      single_rate: false,
      autoCalc: true
    });
    setIsRateModalOpen(true);
  };

  // Handler for editing a rate - fetch by ID and prefill - updated to include single_rate and ratio_1_5
  const handleRateSelect = async (rate) => { 
    try {
      setRateErrors({});
      setRateFocusField(null);
      
      // Fetch the full rate details
      const response = await api.get(`/finance/rates/${rate.id}`);
      if (response.data.success && response.data.data) {
        const rateData = response.data.data;
        
        // Map the ratios array to individual ratio fields
        const ratioValues = {
          ratio_1_1: 0,
          ratio_1_2: 0,
          ratio_1_3: 0,
          ratio_1_4: 0,
          ratio_1_5: 0
        };
        
        if (rateData.ratios && rateData.ratios.length) {
          rateData.ratios.forEach(ratio => {
            const field = `ratio_${ratio.ratio.replace(':', '_')}`;
            ratioValues[field] = (ratio.rate_cents / 100).toFixed(2);
          });
        }
        
        const formattedRate = {
          code: rateData.code,
          description: rateData.description,
          active: rateData.active,
          base_rate: parseFloat(rateData.base_rate).toFixed(2),
          single_rate: !!rateData.single_rate,
          autoCalc: true, // Default to true when editing
          ...ratioValues
        };
        
        // Set both current and pristine state
        setSelectedRate(rateData);
        setNewRate(formattedRate);
        setPristineRate({...formattedRate});
        setIsRateModalOpen(true);
      } else {
        throw new Error('Failed to fetch rate details');
      }
    } catch (err) {
      console.error('Error fetching rate details:', err);
      toast.error('Failed to load rate details');
    }
  };

  // Handler for canceling rate edit
  const handleRateCancel = () => {
    if (isRateDirty) {
      if (window.confirm('Discard unsaved changes?')) {
        setIsRateModalOpen(false);
        setRateErrors({});
      }
    } else {
      setIsRateModalOpen(false);
    }
  };

  // Handler for ESC key in rate modal
  const handleRateKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleRateCancel();
    }
  };

  // Handler for submitting a rate - updated to include single_rate and ratio_1_5
  const handleRateSubmit = (e) => { 
    if (e && e.preventDefault) e.preventDefault(); 
    
    // Validate the form
    const errors = validateRate(newRate);
    if (Object.keys(errors).length > 0) {
      setRateErrors(errors);
      // Focus the first field with an error
      const firstErrorField = Object.keys(errors)[0];
      setRateFocusField(firstErrorField);
      return;
    }
    
    // Check if form is dirty (has changes)
    if (!isRateDirty) {
      setIsRateModalOpen(false);
      toast.info('No changes to save');
      return;
    }
    
    // Branch based on whether we're creating or editing
    if (selectedRate) {
      // EDIT MODE - Log diagnostic info
      console.log('rate-submit edit', { draft: newRate, pristine: pristineRate });
      
      // Build a payload with only the changed fields
      const changedFields = {};
      const allowedFields = ['description', 'active', 'base_rate', 
                           'ratio_1_1', 'ratio_1_2', 'ratio_1_3', 'ratio_1_4', 'ratio_1_5',
                           'single_rate'];
      
      allowedFields.forEach(field => {
        if (String(newRate[field]) !== String(pristineRate[field])) {
          // Parse numeric fields
          if (['base_rate', 'ratio_1_1', 'ratio_1_2', 'ratio_1_3', 'ratio_1_4', 'ratio_1_5'].includes(field)) {
            let value = newRate[field].toString().replace(/[$,]/g, '');
            changedFields[field] = parseFloat(value) || 0;
          } else {
            changedFields[field] = newRate[field];
          }
        }
      });
      
      // Diagnostic log: changed fields and selected rate ID
      console.log('Rate Update - Changed Fields:', changedFields, 'Rate ID:', selectedRate.id);
      
      // If no fields changed, just close
      if (Object.keys(changedFields).length === 0) {
        setIsRateModalOpen(false);
        toast.info('No changes to save');
        return;
      }
      
      // Send PATCH with only changed fields
      updateRateMutation.mutate({ rateId: selectedRate.id, rate: changedFields });
    } else {
      // CREATE MODE - Log diagnostic info
      console.log('rate-submit create', { draft: newRate });
      
      // For new rates, we need all fields with numeric parsing
      const baseRate = parseFloat(newRate.base_rate.toString().replace(/[$,]/g, '')) || 0;
      
      const payload = {
        code: newRate.code.trim(),
        description: newRate.description.trim(),
        active: newRate.active,
        base_rate: baseRate,
        single_rate: newRate.single_rate,
        // Set ratio_1_1 equal to base_rate
        ratio_1_1: baseRate,
        ratio_1_2: parseFloat(newRate.ratio_1_2.toString().replace(/[$,]/g, '')) || 0,
        ratio_1_3: parseFloat(newRate.ratio_1_3.toString().replace(/[$,]/g, '')) || 0,
        ratio_1_4: parseFloat(newRate.ratio_1_4.toString().replace(/[$,]/g, '')) || 0,
        ratio_1_5: parseFloat(newRate.ratio_1_5.toString().replace(/[$,]/g, '')) || 0
      };
      
      // Send POST with complete payload
      createRateMutation.mutate(payload);
    }
  };

  // Handler for opening the import panel
  const handleOpenImport = () => {
    setIsImportOpen(true);
    setImportResult(null);
    setImportCsvText('');
    setImportDryRun(true);
  };

  // Handler for running a dry run import
  const handleImportDryRun = () => {
    if (!importCsvText.trim()) return;
    importDryRunMutation.mutate(importCsvText);
  };

  // Handler for committing an import
  const handleImportCommit = () => {
    if (!importCsvText.trim()) return;
    importCommitMutation.mutate(importCsvText);
  };

  // Updated export handler with error handling
  const handleExportSubmit = (e) => { 
    if (e && e.preventDefault) e.preventDefault(); 
    
    // Validate required fields
    if (!exportOptions.start_date || !exportOptions.end_date) {
      toast.error('Start and end dates are required');
      return;
    }
    
    exportBillingMutation.mutate(exportOptions); 
  };

  return (
    <div className="finance-container">
      <div className="page-header">
        <h2 className="page-title">Finance</h2>
        <div className="page-actions">
          <span className="date-display">{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
        </div>
      </div>

      {/* Unified global tab bar */}
      <div className="page-tabs">
        <button className={`tab-button ${selectedTab === 'billing' ? 'active' : ''}`} onClick={() => setSelectedTab('billing')}>
          <FiDollarSign /> Billing
        </button>
        <button className={`tab-button ${selectedTab === 'rates' ? 'active' : ''}`} onClick={() => setSelectedTab('rates')}>
          <FiPieChart /> NDIS Rates
        </button>
        <button className={`tab-button ${selectedTab === 'reports' ? 'active' : ''}`} onClick={() => setSelectedTab('reports')}>
          <FiBarChart2 /> Reports
        </button>
        <button className={`tab-button ${selectedTab === 'invoices' ? 'active' : ''}`} onClick={() => setSelectedTab('invoices')}>
          <FiFileText /> Invoices
        </button>
      </div>

      <div className="finance-content">
        {selectedTab === 'billing' && (
          <BillingTab
            billingData={billingData}
            billingLoading={billingLoading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            participantsData={participantsData}
            programsData={programsData}
            filterOptions={filterOptions}
            setFilterOptions={setFilterOptions}
            dateRange={dateRange}
            setDateRange={setDateRange}
            managementFilter={managementFilter}
            setManagementFilter={setManagementFilter}
            onRefetch={refetchBilling}
            onOpenNewBilling={() => { setSelectedBilling(null); resetNewBilling(); setIsBillingModalOpen(true); }}
            onOpenBulkNew={() => { resetBulkForm(); setIsBulkModalOpen(true); }}
            onOpenExport={() => setIsExportModalOpen(true)}
            onEditBilling={handleBillingSelect}
            onDeleteBilling={(b) => { if (confirm('Delete this billing entry?')) deleteBillingMutation.mutate(b.id); }}
          />
        )}

        {selectedTab === 'rates' && (
          <>
            <RatesTab
              ratesData={ratesData}
              ratesLoading={ratesLoading}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onRefetch={refetchRates}
              onEditRate={handleRateSelect}
              onAddRate={handleAddRate}
              onOpenImport={handleOpenImport}
              onDeleteRate={handleDeleteRate}
            />
            
            {/* Import Panel */}
            {isImportOpen && (
              <div className="import-panel glass-card mt-4">
                <h3><FiUpload /> Import NDIS Rates</h3>
                <div className="form-group">
                  <label>CSV Content</label>
                  <textarea
                    className="form-control"
                    rows="6"
                    value={importCsvText}
                    onChange={(e) => setImportCsvText(e.target.value)}
                    placeholder="Paste CSV content here..."
                  />
                </div>
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={importDryRun}
                      onChange={(e) => setImportDryRun(e.target.checked)}
                    />{' '}
                    Dry Run (preview only)
                  </label>
                </div>
                
                {/* Import Preview */}
                {importResult && (
                  <div className="import-preview">
                    <h4>Import Preview</h4>
                    {importResult.dryRun ? (
                      <div className="preview-summary">
                        <p>
                          <strong>Detected Headers:</strong> {importResult.detectedHeaders?.join(', ')}
                        </p>
                        <p>
                          <strong>Summary:</strong> {importResult.rows?.length || 0} rows processed
                          {importResult.summary && (
                            <>
                              <br />
                              <strong>Create:</strong> {importResult.summary.create || 0},
                              <strong> Update:</strong> {importResult.summary.update || 0},
                              <strong> Skip:</strong> {importResult.summary.skip || 0}
                            </>
                          )}
                        </p>
                      </div>
                    ) : (
                      <div className="preview-summary">
                        <p className="success-message">
                          <FiCheckCircle /> Import completed successfully!
                        </p>
                        <p>
                          <strong>Summary:</strong>
                          <br />
                          <strong>Created:</strong> {importResult.summary?.create || 0},
                          <strong> Updated:</strong> {importResult.summary?.update || 0},
                          <strong> Skipped:</strong> {importResult.summary?.skip || 0}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="form-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setIsImportOpen(false)}
                  >
                    Close
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleImportDryRun}
                    disabled={!importCsvText.trim() || importDryRunMutation.isLoading}
                  >
                    {importDryRunMutation.isLoading ? 'Processing...' : 'Dry Run'}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleImportCommit}
                    disabled={!importCsvText.trim() || importCommitMutation.isLoading}
                  >
                    {importCommitMutation.isLoading ? 'Committing...' : 'Commit Import'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {selectedTab === 'reports' && (
          <ReportsTab
            selectedReport={'participant_summary'}
            setSelectedReport={() => {}}
            selectedMonth={selectedMonth}
            reportData={reportData}
            reportLoading={reportLoading}
            reportError={reportError}
            onPrevMonth={onPrevMonth}
            onCurrentMonth={onCurrentMonth}
            onNextMonth={onNextMonth}
            onRefetch={refetchReport}
          />
        )}

        {selectedTab === 'invoices' && (
          <InvoicesTab
            selectedMonth={selectedMonth}
            onPrevMonth={onPrevMonth}
            onCurrentMonth={onCurrentMonth}
            onNextMonth={onNextMonth}
          />
        )}
      </div>

      <div className="finance-actions">
        <button className="glass-card action-card" onClick={() => setIsExportModalOpen(true)}>
          <FiPlusCircle className="action-icon" />
          <span>Export Data</span>
        </button>
        <button className="glass-card action-card" onClick={() => { setSelectedTab('reports'); }}>
          <FiPieChart className="action-icon" />
          <span>Monthly Report</span>
        </button>
        <button className="glass-card action-card" onClick={() => { setSelectedBilling(null); resetNewBilling(); setIsBillingModalOpen(true); }}>
          <FiPlusCircle className="action-icon" />
          <span>New Billing</span>
        </button>
        <button className="glass-card action-card">
          <FiClipboard className="action-icon" />
          <span>NDIS Portal</span>
        </button>
      </div>

      {/* Bulk Billing Modal */}
      {isBulkModalOpen && (
        <div className="modal-overlay" onClick={() => setIsBulkModalOpen(false)}>
          <div className="modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Bulk New Billing Entries</h3>
              <button className="modal-close" onClick={() => setIsBulkModalOpen(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleBulkSubmit} className="modal-body">
              <div className="form-grid">
                {/* Dates Selection */}
                <div className="form-section">
                  <h4>Dates</h4>
                  <div className="date-input-group">
                    <input
                      id="bulk-date-input"
                      type="date"
                      className="date-input"
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAddDate}
                    >
                      <FiPlus /> Add Date
                    </button>
                  </div>
                  
                  {/* Selected Dates */}
                  <div className="selected-dates">
                    {bulkForm.dates.length === 0 ? (
                      <div className="no-dates">No dates selected</div>
                    ) : (
                      <div className="date-chips">
                        {bulkForm.dates.map(date => (
                          <div key={date} className="date-chip">
                            {format(parseISO(date), 'MMM d, yyyy')}
                            <button
                              type="button"
                              className="remove-date"
                              onClick={() => handleRemoveDate(date)}
                            >
                              <FiX />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Participants Selection */}
                <div className="form-section">
                  <h4>Participants</h4>
                  <div className="select-all-row">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleSelectAllParticipants}
                    >
                      {participantsData?.data?.length === bulkForm.participant_ids.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                    <span className="selected-count">
                      {bulkForm.participant_ids.length} selected
                    </span>
                  </div>
                  
                  {/* Multi-select list replaces individual checkboxes */}
                  <select
                    multiple
                    size="8"
                    value={bulkForm.participant_ids.map(String)}
                    onChange={(e) => {
                      const selectedIds = Array.from(e.target.selectedOptions).map(
                        (opt) => opt.value
                      );
                      setBulkForm((prev) => ({ ...prev, participant_ids: selectedIds }));
                    }}
                    className="multi-select"
                    style={{ width: '100%', minHeight: '160px' }}
                  >
                    {participantsData?.data?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Program Selection */}
                <div className="form-group">
                  <label>Program (Optional)</label>
                  <select
                    value={bulkForm.program_id}
                    onChange={(e) => setBulkForm({...bulkForm, program_id: e.target.value})}
                  >
                    <option value="">Select program</option>
                    {programsData?.data?.map((pr) => (
                      <option key={pr.id} value={pr.id}>{pr.title || pr.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Rate Code - Updated to use option_id */}
                <div className="form-group">
                  <label>Rate Code</label>
                  <select
                    value={bulkForm.selected_rate_option_id || ''}
                    onChange={(e) => {
                      const optionId = e.target.value;
                      const selectedCode = codesData?.data?.find(c => 
                        (c.option_id || `${c.id}-${c.ratio}`) === optionId
                      );
                      
                      if (selectedCode) {
                        setBulkForm({
                          ...bulkForm, 
                          selected_rate_option_id: optionId,
                          rate_code: selectedCode.code,
                          unit_price: selectedCode.rate_cents / 100
                        });
                      } else {
                        setBulkForm({
                          ...bulkForm, 
                          selected_rate_option_id: '',
                          rate_code: '',
                          unit_price: 0
                        });
                      }
                    }}
                    required
                  >
                    <option value="">Select rate</option>
                    {codesData?.data?.map((c) => (
                      <option 
                        key={c.option_id || `${c.id}-${c.ratio}`} 
                        value={c.option_id || `${c.id}-${c.ratio}`}
                      >
                        {`${c.code} — ${c.label.split(' — ')[1]} ($${(c.rate_cents/100).toFixed(2)})`}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Hours */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Hours</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={bulkForm.hours}
                      onChange={(e) => setBulkForm({...bulkForm, hours: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                {/* Notes */}
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={bulkForm.notes}
                    onChange={(e) => setBulkForm({...bulkForm, notes: e.target.value})}
                    rows="3"
                  />
                </div>
                
                {/* Management Summary */}
                {bulkForm.participant_ids.length > 0 && participantsData?.data && (
                  <div className="management-summary">
                    <h4>Management Summary</h4>
                    <div className="summary-text">
                      {(() => {
                        const managementCounts = {};
                        bulkForm.participant_ids.forEach(pid => {
                          const participant = participantsData.data.find(p => p.id === pid);
                          if (participant) {
                            const mgmt = participant.plan_management_type || 'unknown';
                            managementCounts[mgmt] = (managementCounts[mgmt] || 0) + 1;
                          }
                        });
                        
                        const managementLabels = {
                          'agency_managed': 'Agency',
                          'plan_managed': 'Plan',
                          'self_managed': 'Self',
                          'self_funded': 'Self Funded',
                          'unknown': 'Unknown'
                        };
                        
                        return Object.entries(managementCounts).map(([type, count]) => (
                          <span key={type} className="management-chip">
                            {count} {managementLabels[type]}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsBulkModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={bulkCreateBilling.isLoading}
                >
                  {bulkCreateBilling.isLoading ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <FiCheck /> Create Entries
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BillingModal
        isOpen={isBillingModalOpen}
        onClose={() => setIsBillingModalOpen(false)}
        participantsData={participantsData}
        programsData={programsData}
        codesData={codesData}
        selectedBilling={selectedBilling}
        newBilling={newBilling}
        setNewBilling={setNewBilling}
        onSubmit={handleBillingSubmit}
        onDelete={() => { if (selectedBilling && confirm('Delete this billing entry?')) { deleteBillingMutation.mutate(selectedBilling.id); setIsBillingModalOpen(false); } }}
        calculateBillingAmount={calculateBillingAmount}
      />

      <RateModal
        isOpen={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        onCancel={handleRateCancel}
        newRate={newRate}
        setNewRate={setNewRate}
        onSubmit={handleRateSubmit}
        isSaving={createRateMutation.isLoading || updateRateMutation.isLoading}
        errors={rateErrors}
        isDirty={isRateDirty}
        onKeyDown={handleRateKeyDown}
        onFieldBlur={onRateFieldBlur}
        focusField={rateFocusField}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        exportOptions={exportOptions}
        setExportOptions={setExportOptions}
        onSubmit={handleExportSubmit}
        isExporting={exportBillingMutation.isLoading}
      />
    </div>
  );
};

export default Finance;
