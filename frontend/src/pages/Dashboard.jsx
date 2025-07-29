import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import axios from 'axios';
import TimelineColumn from '../components/TimelineColumn';
import MasterCard from '../components/MasterCard';
import Modal from '../components/Modal';
import { formatDateForApi } from '../utils/dateUtils';
import '../styles/Dashboard.css';

/**
 * Revolutionary Dashboard with 5-column timeline, financial metrics,
 * supervision multipliers, and TGL architecture integration
 */
const Dashboard = () => {
  const { simulatedDate } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showFinancialModal, setShowFinancialModal] = useState(false);
  
  // Timeline data
  const [timelineData, setTimelineData] = useState({
    earlier: [],
    before: [],
    now: [],
    next: [],
    later: []
  });
  
  // Financial metrics
  const [financialMetrics, setFinancialMetrics] = useState({
    daily: { revenue: 0, staffCosts: 0, adminCosts: 0, profitLoss: 0, profitMargin: 0 },
    weekly: { revenue: 0, staffCosts: 0, adminCosts: 0, profitLoss: 0, profitMargin: 0 },
    fortnightly: { revenue: 0, staffCosts: 0, adminCosts: 0, profitLoss: 0, profitMargin: 0 },
    monthly: { revenue: 0, staffCosts: 0, adminCosts: 0, profitLoss: 0, profitMargin: 0 }
  });
  
  // Dashboard metrics
  const [dashboardMetrics, setDashboardMetrics] = useState({
    totalParticipants: 0,
    totalServiceHours: 0,
    totalRevenue: 0,
    totalPrograms: 0,
    staffUtilization: 0,
    vehiclesInUse: 0,
    supervisionLoad: 0,
    avgSupervisionMultiplier: 1.0
  });

  // Fetch timeline data
  const fetchTimelineData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/v1/dashboard/timeline', {
        params: { date: formatDateForApi(simulatedDate) }
      });
      
      if (response.data && response.data.success) {
        setTimelineData(response.data.data);
      } else {
        throw new Error('Failed to fetch timeline data');
      }
    } catch (err) {
      console.error('Error fetching timeline data:', err);
      setError('Failed to load timeline. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch financial metrics
  const fetchFinancialMetrics = async () => {
    try {
      const response = await axios.get('/api/v1/dashboard/financials/all', {
        params: { date: formatDateForApi(simulatedDate) }
      });
      
      if (response.data && response.data.success) {
        setFinancialMetrics(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching financial metrics:', err);
    }
  };

  // Fetch dashboard metrics
  const fetchDashboardMetrics = async () => {
    try {
      const response = await axios.get('/api/v1/dashboard/metrics', {
        params: { date: formatDateForApi(simulatedDate) }
      });
      
      if (response.data && response.data.success) {
        setDashboardMetrics(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
    }
  };

  // Initial data load and when simulated date changes
  useEffect(() => {
    fetchTimelineData();
    fetchFinancialMetrics();
    fetchDashboardMetrics();
    
    // Set up auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchTimelineData();
      fetchDashboardMetrics();
    }, 30000);
    
    return () => clearInterval(refreshInterval);
  }, [simulatedDate]);

  // Handle card click
  const handleCardClick = (card) => {
    setSelectedCard(card);
    setShowCardModal(true);
  };

  // Format currency values
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Format percentage values
  const formatPercent = (value) => {
    return `${Math.round(value)}%`;
  };
  
  // Handle timesheet export
  const handleTimesheetExport = async () => {
    try {
      const response = await axios.get('/api/v1/dashboard/timesheets', {
        params: { date: formatDateForApi(simulatedDate) },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `timesheets-${formatDateForApi(simulatedDate)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting timesheets:', err);
      alert('Failed to export timesheets. Some staff may not have completed their shift notes.');
    }
  };
  
  // Handle supervision stats
  const handleViewSupervisionStats = async () => {
    try {
      const response = await axios.get('/api/v1/dashboard/supervision-stats', {
        params: { date: formatDateForApi(simulatedDate) }
      });
      
      if (response.data && response.data.success) {
        // Show supervision stats modal (would be implemented in a real app)
        alert(`Total supervision load: ${response.data.data.totalLoad.toFixed(1)}\nAverage multiplier: ${response.data.data.avgMultiplier.toFixed(2)}x`);
      }
    } catch (err) {
      console.error('Error fetching supervision stats:', err);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h1>RABS Command Center</h1>
          <p className="dashboard-date">
            {simulatedDate.toLocaleDateString('en-AU', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        
        <div className="dashboard-actions">
          <button 
            className="action-button timesheet-button" 
            onClick={handleTimesheetExport}
            title="Export timesheets to Xero CSV format"
          >
            <span className="button-icon">📊</span>
            Export Timesheets
          </button>
          
          <button 
            className="action-button financial-button" 
            onClick={() => setShowFinancialModal(true)}
            title="View detailed financial breakdown"
          >
            <span className="button-icon">💰</span>
            Financial Dashboard
          </button>
          
          <button 
            className="action-button supervision-button" 
            onClick={handleViewSupervisionStats}
            title="View supervision multiplier statistics"
          >
            <span className="button-icon">👥</span>
            Supervision Stats
          </button>
        </div>
      </div>
      
      {/* KPI Metrics Dashboard */}
      <div className="metrics-dashboard">
        <div className="metric-card">
          <h3>Participants</h3>
          <div className="metric-value">{dashboardMetrics.totalParticipants}</div>
          <div className="metric-label">Active Today</div>
        </div>
        
        <div className="metric-card">
          <h3>Service Hours</h3>
          <div className="metric-value">{dashboardMetrics.totalServiceHours}</div>
          <div className="metric-label">Total Hours</div>
        </div>
        
        <div className="metric-card revenue-card">
          <h3>Revenue</h3>
          <div className="metric-value">{formatCurrency(dashboardMetrics.totalRevenue)}</div>
          <div className="metric-label">Today's Total</div>
        </div>
        
        <div className="metric-card profit-card">
          <h3>Profit</h3>
          <div className="metric-value">
            {formatCurrency((financialMetrics.daily?.profitLoss ?? 0))}
            <span className="profit-percent">
              {formatPercent((financialMetrics.daily?.profitMargin ?? 0))}
            </span>
          </div>
          <div className="metric-label">After 18% Admin</div>
        </div>
        
        <div className="metric-card supervision-card">
          <h3>Supervision</h3>
          <div className="metric-value">
            {(dashboardMetrics.supervisionLoad ?? 0).toFixed(1)}
            <span className="multiplier-badge" title="Average multiplier">
              {(dashboardMetrics.avgSupervisionMultiplier ?? 1.0).toFixed(2)}x
            </span>
          </div>
          <div className="metric-label">Virtual Load</div>
        </div>
      </div>
      
      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading revolutionary dashboard...</p>
        </div>
      )}
      
      {error && (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchTimelineData}>Retry</button>
        </div>
      )}
      
      {!loading && !error && (
        <div className="timeline-container">
          <TimelineColumn 
            columnType="earlier"
            columnLabel="EARLIER"
            cards={timelineData.earlier}
            onCardClick={handleCardClick}
          />
          
          <TimelineColumn 
            columnType="before"
            columnLabel="BEFORE"
            cards={timelineData.before}
            onCardClick={handleCardClick}
          />
          
          <TimelineColumn 
            columnType="now"
            columnLabel="NOW"
            cards={timelineData.now}
            onCardClick={handleCardClick}
            isActive={true}
          />
          
          <TimelineColumn 
            columnType="next"
            columnLabel="NEXT"
            cards={timelineData.next}
            onCardClick={handleCardClick}
          />
          
          <TimelineColumn 
            columnType="later"
            columnLabel="LATER"
            cards={timelineData.later}
            onCardClick={handleCardClick}
          />
        </div>
      )}
      
      {/* Master Card Modal */}
      {showCardModal && selectedCard && (
        <Modal onClose={() => setShowCardModal(false)} className="card-detail-modal">
          <div className="card-detail-header">
            <h2>{selectedCard.title}</h2>
            <p className="card-detail-time">
              {selectedCard.startTime} - {selectedCard.endTime}
            </p>
          </div>
          
          <div className="card-detail-body">
            {/* Participant Section */}
            <div className="card-detail-section">
              <h3>Participants</h3>
              <div className="participants-list">
                {selectedCard.participants?.map(participant => (
                  <div key={participant.id} className="participant-item">
                    <span className="participant-name">
                      {participant.first_name} {participant.last_name}
                    </span>
                    {participant.supervision_multiplier > 1 && (
                      <span 
                        className={`supervision-tag multiplier-${Math.floor(participant.supervision_multiplier * 4)}`}
                        title="Supervision multiplier"
                      >
                        {participant.supervision_multiplier}x
                      </span>
                    )}
                    {participant.pickup_required && <span className="pickup-tag">Pickup</span>}
                    {participant.dropoff_required && <span className="dropoff-tag">Dropoff</span>}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Staff Section */}
            <div className="card-detail-section">
              <h3>Staff</h3>
              <div className="staff-list">
                {selectedCard.staff?.map(staff => (
                  <div key={staff.id} className="staff-item">
                    <span className="staff-name">
                      {staff.first_name} {staff.last_name}
                    </span>
                    <span className="staff-role">{staff.role}</span>
                    <span className="schads-level">
                      SCHADS L{staff.schadsLevel} ({formatCurrency(staff.hourlyRate)}/hr)
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Financial Section - Only for MASTER cards */}
            {selectedCard.type === 'MASTER' && selectedCard.financials && (
              <div className="card-detail-section financials-section">
                <h3>Financial Breakdown</h3>
                <table className="financials-table">
                  <tbody>
                    <tr>
                      <td>Revenue</td>
                      <td>{formatCurrency(selectedCard.financials.revenue)}</td>
                    </tr>
                    <tr>
                      <td>Staff Costs</td>
                      <td>{formatCurrency(selectedCard.financials.staffCosts)}</td>
                    </tr>
                    <tr className="admin-row">
                      <td>Admin Costs (18%)</td>
                      <td>{formatCurrency(selectedCard.financials.adminCosts)}</td>
                    </tr>
                    <tr className="profit-row">
                      <td>Profit/Loss</td>
                      <td>
                        {formatCurrency(selectedCard.financials.profitLoss)}
                        <span className="profit-percent">
                          {formatPercent(selectedCard.financials.profitMargin)}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Vehicle Section - For pickup/dropoff */}
            {(selectedCard.type === 'pickup' || selectedCard.type === 'dropoff') && selectedCard.vehicle && (
              <div className="card-detail-section">
                <h3>Vehicle</h3>
                <div className="vehicle-details">
                  <p>
                    <strong>{selectedCard.vehicle.description}</strong> ({selectedCard.vehicle.registration})
                  </p>
                  <p>Capacity: {selectedCard.vehicle.seats} seats</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="card-detail-footer">
            <button onClick={() => setShowCardModal(false)}>Close</button>
            {selectedCard.type === 'MASTER' && (
              <button className="edit-button">Edit Event</button>
            )}
          </div>
        </Modal>
      )}
      
      {/* Financial Dashboard Modal */}
      {showFinancialModal && (
        <Modal onClose={() => setShowFinancialModal(false)} className="financial-modal">
          <div className="financial-modal-header">
            <h2>Financial Dashboard</h2>
            <p>Complete P&L breakdown with 18% primadonna admin rate</p>
          </div>
          
          <div className="financial-modal-body">
            <div className="financial-period-tabs">
              <button className="period-tab active">Day</button>
              <button className="period-tab">Week</button>
              <button className="period-tab">Fortnight</button>
              <button className="period-tab">Month</button>
            </div>
            
            <div className="financial-metrics-grid">
              {/* Daily Financials */}
              <div className="financial-period-panel active">
                <div className="financial-metric-row">
                  <div className="financial-metric">
                    <h3>Revenue</h3>
                    <div className="financial-value revenue">
                      {formatCurrency(financialMetrics.daily.revenue)}
                    </div>
                  </div>
                  
                  <div className="financial-metric">
                    <h3>Staff Costs</h3>
                    <div className="financial-value cost">
                      {formatCurrency(financialMetrics.daily.staffCosts)}
                    </div>
                  </div>
                  
                  <div className="financial-metric">
                    <h3>Admin Costs</h3>
                    <div className="financial-value admin-cost">
                      {formatCurrency(financialMetrics.daily.adminCosts)}
                      <span className="admin-percent">18%</span>
                    </div>
                  </div>
                  
                  <div className="financial-metric">
                    <h3>Profit/Loss</h3>
                    <div className={`financial-value ${financialMetrics.daily.profitLoss >= 0 ? 'profit' : 'loss'}`}>
                      {formatCurrency(financialMetrics.daily.profitLoss)}
                      <span className="profit-percent">{formatPercent(financialMetrics.daily.profitMargin)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="financial-chart-container">
                  <div className="chart-placeholder">
                    <p>Daily P&L Visualization</p>
                    <div className="profit-bar-container">
                      <div 
                        className="revenue-bar" 
                        style={{ width: '100%' }}
                      ></div>
                      <div 
                        className="staff-cost-bar" 
                        style={{ width: `${(financialMetrics.daily.staffCosts / financialMetrics.daily.revenue) * 100}%` }}
                      ></div>
                      <div 
                        className="admin-cost-bar" 
                        style={{ width: `${(financialMetrics.daily.adminCosts / financialMetrics.daily.revenue) * 100}%` }}
                      ></div>
                      <div 
                        className="profit-bar" 
                        style={{ width: `${(financialMetrics.daily.profitLoss / financialMetrics.daily.revenue) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="financial-modal-footer">
            <button onClick={() => setShowFinancialModal(false)}>Close</button>
            <button className="export-button">Export to CSV</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Dashboard;
