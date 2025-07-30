import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import axios from 'axios';
import Modal from '../components/Modal';
import MasterCard from '../components/MasterCard';
import { formatDateForApi } from '../utils/dateUtils';
import '../styles/Roster.css';

/**
 * Revolutionary Roster page with SCHADS integration, timesheet exports,
 * financial intelligence, and supervision multiplier calculations
 */
const Roster = () => {
  const { simulatedDate } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('staff'); // 'staff' or 'schedule'
  const [rosterData, setRosterData] = useState([]);
  const [staffData, setStaffData] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showTimesheetModal, setShowTimesheetModal] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterSchadsLevel, setFilterSchadsLevel] = useState('all');
  const [filterShiftStatus, setFilterShiftStatus] = useState('all');
  const [filterSchedule, setFilterSchedule] = useState('all');
  const [filterStaffMember, setFilterStaffMember] = useState('all');
  const [dateRange, setDateRange] = useState({
    startDate: simulatedDate,
    endDate: new Date(simulatedDate.getTime() + 6 * 24 * 60 * 60 * 1000) // Default to week view
  });
  
  // Financial metrics
  const [financialMetrics, setFinancialMetrics] = useState({
    totalStaffCost: 0,
    averageHourlyRate: 0,
    totalHours: 0,
    staffUtilization: 0,
    schadsBreakdown: {}
  });
  
  // Timesheet data
  const [timesheetData, setTimesheetData] = useState({
    staff: [],
    dateRange: {
      startDate: new Date(),
      endDate: new Date()
    },
    totalHours: 0,
    totalCost: 0,
    pendingShiftNotes: 0
  });
  
  // Fetch roster data
  const fetchRosterData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/v1/roster', {
        params: {
          startDate: formatDateForApi(dateRange.startDate),
          endDate: formatDateForApi(dateRange.endDate)
        }
      });
      
      if (response.data && response.data.success) {
        setRosterData(response.data.data);
      } else {
        throw new Error('Failed to fetch roster data');
      }
    } catch (err) {
      console.error('Error fetching roster data:', err);
      setError('Failed to load roster. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch staff data with SCHADS levels
  const fetchStaffData = async () => {
    try {
      const response = await axios.get('/api/v1/staff/with-schads');
      
      if (response.data && response.data.success) {
        setStaffData(response.data.data);
      } else {
        throw new Error('Failed to fetch staff data');
      }
    } catch (err) {
      console.error('Error fetching staff data:', err);
    }
  };
  
  // Fetch financial metrics
  const fetchFinancialMetrics = async () => {
    try {
      const response = await axios.get('/api/v1/roster/financial-metrics', {
        params: {
          startDate: formatDateForApi(dateRange.startDate),
          endDate: formatDateForApi(dateRange.endDate)
        }
      });
      
      if (response.data && response.data.success) {
        setFinancialMetrics(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching financial metrics:', err);
    }
  };
  
  // Fetch timesheet data
  const fetchTimesheetData = async () => {
    try {
      const response = await axios.get('/api/v1/roster/timesheets', {
        params: {
          startDate: formatDateForApi(dateRange.startDate),
          endDate: formatDateForApi(dateRange.endDate)
        }
      });
      
      if (response.data && response.data.success) {
        setTimesheetData(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching timesheet data:', err);
    }
  };
  
  // Initial data load
  useEffect(() => {
    fetchRosterData();
    fetchStaffData();
    fetchFinancialMetrics();
    fetchTimesheetData();
    
    // Set up auto-refresh every 60 seconds
    const refreshInterval = setInterval(() => {
      fetchRosterData();
      fetchFinancialMetrics();
    }, 60000);
    
    return () => clearInterval(refreshInterval);
  }, [simulatedDate, dateRange]);
  
  // Handle date range change
  const handleDateRangeChange = (range) => {
    setDateRange(range);
  };
  
  // Handle view mode change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };
  
  // Handle staff click
  const handleStaffClick = (staff) => {
    setSelectedStaff(staff);
    setShowStaffModal(true);
  };
  
  // Handle shift click
  const handleShiftClick = (shift) => {
    setSelectedShift(shift);
    setShowShiftModal(true);
  };
  
  // Handle shift note update
  const handleShiftNoteUpdate = async (shiftId, notes) => {
    try {
      const response = await axios.post(`/api/v1/roster/shift/${shiftId}/notes`, {
        notes
      });
      
      if (response.data && response.data.success) {
        // Refresh data
        fetchRosterData();
        fetchTimesheetData();
        setShowShiftModal(false);
      } else {
        throw new Error('Failed to update shift notes');
      }
    } catch (err) {
      console.error('Error updating shift notes:', err);
      alert('Failed to update shift notes. Please try again.');
    }
  };
  
  // Handle timesheet export
  const handleTimesheetExport = async (format = 'xero') => {
    try {
      const response = await axios.get('/api/v1/roster/export-timesheets', {
        params: {
          startDate: formatDateForApi(timesheetData.dateRange.startDate),
          endDate: formatDateForApi(timesheetData.dateRange.endDate),
          format
        },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `timesheets-${format}-${formatDateForApi(timesheetData.dateRange.startDate)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setShowTimesheetModal(false);
    } catch (err) {
      console.error('Error exporting timesheets:', err);
      alert('Failed to export timesheets. Some staff may not have completed their shift notes.');
    }
  };
  
  // Handle staff swap
  const handleStaffSwap = async (shiftId, oldStaffId, newStaffId) => {
    try {
      const response = await axios.post(`/api/v1/roster/shift/${shiftId}/swap-staff`, {
        oldStaffId,
        newStaffId
      });
      
      if (response.data && response.data.success) {
        // Refresh data
        fetchRosterData();
        fetchFinancialMetrics();
        setShowShiftModal(false);
      } else {
        throw new Error('Failed to swap staff');
      }
    } catch (err) {
      console.error('Error swapping staff:', err);
      alert('Failed to swap staff. Please try again.');
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
  
  // Filter staff data based on search and filters
  const filteredStaffData = useMemo(() => {
    return staffData.filter(staff => {
      // Text filter
      const nameMatch = `${staff.first_name} ${staff.last_name}`.toLowerCase().includes(filterText.toLowerCase());
      
      // SCHADS level filter
      const schadsMatch = filterSchadsLevel === 'all' || staff.schads_level === parseInt(filterSchadsLevel);
      
      return nameMatch && schadsMatch;
    });
  }, [staffData, filterText, filterSchadsLevel]);
  
  // Filter roster data based on search and filters
  const filteredRosterData = useMemo(() => {
    return rosterData.filter(shift => {
      // Text filter
      const staffNameMatch = shift.staff && shift.staff.some(s => 
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(filterText.toLowerCase())
      );
      const programNameMatch = shift.program_name.toLowerCase().includes(filterText.toLowerCase());
      const textMatch = staffNameMatch || programNameMatch;
      
      // Shift status filter
      const statusMatch = filterShiftStatus === 'all' || 
        (filterShiftStatus === 'complete' && shift.notes_completed) ||
        (filterShiftStatus === 'incomplete' && !shift.notes_completed);
      
      // Schedule filter
      const scheduleMatch = filterSchedule === 'all' || 
        (shift.program_type && shift.program_type.toLowerCase() === filterSchedule.toLowerCase());
      
      // Staff member filter
      const staffMemberMatch = filterStaffMember === 'all' || 
        (shift.staff && shift.staff.some(s => s.id.toString() === filterStaffMember));
      
      return textMatch && statusMatch && scheduleMatch && staffMemberMatch;
    });
  }, [rosterData, filterText, filterShiftStatus, filterSchedule, filterStaffMember]);
  
  // Group shifts by staff for Staff View
  const shiftsByStaff = useMemo(() => {
    const staffMap = {};
    
    filteredRosterData.forEach(shift => {
      (shift.staff || []).forEach(staffMember => {
        const staffId = staffMember.id;
        
        if (!staffMap[staffId]) {
          // Find full staff data with SCHADS info
          const fullStaffData = staffData.find(s => s.id === staffId) || staffMember;
          
          staffMap[staffId] = {
            staffInfo: {
              ...fullStaffData,
              schads_level: fullStaffData.schads_level || 1,
              hourly_rate: fullStaffData.hourly_rate || 25.0
            },
            shifts: []
          };
        }
        
        staffMap[staffId].shifts.push({
          ...shift,
          staffRole: staffMember.role
        });
      });
    });
    
    // Sort each staff member's shifts by start time
    Object.values(staffMap).forEach(staff => {
      staff.shifts.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    });
    
    return staffMap;
  }, [filteredRosterData, staffData]);
  
  // Group shifts by day for Schedule View
  const shiftsByDay = useMemo(() => {
    const dayMap = {};
    
    filteredRosterData.forEach(shift => {
      const dateStr = shift.date;
      
      if (!dayMap[dateStr]) {
        dayMap[dateStr] = [];
      }
      
      dayMap[dateStr].push(shift);
    });
    
    // Sort shifts within each day by start time
    Object.values(dayMap).forEach(shifts => {
      shifts.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    });
    
    return dayMap;
  }, [filteredRosterData]);
  
  // Generate days array for calendar view
  const calendarDays = useMemo(() => {
    const days = [];
    const currentDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    
    while (currentDate <= endDate) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }, [dateRange]);
  
  // Calculate SCHADS color based on level
  const getSchadsColor = (level) => {
    switch (level) {
      case 1: return '#4caf50'; // Green
      case 2: return '#8bc34a'; // Light Green
      case 3: return '#ffc107'; // Yellow
      case 4: return '#ff9800'; // Orange
      case 5: return '#f44336'; // Red
      case 6: return '#9c27b0'; // Purple
      case 7: return '#673ab7'; // Deep Purple
      default: return '#2196f3'; // Blue
    }
  };
  
  // Calculate shift status color
  const getShiftStatusColor = (shift) => {
    if (!shift) return '#888';
    if (shift.notes_completed) return '#4caf50';
    return '#ff9800';
  };
  
  // Calculate if a shift has supervision multiplier impact
  const hasSupervisionImpact = (shift) => {
    if (!shift || !shift.participants) return false;
    
    return shift.participants.some(p => (p.supervision_multiplier || 1) > 1);
  };
  
  return (
    <div className="roster-container">
      <div className="roster-header universal-header">
        <div className="header-left">
          <h1>Staff Roster</h1>
          <p className="header-subtitle">
            SCHADS-integrated staff management with timesheet exports
          </p>
        </div>
        
        <div className="header-right">
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Search staff or programs..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <span className="search-icon">🔍</span>
          </div>
          
          <div className="filter-group">
            <label>Schedule:</label>
            <select 
              value={filterSchedule}
              onChange={(e) => setFilterSchedule(e.target.value)}
            >
              <option value="all">All Schedules</option>
              <option value="centre-based">Centre-Based</option>
              <option value="community">Community</option>
              <option value="transport">Transport</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Staff Member:</label>
            <select 
              value={filterStaffMember}
              onChange={(e) => setFilterStaffMember(e.target.value)}
            >
              <option value="all">All Staff</option>
              {staffData.map(staff => (
                <option key={staff.id} value={staff.id}>
                  {staff.first_name} {staff.last_name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>SCHADS Level:</label>
            <select 
              value={filterSchadsLevel}
              onChange={(e) => setFilterSchadsLevel(e.target.value)}
            >
              <option value="all">All Levels</option>
              <option value="1">Level 1</option>
              <option value="2">Level 2</option>
              <option value="3">Level 3</option>
              <option value="4">Level 4</option>
              <option value="5">Level 5</option>
              <option value="6">Level 6</option>
              <option value="7">Level 7</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Status:</label>
            <select 
              value={filterShiftStatus}
              onChange={(e) => setFilterShiftStatus(e.target.value)}
            >
              <option value="all">All Shifts</option>
              <option value="complete">Notes Complete</option>
              <option value="incomplete">Notes Pending</option>
            </select>
          </div>
          
          <div className="view-toggle">
            <button 
              className={`toggle-button ${viewMode === 'staff' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('staff')}
            >
              Staff View
            </button>
            <button 
              className={`toggle-button ${viewMode === 'schedule' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('schedule')}
            >
              Schedule View
            </button>
          </div>
          
          <button 
            className="action-button timesheet-button" 
            onClick={() => setShowTimesheetModal(true)}
            title="Export timesheets to Xero/MYOB format"
          >
            <span className="button-icon">📊</span>
            Export Timesheets
          </button>
        </div>
      </div>
      
      {/* Date Range Display */}
      <div className="date-range-display">
        <h2>
          {dateRange.startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - 
          {dateRange.endDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </h2>
        
        <div className="date-range-selector">
          <button 
            className="date-range-button"
            onClick={() => handleDateRangeChange({
              startDate: simulatedDate,
              endDate: new Date(simulatedDate.getTime() + 6 * 24 * 60 * 60 * 1000)
            })}
          >
            Week
          </button>
          <button 
            className="date-range-button"
            onClick={() => handleDateRangeChange({
              startDate: simulatedDate,
              endDate: new Date(simulatedDate.getTime() + 13 * 24 * 60 * 60 * 1000)
            })}
          >
            Fortnight
          </button>
          <button 
            className="date-range-button"
            onClick={() => handleDateRangeChange({
              startDate: simulatedDate,
              endDate: new Date(simulatedDate.getTime() + 29 * 24 * 60 * 60 * 1000)
            })}
          >
            Month
          </button>
        </div>
      </div>
      
      {/* Financial Metrics */}
      <div className="financial-metrics">
        <div className="metric-card">
          <h3>Staff Cost</h3>
          <div className="metric-value cost">
            {formatCurrency(financialMetrics.totalStaffCost)}
          </div>
          <div className="metric-label">{financialMetrics.totalHours} hours</div>
        </div>
        
        <div className="metric-card">
          <h3>Average Rate</h3>
          <div className="metric-value">
            {formatCurrency(financialMetrics.averageHourlyRate)}/hr
          </div>
          <div className="metric-label">SCHADS weighted</div>
        </div>
        
        <div className="metric-card">
          <h3>Utilization</h3>
          <div className="metric-value">
            {formatPercent(financialMetrics.staffUtilization)}
          </div>
          <div className="metric-label">{Object.keys(shiftsByStaff).length} staff</div>
        </div>
        
        <div className="metric-card">
          <h3>Shift Notes</h3>
          <div className="metric-value">
            {timesheetData.pendingShiftNotes > 0 ? (
              <span className="pending-notes">{timesheetData.pendingShiftNotes} pending</span>
            ) : (
              <span className="complete-notes">All Complete</span>
            )}
          </div>
          <div className="metric-label">For timesheet export</div>
        </div>
      </div>
      
      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading roster data...</p>
        </div>
      )}
      
      {error && (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchRosterData}>Retry</button>
        </div>
      )}
      
      {!loading && !error && (
        <>
          {viewMode === 'staff' ? (
            // Staff View
            <div className="staff-view">
              {Object.values(shiftsByStaff).length > 0 ? (
                <div className="staff-grid">
                  {Object.values(shiftsByStaff).map((staffData) => (
                    <div 
                      key={staffData.staffInfo.id} 
                      className="staff-card"
                      onClick={() => handleStaffClick(staffData.staffInfo)}
                    >
                      <div className="staff-card-header">
                        <div 
                          className="schads-indicator" 
                          style={{ backgroundColor: getSchadsColor(staffData.staffInfo.schads_level) }}
                          title={`SCHADS Level ${staffData.staffInfo.schads_level}`}
                        >
                          L{staffData.staffInfo.schads_level}
                        </div>
                        <h3 className="staff-name">
                          {staffData.staffInfo.first_name} {staffData.staffInfo.last_name}
                        </h3>
                        <div className="staff-rate">
                          {formatCurrency(staffData.staffInfo.hourly_rate)}/hr
                        </div>
                      </div>
                      
                      <div className="staff-metrics">
                        <div className="staff-metric">
                          <span className="metric-label">Shifts</span>
                          <span className="metric-value">{staffData.shifts.length}</span>
                        </div>
                        <div className="staff-metric">
                          <span className="metric-label">Hours</span>
                          <span className="metric-value">
                            {staffData.shifts.reduce((total, shift) => {
                              const startTime = new Date(`${shift.date}T${shift.start_time}`);
                              const endTime = new Date(`${shift.date}T${shift.end_time}`);
                              const hours = (endTime - startTime) / (1000 * 60 * 60);
                              return total + hours;
                            }, 0).toFixed(1)}
                          </span>
                        </div>
                        <div className="staff-metric">
                          <span className="metric-label">Cost</span>
                          <span className="metric-value">
                            {formatCurrency(staffData.shifts.reduce((total, shift) => {
                              const startTime = new Date(`${shift.date}T${shift.start_time}`);
                              const endTime = new Date(`${shift.date}T${shift.end_time}`);
                              const hours = (endTime - startTime) / (1000 * 60 * 60);
                              return total + (hours * staffData.staffInfo.hourly_rate);
                            }, 0))}
                          </span>
                        </div>
                      </div>
                      
                      <div className="staff-shifts">
                        {staffData.shifts.slice(0, 3).map((shift) => (
                          <div 
                            key={`${shift.id}-${staffData.staffInfo.id}`} 
                            className="staff-shift-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShiftClick(shift);
                            }}
                          >
                            <div 
                              className="shift-status-indicator"
                              style={{ backgroundColor: getShiftStatusColor(shift) }}
                              title={shift.notes_completed ? "Notes Complete" : "Notes Pending"}
                            ></div>
                            <div className="shift-time">
                              {shift.start_time} - {shift.end_time}
                            </div>
                            <div className="shift-title">
                              {shift.program_name}
                            </div>
                            {hasSupervisionImpact(shift) && (
                              <div 
                                className="supervision-indicator"
                                title="Has supervision multiplier impact"
                              >
                                ⚠️
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {staffData.shifts.length > 3 && (
                          <div className="more-shifts">
                            +{staffData.shifts.length - 3} more shifts
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No staff assignments found for this period.</p>
                </div>
              )}
            </div>
          ) : (
            // Schedule View
            <div className="schedule-view">
              <div className="calendar-grid">
                {calendarDays.map((day, index) => (
                  <div key={index} className="calendar-day">
                    <div className={`day-header ${day.toDateString() === new Date().toDateString() ? 'today' : ''}`}>
                      <div className="day-name">
                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className="day-number">
                        {day.getDate()}
                      </div>
                    </div>
                    
                    <div className="day-shifts">
                      {shiftsByDay[formatDateForApi(day)] ? (
                        shiftsByDay[formatDateForApi(day)].map((shift) => (
                          <div 
                            key={shift.id} 
                            className="schedule-shift-card"
                            onClick={() => handleShiftClick(shift)}
                            style={{ 
                              borderLeft: `4px solid ${getShiftStatusColor(shift)}`,
                            }}
                          >
                            <div className="shift-time">
                              {shift.start_time} - {shift.end_time}
                            </div>
                            <div className="shift-title">
                              {shift.program_name}
                            </div>
                            <div className="shift-staff">
                              {(shift.staff || []).map((staffMember, idx) => {
                                // Find full staff data with SCHADS info
                                const fullStaffData = staffData.find(s => s.id === staffMember.id) || staffMember;
                                const schadsLevel = fullStaffData.schads_level || 1;
                                
                                return (
                                  <div 
                                    key={idx} 
                                    className="staff-badge"
                                    style={{ backgroundColor: getSchadsColor(schadsLevel) }}
                                    title={`${staffMember.first_name} ${staffMember.last_name}: SCHADS Level ${schadsLevel}`}
                                  >
                                    {staffMember.first_name.charAt(0)}{staffMember.last_name.charAt(0)}
                                    <span className="schads-level-indicator">{schadsLevel}</span>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {hasSupervisionImpact(shift) && (
                              <div 
                                className="supervision-indicator"
                                title="Has supervision multiplier impact"
                              >
                                ⚠️
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="empty-day">
                          <span>No shifts</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      
      {/* SCHADS Analysis */}
      <div className="schads-analysis">
        <h3>SCHADS Cost Analysis</h3>
        <div className="schads-breakdown">
          {Object.entries(financialMetrics.schadsBreakdown || {}).map(([level, data], index) => (
            <div key={index} className="schads-level">
              <div className="schads-header">
                <span className="schads-title">Level {level}</span>
                <span className="schads-rate">{formatCurrency(data.hourlyRate)}/hr</span>
              </div>
              <div className="schads-bar-container">
                <div 
                  className="schads-bar" 
                  style={{ 
                    width: `${(data.hours / financialMetrics.totalHours) * 100}%`,
                    backgroundColor: getSchadsColor(parseInt(level))
                  }}
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
      
      {/* Staff Modal */}
      {showStaffModal && selectedStaff && (
        <Modal onClose={() => setShowStaffModal(false)} className="staff-detail-modal">
          <div className="modal-header">
            <h2>
              {selectedStaff.first_name} {selectedStaff.last_name}
              <span 
                className="schads-badge"
                style={{ backgroundColor: getSchadsColor(selectedStaff.schads_level) }}
              >
                SCHADS L{selectedStaff.schads_level}
              </span>
            </h2>
            <p className="staff-contact">{selectedStaff.email || 'No email'} | {selectedStaff.phone || 'No phone'}</p>
          </div>
          
          <div className="modal-body">
            <div className="staff-financial-summary">
              <div className="financial-item">
                <span className="item-label">Hourly Rate</span>
                <span className="item-value">{formatCurrency(selectedStaff.hourly_rate)}/hr</span>
              </div>
              <div className="financial-item">
                <span className="item-label">Weekly Hours</span>
                <span className="item-value">
                  {shiftsByStaff[selectedStaff.id]?.shifts.reduce((total, shift) => {
                    const startTime = new Date(`${shift.date}T${shift.start_time}`);
                    const endTime = new Date(`${shift.date}T${shift.end_time}`);
                    const hours = (endTime - startTime) / (1000 * 60 * 60);
                    return total + hours;
                  }, 0).toFixed(1) || 0}
                </span>
              </div>
              <div className="financial-item">
                <span className="item-label">Weekly Cost</span>
                <span className="item-value">
                  {formatCurrency(shiftsByStaff[selectedStaff.id]?.shifts.reduce((total, shift) => {
                    const startTime = new Date(`${shift.date}T${shift.start_time}`);
                    const endTime = new Date(`${shift.date}T${shift.end_time}`);
                    const hours = (endTime - startTime) / (1000 * 60 * 60);
                    return total + (hours * selectedStaff.hourly_rate);
                  }, 0) || 0)}
                </span>
              </div>
              <div className="financial-item">
                <span className="item-label">Shift Notes</span>
                <span className="item-value">
                  {shiftsByStaff[selectedStaff.id]?.shifts.filter(s => !s.notes_completed).length || 0} pending
                </span>
              </div>
            </div>
            
            <h3>Upcoming Shifts</h3>
            <div className="staff-shifts-list">
              {shiftsByStaff[selectedStaff.id]?.shifts.map((shift) => (
                <div 
                  key={`${shift.id}-${selectedStaff.id}`} 
                  className="staff-shift-detail"
                  onClick={() => {
                    setSelectedShift(shift);
                    setShowStaffModal(false);
                    setShowShiftModal(true);
                  }}
                >
                  <div className="shift-date-time">
                    <div className="shift-date">
                      {new Date(shift.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <div className="shift-time">
                      {shift.start_time} - {shift.end_time}
                    </div>
                  </div>
                  
                  <div className="shift-info">
                    <div className="shift-program">
                      {shift.program_name}
                    </div>
                    <div className="shift-role">
                      Role: {shift.staffRole || 'Support Worker'}
                    </div>
                  </div>
                  
                  <div 
                    className="shift-status"
                    style={{ backgroundColor: getShiftStatusColor(shift) }}
                  >
                    {shift.notes_completed ? 'Complete' : 'Pending'}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="modal-footer">
            <button onClick={() => setShowStaffModal(false)}>Close</button>
            <button 
              className="timesheet-button"
              onClick={() => {
                setShowStaffModal(false);
                setShowTimesheetModal(true);
              }}
            >
              Export Timesheets
            </button>
          </div>
        </Modal>
      )}
      
      {/* Shift Modal */}
      {showShiftModal && selectedShift && (
        <Modal onClose={() => setShowShiftModal(false)} className="shift-detail-modal">
          <div className="modal-header">
            <h2>{selectedShift.program_name}</h2>
            <p className="shift-datetime">
              {new Date(selectedShift.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} | 
              {selectedShift.start_time} - {selectedShift.end_time}
            </p>
          </div>
          
          <div className="modal-body">
            {/* Staff Section */}
            <div className="shift-detail-section">
              <h3>Staff Assigned</h3>
              <div className="staff-list">
                {(selectedShift.staff || []).map((staffMember, idx) => {
                  // Find full staff data with SCHADS info
                  const fullStaffData = staffData.find(s => s.id === staffMember.id) || staffMember;
                  const schadsLevel = fullStaffData.schads_level || 1;
                  const hourlyRate = fullStaffData.hourly_rate || 25.0;
                  
                  return (
                    <div key={idx} className="staff-list-item">
                      <div className="staff-info">
                        <span className="staff-name">
                          {staffMember.first_name} {staffMember.last_name}
                        </span>
                        <span className="staff-role">{staffMember.role || 'Support Worker'}</span>
                      </div>
                      
                      <div className="staff-cost-info">
                        <span 
                          className="schads-badge"
                          style={{ backgroundColor: getSchadsColor(schadsLevel) }}
                        >
                          L{schadsLevel}
                        </span>
                        <span className="hourly-rate">{formatCurrency(hourlyRate)}/hr</span>
                      </div>
                      
                      <button 
                        className="swap-button"
                        onClick={() => {
                          const newStaffId = prompt('Enter new staff ID:');
                          if (newStaffId) {
                            handleStaffSwap(selectedShift.id, staffMember.id, newStaffId);
                          }
                        }}
                      >
                        Swap
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Participant Section */}
            {selectedShift.participants && selectedShift.participants.length > 0 && (
              <div className="shift-detail-section">
                <h3>Participants</h3>
                <div className="participants-list">
                  {selectedShift.participants.map((participant, idx) => (
                    <div key={idx} className="participant-item">
                      <span className="participant-name">
                        {participant.first_name} {participant.last_name}
                      </span>
                      
                      {participant.supervision_multiplier > 1 && (
                        <span 
                          className="supervision-multiplier"
                          title="Supervision multiplier impacts staffing requirements"
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
            )}
            
            {/* Shift Notes Section */}
            <div className="shift-detail-section">
              <h3>Shift Notes</h3>
              <div className="shift-notes">
                <textarea 
                  placeholder="Enter shift notes here..."
                  defaultValue={selectedShift.notes || ''}
                  rows={5}
                ></textarea>
                
                <div className="notes-status">
                  <div className="status-indicator">
                    <span className="status-label">Status:</span>
                    <span 
                      className={`status-value ${selectedShift.notes_completed ? 'complete' : 'pending'}`}
                    >
                      {selectedShift.notes_completed ? 'Complete' : 'Pending'}
                    </span>
                  </div>
                  
                  <div className="notes-info">
                    <span className="info-text">
                      Shift notes must be completed for timesheet export
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Financial Section */}
            <div className="shift-detail-section">
              <h3>Financial Breakdown</h3>
              <div className="financial-breakdown">
                <div className="financial-row">
                  <span className="row-label">Duration</span>
                  <span className="row-value">
                    {(() => {
                      const startTime = new Date(`${selectedShift.date}T${selectedShift.start_time}`);
                      const endTime = new Date(`${selectedShift.date}T${selectedShift.end_time}`);
                      const hours = (endTime - startTime) / (1000 * 60 * 60);
                      return `${hours.toFixed(1)} hours`;
                    })()}
                  </span>
                </div>
                
                <div className="financial-row">
                  <span className="row-label">Staff Cost</span>
                  <span className="row-value">
                    {formatCurrency((() => {
                      const startTime = new Date(`${selectedShift.date}T${selectedShift.start_time}`);
                      const endTime = new Date(`${selectedShift.date}T${selectedShift.end_time}`);
                      const hours = (endTime - startTime) / (1000 * 60 * 60);
                      
                      return (selectedShift.staff || []).reduce((total, staffMember) => {
                        // Find full staff data with SCHADS info
                        const fullStaffData = staffData.find(s => s.id === staffMember.id) || staffMember;
                        const hourlyRate = fullStaffData.hourly_rate || 25.0;
                        
                        return total + (hours * hourlyRate);
                      }, 0);
                    })())}
                  </span>
                </div>
                
                <div className="financial-row">
                  <span className="row-label">Revenue</span>
                  <span className="row-value">
                    {formatCurrency(selectedShift.revenue || 0)}
                  </span>
                </div>
                
                <div className="financial-row profit-row">
                  <span className="row-label">Profit/Loss</span>
                  <span className="row-value">
                    {formatCurrency((selectedShift.revenue || 0) - (() => {
                      const startTime = new Date(`${selectedShift.date}T${selectedShift.start_time}`);
                      const endTime = new Date(`${selectedShift.date}T${selectedShift.end_time}`);
                      const hours = (endTime - startTime) / (1000 * 60 * 60);
                      
                      return (selectedShift.staff || []).reduce((total, staffMember) => {
                        // Find full staff data with SCHADS info
                        const fullStaffData = staffData.find(s => s.id === staffMember.id) || staffMember;
                        const hourlyRate = fullStaffData.hourly_rate || 25.0;
                        
                        return total + (hours * hourlyRate);
                      }, 0);
                    })())}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button onClick={() => setShowShiftModal(false)}>Cancel</button>
            <button 
              className="save-button"
              onClick={() => {
                const notesElement = document.querySelector('.shift-notes textarea');
                if (notesElement) {
                  handleShiftNoteUpdate(selectedShift.id, notesElement.value);
                }
              }}
            >
              Save Notes & Mark Complete
            </button>
          </div>
        </Modal>
      )}
      
      {/* Timesheet Modal */}
      {showTimesheetModal && (
        <Modal onClose={() => setShowTimesheetModal(false)} className="timesheet-modal">
          <div className="modal-header">
            <h2>Export Timesheets</h2>
            <p className="timesheet-date-range">
              {timesheetData.dateRange.startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - 
              {timesheetData.dateRange.endDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          
          <div className="modal-body">
            <div className="timesheet-summary">
              <div className="summary-item">
                <span className="item-label">Total Staff</span>
                <span className="item-value">{timesheetData.staff.length}</span>
              </div>
              <div className="summary-item">
                <span className="item-label">Total Hours</span>
                <span className="item-value">{timesheetData.totalHours.toFixed(1)}</span>
              </div>
              <div className="summary-item">
                <span className="item-label">Total Cost</span>
                <span className="item-value">{formatCurrency(timesheetData.totalCost)}</span>
              </div>
              <div className="summary-item">
                <span className="item-label">Pending Notes</span>
                <span className="item-value">
                  {timesheetData.pendingShiftNotes > 0 ? (
                    <span className="warning">{timesheetData.pendingShiftNotes}</span>
                  ) : (
                    <span className="success">None</span>
                  )}
                </span>
              </div>
            </div>
            
            {timesheetData.pendingShiftNotes > 0 && (
              <div className="warning-message">
                <p>⚠️ {timesheetData.pendingShiftNotes} shifts have incomplete notes. These shifts will be excluded from the export.</p>
              </div>
            )}
            
            <h3>Staff Included in Export</h3>
            <div className="timesheet-staff-list">
              {timesheetData.staff.map((staffMember, idx) => (
                <div key={idx} className="timesheet-staff-item">
                  <div className="staff-info">
                    <span className="staff-name">
                      {staffMember.first_name} {staffMember.last_name}
                    </span>
                    <span 
                      className="schads-badge"
                      style={{ backgroundColor: getSchadsColor(staffMember.schads_level) }}
                    >
                      L{staffMember.schads_level}
                    </span>
                  </div>
                  
                  <div className="staff-timesheet-info">
                    <span className="hours">{staffMember.hours.toFixed(1)} hrs</span>
                    <span className="cost">{formatCurrency(staffMember.cost)}</span>
                    {staffMember.pendingNotes > 0 && (
                      <span className="pending-indicator">
                        {staffMember.pendingNotes} pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="export-options">
              <h3>Export Format</h3>
              <div className="format-options">
                <div className="format-option">
                  <input type="radio" id="xero" name="format" value="xero" defaultChecked />
                  <label htmlFor="xero">
                    <span className="format-name">Xero</span>
                    <span className="format-description">Standard Xero timesheet CSV format</span>
                  </label>
                </div>
                
                <div className="format-option">
                  <input type="radio" id="myob" name="format" value="myob" />
                  <label htmlFor="myob">
                    <span className="format-name">MYOB</span>
                    <span className="format-description">MYOB compatible CSV format</span>
                  </label>
                </div>
                
                <div className="format-option">
                  <input type="radio" id="custom" name="format" value="custom" />
                  <label htmlFor="custom">
                    <span className="format-name">Custom</span>
                    <span className="format-description">Detailed CSV with SCHADS rates</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button onClick={() => setShowTimesheetModal(false)}>Cancel</button>
            <button 
              className="export-button"
              onClick={() => {
                const selectedFormat = document.querySelector('input[name="format"]:checked').value;
                handleTimesheetExport(selectedFormat);
              }}
            >
              Export Timesheets
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Roster;
