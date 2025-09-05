import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { toast } from 'react-toastify';
import api from '../api/api';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { FiDollarSign, FiFileText, FiRefreshCw, FiBarChart2, FiPieChart, FiClipboard, FiPlusCircle, FiUpload, FiCheckCircle } from 'react-icons/fi';

import BillingTab from './finance/tabs/BillingTab';
import RatesTab from './finance/tabs/RatesTab';
import ReportsTab from './finance/tabs/ReportsTab';
import InvoicesTab from './finance/tabs/InvoicesTab';
import BillingModal from './finance/modals/BillingModal';
import RateModal from './finance/modals/RateModal';
import ExportModal from './finance/modals/ExportModal';

// Page-specific styles
import '../styles/Finance.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

const Finance = () => {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [selectedTab, setSelectedTab] = useState('billing');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState({ participant: 'all', program: 'all', status: 'all', dateRange: 'current-month' });

  const [selectedBilling, setSelectedBilling] = useState(null);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [newBilling, setNewBilling] = useState({
    participant_id: '',
    program_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    hours: 1,
    rate_code: '',
    support_ratio: 1,
    weekend_multiplier: 1,
    notes: ''
  });

  // Updated rate state with new schema
  const [selectedRate, setSelectedRate] = useState(null);
  const [newRate, setNewRate] = useState({ 
    code: '', 
    description: '', 
    active: true, 
    base_rate: 0, 
    ratio_1_1: 0, 
    ratio_1_2: 0, 
    ratio_1_3: 0, 
    ratio_1_4: 0 
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
            'ratio_1_1','ratio_1_2','ratio_1_3','ratio_1_4']
      .some(k => String(draft[k] ?? '') !== String(pristine[k] ?? ''));
  };

  const isRateDirty = computeDirty(newRate, pristineRate);

  const validateRate = (draft) => {
    const errs = {};
    if (!draft.code.trim())         errs.code        = 'Required';
    if (!draft.description.trim())  errs.description = 'Required';
    const curFields = ['base_rate','ratio_1_1','ratio_1_2','ratio_1_3','ratio_1_4'];
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
    if (['base_rate','ratio_1_1','ratio_1_2','ratio_1_3','ratio_1_4'].includes(name)) {
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

  const formattedMonthStart = format(selectedMonth, 'yyyy-MM-dd');
  const formattedMonthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

  const { data: billingData, isLoading: billingLoading, refetch: refetchBilling } = useQuery(
    ['billingData', formattedMonthStart, formattedMonthEnd, filterOptions],
    async () => {
      const params = { start_date: formattedMonthStart, end_date: formattedMonthEnd };
      if (filterOptions.participant !== 'all') params.participant_id = filterOptions.participant;
      if (filterOptions.program !== 'all') params.program_id = filterOptions.program;
      if (filterOptions.status !== 'all') params.status = filterOptions.status;
      const response = await axios.get(`${API_URL}/api/v1/finance/billing`, { params });
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

  const { data: participantsData } = useQuery(
    ['participantsList'],
    async () => (await axios.get(`${API_URL}/api/v1/participants`)).data
  );

  const { data: programsData } = useQuery(
    ['programsList'],
    async () => (await axios.get(`${API_URL}/api/v1/programs`)).data
  );

  const { data: reportData, isLoading: reportLoading, error: reportError, refetch: refetchReport } = useQuery(
    ['financialReport', formattedMonthStart, formattedMonthEnd],
    async () => (await axios.get(`${API_URL}/api/v1/finance/reports`, { params: { report_type: 'participant_summary', start_date: formattedMonthStart, end_date: formattedMonthEnd } })).data
  );

  const createBillingMutation = useMutation(
    async (billing) => (await axios.post(`${API_URL}/api/v1/finance/billing`, billing)).data,
    { onSuccess: () => { queryClient.invalidateQueries(['billingData']); setIsBillingModalOpen(false); resetNewBilling(); } }
  );

  const updateBillingMutation = useMutation(
    async ({ billingId, billing }) => (await axios.put(`${API_URL}/api/v1/finance/billing/${billingId}`, billing)).data,
    { onSuccess: () => { queryClient.invalidateQueries(['billingData']); setIsBillingModalOpen(false); } }
  );

  const deleteBillingMutation = useMutation(
    async (billingId) => (await axios.delete(`${API_URL}/api/v1/finance/billing/${billingId}`)).data,
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
          
          // Find and update the specific rate
          const updatedData = {
            ...oldData,
            data: oldData.data.map(r => {
              if (r.id === variables.rateId) {
                // Rebuild ratios array from the updated values
                const ratios = [];
                const ratioFields = [
                  { field: 'ratio_1_1', label: '1:1' },
                  { field: 'ratio_1_2', label: '1:2' },
                  { field: 'ratio_1_3', label: '1:3' },
                  { field: 'ratio_1_4', label: '1:4' }
                ];
                
                ratioFields.forEach(({ field, label }) => {
                  const value = variables.rate[field];
                  if (value && parseFloat(value) > 0) {
                    ratios.push({ ratio: label, rate: parseFloat(value) });
                  }
                });
                
                return {
                  ...r,
                  description: variables.rate.description ?? r.description,
                  active: variables.rate.active ?? r.active,
                  base_rate: variables.rate.base_rate ?? r.base_rate,
                  updated_at: new Date().toISOString(),
                  ratios
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

  const exportBillingMutation = useMutation(
    async (payload) => (await axios.post(`${API_URL}/api/v1/finance/export`, payload)).data,
    { onSuccess: () => setIsExportModalOpen(false) }
  );

  const resetNewBilling = () => setNewBilling({ participant_id: '', program_id: '', date: format(new Date(), 'yyyy-MM-dd'), hours: 1, rate_code: '', support_ratio: 1, weekend_multiplier: 1, notes: '' });

  const calculateBillingAmount = (rateAmount, hours, supportRatio, weekendMultiplier) => (rateAmount * supportRatio * weekendMultiplier * hours);

  const onPrevMonth = () => setSelectedMonth(prev => subMonths(prev, 1));
  const onNextMonth = () => setSelectedMonth(prev => addMonths(prev, 1));
  const onCurrentMonth = () => setSelectedMonth(startOfMonth(new Date()));

  const handleBillingSelect = (billing) => {
    setSelectedBilling(billing);
    setNewBilling({ participant_id: billing.participant_id, program_id: billing.program_id, date: billing.date, hours: billing.hours, rate_code: billing.rate_code, support_ratio: billing.support_ratio, weekend_multiplier: billing.weekend_multiplier, notes: billing.notes || '' });
    setIsBillingModalOpen(true);
  };

  const handleBillingSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const selected = ratesData?.data?.find(r => r.code === newBilling.rate_code);
    const rateAmount = selected ? parseFloat(selected.amount) : 0;
    const payload = {
      participant_id: newBilling.participant_id,
      program_id: newBilling.program_id,
      date: newBilling.date,
      hours: parseFloat(newBilling.hours),
      rate_code: newBilling.rate_code,
      rate_amount: rateAmount,
      support_ratio: parseFloat(newBilling.support_ratio),
      weekend_multiplier: parseFloat(newBilling.weekend_multiplier),
      total_amount: calculateBillingAmount(rateAmount, parseFloat(newBilling.hours), parseFloat(newBilling.support_ratio), parseFloat(newBilling.weekend_multiplier)),
      notes: newBilling.notes
    };
    if (selectedBilling) {
      updateBillingMutation.mutate({ billingId: selectedBilling.id, billing: payload });
    } else {
      createBillingMutation.mutate(payload);
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
      ratio_1_4: 0 
    });
    setIsRateModalOpen(true);
  };

  // Handler for editing a rate - fetch by ID and prefill
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
          ratio_1_4: 0
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

  // Handler for submitting a rate
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
    
    // If no changes, just close the modal
    if (!isRateDirty) {
      setIsRateModalOpen(false);
      toast.info('No changes to save');
      return;
    }
    
    // Build a payload with only the changed fields
    const changedFields = {};
    const allowedFields = ['description', 'active', 'base_rate', 'ratio_1_1', 'ratio_1_2', 'ratio_1_3', 'ratio_1_4'];
    
    allowedFields.forEach(field => {
      if (String(newRate[field]) !== String(pristineRate[field])) {
        // Parse numeric fields
        if (['base_rate', 'ratio_1_1', 'ratio_1_2', 'ratio_1_3', 'ratio_1_4'].includes(field)) {
          let value = newRate[field].toString().replace(/[$,]/g, '');
          changedFields[field] = parseFloat(value) || 0;
        } else {
          changedFields[field] = newRate[field];
        }
      }
    });
    
    // If no fields changed, just close
    if (Object.keys(changedFields).length === 0) {
      setIsRateModalOpen(false);
      toast.info('No changes to save');
      return;
    }
    
    if (selectedRate) {
      updateRateMutation.mutate({ rateId: selectedRate.id, rate: changedFields });
    } else {
      // For new rates, we need all fields
      const payload = {
        code: newRate.code.trim(),
        description: newRate.description.trim(),
        active: newRate.active,
        base_rate: parseFloat(newRate.base_rate) || 0,
        ratio_1_1: parseFloat(newRate.ratio_1_1) || 0,
        ratio_1_2: parseFloat(newRate.ratio_1_2) || 0,
        ratio_1_3: parseFloat(newRate.ratio_1_3) || 0,
        ratio_1_4: parseFloat(newRate.ratio_1_4) || 0
      };
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

  const handleExportSubmit = (e) => { 
    if (e && e.preventDefault) e.preventDefault(); 
    exportBillingMutation.mutate(exportOptions); 
  };

  return (
    <div className="finance-container">
      <div className="page-header">
        <h2 className="page-title">Finance</h2>
        <div className="page-actions">
          <button className="nav-button" onClick={() => { refetchBilling(); refetchRates(); refetchReport(); }} title="Refresh All Data">
            <FiRefreshCw />
          </button>
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
            selectedMonth={selectedMonth}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            participantsData={participantsData}
            programsData={programsData}
            filterOptions={filterOptions}
            setFilterOptions={setFilterOptions}
            onPrevMonth={onPrevMonth}
            onCurrentMonth={onCurrentMonth}
            onNextMonth={onNextMonth}
            onRefetch={refetchBilling}
            onOpenNewBilling={() => { setSelectedBilling(null); resetNewBilling(); setIsBillingModalOpen(true); }}
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

      <BillingModal
        isOpen={isBillingModalOpen}
        onClose={() => setIsBillingModalOpen(false)}
        participantsData={participantsData}
        programsData={programsData}
        ratesData={ratesData}
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
        participantsData={participantsData}
        onSubmit={handleExportSubmit}
        isExporting={exportBillingMutation.isLoading}
      />
    </div>
  );
};

export default Finance;
