import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import '../styles/Finance.css';

const Finance = () => {
  // Period selection state
  const [activePeriod, setActivePeriod] = useState('day');
  const [customDateRange, setCustomDateRange] = useState(false);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Dashboard data state
  const [financials, setFinancials] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [masterCards, setMasterCards] = useState([]);
  const [supervisionStats, setSupervisionStats] = useState(null);
  
  // Admin settings state
  const [adminPercentage, setAdminPercentage] = useState(15);
  const [isEditingAdminPercentage, setIsEditingAdminPercentage] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState({
    financials: true,
    metrics: true,
    masterCards: true,
    supervisionStats: true
  });
  const [error, setError] = useState({
    financials: null,
    metrics: null,
    masterCards: null,
    supervisionStats: null
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMasterCard, setSelectedMasterCard] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('xero');
  const [exportType, setExportType] = useState('timesheets');

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
  const SCHADS_COLORS = {
    1: '#4287f5',
    2: '#42b3f5',
    3: '#42d7f5',
    4: '#42f5e3',
    5: '#42f5b3',
    6: '#42f587',
    7: '#5af542',
    8: '#8af542'
  };

  // Helper function to format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(value);
  };

  // Helper function to format percentage
  const formatPercentage = (value) => {
    const num = typeof value === 'number' && !isNaN(value) ? value : 0;
    return `${num.toFixed(2)}%`;
  };

  // Set date range based on period
  useEffect(() => {
    if (customDateRange) return;

    const today = new Date();
    let start, end;

    switch (activePeriod) {
      case 'day':
        start = end = format(today, 'yyyy-MM-dd');
        break;
      case 'week':
        start = format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
        end = format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
        break;
      case 'fortnight':
        // Determine if we're in week A or week B of the fortnight
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        const weekNumber = Math.floor((today - startOfYear) / (7 * 24 * 60 * 60 * 1000));
        const isWeekA = weekNumber % 2 === 0;
        
        // Calculate start of fortnight (either this week or last week)
        const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 0 });
        start = isWeekA 
          ? format(startOfCurrentWeek, 'yyyy-MM-dd')
          : format(new Date(startOfCurrentWeek.setDate(startOfCurrentWeek.getDate() - 7)), 'yyyy-MM-dd');
        
        // End of fortnight is 13 days after start
        const endOfFortnight = new Date(new Date(start).setDate(new Date(start).getDate() + 13));
        end = format(endOfFortnight, 'yyyy-MM-dd');
        break;
      case 'month':
        start = format(startOfMonth(today), 'yyyy-MM-dd');
        end = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
      default:
        start = end = format(today, 'yyyy-MM-dd');
    }

    setStartDate(start);
    setEndDate(end);
  }, [activePeriod, customDateRange]);

  // Fetch all financial data
  useEffect(() => {
    fetchFinancials();
    fetchMetrics();
    fetchMasterCards();
    fetchSupervisionStats();
  }, [startDate, endDate]);

  // Fetch financial metrics for selected period
  const fetchFinancials = async () => {
    setLoading(prev => ({ ...prev, financials: true }));
    setError(prev => ({ ...prev, financials: null }));

    try {
      let url = '/api/v1/dashboard/financials/all';
      
      if (customDateRange) {
        url = `/api/v1/dashboard/financials?start=${startDate}&end=${endDate}&period=${activePeriod}`;
      }

      const response = await axios.get(url);
      setFinancials(response.data.data);
    } catch (err) {
      console.error('Error fetching financial data:', err);
      setError(prev => ({ 
        ...prev, 
        financials: 'Failed to load financial data. Please try again.' 
      }));
    } finally {
      setLoading(prev => ({ ...prev, financials: false }));
    }
  };

  // Fetch dashboard metrics
  const fetchMetrics = async () => {
    setLoading(prev => ({ ...prev, metrics: true }));
    setError(prev => ({ ...prev, metrics: null }));

    try {
      const response = await axios.get('/api/v1/dashboard/metrics');
      setMetrics(response.data.data);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(prev => ({ 
        ...prev, 
        metrics: 'Failed to load dashboard metrics. Please try again.' 
      }));
    } finally {
      setLoading(prev => ({ ...prev, metrics: false }));
    }
  };

  // Fetch master cards with financial data
  const fetchMasterCards = async () => {
    setLoading(prev => ({ ...prev, masterCards: true }));
    setError(prev => ({ ...prev, masterCards: null }));

    try {
      const response = await axios.get(`/api/v1/dashboard/master-cards?start=${startDate}&end=${endDate}`);
      setMasterCards(response.data.data);
    } catch (err) {
      console.error('Error fetching master cards:', err);
      setError(prev => ({ 
        ...prev, 
        masterCards: 'Failed to load master cards. Please try again.' 
      }));
    } finally {
      setLoading(prev => ({ ...prev, masterCards: false }));
    }
  };

  // Fetch supervision multiplier statistics
  const fetchSupervisionStats = async () => {
    setLoading(prev => ({ ...prev, supervisionStats: true }));
    setError(prev => ({ ...prev, supervisionStats: null }));

    try {
      const response = await axios.get(`/api/v1/dashboard/supervision-stats?start=${startDate}&end=${endDate}`);
      setSupervisionStats(response.data.data);
      
      // Also update admin percentage from server if available
      if (response.data.data.adminPercentage) {
        setAdminPercentage(response.data.data.adminPercentage);
      }
    } catch (err) {
      console.error('Error fetching supervision stats:', err);
      setError(prev => ({ 
        ...prev, 
        supervisionStats: 'Failed to load supervision statistics. Please try again.' 
      }));
    } finally {
      setLoading(prev => ({ ...prev, supervisionStats: false }));
    }
  };

  // Handle admin percentage update
  const updateAdminPercentage = async () => {
    try {
      // In a real implementation, this would send the update to the server
      // await axios.post('/api/v1/settings/admin-percentage', { value: adminPercentage });
      console.log('Admin percentage updated to:', adminPercentage);
      setIsEditingAdminPercentage(false);
      
      // Refresh financial data to reflect new admin percentage
      fetchFinancials();
      fetchMasterCards();
    } catch (err) {
      console.error('Error updating admin percentage:', err);
      alert('Failed to update admin percentage. Please try again.');
    }
  };

  // Handle export action
  const handleExport = async () => {
    setLoading(prev => ({ ...prev, export: true }));
    
    try {
      let url;
      let filename;
      
      switch (exportType) {
        case 'timesheets':
          url = `/api/v1/dashboard/timesheets?start=${startDate}&end=${endDate}&format=${exportFormat}`;
          filename = `timesheets_${startDate}_to_${endDate}.csv`;
          break;
        case 'billing':
          url = `/api/v1/billing/export?start=${startDate}&end=${endDate}`;
          filename = `billing_${startDate}_to_${endDate}.csv`;
          break;
        case 'invoices':
          url = `/api/v1/invoices/export?start=${startDate}&end=${endDate}`;
          filename = `invoices_${startDate}_to_${endDate}.csv`;
          break;
        default:
          throw new Error('Invalid export type');
      }
      
      // Create a hidden anchor element to trigger download
      const response = await axios.get(url, { responseType: 'blob' });
      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setShowExportModal(false);
    } catch (err) {
      console.error('Error exporting data:', err);
      alert('Failed to export data. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, export: false }));
    }
  };

  // Prepare data for SCHADS cost breakdown chart
  const prepareSchadsData = () => {
    if (!masterCards || masterCards.length === 0) return [];
    
    // Group staff costs by SCHADS level
    const schadsMap = {};
    
    masterCards.forEach(card => {
      if (card.staff_assignments) {
        card.staff_assignments.forEach(assignment => {
          const level = assignment.schads_level || 'Unknown';
          if (!schadsMap[level]) {
            schadsMap[level] = 0;
          }
          schadsMap[level] += assignment.cost || 0;
        });
      }
    });
    
    // Convert to array for chart
    return Object.keys(schadsMap).map(level => ({
      name: `Level ${level}`,
      value: schadsMap[level]
    }));
  };

  // Prepare data for revenue trend chart
  const prepareRevenueTrendData = () => {
    if (!masterCards || masterCards.length === 0) return [];
    
    // Group by date
    const dateMap = {};
    
    masterCards.forEach(card => {
      const date = card.date;
      if (!dateMap[date]) {
        dateMap[date] = {
          date,
          revenue: 0,
          staffCost: 0,
          profit: 0
        };
      }
      
      if (card.financials) {
        dateMap[date].revenue += card.financials.revenue || 0;
        dateMap[date].staffCost += card.financials.staffCosts || 0;
        dateMap[date].profit += card.financials.profitLoss || 0;
      }
    });
    
    // Convert to array and sort by date
    return Object.values(dateMap).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
  };

  // Render loading spinner
  const renderLoading = () => (
    <div className="finance-loading">
      <div className="spinner"></div>
      <p>Loading financial data...</p>
    </div>
  );

  // Render error message
  const renderError = (message) => (
    <div className="finance-error">
      <p>{message}</p>
      <button onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  // Render financial overview tab
  const renderOverviewTab = () => {
    if (loading.financials || loading.metrics) return renderLoading();
    if (error.financials || error.metrics) {
      return renderError(error.financials || error.metrics);
    }

    const periodData = financials ? 
      (customDateRange ? financials : financials[activePeriod]) : null;

    return (
      <div className="finance-overview">
        {/* KPI Cards */}
        <div className="finance-kpi-cards">
          <div className="finance-kpi-card">
            <h3>Revenue</h3>
            <div className="kpi-value">
              {periodData ? formatCurrency(periodData.revenue) : '$0.00'}
            </div>
            <div className="kpi-period">{activePeriod}</div>
          </div>
          
          <div className="finance-kpi-card">
            <h3>Staff Costs</h3>
            <div className="kpi-value">
              {periodData ? formatCurrency(periodData.staffCosts) : '$0.00'}
            </div>
            <div className="kpi-period">{activePeriod}</div>
          </div>
          
          <div className="finance-kpi-card">
            <h3>Admin Costs</h3>
            <div className="kpi-value">
              {periodData ? formatCurrency(periodData.adminCosts) : '$0.00'}
            </div>
            <div className="kpi-period">{activePeriod}</div>
          </div>
          
          <div className={`finance-kpi-card ${periodData && periodData.profitLoss < 0 ? 'negative' : 'positive'}`}>
            <h3>Profit/Loss</h3>
            <div className="kpi-value">
              {periodData ? formatCurrency(periodData.profitLoss) : '$0.00'}
            </div>
            <div className="kpi-percentage">
              {periodData ? formatPercentage(periodData.profitMargin) : '0.00%'}
            </div>
          </div>
        </div>
        
        {/* Charts Row */}
        <div className="finance-charts-row">
          <div className="finance-chart-container">
            <h3>Revenue vs Costs</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  {
                    name: activePeriod,
                    revenue: periodData ? periodData.revenue : 0,
                    staffCosts: periodData ? periodData.staffCosts : 0,
                    adminCosts: periodData ? periodData.adminCosts : 0
                  }
                ]}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#4287f5" />
                <Bar dataKey="staffCosts" name="Staff Costs" fill="#f54242" />
                <Bar dataKey="adminCosts" name="Admin Costs" fill="#f5a742" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="finance-chart-container">
            <h3>Profit Margin</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Staff Costs', value: periodData ? periodData.staffCosts : 0 },
                    { name: 'Admin Costs', value: periodData ? periodData.adminCosts : 0 },
                    { name: 'Profit', value: periodData && periodData.profitLoss > 0 ? periodData.profitLoss : 0 },
                    { name: 'Loss', value: periodData && periodData.profitLoss < 0 ? -periodData.profitLoss : 0 }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {[
                    { name: 'Staff Costs', color: '#f54242' },
                    { name: 'Admin Costs', color: '#f5a742' },
                    { name: 'Profit', color: '#42f587' },
                    { name: 'Loss', color: '#f542a7' }
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Additional Metrics */}
        <div className="finance-metrics-container">
          <h3>Today's Operational Metrics</h3>
          <div className="finance-metrics-grid">
            <div className="finance-metric-item">
              <span className="metric-label">Participants Served</span>
              <span className="metric-value">{metrics?.totalParticipants || 0}</span>
            </div>
            <div className="finance-metric-item">
              <span className="metric-label">Programs Running</span>
              <span className="metric-value">{metrics?.totalPrograms || 0}</span>
            </div>
            <div className="finance-metric-item">
              <span className="metric-label">Vehicles In Use</span>
              <span className="metric-value">{metrics?.vehiclesInUse || 0}</span>
            </div>
            <div className="finance-metric-item">
              <span className="metric-label">Service Hours</span>
              <span className="metric-value">
                {metrics?.totalServiceHours ? metrics.totalServiceHours.toFixed(1) : 0}
              </span>
            </div>
            <div className="finance-metric-item">
              <span className="metric-label">Revenue Per Participant</span>
              <span className="metric-value">
                {metrics?.totalParticipants && metrics?.totalRevenue 
                  ? formatCurrency(metrics.totalRevenue / metrics.totalParticipants) 
                  : '$0.00'}
              </span>
            </div>
            <div className="finance-metric-item">
              <span className="metric-label">Admin Expense</span>
              <span className="metric-value">
                {isEditingAdminPercentage ? (
                  <div className="admin-percentage-editor">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={adminPercentage}
                      onChange={(e) => setAdminPercentage(parseFloat(e.target.value))}
                    />
                    <button onClick={updateAdminPercentage}>Save</button>
                  </div>
                ) : (
                  <span onClick={() => setIsEditingAdminPercentage(true)}>
                    {adminPercentage}% <i className="fas fa-pencil-alt"></i>
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render revenue analysis tab
  const renderRevenueTab = () => {
    if (loading.financials || loading.masterCards) return renderLoading();
    if (error.financials || error.masterCards) {
      return renderError(error.financials || error.masterCards);
    }

    const trendData = prepareRevenueTrendData();

    return (
      <div className="finance-revenue">
        <h2>Revenue Analysis</h2>
        
        {/* Revenue Trend Chart */}
        <div className="finance-chart-container large">
          <h3>Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={trendData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => format(parseISO(date), 'MMM dd')}
              />
              <YAxis />
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(date) => format(parseISO(date), 'MMMM d, yyyy')}
              />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#4287f5" strokeWidth={2} />
              <Line type="monotone" dataKey="staffCost" name="Staff Cost" stroke="#f54242" strokeWidth={2} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="#42f587" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Revenue by Program */}
        <div className="finance-chart-container large">
          <h3>Revenue by Program</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={masterCards.reduce((acc, card) => {
                const program = card.program_name || 'Unknown';
                const existingProgram = acc.find(p => p.name === program);
                
                if (existingProgram) {
                  existingProgram.revenue += card.financials?.revenue || 0;
                } else {
                  acc.push({
                    name: program,
                    revenue: card.financials?.revenue || 0
                  });
                }
                
                return acc;
              }, []).sort((a, b) => b.revenue - a.revenue)}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="revenue" name="Revenue" fill="#4287f5">
                {masterCards.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Top Revenue Generating Master Cards */}
        <div className="finance-table-container">
          <h3>Top Revenue Generating Events</h3>
          <table className="finance-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Program</th>
                <th>Participants</th>
                <th>Revenue</th>
                <th>Staff Cost</th>
                <th>Profit</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {masterCards
                .filter(card => card.financials && card.financials.revenue > 0)
                .sort((a, b) => b.financials.revenue - a.financials.revenue)
                .slice(0, 10)
                .map((card, index) => (
                  <tr key={index} onClick={() => setSelectedMasterCard(card)}>
                    <td>{format(parseISO(card.date), 'MMM dd')}</td>
                    <td>{card.program_name || 'Unknown'}</td>
                    <td>{card.participant_count || 0}</td>
                    <td>{formatCurrency(card.financials.revenue)}</td>
                    <td>{formatCurrency(card.financials.staffCosts)}</td>
                    <td className={card.financials.profitLoss >= 0 ? 'positive' : 'negative'}>
                      {formatCurrency(card.financials.profitLoss)}
                    </td>
                    <td className={card.financials.profitMargin >= 0 ? 'positive' : 'negative'}>
                      {formatPercentage(card.financials.profitMargin)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render staff costs tab
  const renderStaffCostsTab = () => {
    if (loading.financials || loading.masterCards) return renderLoading();
    if (error.financials || error.masterCards) {
      return renderError(error.financials || error.masterCards);
    }

    const schadsData = prepareSchadsData();

    return (
      <div className="finance-staff-costs">
        <h2>Staff Cost Analysis</h2>
        
        {/* SCHADS Cost Breakdown */}
        <div className="finance-chart-container large">
          <h3>SCHADS Level Cost Breakdown</h3>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={schadsData}
                cx="50%"
                cy="50%"
                labelLine={true}
                outerRadius={150}
                fill="#8884d8"
                dataKey="value"
                label={({ name, value, percent }) => 
                  `${name}: ${formatCurrency(value)} (${(percent * 100).toFixed(0)}%)`
                }
              >
                {schadsData.map((entry, index) => {
                  const level = entry.name.split(' ')[1];
                  return <Cell key={`cell-${index}`} fill={SCHADS_COLORS[level] || COLORS[index % COLORS.length]} />;
                })}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Staff Cost by Program */}
        <div className="finance-chart-container large">
          <h3>Staff Cost by Program</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={masterCards.reduce((acc, card) => {
                const program = card.program_name || 'Unknown';
                const existingProgram = acc.find(p => p.name === program);
                
                if (existingProgram) {
                  existingProgram.staffCost += card.financials?.staffCosts || 0;
                } else {
                  acc.push({
                    name: program,
                    staffCost: card.financials?.staffCosts || 0
                  });
                }
                
                return acc;
              }, []).sort((a, b) => b.staffCost - a.staffCost)}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="staffCost" name="Staff Cost" fill="#f54242">
                {masterCards.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* SCHADS Level Distribution Table */}
        <div className="finance-table-container">
          <h3>SCHADS Level Distribution</h3>
          <table className="finance-table">
            <thead>
              <tr>
                <th>SCHADS Level</th>
                <th>Base Rate</th>
                <th>Staff Count</th>
                <th>Hours</th>
                <th>Total Cost</th>
                <th>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {schadsData.map((entry, index) => {
                const level = entry.name.split(' ')[1];
                const baseRate = {
                  '1': 28.41, '2': 32.54, '3': 34.85, '4': 36.88,
                  '5': 39.03, '6': 43.26, '7': 46.71, '8': 50.15
                }[level] || 0;
                
                // Calculate staff count and hours
                let staffCount = 0;
                let hours = 0;
                
                masterCards.forEach(card => {
                  if (card.staff_assignments) {
                    card.staff_assignments.forEach(assignment => {
                      if (assignment.schads_level === parseInt(level)) {
                        staffCount++;
                        hours += assignment.hours || 0;
                      }
                    });
                  }
                });
                
                // Calculate percentage of total
                const totalCost = schadsData.reduce((sum, item) => sum + item.value, 0);
                const percentage = totalCost > 0 ? (entry.value / totalCost) * 100 : 0;
                
                return (
                  <tr key={index} style={{ backgroundColor: `${SCHADS_COLORS[level]}22` }}>
                    <td>Level {level}</td>
                    <td>{formatCurrency(baseRate)}/hr</td>
                    <td>{staffCount}</td>
                    <td>{hours.toFixed(1)}</td>
                    <td>{formatCurrency(entry.value)}</td>
                    <td>{percentage.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render supervision multiplier tab
  const renderSupervisionTab = () => {
    if (loading.supervisionStats) return renderLoading();
    if (error.supervisionStats) {
      return renderError(error.supervisionStats);
    }

    return (
      <div className="finance-supervision">
        <h2>Supervision Multiplier Analysis</h2>
        
        {/* Supervision Impact Summary */}
        <div className="supervision-impact-summary">
          <div className="impact-card">
            <h3>Total Instances</h3>
            <div className="impact-value">{supervisionStats?.total_instances || 0}</div>
          </div>
          
          <div className="impact-card">
            <h3>Instances with Multiplier Impact</h3>
            <div className="impact-value">{supervisionStats?.instances_with_multiplier_impact || 0}</div>
            <div className="impact-percentage">
              {supervisionStats?.total_instances > 0
                ? ((supervisionStats.instances_with_multiplier_impact / supervisionStats.total_instances) * 100).toFixed(1)
                : 0}%
            </div>
          </div>
          
          <div className="impact-card">
            <h3>Average Multiplier Impact</h3>
            <div className="impact-value">
              {
                (() => {
                  const val = supervisionStats?.avg_multiplier_impact;
                  if (typeof val === 'number' && !isNaN(val)) {
                    return `+${val.toFixed(2)}`;
                  }
                  return '+0.00';
                })()
              }
            </div>
            <div className="impact-subtitle">virtual participants per instance</div>
          </div>
        </div>
        
        {/* Supervision Multiplier Chart */}
        <div className="finance-chart-container large">
          <h3>Supervision Multiplier Financial Impact</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={[
                {
                  name: 'Without Multipliers',
                  value: masterCards.reduce((sum, card) => {
                    // Calculate revenue without multipliers
                    const participantCount = card.participant_count || 0;
                    const avgRevenue = card.financials?.revenue / (card.virtual_participant_count || participantCount);
                    return sum + (avgRevenue * participantCount);
                  }, 0)
                },
                {
                  name: 'With Multipliers',
                  value: masterCards.reduce((sum, card) => sum + (card.financials?.revenue || 0), 0)
                }
              ]}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="value" name="Revenue" fill="#4287f5">
                <Cell fill="#82ca9d" />
                <Cell fill="#8884d8" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Participants with Supervision Multipliers */}
        <div className="finance-table-container">
          <h3>Participants with Supervision Multipliers</h3>
          <table className="finance-table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Multiplier</th>
                <th>Events Attended</th>
                <th>Revenue Impact</th>
              </tr>
            </thead>
            <tbody>
              {/* This would be populated with real data from the API */}
              <tr>
                <td>John D.</td>
                <td>1.5x</td>
                <td>12</td>
                <td>{formatCurrency(1250)}</td>
              </tr>
              <tr>
                <td>Sarah M.</td>
                <td>2.0x</td>
                <td>8</td>
                <td>{formatCurrency(1800)}</td>
              </tr>
              <tr>
                <td>Michael R.</td>
                <td>1.75x</td>
                <td>15</td>
                <td>{formatCurrency(2100)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render master card details modal
  const renderMasterCardModal = () => {
    if (!selectedMasterCard) return null;
    
    return (
      <div className="finance-modal">
        <div className="finance-modal-content">
          <div className="finance-modal-header">
            <h2>Master Card Details</h2>
            <button className="close-button" onClick={() => setSelectedMasterCard(null)}>×</button>
          </div>
          
          <div className="finance-modal-body">
            <div className="master-card-details">
              <div className="master-card-header">
                <h3>{selectedMasterCard.program_name || 'Unknown Program'}</h3>
                <p className="master-card-date">
                  {format(parseISO(selectedMasterCard.date), 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="master-card-time">
                  {selectedMasterCard.start_time} - {selectedMasterCard.end_time}
                </p>
              </div>
              
              <div className="master-card-financials">
                <div className="financial-row">
                  <div className="financial-item">
                    <span className="financial-label">Revenue</span>
                    <span className="financial-value">
                      {formatCurrency(selectedMasterCard.financials?.revenue || 0)}
                    </span>
                  </div>
                  <div className="financial-item">
                    <span className="financial-label">Staff Costs</span>
                    <span className="financial-value">
                      {formatCurrency(selectedMasterCard.financials?.staffCosts || 0)}
                    </span>
                  </div>
                </div>
                
                <div className="financial-row">
                  <div className="financial-item">
                    <span className="financial-label">Admin Costs</span>
                    <span className="financial-value">
                      {formatCurrency(selectedMasterCard.financials?.adminCosts || 0)}
                    </span>
                  </div>
                  <div className="financial-item">
                    <span className="financial-label">Raw P&L</span>
                    <span className={`financial-value ${selectedMasterCard.financials?.rawProfitLoss >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(selectedMasterCard.financials?.rawProfitLoss || 0)}
                    </span>
                  </div>
                </div>
                
                <div className="financial-row">
                  <div className="financial-item large">
                    <span className="financial-label">Net Profit/Loss</span>
                    <span className={`financial-value large ${selectedMasterCard.financials?.profitLoss >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(selectedMasterCard.financials?.profitLoss || 0)}
                    </span>
                  </div>
                  <div className="financial-item">
                    <span className="financial-label">Margin</span>
                    <span className={`financial-value ${selectedMasterCard.financials?.profitMargin >= 0 ? 'positive' : 'negative'}`}>
                      {formatPercentage(selectedMasterCard.financials?.profitMargin || 0)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="master-card-details-section">
                <h4>Participants</h4>
                <div className="details-grid">
                  <div className="details-item">
                    <span className="details-label">Actual Count</span>
                    <span className="details-value">{selectedMasterCard.participant_count || 0}</span>
                  </div>
                  <div className="details-item">
                    <span className="details-label">Virtual Count</span>
                    <span className="details-value">{selectedMasterCard.virtual_participant_count || selectedMasterCard.participant_count || 0}</span>
                  </div>
                  <div className="details-item">
                    <span className="details-label">Multiplier Effect</span>
                    <span className="details-value">
                      {selectedMasterCard.virtual_participant_count && selectedMasterCard.participant_count
                        ? `+${(selectedMasterCard.virtual_participant_count - selectedMasterCard.participant_count).toFixed(2)}`
                        : '+0.00'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="master-card-details-section">
                <h4>Staff</h4>
                <table className="details-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>SCHADS</th>
                      <th>Hours</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMasterCard.staff_assignments ? (
                      selectedMasterCard.staff_assignments.map((staff, index) => (
                        <tr key={index}>
                          <td>{staff.name || `Staff #${staff.staff_id}`}</td>
                          <td>Level {staff.schads_level || 'N/A'}</td>
                          <td>{staff.hours?.toFixed(1) || 0}</td>
                          <td>{formatCurrency(staff.cost || 0)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4">No staff assignments</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render export modal
  const renderExportModal = () => {
    if (!showExportModal) return null;
    
    return (
      <div className="finance-modal">
        <div className="finance-modal-content">
          <div className="finance-modal-header">
            <h2>Export Data</h2>
            <button className="close-button" onClick={() => setShowExportModal(false)}>×</button>
          </div>
          
          <div className="finance-modal-body">
            <div className="export-options">
              <div className="export-option">
                <label>Export Type</label>
                <select value={exportType} onChange={(e) => setExportType(e.target.value)}>
                  <option value="timesheets">Timesheets</option>
                  <option value="billing">Agency Billing</option>
                  <option value="invoices">Plan-Managed Invoices</option>
                </select>
              </div>
              
              {exportType === 'timesheets' && (
                <div className="export-option">
                  <label>Format</label>
                  <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                    <option value="xero">Xero</option>
                    <option value="myob">MYOB</option>
                    <option value="csv">Standard CSV</option>
                  </select>
                </div>
              )}
              
              <div className="export-option">
                <label>Date Range</label>
                <div className="date-range-inputs">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="export-actions">
              <button className="primary-button" onClick={handleExport}>
                Export
              </button>
              <button className="secondary-button" onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="finance-dashboard">
      {/* Header */}
      <div className="finance-header">
        <div className="finance-title">
          <h1>Financial Intelligence Dashboard</h1>
          <p className="finance-subtitle">
            Comprehensive financial analytics for disability services
          </p>
        </div>
        
        <div className="finance-actions">
          <button 
            className="export-button"
            onClick={() => setShowExportModal(true)}
          >
            Export Data
          </button>
        </div>
      </div>
      
      {/* Period Selection */}
      <div className="finance-period-selector">
        <div className="period-tabs">
          <button 
            className={activePeriod === 'day' && !customDateRange ? 'active' : ''} 
            onClick={() => { setActivePeriod('day'); setCustomDateRange(false); }}
          >
            Day
          </button>
          <button 
            className={activePeriod === 'week' && !customDateRange ? 'active' : ''} 
            onClick={() => { setActivePeriod('week'); setCustomDateRange(false); }}
          >
            Week
          </button>
          <button 
            className={activePeriod === 'fortnight' && !customDateRange ? 'active' : ''} 
            onClick={() => { setActivePeriod('fortnight'); setCustomDateRange(false); }}
          >
            Fortnight
          </button>
          <button 
            className={activePeriod === 'month' && !customDateRange ? 'active' : ''} 
            onClick={() => { setActivePeriod('month'); setCustomDateRange(false); }}
          >
            Month
          </button>
          <button 
            className={customDateRange ? 'active' : ''} 
            onClick={() => setCustomDateRange(true)}
          >
            Custom
          </button>
        </div>
        
        {customDateRange && (
          <div className="custom-date-range">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <button onClick={() => fetchFinancials()}>Apply</button>
          </div>
        )}
        
        <div className="date-display">
          {format(parseISO(startDate), 'MMMM d, yyyy')}
          {startDate !== endDate && ` - ${format(parseISO(endDate), 'MMMM d, yyyy')}`}
        </div>
      </div>
      
      {/* Navigation Tabs */}
      <div className="finance-tabs">
        <button 
          className={activeTab === 'overview' ? 'active' : ''} 
          onClick={() => setActiveTab('overview')}
        >
          Financial Overview
        </button>
        <button 
          className={activeTab === 'revenue' ? 'active' : ''} 
          onClick={() => setActiveTab('revenue')}
        >
          Revenue Analysis
        </button>
        <button 
          className={activeTab === 'staff' ? 'active' : ''} 
          onClick={() => setActiveTab('staff')}
        >
          Staff Costs
        </button>
        <button 
          className={activeTab === 'supervision' ? 'active' : ''} 
          onClick={() => setActiveTab('supervision')}
        >
          Supervision Multipliers
        </button>
      </div>
      
      {/* Content Area */}
      <div className="finance-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'revenue' && renderRevenueTab()}
        {activeTab === 'staff' && renderStaffCostsTab()}
        {activeTab === 'supervision' && renderSupervisionTab()}
      </div>
      
      {/* Modals */}
      {renderMasterCardModal()}
      {renderExportModal()}
    </div>
  );
};

export default Finance;
