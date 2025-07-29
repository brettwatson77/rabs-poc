import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import axios from 'axios';
import MasterCard from '../components/MasterCard';
import Modal from '../components/Modal';
import { formatDateForApi } from '../utils/dateUtils';
import '../styles/MasterSchedule.css';

/**
 * Revolutionary Master Schedule page
 * Timeline-based schedule management with financial intelligence,
 * supervision multiplier planning, and SCHADS cost analysis
 */
const MasterSchedule = () => {
  const { simulatedDate, setSimulatedDate } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scheduleData, setScheduleData] = useState([]);
  
  // Financial metrics
  const [financialMetrics, setFinancialMetrics] = useState({
    weekly: { revenue: 0, staffCosts: 0, adminCosts: 0, profitLoss: 0, profitMargin: 0 },
    fortnightly: { revenue: 0, staffCosts: 0, adminCosts: 0, profitLoss: 0, profitMargin: 0 }
  });
  
  // Staff utilization metrics
  const [staffMetrics, setStaffMetrics] = useState({
    totalStaff: 0,
    totalHours: 0,
    utilization: 0,
    schadsBreakdown: {}
  });
  
  // Supervision metrics
  const [supervisionMetrics, setSupervisionMetrics] = useState({
    totalParticipants: 0,
    avgSupervisionMultiplier: 1.0,
    totalSupervisionLoad: 0,
    highSupportHours: 0
  });
  
  // Modal states
  const [showCardModal, setShowCardModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFinancialModal, setShowFinancialModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  
  // Week navigation
  const [currentWeekStart, setCurrentWeekStart] = useState(null);
  const [weekDays, setWeekDays] = useState([]);
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'fortnight'
  
  // Calculate week dates based on simulatedDate
  useEffect(() => {
    // Get Monday of current week
    const dayOfWeek = simulatedDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(simulatedDate);
    monday.setDate(simulatedDate.getDate() + diffToMonday);
    setCurrentWeekStart(monday);
    
    // Generate array of dates for the week/fortnight
    const daysToShow = viewMode === 'week' ? 7 : 14;
    const days = Array.from({ length: daysToShow }, (_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      return day;
    });
    
    setWeekDays(days);
  }, [simulatedDate, viewMode]);
  
  // Fetch schedule data
  const fetchScheduleData = async () => {
    if (!currentWeekStart) return;
    
    setLoading(true);
    try {
      const endDate = new Date(currentWeekStart);
      endDate.setDate(currentWeekStart.getDate() + (viewMode === 'week' ? 6 : 13));
      
      const response = await axios.get('/api/v1/cards/master', {
        params: {
          start: formatDateForApi(currentWeekStart),
          end: formatDateForApi(endDate)
        }
      });
      
      if (response.data && response.data.success) {
        setScheduleData(response.data.data);
      } else {
        throw new Error('Failed to fetch schedule data');
      }
    } catch (err) {
      console.error('Error fetching schedule data:', err);
      setError('Failed to load schedule. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch financial metrics
  const fetchFinancialMetrics = async () => {
    if (!currentWeekStart) return;
    
    try {
      const response = await axios.get('/api/v1/dashboard/financials', {
        params: {
          start: formatDateForApi(currentWeekStart),
          period: viewMode
        }
      });
      
      if (response.data && response.data.success) {
        setFinancialMetrics(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching financial metrics:', err);
    }
  };
  
  // Placeholder fetches for staff & supervision metrics (backend endpoints pending)
  const fetchStaffMetrics = () => {};      // TODO: implement when API available
  const fetchSupervisionMetrics = () => {}; // TODO: implement when API available
  
  // Load data when week changes
  useEffect(() => {
    if (currentWeekStart) {
      fetchScheduleData();
      fetchFinancialMetrics();
      // Metrics endpoints not yet implemented
    }
  }, [currentWeekStart, viewMode]);
  
  // Handle week navigation
  const handlePrevPeriod = () => {
    const newDate = new Date(simulatedDate);
    newDate.setDate(simulatedDate.getDate() - (viewMode === 'week' ? 7 : 14));
    setSimulatedDate(newDate);
  };
  
  const handleNextPeriod = () => {
    const newDate = new Date(simulatedDate);
    newDate.setDate(simulatedDate.getDate() + (viewMode === 'week' ? 7 : 14));
    setSimulatedDate(newDate);
  };
  
  // Handle card click
  const handleCardClick = (card) => {
    setSelectedCard(card);
    setShowCardModal(true);
  };
  
  // Handle day click for creating new event
  const handleDayClick = (day) => {
    setSelectedDay(day);
    setShowCreateModal(true);
  };
  
  // Handle create new master card
  const handleCreateMasterCard = async (formData) => {
    try {
      const response = await axios.post('/api/v1/schedule/master-card', formData);
      
      if (response.data && response.data.success) {
        setShowCreateModal(false);
        fetchScheduleData(); // Refresh data
      } else {
        throw new Error('Failed to create master card');
      }
    } catch (err) {
      console.error('Error creating master card:', err);
      alert('Failed to create master card. Please try again.');
    }
  };
  
  // Handle edit master card
  const handleEditMasterCard = async (cardId, formData) => {
    try {
      const response = await axios.put(`/api/v1/schedule/master-card/${cardId}`, formData);
      
      if (response.data && response.data.success) {
        setShowCardModal(false);
        fetchScheduleData(); // Refresh data
      } else {
        throw new Error('Failed to update master card');
      }
    } catch (err) {
      console.error('Error updating master card:', err);
      alert('Failed to update master card. Please try again.');
    }
  };
  
  // Handle delete master card
  const handleDeleteMasterCard = async (cardId) => {
    if (!window.confirm('Are you sure you want to delete this master card?')) {
      return;
    }
    
    try {
      const response = await axios.delete(`/api/v1/schedule/master-card/${cardId}`);
      
      if (response.data && response.data.success) {
        setShowCardModal(false);
        fetchScheduleData(); // Refresh data
      } else {
        throw new Error('Failed to delete master card');
      }
    } catch (err) {
      console.error('Error deleting master card:', err);
      alert('Failed to delete master card. Please try again.');
    }
  };
  
  // Handle optimize resources
  const handleOptimizeResources = async (cardId) => {
    try {
      const response = await axios.post(`/api/v1/schedule/optimize/${cardId}`);
      
      if (response.data && response.data.success) {
        alert('Resources optimized successfully!');
        fetchScheduleData(); // Refresh data
      } else {
        throw new Error('Failed to optimize resources');
      }
    } catch (err) {
      console.error('Error optimizing resources:', err);
      alert('Failed to optimize resources. Please try again.');
    }
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
  
  // Group cards by day
  const getCardsForDay = (day) => {
    const dateStr = formatDateForApi(day);
    return scheduleData.filter(card => card.date === dateStr);
  };
  
  // Format day header
  const formatDayHeader = (day) => {
    const isToday = day.toDateString() === new Date().toDateString();
    const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = day.getDate();
    
    return (
      <div className={`day-header ${isToday ? 'today' : ''}`}>
        <div className="day-name">{dayName}</div>
        <div className="day-number">{dayNum}</div>
      </div>
    );
  };
  
  // Calculate period display string
  const getPeriodDisplayString = () => {
    if (!currentWeekStart) return '';
    
    const periodEnd = new Date(currentWeekStart);
    periodEnd.setDate(currentWeekStart.getDate() + (viewMode === 'week' ? 6 : 13));
    
    const startStr = currentWeekStart.toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short'
    });
    
    const endStr = periodEnd.toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
    
    return `${startStr} - ${endStr}`;
  };
  
  return (
    <div className="master-schedule-container">
      <div className="schedule-header">
        <div className="schedule-title">
          <h1>Master Schedule</h1>
          <p className="schedule-subtitle">
            Command center for program planning and resource optimization
          </p>
        </div>
        
        <div className="schedule-actions">
          <button 
            className="action-button create-button" 
            onClick={() => setShowCreateModal(true)}
          >
            <span className="button-icon">➕</span>
            Create Master Card
          </button>
          
          <button 
            className="action-button financial-button" 
            onClick={() => setShowFinancialModal(true)}
          >
            <span className="button-icon">💰</span>
            Financial Projections
          </button>
          
          <div className="view-toggle">
            <button 
              className={`toggle-button ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
            <button 
              className={`toggle-button ${viewMode === 'fortnight' ? 'active' : ''}`}
              onClick={() => setViewMode('fortnight')}
            >
              Fortnight
            </button>
          </div>
        </div>
      </div>
      
      {/* Period Navigation */}
      <div className="period-navigation">
        <button className="nav-button" onClick={handlePrevPeriod}>
          &lt; Previous {viewMode === 'week' ? 'Week' : 'Fortnight'}
        </button>
        <h2 className="period-display">{getPeriodDisplayString()}</h2>
        <button className="nav-button" onClick={handleNextPeriod}>
          Next {viewMode === 'week' ? 'Week' : 'Fortnight'} &gt;
        </button>
      </div>
      
      {/* Metrics Dashboard */}
      <div className="schedule-metrics">
        <div className="metric-card revenue-card">
          <h3>Projected Revenue</h3>
          <div className="metric-value">
            {formatCurrency(
              viewMode === 'week'
                ? (financialMetrics.weekly?.revenue ?? 0)
                : (financialMetrics.fortnightly?.revenue ?? 0)
            )}
          </div>
          <div className="metric-label">{viewMode === 'week' ? 'This Week' : 'This Fortnight'}</div>
        </div>
        
        <div className="metric-card profit-card">
          <h3>Projected Profit</h3>
          <div className="metric-value">
            {formatCurrency(
              viewMode === 'week'
                ? (financialMetrics.weekly?.profitLoss ?? 0)
                : (financialMetrics.fortnightly?.profitLoss ?? 0)
            )}
            <span className="profit-percent">
              {formatPercent(
                viewMode === 'week'
                  ? (financialMetrics.weekly?.profitMargin ?? 0)
                  : (financialMetrics.fortnightly?.profitMargin ?? 0)
              )}
            </span>
          </div>
          <div className="metric-label">After 18% Admin</div>
        </div>
        
        <div className="metric-card staff-card">
          <h3>Staff Utilization</h3>
          <div className="metric-value">
            {staffMetrics.utilization}%
            <span className="staff-hours">{staffMetrics.totalHours}h</span>
          </div>
          <div className="metric-label">{staffMetrics.totalStaff} Staff Members</div>
        </div>
        
        <div className="metric-card supervision-card">
          <h3>Supervision Load</h3>
          <div className="metric-value">
            {supervisionMetrics.totalSupervisionLoad.toFixed(1)}
            <span className="multiplier-badge">
              {supervisionMetrics.avgSupervisionMultiplier.toFixed(2)}x
            </span>
          </div>
          <div className="metric-label">{supervisionMetrics.totalParticipants} Participants</div>
        </div>
      </div>
      
      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading master schedule...</p>
        </div>
      )}
      
      {error && (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchScheduleData}>Retry</button>
        </div>
      )}
      
      {!loading && !error && (
        <div className="schedule-timeline">
          {weekDays.map((day, index) => (
            <div 
              key={index} 
              className="day-column"
              onClick={() => handleDayClick(day)}
            >
              {formatDayHeader(day)}
              
              <div className="day-cards">
                {getCardsForDay(day).length > 0 ? (
                  getCardsForDay(day).map((card) => (
                    <div 
                      key={card.id} 
                      className="schedule-card-container"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(card);
                      }}
                    >
                      <MasterCard 
                        card={card} 
                        onClick={(cardData) => handleCardClick(cardData)}
                        columnType="schedule"
                      />
                    </div>
                  ))
                ) : (
                  <div className="empty-day-message">
                    <span>Click to add</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* SCHADS Cost Analysis */}
      <div className="schads-analysis">
        <h3>SCHADS Cost Analysis</h3>
        <div className="schads-breakdown">
          {Object.entries(staffMetrics.schadsBreakdown || {}).map(([level, data], index) => (
            <div key={index} className="schads-level">
              <div className="schads-header">
                <span className="schads-title">Level {level}</span>
                <span className="schads-rate">{formatCurrency(data.hourlyRate)}/hr</span>
              </div>
              <div className="schads-bar-container">
                <div 
                  className="schads-bar" 
                  style={{ width: `${(data.hours / staffMetrics.totalHours) * 100}%` }}
                ></div>
              </div>
              <div className="schads-details">
                <span>{data.hours} hours</span>
                <span>{data.count} staff</span>
                <span>{formatCurrency(data.totalCost)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="schedule-legend">
        <div className="legend-item">
          <div className="legend-color master-color"></div>
          <span>Master Program</span>
        </div>
        <div className="legend-item">
          <div className="legend-color pickup-color"></div>
          <span>Pickup Run</span>
        </div>
        <div className="legend-item">
          <div className="legend-color dropoff-color"></div>
          <span>Dropoff Run</span>
        </div>
        <div className="legend-item">
          <div className="legend-color activity-color"></div>
          <span>Activity</span>
        </div>
        <div className="legend-item">
          <div className="legend-color roster-color"></div>
          <span>Roster</span>
        </div>
      </div>
      
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
              <>
                <button 
                  className="optimize-button"
                  onClick={() => handleOptimizeResources(selectedCard.id)}
                >
                  Optimize Resources
                </button>
                <button 
                  className="edit-button"
                  onClick={() => {
                    // Would open edit form in real implementation
                    alert('Edit functionality would open a form in a real implementation');
                  }}
                >
                  Edit Event
                </button>
                <button 
                  className="delete-button"
                  onClick={() => handleDeleteMasterCard(selectedCard.id)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
      
      {/* Create Master Card Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} className="create-modal">
          <div className="create-modal-header">
            <h2>Create Master Card</h2>
            <p className="create-modal-date">
              {selectedDay?.toLocaleDateString('en-AU', { 
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
          
          <div className="create-modal-body">
            <div className="create-form">
              <div className="form-group">
                <label htmlFor="title">Event Title</label>
                <input type="text" id="title" placeholder="Enter event title" />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="startTime">Start Time</label>
                  <input type="time" id="startTime" defaultValue="09:00" />
                </div>
                
                <div className="form-group">
                  <label htmlFor="endTime">End Time</label>
                  <input type="time" id="endTime" defaultValue="15:00" />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="programType">Program Type</label>
                <select id="programType">
                  <option value="centre-based">Centre-based Program</option>
                  <option value="community">Community Access</option>
                  <option value="bowling">Bowling Night</option>
                  <option value="spin-win">Spin & Win</option>
                  <option value="adventure">Saturday Adventure</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="venue">Venue</label>
                <select id="venue">
                  <option value="">Select a venue...</option>
                  <option value="1">Main Centre</option>
                  <option value="2">Community Hall</option>
                  <option value="3">Bowling Alley</option>
                  <option value="4">Adventure Park</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Participants</label>
                <div className="participant-selector">
                  <div className="participant-search">
                    <input type="text" placeholder="Search participants..." />
                    <button className="search-button">Search</button>
                  </div>
                  
                  <div className="participant-options">
                    <div className="participant-option">
                      <input type="checkbox" id="participant1" />
                      <label htmlFor="participant1">John Smith (1.5x)</label>
                    </div>
                    <div className="participant-option">
                      <input type="checkbox" id="participant2" />
                      <label htmlFor="participant2">Sarah Johnson (1.0x)</label>
                    </div>
                    <div className="participant-option">
                      <input type="checkbox" id="participant3" />
                      <label htmlFor="participant3">Michael Brown (2.0x)</label>
                    </div>
                    <div className="participant-option">
                      <input type="checkbox" id="participant4" />
                      <label htmlFor="participant4">Emma Wilson (1.25x)</label>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="form-group">
                <label>Transport Options</label>
                <div className="transport-options">
                  <div className="transport-option">
                    <input type="checkbox" id="pickupRequired" />
                    <label htmlFor="pickupRequired">Pickup Required</label>
                  </div>
                  <div className="transport-option">
                    <input type="checkbox" id="dropoffRequired" />
                    <label htmlFor="dropoffRequired">Dropoff Required</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="create-modal-footer">
            <button onClick={() => setShowCreateModal(false)}>Cancel</button>
            <button 
              className="create-button"
              onClick={() => {
                // Would submit form in real implementation
                alert('Create functionality would submit the form in a real implementation');
                setShowCreateModal(false);
              }}
            >
              Create Master Card
            </button>
          </div>
        </Modal>
      )}
      
      {/* Financial Projections Modal */}
      {showFinancialModal && (
        <Modal onClose={() => setShowFinancialModal(false)} className="financial-modal">
          <div className="financial-modal-header">
            <h2>Financial Projections</h2>
            <p>{getPeriodDisplayString()}</p>
          </div>
          
          <div className="financial-modal-body">
            <div className="financial-period-tabs">
              <button className="period-tab active">Week</button>
              <button className="period-tab">Fortnight</button>
            </div>
            
            <div className="financial-metrics-grid">
              <div className="financial-period-panel active">
                <div className="financial-metric-row">
                  <div className="financial-metric">
                    <h3>Revenue</h3>
                    <div className="financial-value revenue">
                      {formatCurrency(financialMetrics.weekly.revenue)}
                    </div>
                  </div>
                  
                  <div className="financial-metric">
                    <h3>Staff Costs</h3>
                    <div className="financial-value cost">
                      {formatCurrency(financialMetrics.weekly.staffCosts)}
                    </div>
                  </div>
                  
                  <div className="financial-metric">
                    <h3>Admin Costs</h3>
                    <div className="financial-value admin-cost">
                      {formatCurrency(financialMetrics.weekly.adminCosts)}
                      <span className="admin-percent">18%</span>
                    </div>
                  </div>
                  
                  <div className="financial-metric">
                    <h3>Profit/Loss</h3>
                    <div className={`financial-value ${financialMetrics.weekly.profitLoss >= 0 ? 'profit' : 'loss'}`}>
                      {formatCurrency(financialMetrics.weekly.profitLoss)}
                      <span className="profit-percent">{formatPercent(financialMetrics.weekly.profitMargin)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="financial-chart-container">
                  <div className="chart-placeholder">
                    <p>Weekly P&L Visualization</p>
                    <div className="profit-bar-container">
                      <div 
                        className="revenue-bar" 
                        style={{ width: '100%' }}
                      ></div>
                      <div 
                        className="staff-cost-bar" 
                        style={{ width: `${(financialMetrics.weekly.staffCosts / financialMetrics.weekly.revenue) * 100}%` }}
                      ></div>
                      <div 
                        className="admin-cost-bar" 
                        style={{ width: `${(financialMetrics.weekly.adminCosts / financialMetrics.weekly.revenue) * 100}%` }}
                      ></div>
                      <div 
                        className="profit-bar" 
                        style={{ width: `${(financialMetrics.weekly.profitLoss / financialMetrics.weekly.revenue) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                
                {/* Daily Breakdown */}
                <div className="daily-breakdown">
                  <h3>Daily Financial Breakdown</h3>
                  <table className="breakdown-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Revenue</th>
                        <th>Staff Cost</th>
                        <th>Admin</th>
                        <th>Profit/Loss</th>
                        <th>Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weekDays.slice(0, 7).map((day, index) => (
                        <tr key={index}>
                          <td>{day.toLocaleDateString('en-US', { weekday: 'short' })}</td>
                          <td>{formatCurrency(1200 + Math.random() * 800)}</td>
                          <td>{formatCurrency(600 + Math.random() * 400)}</td>
                          <td>{formatCurrency(200 + Math.random() * 100)}</td>
                          <td>{formatCurrency(300 + Math.random() * 300)}</td>
                          <td>{formatPercent(20 + Math.random() * 15)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

export default MasterSchedule;
