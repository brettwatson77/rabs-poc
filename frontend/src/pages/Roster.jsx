import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  // Add fallback for simulatedDate if context fails
  const context = useAppContext() || {};
  const simulatedDate = context.simulatedDate || new Date();
  
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
  
  // Ensure dateRange has valid dates with fallbacks
  const [dateRange, setDateRange] = useState(() => {
    try {
      const startDate = simulatedDate || new Date();
      const endDate = new Date((startDate).getTime() + 6 * 24 * 60 * 60 * 1000);
      return { startDate, endDate };
    } catch (err) {
      console.error('Error initializing date range:', err);
      const today = new Date();
      return {
        startDate: today,
        endDate: new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000)
      };
    }
  });
  
  // Financial metrics with safe defaults
  const [financialMetrics, setFinancialMetrics] = useState({
    totalStaffCost: 0,
    averageHourlyRate: 0,
    totalHours: 0,
    staffUtilization: 0,
    schadsBreakdown: {}
  });
  
  // Timesheet data with safe defaults
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
  
  // Safe date formatter with error handling
  const safeFormatDateForApi = useCallback((date) => {
    try {
      if (!date) return '';
      return formatDateForApi(date);
    } catch (err) {
      console.error('Error formatting date:', err);
      return '';
    }
  }, []);
  
  // Fetch roster data with enhanced error handling
  const fetchRosterData = useCallback(async () => {
    setLoading(true);
    try {
      if (!dateRange.startDate || !dateRange.endDate) {
        throw new Error('Invalid date range');
      }
      
      const response = await axios.get('/api/v1/roster', {
        params: {
          startDate: safeFormatDateForApi(dateRange.startDate),
          endDate: safeFormatDateForApi(dateRange.endDate)
        }
      });
      
      if (response.data && response.data.success) {
        setRosterData(response.data.data || []);
      } else {
        throw new Error(response.data?.message || 'Failed to fetch roster data');
      }
    } catch (err) {
      console.error('Error fetching roster data:', err);
      setError(`Failed to load roster: ${err.message || 'Unknown error'}. Please ensure the backend is running.`);
      setRosterData([]); // Set empty array as fallback
    } finally {
      setLoading(false);
    }
  }, [dateRange, safeFormatDateForApi]);
  
  // Fetch staff data with enhanced error handling
  const fetchStaffData = useCallback(async () => {
    try {
      const response = await axios.get('/api/v1/staff/with-schads');
      
      if (response.data && response.data.success) {
        setStaffData(response.data.data || []);
      } else {
        throw new Error(response.data?.message || 'Failed to fetch staff data');
      }
    } catch (err) {
      console.error('Error fetching staff data:', err);
      // Don't set global error, but provide empty array as fallback
      setStaffData([]);
    }
  }, []);
  
  // Fetch financial metrics with enhanced error handling
  const fetchFinancialMetrics = useCallback(async () => {
    try {
      if (!dateRange.startDate || !dateRange.endDate) {
        throw new Error('Invalid date range');
      }
      
      const response = await axios.get('/api/v1/roster/financial-metrics', {
        params: {
          startDate: safeFormatDateForApi(dateRange.startDate),
          endDate: safeFormatDateForApi(dateRange.endDate)
        }
      });
      
      if (response.data && response.data.success) {
        setFinancialMetrics(response.data.data || {
          totalStaffCost: 0,
          averageHourlyRate: 0,
          totalHours: 0,
          staffUtilization: 0,
          schadsBreakdown: {}
        });
      } else {
        throw new Error(response.data?.message || 'Failed to fetch financial metrics');
      }
    } catch (err) {
      console.error('Error fetching financial metrics:', err);
      // Keep existing metrics, don't update on error
    }
  }, [dateRange, safeFormatDateForApi]);
  
  // Fetch timesheet data with enhanced error handling
  const fetchTimesheetData = useCallback(async () => {
    try {
      if (!dateRange.startDate || !dateRange.endDate) {
        throw new Error('Invalid date range');
      }
      
      const response = await axios.get('/api/v1/roster/timesheets', {
        params: {
          startDate: safeFormatDateForApi(dateRange.startDate),
          endDate: safeFormatDateForApi(dateRange.endDate)
        }
      });
      
      if (response.data && response.data.success) {
        setTimesheetData(response.data.data || {
          staff: [],
          dateRange: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          },
          totalHours: 0,
          totalCost: 0,
          pendingShiftNotes: 0
        });
      } else {
        throw new Error(response.data?.message || 'Failed to fetch timesheet data');
      }
    } catch (err) {
      console.error('Error fetching timesheet data:', err);
      // Keep existing timesheet data, don't update on error
    }
  }, [dateRange, safeFormatDateForApi]);
  
  // Initial data load with error handling
  useEffect(() => {
    try {
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
    } catch (err) {
      console.error('Error in useEffect setup:', err);
      setError('Failed to initialize roster data. Please refresh the page.');
    }
  }, [fetchRosterData, fetchStaffData, fetchFinancialMetrics, fetchTimesheetData]);
  
  // Handle date range change with validation
  const handleDateRangeChange = useCallback((range) => {
    try {
      if (!range.startDate || !range.endDate) {
        throw new Error('Invalid date range provided');
      }
      setDateRange(range);
    } catch (err) {
      console.error('Error setting date range:', err);
      // Keep existing date range on error
    }
  }, []);
  
  // Handle view mode change
  const handleViewModeChange = useCallback((mode) => {
    if (mode !== 'staff' && mode !== 'schedule') {
      console.error('Invalid view mode:', mode);
      return;
    }
    setViewMode(mode);
  }, []);
  
  // Handle staff click with validation
  const handleStaffClick = useCallback((staff) => {
    if (!staff || !staff.id) {
      console.error('Invalid staff data:', staff);
      return;
    }
    setSelectedStaff(staff);
    setShowStaffModal(true);
  }, []);
  
  // Handle shift click with validation
  const handleShiftClick = useCallback((shift) => {
    if (!shift || !shift.id) {
      console.error('Invalid shift data:', shift);
      return;
    }
    setSelectedShift(shift);
    setShowShiftModal(true);
  }, []);
  
  // Handle shift note update with enhanced error handling
  const handleShiftNoteUpdate = useCallback(async (shiftId, notes) => {
    try {
      if (!shiftId) {
        throw new Error('Invalid shift ID');
      }
      
      const response = await axios.post(`/api/v1/roster/shift/${shiftId}/notes`, {
        notes: notes || ''
      });
      
      if (response.data && response.data.success) {
        // Refresh data
        fetchRosterData();
        fetchTimesheetData();
        setShowShiftModal(false);
      } else {
        throw new Error(response.data?.message || 'Failed to update shift notes');
      }
    } catch (err) {
      console.error('Error updating shift notes:', err);
      alert(`Failed to update shift notes: ${err.message || 'Unknown error'}. Please try again.`);
    }
  }, [fetchRosterData, fetchTimesheetData]);
  
  // Handle timesheet export with enhanced error handling
  const handleTimesheetExport = useCallback(async (format = 'xero') => {
    try {
      if (!timesheetData.dateRange?.startDate || !timesheetData.dateRange?.endDate) {
        throw new Error('Invalid timesheet date range');
      }
      
      const response = await axios.get('/api/v1/roster/export-timesheets', {
        params: {
          startDate: safeFormatDateForApi(timesheetData.dateRange.startDate),
          endDate: safeFormatDateForApi(timesheetData.dateRange.endDate),
          format: format || 'xero'
        },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `timesheets-${format}-${safeFormatDateForApi(timesheetData.dateRange.startDate)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setShowTimesheetModal(false);
    } catch (err) {
      console.error('Error exporting timesheets:', err);
      alert(`Failed to export timesheets: ${err.message || 'Unknown error'}. Some staff may not have completed their shift notes.`);
    }
  }, [timesheetData, safeFormatDateForApi]);
  
  // Handle staff swap with enhanced error handling
  const handleStaffSwap = useCallback(async (shiftId, oldStaffId, newStaffId) => {
    try {
      if (!shiftId || !oldStaffId || !newStaffId) {
        throw new Error('Missing required parameters for staff swap');
      }
      
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
        throw new Error(response.data?.message || 'Failed to swap staff');
      }
    } catch (err) {
      console.error('Error swapping staff:', err);
      alert(`Failed to swap staff: ${err.message || 'Unknown error'}. Please try again.`);
    }
  }, [fetchRosterData, fetchFinancialMetrics]);
  
  // Format currency values with error handling
  const formatCurrency = useCallback((value) => {
    try {
      const numValue = Number(value);
      if (isNaN(numValue)) return '$0';
      
      return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(numValue);
    } catch (err) {
      console.error('Error formatting currency:', err);
      return '$0';
    }
  }, []);
  
  // Format percentage values with error handling
  const formatPercent = useCallback((value) => {
    try {
      const numValue = Number(value);
      if (isNaN(numValue)) return '0%';
      return `${Math.round(numValue)}%`;
    } catch (err) {
      console.error('Error formatting percentage:', err);
      return '0%';
    }
  }, []);
  
  // Filter staff data with null checks
  const filteredStaffData = useMemo(() => {
    try {
      if (!Array.isArray(staffData)) return [];
      
      return staffData.filter(staff => {
        if (!staff) return false;
        
        // Text filter
        const staffName = `${staff.first_name || ''} ${staff.last_name || ''}`.toLowerCase();
        const searchTerm = (filterText || '').toLowerCase();
        const nameMatch = staffName.includes(searchTerm);
        
        // SCHADS level filter
        const schadsMatch = filterSchadsLevel === 'all' || 
          (staff.schads_level && staff.schads_level === parseInt(filterSchadsLevel));
        
        return nameMatch && schadsMatch;
      });
    } catch (err) {
      console.error('Error filtering staff data:', err);
      return [];
    }
  }, [staffData, filterText, filterSchadsLevel]);
  
  // Filter roster data with null checks
  const filteredRosterData = useMemo(() => {
    try {
      if (!Array.isArray(rosterData)) return [];
      
      return rosterData.filter(shift => {
        if (!shift) return false;
        
        // Text filter
        const staffNameMatch = Array.isArray(shift.staff) && shift.staff.some(s => 
          s && `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes((filterText || '').toLowerCase())
        );
        const programNameMatch = (shift.program_name || '').toLowerCase().includes((filterText || '').toLowerCase());
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
          (Array.isArray(shift.staff) && shift.staff.some(s => s && s.id && s.id.toString() === filterStaffMember));
        
        return textMatch && statusMatch && scheduleMatch && staffMemberMatch;
      });
    } catch (err) {
      console.error('Error filtering roster data:', err);
      return [];
    }
  }, [rosterData, filterText, filterShiftStatus, filterSchedule, filterStaffMember]);
  
  // Group shifts by staff with null checks
  const shiftsByStaff = useMemo(() => {
    try {
      if (!Array.isArray(filteredRosterData) || !Array.isArray(staffData)) {
        return {};
      }
      
      const staffMap = {};
      
      filteredRosterData.forEach(shift => {
        if (!shift || !Array.isArray(shift.staff)) return;
        
        shift.staff.forEach(staffMember => {
          if (!staffMember || !staffMember.id) return;
          
          const staffId = staffMember.id;
          
          if (!staffMap[staffId]) {
            // Find full staff data with SCHADS info
            const fullStaffData = staffData.find(s => s && s.id === staffId) || staffMember;
            
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
        if (!staff || !Array.isArray(staff.shifts)) return;
        
        staff.shifts.sort((a, b) => {
          try {
            return new Date(a.start_time || 0) - new Date(b.start_time || 0);
          } catch (err) {
            return 0;
          }
        });
      });
      
      return staffMap;
    } catch (err) {
      console.error('Error grouping shifts by staff:', err);
      return {};
    }
  }, [filteredRosterData, staffData]);
  
  // Group shifts by day with null checks
  const shiftsByDay = useMemo(() => {
    try {
      if (!Array.isArray(filteredRosterData)) {
        return {};
      }
      
      const dayMap = {};
      
      filteredRosterData.forEach(shift => {
        if (!shift || !shift.date) return;
        
        const dateStr = shift.date;
        
        if (!dayMap[dateStr]) {
          dayMap[dateStr] = [];
        }
        
        dayMap[dateStr].push(shift);
      });
      
      // Sort shifts within each day by start time
      Object.values(dayMap).forEach(shifts => {
        if (!Array.isArray(shifts)) return;
        
        shifts.sort((a, b) => {
          try {
            return new Date(a.start_time || 0) - new Date(b.start_time || 0);
          } catch (err) {
            return 0;
          }
        });
      });
      
      return dayMap;
    } catch (err) {
      console.error('Error grouping shifts by day:', err);
      return {};
    }
  }, [filteredRosterData]);
  
  // Generate days array for calendar view with error handling
  const calendarDays = useMemo(() => {
    try {
      if (!dateRange.startDate || !dateRange.endDate) {
        return [];
      }
      
      const days = [];
      const currentDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      
      // Safety check to prevent infinite loops
      let safetyCounter = 0;
      const MAX_DAYS = 60;
      
      while (currentDate <= endDate && safetyCounter < MAX_DAYS) {
        days.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
        safetyCounter++;
      }
      
      return days;
    } catch (err) {
      console.error('Error generating calendar days:', err);
      return [];
    }
  }, [dateRange]);
  
  // Calculate SCHADS color based on level with validation
  const getSchadsColor = useCallback((level) => {
    try {
      const numLevel = Number(level);
      if (isNaN(numLevel)) return '#2196f3'; // Default blue
      
      switch (numLevel) {
        case 1: return '#4caf50'; // Green
        case 2: return '#8bc34a'; // Light Green
        case 3: return '#ffc107'; // Yellow
        case 4: return '#ff9800'; // Orange
        case 5: return '#f44336'; // Red
        case 6: return '#9c27b0'; // Purple
        case 7: return '#673ab7'; // Deep Purple
        default: return '#2196f3'; // Blue
      }
    } catch (err) {
      console.error('Error getting SCHADS color:', err);
      return '#2196f3'; // Default blue
    }
  }, []);
  
  // Calculate shift status color with validation
  const getShiftStatusColor = useCallback((shift) => {
    try {
      if (!shift) return '#888';
      if (shift.notes_completed) return '#4caf50';
      return '#ff9800';
    } catch (err) {
      console.error('Error getting shift status color:', err);
      return '#888'; // Default gray
    }
  }, []);
  
  // Calculate if a shift has supervision multiplier impact with validation
  const hasSupervisionImpact = useCallback((shift) => {
    try {
      if (!shift || !Array.isArray(shift.participants)) return false;
      
      return shift.participants.some(p => p && (Number(p.supervision_multiplier) || 1) > 1);
    } catch (err) {
      console.error('Error checking supervision impact:', err);
      return false;
    }
  }, []);
  
  // Calculate shift duration with error handling
  const calculateShiftDuration = useCallback((shift) => {
    try {
      if (!shift || !shift.date || !shift.start_time || !shift.end_time) {
        return 0;
      }
      
      const startTime = new Date(`${shift.date}T${shift.start_time}`);
      const endTime = new Date(`${shift.date}T${shift.end_time}`);
      
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return 0;
      }
      
      return (endTime - startTime) / (1000 * 60 * 60);
    } catch (err) {
      console.error('Error calculating shift duration:', err);
      return 0;
    }
  }, []);

  // Error boundary for the entire component
  try {
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
                {Array.isArray(staffData) && staffData.map(staff => staff && (
                  <option key={staff.id} value={staff.id}>
                    {staff.first_name || ''} {staff.last_name || ''}
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
            {dateRange.startDate?.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) || 'Invalid date'} - 
            {dateRange.endDate?.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) || 'Invalid date'}
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
              {formatCurrency(financialMetrics.totalStaffCost || 0)}
            </div>
            <div className="metric-label">{financialMetrics.totalHours || 0} hours</div>
          </div>
          
          <div className="metric-card">
            <h3>Average Rate</h3>
            <div className="metric-value">
              {formatCurrency(financialMetrics.averageHourlyRate || 0)}/hr
            </div>
            <div className="metric-label">SCHADS weighted</div>
          </div>
          
          <div className="metric-card">
            <h3>Utilization</h3>
            <div className="metric-value">
              {formatPercent(financialMetrics.staffUtilization || 0)}
            </div>
            <div className="metric-label">{Object.keys(shiftsByStaff).length || 0} staff</div>
          </div>
          
          <div className="metric-card">
            <h3>Shift Notes</h3>
            <div className="metric-value">
              {(timesheetData.pendingShiftNotes || 0) > 0 ? (
                <span className="pending-notes">{timesheetData.pendingShiftNotes} pending</span>
              ) : (
                <span className="complete-notes">All Complete</span>
              )}
            </div>
            <div className="metric-label">For timesheet export</div>
          </div>
        </div>
        
        {/* Loading state */}
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading roster data...</p>
          </div>
        )}
        
        {/* Error state */}
        {error && (
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button onClick={fetchRosterData} className="retry-button">Retry</button>
          </div>
        )}
        
        {/* Main content */}
        {!loading && !error && (
          <>
            {viewMode === 'staff' ? (
              // Staff View
              <div className="staff-view">
                {Object.values(shiftsByStaff).length > 0 ? (
                  <div className="staff-grid">
                    {Object.values(shiftsByStaff).map((staffData) => staffData && (
                      <div 
                        key={staffData.staffInfo.id} 
                        className="staff-card"
                        onClick={() => handleStaffClick(staffData.staffInfo)}
                      >
                        <div className="staff-card-header">
                          <div 
                            className="schads-indicator" 
                            style={{ backgroundColor: getSchadsColor(staffData.staffInfo.schads_level) }}
                            title={`SCHADS Level ${staffData.staffInfo.schads_level || 1}`}
                          >
                            L{staffData.staffInfo.schads_level || 1}
                          </div>
                          <h3 className="staff-name">
                            {staffData.staffInfo.first_name || ''} {staffData.staffInfo.last_name || ''}
                          </h3>
                          <div className="staff-rate">
                            {formatCurrency(staffData.staffInfo.hourly_rate || 0)}/hr
                          </div>
                        </div>
                        
                        <div className="staff-metrics">
                          <div className="staff-metric">
                            <span className="metric-label">Shifts</span>
                            <span className="metric-value">{Array.isArray(staffData.shifts) ? staffData.shifts.length : 0}</span>
                          </div>
                          <div className="staff-metric">
                            <span className="metric-label">Hours</span>
                            <span className="metric-value">
                              {Array.isArray(staffData.shifts) ? 
                                staffData.shifts.reduce((total, shift) => {
                                  return total + calculateShiftDuration(shift);
                                }, 0).toFixed(1) : '0.0'}
                            </span>
                          </div>
                          <div className="staff-metric">
                            <span className="metric-label">Cost</span>
                            <span className="metric-value">
                              {formatCurrency(Array.isArray(staffData.shifts) ? 
                                staffData.shifts.reduce((total, shift) => {
                                  const hours = calculateShiftDuration(shift);
                                  return total + (hours * (staffData.staffInfo.hourly_rate || 0));
                                }, 0) : 0)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="staff-shifts">
                          {Array.isArray(staffData.shifts) && staffData.shifts.slice(0, 3).map((shift) => shift && (
                            <div 
                              key={`${shift.id || 'unknown'}-${staffData.staffInfo.id || 'unknown'}`} 
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
                                {shift.start_time || '00:00'} - {shift.end_time || '00:00'}
                              </div>
                              <div className="shift-title">
                                {shift.program_name || 'Unnamed Program'}
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
                          
                          {Array.isArray(staffData.shifts) && staffData.shifts.length > 3 && (
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
                  {Array.isArray(calendarDays) && calendarDays.map((day, index) => day && (
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
                        {shiftsByDay[safeFormatDateForApi(day)] ? (
                          shiftsByDay[safeFormatDateForApi(day)].map((shift) => shift && (
                            <div 
                              key={shift.id || `shift-${Math.random()}`} 
                              className="schedule-shift-card"
                              onClick={() => handleShiftClick(shift)}
                              style={{ 
                                borderLeft: `4px solid ${getShiftStatusColor(shift)}`,
                              }}
                            >
                              <div className="shift-time">
                                {shift.start_time || '00:00'} - {shift.end_time || '00:00'}
                              </div>
                              <div className="shift-title">
                                {shift.program_name || 'Unnamed Program'}
                              </div>
                              <div className="shift-staff">
                                {Array.isArray(shift.staff) && shift.staff.map((staffMember, idx) => {
                                  if (!staffMember) return null;
                                  
                                  // Find full staff data with SCHADS info
                                  const fullStaffData = staffData.find(s => s && s.id === staffMember.id) || staffMember;
                                  const schadsLevel = fullStaffData.schads_level || 1;
                                  
                                  return (
                                    <div 
                                      key={idx} 
                                      className="staff-badge"
                                      style={{ backgroundColor: getSchadsColor(schadsLevel) }}
                                      title={`${staffMember.first_name || ''} ${staffMember.last_name || ''}: SCHADS Level ${schadsLevel}`}
                                    >
                                      {(staffMember.first_name || '?').charAt(0)}{(staffMember.last_name || '?').charAt(0)}
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
            {Object.entries(financialMetrics.schadsBreakdown || {}).map(([level, data], index) => data && (
              <div key={index} className="schads-level">
                <div className="schads-header">
                  <span className="schads-title">Level {level}</span>
                  <span className="schads-rate">{formatCurrency(data.hourlyRate || 0)}/hr</span>
                </div>
                <div className="schads-bar-container">
                  <div 
                    className="schads-bar" 
                    style={{ 
                      width: `${((data.hours || 0) / (financialMetrics.totalHours || 1)) * 100}%`,
                      backgroundColor: getSchadsColor(parseInt(level))
                    }}
                  ></div>
                </div>
                <div className="schads-details">
                  <span>{data.hours || 0} hours</span>
                  <span>{data.count || 0} staff</span>
                  <span>{formatCurrency(data.totalCost || 0)}</span>
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
                {selectedStaff.first_name || ''} {selectedStaff.last_name || ''}
                <span 
                  className="schads-badge"
                  style={{ backgroundColor: getSchadsColor(selectedStaff.schads_level) }}
                >
                  SCHADS L{selectedStaff.schads_level || 1}
                </span>
              </h2>
              <p className="staff-contact">{selectedStaff.email || 'No email'} | {selectedStaff.phone || 'No phone'}</p>
            </div>
            
            <div className="modal-body">
              <div className="staff-financial-summary">
                <div className="financial-item">
                  <span className="item-label">Hourly Rate</span>
                  <span className="item-value">{formatCurrency(selectedStaff.hourly_rate || 0)}/hr</span>
                </div>
                <div className="financial-item">
                  <span className="item-label">Weekly Hours</span>
                  <span className="item-value">
                    {shiftsByStaff[selectedStaff.id]?.shifts && Array.isArray(shiftsByStaff[selectedStaff.id].shifts) ?
                      shiftsByStaff[selectedStaff.id].shifts.reduce((total, shift) => {
                        return total + calculateShiftDuration(shift);
                      }, 0).toFixed(1) : '0.0'}
                  </span>
                </div>
                <div className="financial-item">
                  <span className="item-label">Weekly Cost</span>
                  <span className="item-value">
                    {formatCurrency(
                      shiftsByStaff[selectedStaff.id]?.shifts && Array.isArray(shiftsByStaff[selectedStaff.id].shifts) ?
                      shiftsByStaff[selectedStaff.id].shifts.reduce((total, shift) => {
                        const hours = calculateShiftDuration(shift);
                        return total + (hours * (selectedStaff.hourly_rate || 0));
                      }, 0) : 0
                    )}
                  </span>
                </div>
                <div className="financial-item">
                  <span className="item-label">Shift Notes</span>
                  <span className="item-value">
                    {shiftsByStaff[selectedStaff.id]?.shifts && Array.isArray(shiftsByStaff[selectedStaff.id].shifts) ?
                      shiftsByStaff[selectedStaff.id].shifts.filter(s => s && !s.notes_completed).length : 0} pending
                  </span>
                </div>
              </div>
              
              <h3>Upcoming Shifts</h3>
              <div className="staff-shifts-list">
                {shiftsByStaff[selectedStaff.id]?.shifts && Array.isArray(shiftsByStaff[selectedStaff.id].shifts) ?
                  shiftsByStaff[selectedStaff.id].shifts.map((shift) => shift && (
                    <div 
                      key={`${shift.id || 'unknown'}-${selectedStaff.id || 'unknown'}`} 
                      className="staff-shift-detail"
                      onClick={() => {
                        setSelectedShift(shift);
                        setShowStaffModal(false);
                        setShowShiftModal(true);
                      }}
                    >
                      <div className="shift-date-time">
                        <div className="shift-date">
                          {shift.date ? new Date(shift.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Unknown date'}
                        </div>
                        <div className="shift-time">
                          {shift.start_time || '00:00'} - {shift.end_time || '00:00'}
                        </div>
                      </div>
                      
                      <div className="shift-info">
                        <div className="shift-program">
                          {shift.program_name || 'Unnamed Program'}
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
                  )) : (
                    <div className="no-shifts">No shifts assigned</div>
                  )
                }
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
              <h2>{selectedShift.program_name || 'Unnamed Program'}</h2>
              <p className="shift-datetime">
                {selectedShift.date ? new Date(selectedShift.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Unknown date'} | 
                {selectedShift.start_time || '00:00'} - {selectedShift.end_time || '00:00'}
              </p>
            </div>
            
            <div className="modal-body">
              {/* Staff Section */}
              <div className="shift-detail-section">
                <h3>Staff Assigned</h3>
                <div className="staff-list">
                  {Array.isArray(selectedShift.staff) ? selectedShift.staff.map((staffMember, idx) => {
                    if (!staffMember) return null;
                    
                    // Find full staff data with SCHADS info
                    const fullStaffData = staffData.find(s => s && s.id === staffMember.id) || staffMember;
                    const schadsLevel = fullStaffData.schads_level || 1;
                    const hourlyRate = fullStaffData.hourly_rate || 25.0;
                    
                    return (
                      <div key={idx} className="staff-list-item">
                        <div className="staff-info">
                          <span className="staff-name">
                            {staffMember.first_name || ''} {staffMember.last_name || ''}
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
                  }) : (
                    <div className="no-staff">No staff assigned</div>
                  )}
                </div>
              </div>
              
              {/* Participant Section */}
              {selectedShift.participants && Array.isArray(selectedShift.participants) && selectedShift.participants.length > 0 && (
                <div className="shift-detail-section">
                  <h3>Participants</h3>
                  <div className="participants-list">
                    {selectedShift.participants.map((participant, idx) => participant && (
                      <div key={idx} className="participant-item">
                        <span className="participant-name">
                          {participant.first_name || ''} {participant.last_name || ''}
                        </span>
                        
                        {(participant.supervision_multiplier || 1) > 1 && (
                          <span 
                            className="supervision-multiplier"
                            title="Supervision multiplier impacts staffing requirements"
                          >
                            {participant.supervision_multiplier || 1}x
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
                      {`${calculateShiftDuration(selectedShift).toFixed(1)} hours`}
                    </span>
                  </div>
                  
                  <div className="financial-row">
                    <span className="row-label">Staff Cost</span>
                    <span className="row-value">
                      {formatCurrency((() => {
                        const hours = calculateShiftDuration(selectedShift);
                        
                        return Array.isArray(selectedShift.staff) ? 
                          selectedShift.staff.reduce((total, staffMember) => {
                            if (!staffMember) return total;
                            
                            // Find full staff data with SCHADS info
                            const fullStaffData = staffData.find(s => s && s.id === staffMember.id) || staffMember;
                            const hourlyRate = fullStaffData.hourly_rate || 25.0;
                            
                            return total + (hours * hourlyRate);
                          }, 0) : 0;
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
                        const hours = calculateShiftDuration(selectedShift);
                        
                        return Array.isArray(selectedShift.staff) ? 
                          selectedShift.staff.reduce((total, staffMember) => {
                            if (!staffMember) return total;
                            
                            // Find full staff data with SCHADS info
                            const fullStaffData = staffData.find(s => s && s.id === staffMember.id) || staffMember;
                            const hourlyRate = fullStaffData.hourly_rate || 25.0;
                            
                            return total + (hours * hourlyRate);
                          }, 0) : 0;
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
                  try {
                    const notesElement = document.querySelector('.shift-notes textarea');
                    if (notesElement) {
                      handleShiftNoteUpdate(selectedShift.id, notesElement.value);
                    }
                  } catch (err) {
                    console.error('Error saving notes:', err);
                    alert('Failed to save notes. Please try again.');
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
                {timesheetData.dateRange?.startDate?.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) || 'Unknown'} - 
                {timesheetData.dateRange?.endDate?.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) || 'Unknown'}
              </p>
            </div>
            
            <div className="modal-body">
              <div className="timesheet-summary">
                <div className="summary-item">
                  <span className="item-label">Total Staff</span>
                  <span className="item-value">{Array.isArray(timesheetData.staff) ? timesheetData.staff.length : 0}</span>
                </div>
                <div className="summary-item">
                  <span className="item-label">Total Hours</span>
                  <span className="item-value">{(timesheetData.totalHours || 0).toFixed(1)}</span>
                </div>
                <div className="summary-item">
                  <span className="item-label">Total Cost</span>
                  <span className="item-value">{formatCurrency(timesheetData.totalCost || 0)}</span>
                </div>
                <div className="summary-item">
                  <span className="item-label">Pending Notes</span>
                  <span className="item-value">
                    {(timesheetData.pendingShiftNotes || 0) > 0 ? (
                      <span className="warning">{timesheetData.pendingShiftNotes}</span>
                    ) : (
                      <span className="success">None</span>
                    )}
                  </span>
                </div>
              </div>
              
              {(timesheetData.pendingShiftNotes || 0) > 0 && (
                <div className="warning-message">
                  <p>⚠️ {timesheetData.pendingShiftNotes} shifts have incomplete notes. These shifts will be excluded from the export.</p>
                </div>
              )}
              
              <h3>Staff Included in Export</h3>
              <div className="timesheet-staff-list">
                {Array.isArray(timesheetData.staff) ? timesheetData.staff.map((staffMember, idx) => staffMember && (
                  <div key={idx} className="timesheet-staff-item">
                    <div className="staff-info">
                      <span className="staff-name">
                        {staffMember.first_name || ''} {staffMember.last_name || ''}
                      </span>
                      <span 
                        className="schads-badge"
                        style={{ backgroundColor: getSchadsColor(staffMember.schads_level) }}
                      >
                        L{staffMember.schads_level || 1}
                      </span>
                    </div>
                    
                    <div className="staff-timesheet-info">
                      <span className="hours">{(staffMember.hours || 0).toFixed(1)} hrs</span>
                      <span className="cost">{formatCurrency(staffMember.cost || 0)}</span>
                      {(staffMember.pendingNotes || 0) > 0 && (
                        <span className="pending-indicator">
                          {staffMember.pendingNotes} pending
                        </span>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="no-staff">No staff data available</div>
                )}
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
                  try {
                    const selectedFormat = document.querySelector('input[name="format"]:checked')?.value || 'xero';
                    handleTimesheetExport(selectedFormat);
                  } catch (err) {
                    console.error('Error exporting timesheets:', err);
                    alert('Failed to export timesheets. Please try again.');
                  }
                }}
              >
                Export Timesheets
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  } catch (renderError) {
    console.error('Error rendering Roster component:', renderError);
    return (
      <div className="error-boundary">
        <h2>Something went wrong</h2>
        <p>There was an error rendering the roster page. Please try refreshing.</p>
        <button onClick={() => window.location.reload()}>Refresh Page</button>
        <div className="error-details">
          <pre>{renderError.message}</pre>
        </div>
      </div>
    );
  }
};

export default Roster;
