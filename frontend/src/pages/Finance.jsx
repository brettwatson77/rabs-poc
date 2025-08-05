import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { 
  FiDollarSign, 
  FiFileText, 
  FiDownload, 
  FiSearch, 
  FiFilter, 
  FiRefreshCw,
  FiPlusCircle,
  FiEdit2,
  FiTrash2,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiChevronLeft,
  FiChevronRight,
  FiCalendar,
  FiUsers,
  FiPieChart,
  FiBarChart2,
  FiSettings,
  FiClipboard,
  FiCreditCard
} from 'react-icons/fi';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// Finance component
const Finance = () => {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(currentDate));
  const [selectedTab, setSelectedTab] = useState('billing'); // billing, rates, reports, invoices
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    participant: 'all',
    program: 'all',
    status: 'all',
    dateRange: 'current-month'
  });
  const [selectedBilling, setSelectedBilling] = useState(null);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState(null);
  const [newBilling, setNewBilling] = useState({
    participant_id: '',
    program_id: '',
    date: format(currentDate, 'yyyy-MM-dd'),
    hours: 1,
    rate_code: '',
    support_ratio: 1,
    weekend_multiplier: 1,
    notes: ''
  });
  const [newRate, setNewRate] = useState({
    code: '',
    description: '',
    amount: 0,
    support_category: '',
    is_active: true,
    effective_date: format(currentDate, 'yyyy-MM-dd')
  });
  const [exportOptions, setExportOptions] = useState({
    format: 'csv',
    start_date: format(startOfMonth(currentDate), 'yyyy-MM-dd'),
    end_date: format(endOfMonth(currentDate), 'yyyy-MM-dd'),
    participant_ids: [],
    include_details: true
  });
  const [selectedReport, setSelectedReport] = useState('participant_summary');

  // Format date for API requests
  const formattedMonthStart = format(selectedMonth, 'yyyy-MM-dd');
  const formattedMonthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

  // Fetch billing data
  const { 
    data: billingData, 
    isLoading: billingLoading, 
    error: billingError,
    refetch: refetchBilling
  } = useQuery(
    ['billingData', formattedMonthStart, formattedMonthEnd, filterOptions],
    async () => {
      const params = { 
        start_date: formattedMonthStart,
        end_date: formattedMonthEnd
      };
      
      if (filterOptions.participant !== 'all') {
        params.participant_id = filterOptions.participant;
      }
      
      if (filterOptions.program !== 'all') {
        params.program_id = filterOptions.program;
      }
      
      if (filterOptions.status !== 'all') {
        params.status = filterOptions.status;
      }
      
      const response = await axios.get(`${API_URL}/api/v1/finance/billing`, { params });
      return response.data;
    }
  );

  // Fetch billing rates
  const { 
    data: ratesData, 
    isLoading: ratesLoading, 
    error: ratesError,
    refetch: refetchRates
  } = useQuery(
    ['billingRates'],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/finance/rates`);
      return response.data;
    }
  );

  // Fetch participants for dropdown
  const { 
    data: participantsData, 
    isLoading: participantsLoading 
  } = useQuery(
    ['participantsList'],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/participants`);
      return response.data;
    }
  );

  // Fetch programs for dropdown
  const { 
    data: programsData, 
    isLoading: programsLoading 
  } = useQuery(
    ['programsList'],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/programs`);
      return response.data;
    }
  );

  // Fetch financial reports
  const { 
    data: reportData, 
    isLoading: reportLoading, 
    error: reportError,
    refetch: refetchReport
  } = useQuery(
    ['financialReport', selectedReport, formattedMonthStart, formattedMonthEnd],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/finance/reports`, {
        params: {
          report_type: selectedReport,
          start_date: formattedMonthStart,
          end_date: formattedMonthEnd
        }
      });
      return response.data;
    }
  );

  // Create billing entry mutation
  const createBillingMutation = useMutation(
    async (billingData) => {
      const response = await axios.post(`${API_URL}/api/v1/finance/billing`, billingData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['billingData']);
        setIsBillingModalOpen(false);
        resetNewBilling();
      }
    }
  );

  // Update billing entry mutation
  const updateBillingMutation = useMutation(
    async ({ billingId, billingData }) => {
      const response = await axios.put(`${API_URL}/api/v1/finance/billing/${billingId}`, billingData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['billingData']);
        setIsBillingModalOpen(false);
      }
    }
  );

  // Delete billing entry mutation
  const deleteBillingMutation = useMutation(
    async (billingId) => {
      const response = await axios.delete(`${API_URL}/api/v1/finance/billing/${billingId}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['billingData']);
      }
    }
  );

  // Update rate mutation
  const updateRateMutation = useMutation(
    async ({ rateId, rateData }) => {
      const response = await axios.put(`${API_URL}/api/v1/finance/rates/${rateId}`, rateData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['billingRates']);
        setIsRateModalOpen(false);
      }
    }
  );

  // Export billing data mutation
  const exportBillingMutation = useMutation(
    async (exportData) => {
      const response = await axios.post(`${API_URL}/api/v1/finance/export`, exportData);
      return response.data;
    },
    {
      onSuccess: (data) => {
        // In a real app, this would trigger a file download
        console.log('Export successful:', data);
        setIsExportModalOpen(false);
        
        // Example of how to trigger a download in a real app:
        // const blob = new Blob([data], { type: 'text/csv' });
        // const url = window.URL.createObjectURL(blob);
        // const a = document.createElement('a');
        // a.href = url;
        // a.download = `billing-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        // document.body.appendChild(a);
        // a.click();
        // window.URL.revokeObjectURL(url);
      }
    }
  );

  // Reset new billing form
  const resetNewBilling = () => {
    setNewBilling({
      participant_id: '',
      program_id: '',
      date: format(currentDate, 'yyyy-MM-dd'),
      hours: 1,
      rate_code: '',
      support_ratio: 1,
      weekend_multiplier: 1,
      notes: ''
    });
  };

  // Reset new rate form
  const resetNewRate = () => {
    setNewRate({
      code: '',
      description: '',
      amount: 0,
      support_category: '',
      is_active: true,
      effective_date: format(currentDate, 'yyyy-MM-dd')
    });
  };

  // Handle billing selection for editing
  const handleBillingSelect = (billing) => {
    setSelectedBilling(billing);
    setNewBilling({
      participant_id: billing.participant_id,
      program_id: billing.program_id,
      date: billing.date,
      hours: billing.hours,
      rate_code: billing.rate_code,
      support_ratio: billing.support_ratio,
      weekend_multiplier: billing.weekend_multiplier,
      notes: billing.notes || ''
    });
    setIsBillingModalOpen(true);
  };

  // Handle rate selection for editing
  const handleRateSelect = (rate) => {
    setSelectedRate(rate);
    setNewRate({
      code: rate.code,
      description: rate.description,
      amount: rate.amount,
      support_category: rate.support_category,
      is_active: rate.is_active,
      effective_date: rate.effective_date
    });
    setIsRateModalOpen(true);
  };

  // Handle billing form submission
  const handleBillingSubmit = (e) => {
    e.preventDefault();
    
    // Get rate amount from selected rate code
    const selectedRate = ratesData?.data?.find(rate => rate.code === newBilling.rate_code);
    const rateAmount = selectedRate ? parseFloat(selectedRate.amount) : 0;
    
    const billingData = {
      participant_id: newBilling.participant_id,
      program_id: newBilling.program_id,
      date: newBilling.date,
      hours: parseFloat(newBilling.hours),
      rate_code: newBilling.rate_code,
      rate_amount: rateAmount,
      support_ratio: parseFloat(newBilling.support_ratio),
      weekend_multiplier: parseFloat(newBilling.weekend_multiplier),
      total_amount: calculateBillingAmount(
        rateAmount,
        parseFloat(newBilling.hours),
        parseFloat(newBilling.support_ratio),
        parseFloat(newBilling.weekend_multiplier)
      ),
      notes: newBilling.notes
    };

    if (selectedBilling) {
      updateBillingMutation.mutate({ 
        billingId: selectedBilling.id, 
        billingData 
      });
    } else {
      createBillingMutation.mutate(billingData);
    }
  };

  // Handle rate form submission
  const handleRateSubmit = (e) => {
    e.preventDefault();
    
    const rateData = {
      code: newRate.code,
      description: newRate.description,
      amount: parseFloat(newRate.amount),
      support_category: newRate.support_category,
      is_active: newRate.is_active,
      effective_date: newRate.effective_date
    };

    if (selectedRate) {
      updateRateMutation.mutate({ 
        rateId: selectedRate.id, 
        rateData 
      });
    }
  };

  // Handle export form submission
  const handleExportSubmit = (e) => {
    e.preventDefault();
    
    exportBillingMutation.mutate(exportOptions);
  };

  // Calculate billing amount based on rate, hours, and adjustments
  const calculateBillingAmount = (rateAmount, hours, supportRatio, weekendMultiplier) => {
    // Apply support ratio adjustment
    const adjustedRate = rateAmount * supportRatio;
    
    // Apply weekend/holiday multiplier
    const finalRate = adjustedRate * weekendMultiplier;
    
    // Calculate total amount
    return finalRate * hours;
  };

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setSelectedMonth(prevMonth => subMonths(prevMonth, 1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setSelectedMonth(prevMonth => addMonths(prevMonth, 1));
  };

  // Go to current month
  const goToCurrentMonth = () => {
    setSelectedMonth(startOfMonth(new Date()));
  };

  // Filter billing data based on search query
  const filteredBillingData = () => {
    if (!billingData || !billingData.data) return [];
    
    return billingData.data.filter(billing => {
      const participantName = billing.participant_name || '';
      const programTitle = billing.program_title || '';
      const rateCode = billing.rate_code || '';
      
      return participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             programTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
             rateCode.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  // Filter rates data based on search query
  const filteredRatesData = () => {
    if (!ratesData || !ratesData.data) return [];
    
    return ratesData.data.filter(rate => {
      const code = rate.code || '';
      const description = rate.description || '';
      const category = rate.support_category || '';
      
      return code.toLowerCase().includes(searchQuery.toLowerCase()) ||
             description.toLowerCase().includes(searchQuery.toLowerCase()) ||
             category.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  // Render month navigation
  const renderMonthNavigation = () => (
    <div className="month-navigation">
      <button 
        className="btn btn-icon" 
        onClick={goToPreviousMonth}
        aria-label="Previous month"
      >
        <FiChevronLeft />
      </button>
      <button 
        className="btn btn-text"
        onClick={goToCurrentMonth}
      >
        {format(selectedMonth, 'MMMM yyyy')}
      </button>
      <button 
        className="btn btn-icon"
        onClick={goToNextMonth}
        aria-label="Next month"
      >
        <FiChevronRight />
      </button>
    </div>
  );

  // Render billing tab content
  const renderBillingTab = () => (
    <div className="tab-content">
      <div className="billing-controls">
        <div className="control-row">
          <div className="search-container">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search billing entries..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="filter-container">
            <div className="filter-item">
              <label htmlFor="participant-filter">Participant:</label>
              <select
                id="participant-filter"
                value={filterOptions.participant}
                onChange={e => setFilterOptions({...filterOptions, participant: e.target.value})}
              >
                <option value="all">All Participants</option>
                {participantsData?.data?.map(participant => (
                  <option key={participant.id} value={participant.id}>
                    {participant.first_name} {participant.last_name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-item">
              <label htmlFor="program-filter">Program:</label>
              <select
                id="program-filter"
                value={filterOptions.program}
                onChange={e => setFilterOptions({...filterOptions, program: e.target.value})}
              >
                <option value="all">All Programs</option>
                {programsData?.data?.map(program => (
                  <option key={program.id} value={program.id}>
                    {program.title}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-item">
              <label htmlFor="status-filter">Status:</label>
              <select
                id="status-filter"
                value={filterOptions.status}
                onChange={e => setFilterOptions({...filterOptions, status: e.target.value})}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="billed">Billed</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="control-row">
          {renderMonthNavigation()}
          
          <div className="action-buttons">
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setSelectedBilling(null);
                resetNewBilling();
                setIsBillingModalOpen(true);
              }}
            >
              <FiPlusCircle /> New Billing Entry
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => setIsExportModalOpen(true)}
            >
              <FiDownload /> Export
            </button>
            <button 
              className="btn btn-icon"
              onClick={() => refetchBilling()}
              title="Refresh Billing Data"
            >
              <FiRefreshCw />
            </button>
          </div>
        </div>
      </div>
      
      <div className="billing-table-container">
        <table className="billing-table glass-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Participant</th>
              <th>Program</th>
              <th>Hours</th>
              <th>Rate Code</th>
              <th>Rate</th>
              <th>Support Ratio</th>
              <th>Weekend Mult.</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBillingData().map(billing => (
              <tr key={billing.id}>
                <td>{format(parseISO(billing.date), 'MMM d, yyyy')}</td>
                <td>{billing.participant_name}</td>
                <td>{billing.program_title}</td>
                <td>{billing.hours}</td>
                <td>{billing.rate_code}</td>
                <td>${parseFloat(billing.rate_amount).toFixed(2)}</td>
                <td>{billing.support_ratio}x</td>
                <td>{billing.weekend_multiplier}x</td>
                <td className="amount">${parseFloat(billing.total_amount).toFixed(2)}</td>
                <td>
                  <span className={`status-badge ${billing.status}`}>
                    {billing.status}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="btn btn-icon" 
                      onClick={() => handleBillingSelect(billing)}
                      title="Edit Billing"
                    >
                      <FiEdit2 />
                    </button>
                    <button 
                      className="btn btn-icon"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this billing entry?')) {
                          deleteBillingMutation.mutate(billing.id);
                        }
                      }}
                      title="Delete Billing"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredBillingData().length === 0 && !billingLoading && (
              <tr>
                <td colSpan="11" className="no-results">
                  No billing entries found matching your search criteria
                </td>
              </tr>
            )}
          </tbody>
          {billingData?.summary && (
            <tfoot>
              <tr>
                <td colSpan="3" className="summary-label">Total</td>
                <td>{parseFloat(billingData.summary.total_hours).toFixed(2)}</td>
                <td colSpan="4"></td>
                <td className="amount">${parseFloat(billingData.summary.total_amount).toFixed(2)}</td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          )}
        </table>
        {billingLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Loading billing data...</p>
          </div>
        )}
      </div>
      
      <div className="billing-summary glass-card">
        <h3>Billing Summary</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <div className="summary-label">Total Entries</div>
            <div className="summary-value">{billingData?.count || 0}</div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Total Hours</div>
            <div className="summary-value">
              {billingData?.summary ? parseFloat(billingData.summary.total_hours).toFixed(2) : '0.00'}
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Total Amount</div>
            <div className="summary-value amount">
              ${billingData?.summary ? parseFloat(billingData.summary.total_amount).toFixed(2) : '0.00'}
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Month</div>
            <div className="summary-value">{format(selectedMonth, 'MMMM yyyy')}</div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render rates tab content
  const renderRatesTab = () => (
    <div className="tab-content">
      <div className="rates-controls">
        <div className="search-container">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search rates..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="action-buttons">
          <button 
            className="btn btn-icon"
            onClick={() => refetchRates()}
            title="Refresh Rates"
          >
            <FiRefreshCw />
          </button>
        </div>
      </div>
      
      <div className="rates-table-container">
        <table className="rates-table glass-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Support Category</th>
              <th>Status</th>
              <th>Effective Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRatesData().map(rate => (
              <tr key={rate.id}>
                <td>{rate.code}</td>
                <td>{rate.description}</td>
                <td className="amount">${parseFloat(rate.amount).toFixed(2)}</td>
                <td>{rate.support_category}</td>
                <td>
                  <span className={`status-badge ${rate.is_active ? 'active' : 'inactive'}`}>
                    {rate.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{format(parseISO(rate.effective_date), 'MMM d, yyyy')}</td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="btn btn-icon" 
                      onClick={() => handleRateSelect(rate)}
                      title="Edit Rate"
                    >
                      <FiEdit2 />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredRatesData().length === 0 && !ratesLoading && (
              <tr>
                <td colSpan="7" className="no-results">
                  No rates found matching your search criteria
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {ratesLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Loading rates data...</p>
          </div>
        )}
      </div>
      
      <div className="rates-info glass-card">
        <h3>NDIS Pricing Information</h3>
        <p>
          The National Disability Insurance Scheme (NDIS) uses standardized pricing for various support services.
          These rates are updated periodically by the NDIS Commission.
        </p>
        <div className="info-grid">
          <div className="info-item">
            <h4>Support Categories</h4>
            <ul>
              <li>Core - Daily Activities</li>
              <li>Core - Transport</li>
              <li>Core - Social & Community</li>
              <li>Capacity Building</li>
              <li>Capital - Assistive Technology</li>
            </ul>
          </div>
          <div className="info-item">
            <h4>Rate Modifiers</h4>
            <ul>
              <li>Support Ratio (1:1, 1:2, 1:3, etc.)</li>
              <li>Weekend/Public Holiday (1.5x, 2.0x)</li>
              <li>Evening/Overnight (1.1x)</li>
              <li>Remote/Very Remote (1.4x, 1.75x)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  // Render reports tab content
  const renderReportsTab = () => (
    <div className="tab-content">
      <div className="reports-controls">
        <div className="report-selector">
          <label htmlFor="report-type">Report Type:</label>
          <select
            id="report-type"
            value={selectedReport}
            onChange={e => setSelectedReport(e.target.value)}
          >
            <option value="participant_summary">Participant Summary</option>
            <option value="program_summary">Program Summary</option>
            <option value="rate_code_summary">Rate Code Summary</option>
            <option value="monthly_trend">Monthly Trend</option>
          </select>
        </div>
        
        <div className="date-range">
          {renderMonthNavigation()}
        </div>
        
        <div className="action-buttons">
          <button 
            className="btn btn-secondary"
            onClick={() => {
              // In a real app, this would generate a PDF report
              alert('Generating PDF report...');
            }}
          >
            <FiDownload /> Export Report
          </button>
          <button 
            className="btn btn-icon"
            onClick={() => refetchReport()}
            title="Refresh Report"
          >
            <FiRefreshCw />
          </button>
        </div>
      </div>
      
      <div className="report-container">
        {reportLoading ? (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Generating report...</p>
          </div>
        ) : reportError ? (
          <div className="error-container glass-card">
            <FiAlertCircle className="error-icon" />
            <p>Error generating report: {reportError.message}</p>
            <button className="btn btn-primary" onClick={() => refetchReport()}>
              Try Again
            </button>
          </div>
        ) : (
          <>
            <div className="report-header glass-card">
              <h3>
                {selectedReport === 'participant_summary' && 'Participant Summary Report'}
                {selectedReport === 'program_summary' && 'Program Summary Report'}
                {selectedReport === 'rate_code_summary' && 'Rate Code Summary Report'}
                {selectedReport === 'monthly_trend' && 'Monthly Trend Report'}
              </h3>
              <div className="report-meta">
                <div className="meta-item">
                  <strong>Period:</strong> {format(parseISO(formattedMonthStart), 'MMM d, yyyy')} - {format(parseISO(formattedMonthEnd), 'MMM d, yyyy')}
                </div>
                <div className="meta-item">
                  <strong>Generated:</strong> {format(new Date(), 'MMM d, yyyy h:mm a')}
                </div>
                <div className="meta-item">
                  <strong>Total Amount:</strong> ${reportData?.summary ? parseFloat(reportData.summary.total_amount).toFixed(2) : '0.00'}
                </div>
              </div>
            </div>
            
            <div className="report-body">
              <div className="report-table-container">
                <table className="report-table glass-table">
                  <thead>
                    <tr>
                      {selectedReport === 'participant_summary' && (
                        <>
                          <th>Participant</th>
                          <th>Billing Count</th>
                          <th>Total Hours</th>
                          <th>Total Amount</th>
                        </>
                      )}
                      {selectedReport === 'program_summary' && (
                        <>
                          <th>Program</th>
                          <th>Billing Count</th>
                          <th>Total Hours</th>
                          <th>Total Amount</th>
                        </>
                      )}
                      {selectedReport === 'rate_code_summary' && (
                        <>
                          <th>Rate Code</th>
                          <th>Billing Count</th>
                          <th>Total Hours</th>
                          <th>Total Amount</th>
                        </>
                      )}
                      {selectedReport === 'monthly_trend' && (
                        <>
                          <th>Month</th>
                          <th>Billing Count</th>
                          <th>Total Hours</th>
                          <th>Total Amount</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData?.data?.map((row, index) => (
                      <tr key={index}>
                        {selectedReport === 'participant_summary' && (
                          <>
                            <td>{row.participant_name}</td>
                            <td>{row.billing_count}</td>
                            <td>{parseFloat(row.total_hours).toFixed(2)}</td>
                            <td className="amount">${parseFloat(row.total_amount).toFixed(2)}</td>
                          </>
                        )}
                        {selectedReport === 'program_summary' && (
                          <>
                            <td>{row.program_title}</td>
                            <td>{row.billing_count}</td>
                            <td>{parseFloat(row.total_hours).toFixed(2)}</td>
                            <td className="amount">${parseFloat(row.total_amount).toFixed(2)}</td>
                          </>
                        )}
                        {selectedReport === 'rate_code_summary' && (
                          <>
                            <td>{row.rate_code}</td>
                            <td>{row.billing_count}</td>
                            <td>{parseFloat(row.total_hours).toFixed(2)}</td>
                            <td className="amount">${parseFloat(row.total_amount).toFixed(2)}</td>
                          </>
                        )}
                        {selectedReport === 'monthly_trend' && (
                          <>
                            <td>{row.month}</td>
                            <td>{row.billing_count}</td>
                            <td>{parseFloat(row.total_hours).toFixed(2)}</td>
                            <td className="amount">${parseFloat(row.total_amount).toFixed(2)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                    {(!reportData?.data || reportData.data.length === 0) && (
                      <tr>
                        <td colSpan="4" className="no-results">
                          No data available for this report
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {reportData?.summary && (
                    <tfoot>
                      <tr>
                        <td className="summary-label">Total</td>
                        <td>{reportData.count}</td>
                        <td>{parseFloat(reportData.summary.total_hours).toFixed(2)}</td>
                        <td className="amount">${parseFloat(reportData.summary.total_amount).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              
              <div className="report-visualization glass-card">
                <h3>Visual Summary</h3>
                <div className="chart-placeholder">
                  <div className="chart-icon">
                    {selectedReport === 'participant_summary' && <FiPieChart size={48} />}
                    {selectedReport === 'program_summary' && <FiBarChart2 size={48} />}
                    {selectedReport === 'rate_code_summary' && <FiPieChart size={48} />}
                    {selectedReport === 'monthly_trend' && <FiBarChart2 size={48} />}
                  </div>
                  <p>Chart visualization would appear here</p>
                  <p className="chart-note">In a production environment, this would display a dynamic chart based on the report data</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Render invoices tab content
  const renderInvoicesTab = () => (
    <div className="tab-content">
      <div className="invoices-controls">
        <div className="search-container">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="date-range">
          {renderMonthNavigation()}
        </div>
        
        <div className="action-buttons">
          <button 
            className="btn btn-primary"
            onClick={() => {
              // In a real app, this would open an invoice creation wizard
              alert('Invoice creation wizard would open here');
            }}
          >
            <FiPlusCircle /> Generate Invoices
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              // In a real app, this would batch process pending invoices
              alert('Batch processing invoices...');
            }}
          >
            <FiCheckCircle /> Process Pending
          </button>
        </div>
      </div>
      
      <div className="invoices-table-container">
        <table className="invoices-table glass-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Participant</th>
              <th>Date</th>
              <th>Due Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="7" className="no-results">
                Invoice functionality is under development
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="invoices-summary glass-card">
        <h3>NDIS Claiming Process</h3>
        <div className="process-steps">
          <div className="process-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Record Services</h4>
              <p>Enter all billable services in the Billing tab</p>
            </div>
          </div>
          <div className="process-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Generate Claims</h4>
              <p>Create NDIS-compatible claim files</p>
            </div>
          </div>
          <div className="process-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Submit to Portal</h4>
              <p>Upload claims to NDIS portal</p>
            </div>
          </div>
          <div className="process-step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h4>Track Payments</h4>
              <p>Monitor payment status</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render billing modal
  const renderBillingModal = () => (
    <div className="modal-overlay" onClick={() => setIsBillingModalOpen(false)}>
      <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{selectedBilling ? 'Edit Billing Entry' : 'New Billing Entry'}</h3>
          <button className="btn-close" onClick={() => setIsBillingModalOpen(false)}>
            <FiXCircle />
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleBillingSubmit} className="billing-form">
            <div className="form-group">
              <label htmlFor="billing-participant">Participant</label>
              <select
                id="billing-participant"
                value={newBilling.participant_id}
                onChange={e => setNewBilling({...newBilling, participant_id: e.target.value})}
                required
              >
                <option value="">-- Select Participant --</option>
                {participantsData?.data?.map(participant => (
                  <option key={participant.id} value={participant.id}>
                    {participant.first_name} {participant.last_name}
                  </option>
                ))}
              </select>
              {participantsLoading && <span className="loading-indicator-small"></span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="billing-program">Program</label>
              <select
                id="billing-program"
                value={newBilling.program_id}
                onChange={e => setNewBilling({...newBilling, program_id: e.target.value})}
                required
              >
                <option value="">-- Select Program --</option>
                {programsData?.data?.map(program => (
                  <option key={program.id} value={program.id}>
                    {program.title}
                  </option>
                ))}
              </select>
              {programsLoading && <span className="loading-indicator-small"></span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="billing-date">Date</label>
              <input
                id="billing-date"
                type="date"
                value={newBilling.date}
                onChange={e => setNewBilling({...newBilling, date: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="billing-hours">Hours</label>
              <input
                id="billing-hours"
                type="number"
                min="0.25"
                step="0.25"
                value={newBilling.hours}
                onChange={e => setNewBilling({...newBilling, hours: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="billing-rate-code">Rate Code</label>
              <select
                id="billing-rate-code"
                value={newBilling.rate_code}
                onChange={e => setNewBilling({...newBilling, rate_code: e.target.value})}
                required
              >
                <option value="">-- Select Rate Code --</option>
                {ratesData?.data?.filter(rate => rate.is_active).map(rate => (
                  <option key={rate.id} value={rate.code}>
                    {rate.code} - {rate.description} (${parseFloat(rate.amount).toFixed(2)})
                  </option>
                ))}
              </select>
              {ratesLoading && <span className="loading-indicator-small"></span>}
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="billing-support-ratio">Support Ratio</label>
                <select
                  id="billing-support-ratio"
                  value={newBilling.support_ratio}
                  onChange={e => setNewBilling({...newBilling, support_ratio: e.target.value})}
                  required
                >
                  <option value="1">1:1 (1.0x)</option>
                  <option value="0.5">1:2 (0.5x)</option>
                  <option value="0.33">1:3 (0.33x)</option>
                  <option value="0.25">1:4 (0.25x)</option>
                  <option value="0.2">1:5 (0.2x)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="billing-weekend-multiplier">Weekend Multiplier</label>
                <select
                  id="billing-weekend-multiplier"
                  value={newBilling.weekend_multiplier}
                  onChange={e => setNewBilling({...newBilling, weekend_multiplier: e.target.value})}
                  required
                >
                  <option value="1">Weekday (1.0x)</option>
                  <option value="1.5">Saturday (1.5x)</option>
                  <option value="2">Sunday (2.0x)</option>
                  <option value="2.5">Public Holiday (2.5x)</option>
                </select>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="billing-notes">Notes</label>
              <textarea
                id="billing-notes"
                value={newBilling.notes}
                onChange={e => setNewBilling({...newBilling, notes: e.target.value})}
                placeholder="Add any notes about this billing entry..."
                rows="3"
              ></textarea>
            </div>
            
            <div className="form-group">
              <label>Total Amount</label>
              <div className="calculated-amount">
                {(() => {
                  const selectedRate = ratesData?.data?.find(rate => rate.code === newBilling.rate_code);
                  const rateAmount = selectedRate ? parseFloat(selectedRate.amount) : 0;
                  const totalAmount = calculateBillingAmount(
                    rateAmount,
                    parseFloat(newBilling.hours) || 0,
                    parseFloat(newBilling.support_ratio) || 1,
                    parseFloat(newBilling.weekend_multiplier) || 1
                  );
                  
                  return `$${totalAmount.toFixed(2)}`;
                })()}
              </div>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          {selectedBilling && (
            <button 
              type="button" 
              className="btn btn-danger"
              onClick={() => {
                if (confirm('Are you sure you want to delete this billing entry?')) {
                  deleteBillingMutation.mutate(selectedBilling.id);
                  setIsBillingModalOpen(false);
                }
              }}
            >
              <FiTrash2 /> Delete
            </button>
          )}
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => setIsBillingModalOpen(false)}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleBillingSubmit}
            disabled={createBillingMutation.isLoading || updateBillingMutation.isLoading}
          >
            {createBillingMutation.isLoading || updateBillingMutation.isLoading ? (
              <>
                <div className="loading-spinner-small"></div>
                Saving...
              </>
            ) : (
              <>
                <FiCheckCircle /> {selectedBilling ? 'Update' : 'Save'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Render rate modal
  const renderRateModal = () => (
    <div className="modal-overlay" onClick={() => setIsRateModalOpen(false)}>
      <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Rate</h3>
          <button className="btn-close" onClick={() => setIsRateModalOpen(false)}>
            <FiXCircle />
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleRateSubmit} className="rate-form">
            <div className="form-group">
              <label htmlFor="rate-code">Code</label>
              <input
                id="rate-code"
                type="text"
                value={newRate.code}
                onChange={e => setNewRate({...newRate, code: e.target.value})}
                required
                disabled={true} // Don't allow changing the code
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="rate-description">Description</label>
              <input
                id="rate-description"
                type="text"
                value={newRate.description}
                onChange={e => setNewRate({...newRate, description: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="rate-amount">Amount</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  id="rate-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newRate.amount}
                  onChange={e => setNewRate({...newRate, amount: e.target.value})}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="rate-category">Support Category</label>
              <select
                id="rate-category"
                value={newRate.support_category}
                onChange={e => setNewRate({...newRate, support_category: e.target.value})}
                required
              >
                <option value="">-- Select Category --</option>
                <option value="Core - Daily Activities">Core - Daily Activities</option>
                <option value="Core - Transport">Core - Transport</option>
                <option value="Core - Social & Community">Core - Social & Community</option>
                <option value="Capacity Building">Capacity Building</option>
                <option value="Capital - Assistive Technology">Capital - Assistive Technology</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="rate-status">Status</label>
              <div className="toggle-switch">
                <input
                  id="rate-status"
                  type="checkbox"
                  checked={newRate.is_active}
                  onChange={e => setNewRate({...newRate, is_active: e.target.checked})}
                />
                <label htmlFor="rate-status">
                  {newRate.is_active ? 'Active' : 'Inactive'}
                </label>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="rate-effective-date">Effective Date</label>
              <input
                id="rate-effective-date"
                type="date"
                value={newRate.effective_date}
                onChange={e => setNewRate({...newRate, effective_date: e.target.value})}
                required
              />
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => setIsRateModalOpen(false)}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleRateSubmit}
            disabled={updateRateMutation.isLoading}
          >
            {updateRateMutation.isLoading ? (
              <>
                <div className="loading-spinner-small"></div>
                Saving...
              </>
            ) : (
              <>
                <FiCheckCircle /> Update
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Render export modal
  const renderExportModal = () => (
    <div className="modal-overlay" onClick={() => setIsExportModalOpen(false)}>
      <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Export Billing Data</h3>
          <button className="btn-close" onClick={() => setIsExportModalOpen(false)}>
            <FiXCircle />
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleExportSubmit} className="export-form">
            <div className="form-group">
              <label htmlFor="export-format">Format</label>
              <select
                id="export-format"
                value={exportOptions.format}
                onChange={e => setExportOptions({...exportOptions, format: e.target.value})}
              >
                <option value="csv">CSV</option>
                <option value="xlsx">Excel</option>
                <option value="pdf">PDF</option>
                <option value="json">JSON</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Date Range</label>
              <div className="date-range-inputs">
                <div className="date-input">
                  <label htmlFor="export-start-date">From</label>
                  <input
                    id="export-start-date"
                    type="date"
                    value={exportOptions.start_date}
                    onChange={e => setExportOptions({...exportOptions, start_date: e.target.value})}
                    required
                  />
                </div>
                <div className="date-input">
                  <label htmlFor="export-end-date">To</label>
                  <input
                    id="export-end-date"
                    type="date"
                    value={exportOptions.end_date}
                    onChange={e => setExportOptions({...exportOptions, end_date: e.target.value})}
                    required
                  />
                </div>
              </div>
            </div>
            
            <div className="form-group">
              <label>Participants</label>
              <div className="checkbox-list">
                <div className="checkbox-item">
                  <input
                    id="export-all-participants"
                    type="checkbox"
                    checked={exportOptions.participant_ids.length === 0}
                    onChange={() => setExportOptions({...exportOptions, participant_ids: []})}
                  />
                  <label htmlFor="export-all-participants">All Participants</label>
                </div>
                {participantsData?.data?.slice(0, 5).map(participant => (
                  <div key={participant.id} className="checkbox-item">
                    <input
                      id={`export-participant-${participant.id}`}
                      type="checkbox"
                      checked={exportOptions.participant_ids.includes(participant.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setExportOptions({
                            ...exportOptions,
                            participant_ids: [...exportOptions.participant_ids, participant.id]
                          });
                        } else {
                          setExportOptions({
                            ...exportOptions,
                            participant_ids: exportOptions.participant_ids.filter(id => id !== participant.id)
                          });
                        }
                      }}
                    />
                    <label htmlFor={`export-participant-${participant.id}`}>
                      {participant.first_name} {participant.last_name}
                    </label>
                  </div>
                ))}
                {participantsData?.data?.length > 5 && (
                  <div className="more-participants">
                    And {participantsData.data.length - 5} more...
                  </div>
                )}
              </div>
            </div>
            
            <div className="form-group">
              <label>Options</label>
              <div className="checkbox-item">
                <input
                  id="export-include-details"
                  type="checkbox"
                  checked={exportOptions.include_details}
                  onChange={e => setExportOptions({...exportOptions, include_details: e.target.checked})}
                />
                <label htmlFor="export-include-details">Include detailed information</label>
              </div>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => setIsExportModalOpen(false)}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleExportSubmit}
            disabled={exportBillingMutation.isLoading}
          >
            {exportBillingMutation.isLoading ? (
              <>
                <div className="loading-spinner-small"></div>
                Exporting...
              </>
            ) : (
              <>
                <FiDownload /> Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="finance-container">
      <div className="page-header">
        <h2 className="page-title">Finance</h2>
        <div className="page-actions">
          <button 
            className="btn btn-icon" 
            onClick={() => {
              refetchBilling();
              refetchRates();
              refetchReport();
            }}
            title="Refresh All Data"
          >
            <FiRefreshCw />
          </button>
          <span className="date-display">
            {format(currentDate, 'EEEE, MMMM d, yyyy')}
          </span>
        </div>
      </div>
      
      {/* Finance Tabs */}
      <div className="finance-tabs glass-card">
        <button 
          className={`tab-button ${selectedTab === 'billing' ? 'active' : ''}`}
          onClick={() => setSelectedTab('billing')}
        >
          <FiDollarSign /> Billing
        </button>
        <button 
          className={`tab-button ${selectedTab === 'rates' ? 'active' : ''}`}
          onClick={() => setSelectedTab('rates')}
        >
          <FiCreditCard /> NDIS Rates
        </button>
        <button 
          className={`tab-button ${selectedTab === 'reports' ? 'active' : ''}`}
          onClick={() => setSelectedTab('reports')}
        >
          <FiBarChart2 /> Reports
        </button>
        <button 
          className={`tab-button ${selectedTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setSelectedTab('invoices')}
        >
          <FiFileText /> Invoices
        </button>
      </div>
      
      {/* Tab Content */}
      <div className="finance-content">
        {selectedTab === 'billing' && renderBillingTab()}
        {selectedTab === 'rates' && renderRatesTab()}
        {selectedTab === 'reports' && renderReportsTab()}
        {selectedTab === 'invoices' && renderInvoicesTab()}
      </div>
      
      {/* Quick Actions */}
      <div className="finance-actions">
        <button className="glass-card action-card" onClick={() => setIsExportModalOpen(true)}>
          <FiDownload className="action-icon" />
          <span>Export Data</span>
        </button>
        <button 
          className="glass-card action-card"
          onClick={() => {
            setSelectedTab('reports');
            setSelectedReport('monthly_trend');
          }}
        >
          <FiPieChart className="action-icon" />
          <span>Monthly Report</span>
        </button>
        <button 
          className="glass-card action-card"
          onClick={() => {
            setSelectedBilling(null);
            resetNewBilling();
            setIsBillingModalOpen(true);
          }}
        >
          <FiPlusCircle className="action-icon" />
          <span>New Billing</span>
        </button>
        <button className="glass-card action-card">
          <FiClipboard className="action-icon" />
          <span>NDIS Portal</span>
        </button>
      </div>
      
      {/* Modals */}
      {isBillingModalOpen && renderBillingModal()}
      {isRateModalOpen && renderRateModal()}
      {isExportModalOpen && renderExportModal()}
    </div>
  );
};

export default Finance;
