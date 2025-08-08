import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { FiDollarSign, FiFileText, FiRefreshCw, FiBarChart2, FiPieChart, FiClipboard, FiPlusCircle } from 'react-icons/fi';

import BillingTab from './finance/tabs/BillingTab';
import RatesTab from './finance/tabs/RatesTab';
import ReportsTab from './finance/tabs/ReportsTab';
import InvoicesTab from './finance/tabs/InvoicesTab';
import BillingModal from './finance/modals/BillingModal';
import RateModal from './finance/modals/RateModal';
import ExportModal from './finance/modals/ExportModal';

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

  const [selectedRate, setSelectedRate] = useState(null);
  const [newRate, setNewRate] = useState({ code: '', description: '', amount: 0, support_category: '', is_active: true, effective_date: format(new Date(), 'yyyy-MM-dd') });

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

  const { data: ratesData, isLoading: ratesLoading, refetch: refetchRates } = useQuery(
    ['billingRates'],
    async () => (await axios.get(`${API_URL}/api/v1/finance/rates`)).data
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

  const updateRateMutation = useMutation(
    async ({ rateId, rate }) => (await axios.put(`${API_URL}/api/v1/finance/rates/${rateId}`, rate)).data,
    { onSuccess: () => { queryClient.invalidateQueries(['billingRates']); setIsRateModalOpen(false); } }
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

  const handleRateSelect = (rate) => { setSelectedRate(rate); setNewRate({ code: rate.code, description: rate.description, amount: rate.amount, support_category: rate.support_category, is_active: rate.is_active, effective_date: rate.effective_date }); setIsRateModalOpen(true); };
  const handleRateSubmit = (e) => { if (e && e.preventDefault) e.preventDefault(); if (selectedRate) updateRateMutation.mutate({ rateId: selectedRate.id, rate: { ...newRate, amount: parseFloat(newRate.amount) } }); };
  const handleExportSubmit = (e) => { if (e && e.preventDefault) e.preventDefault(); exportBillingMutation.mutate(exportOptions); };

  return (
    <div className="finance-container">
      <div className="page-header">
        <h2 className="page-title">Finance</h2>
        <div className="page-actions">
          <button className="btn btn-icon" onClick={() => { refetchBilling(); refetchRates(); refetchReport(); }} title="Refresh All Data">
            <FiRefreshCw />
          </button>
          <span className="date-display">{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
        </div>
      </div>

      <div className="finance-tabs glass-card">
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
          <RatesTab
            ratesData={ratesData}
            ratesLoading={ratesLoading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onRefetch={refetchRates}
            onEditRate={handleRateSelect}
          />
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
        newRate={newRate}
        setNewRate={setNewRate}
        onSubmit={handleRateSubmit}
        isSaving={updateRateMutation.isLoading}
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
