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
 * 
 * Now Loom-aware: Reads from perpetual calendar system instead of static cards
 */
const MasterSchedule = () => {
  const { simulatedDate, setSimulatedDate } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scheduleData, setScheduleData] = useState([]);
  
  // Loom system state
  const [loomWindow, setLoomWindow] = useState({ start: null, end: null });
  const [nextRollTime, setNextRollTime] = useState(null);
  const [showFutureDatePicker, setShowFutureDatePicker] = useState(false);
  const [futureDate, setFutureDate] = useState(null);
  
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

  /* ------------------------------------------------------------------
   * Repeating Program – Enhanced Create-Modal form state management
   * ------------------------------------------------------------------
   *  • programForm – holds all fields required for a flexible, repeating
   *    program (including advanced slot-based breakdown for dashboard).
   *  • nextSlotId  – simple counter for generating unique ids for new
   *    time-slots on the fly.
   *  • slotTypes & repeatPatterns – dropdown meta for easy maintenance.
   * ------------------------------------------------------------------ */
  const [programForm, setProgramForm] = useState({
    // Basic details
    name: '',
    type: 'center_based',               // centre_based | community | transport …
    notes: '',

    // Repeating pattern
    isRepeating: false,
    repeatPattern: 'none',              // none | weekly | fortnightly | monthly
    repeatEnd: '',                      // yyyy-mm-dd

    // Core timing
    startDate: '',                      // yyyy-mm-dd (defaults to selectedDay)
    startTime: '08:30',
    endTime: '16:30',

    // Fine-grained slot breakdown (array of {id, startTime, endTime, type, description})
    timeSlots: [
      { id: 1, startTime: '08:30', endTime: '09:30', type: 'pickups', description: '' }
    ],

    // Participants & billing
    participants: [],                   // array of participant ids
    billingCodes: [],                   // array of code ids

    // Staffing
    staffAssignment: 'auto'             // auto | assign_now
  });

  const [nextSlotId, setNextSlotId] = useState(2);

  // Static dropdown helpers
  const slotTypes = [
    { value: 'pickups',   label: '1) Pickups' },
    { value: 'activity',  label: '2) Activity/Program' },
    { value: 'dropoffs',  label: '3) Dropoffs' },
    { value: 'meal',      label: '4) Meal' },
    { value: 'other',     label: '5) Other' }
  ];

  const repeatPatterns = [
    { value: 'none',       label: 'One-time event' },
    { value: 'weekly',     label: 'Weekly' },
    { value: 'fortnightly',label: 'Every 2 Weeks' },
    { value: 'monthly',    label: 'Monthly' }
  ];

  /* ------------------------------------------------------------------
   *  NDIS Billing Code Options  (for dropdown)
   * ------------------------------------------------------------------ */
  const ndisCodeOptions = [
    { value: '01_011_0103_6_1', label: '01_011_0103_6_1 - Individual Skills Development' },
    { value: '01_013_0117_6_1', label: '01_013_0117_6_1 - Group Community Access' },
    { value: '01_015_0120_6_1', label: '01_015_0120_6_1 - Transport to Community Activities' },
    { value: '04_104_0136_6_1', label: '04_104_0136_6_1 - Assistance with Daily Living' },
    { value: '07_011_0115_6_1', label: '07_011_0115_6_1 - Participation in Community' },
    { value: '08_001_0128_6_1', label: '08_001_0128_6_1 - Plan Management' },
    { value: '15_001_0107_1_3', label: '15_001_0107_1_3 - Innovative Community Participation' },
    { value: '04_799_0136_6_1', label: '04_799_0136_6_1 - Other Assistance with Daily Living' }
  ];

  /* ------------------------------------------------------------------
   *  Billing – track hours & codes for each participant id
   * ------------------------------------------------------------------ */
  const [billingData, setBillingData] = useState({});

  const updateParticipantBilling = (
    participantId,
    field,
    value,
    codeIndex = null
  ) => {
    setBillingData((prev) => {
      // ensure base structure
      const currentParticipant =
        prev[participantId] || { hours: '', codes: [{ code: '', hours: '' }] };

      // Update total hours
      if (field === 'hours' && codeIndex === null) {
        return {
          ...prev,
          [participantId]: {
            ...currentParticipant,
            hours: value
          }
        };
      }

      // Update specific code entry (code / codeHours)
      if (field === 'code' || field === 'codeHours') {
        const newCodes = [...(currentParticipant.codes || [])];

        // Ensure target index exists
        if (!newCodes[codeIndex]) {
          newCodes[codeIndex] = { code: '', hours: '' };
        }

        if (field === 'code') newCodes[codeIndex].code = value;
        if (field === 'codeHours') newCodes[codeIndex].hours = value;

        return {
          ...prev,
          [participantId]: {
            ...currentParticipant,
            codes: newCodes
          }
        };
      }

      return prev;
    });
  };

  // Add a blank billing code row for participant
  const addBillingCode = (participantId) => {
    setBillingData((prev) => {
      const currentParticipant =
        prev[participantId] || { hours: '', codes: [{ code: '', hours: '' }] };
      return {
        ...prev,
        [participantId]: {
          ...currentParticipant,
          codes: [...currentParticipant.codes, { code: '', hours: '' }]
        }
      };
    });
  };

  // Remove billing code row (keep at least one)
  const removeBillingCode = (participantId, codeIndex) => {
    setBillingData((prev) => {
      const currentParticipant =
        prev[participantId] || { hours: '', codes: [{ code: '', hours: '' }] };
      const newCodes = currentParticipant.codes.filter(
        (_, idx) => idx !== codeIndex
      );
      return {
        ...prev,
        [participantId]: {
          ...currentParticipant,
          codes: newCodes.length > 0 ? newCodes : [{ code: '', hours: '' }]
        }
      };
    });
  };
  
  // Modal states
  const [showCardModal, setShowCardModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFinancialModal, setShowFinancialModal] = useState(false);

  /* ------------------------------------------------------------------
   * Participants list for the Create-Program modal
   * ------------------------------------------------------------------ */
  const [participantsList, setParticipantsList] = useState([]);

  // Fetch all participants once when component mounts
  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const res = await axios.get('/api/v1/participants');
        if (res.data && res.data.success) {
          setParticipantsList(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch participants list', err);
      }
    };
    fetchParticipants();
  }, []);
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
  
  // Fetch loom window information
  const fetchLoomWindow = async () => {
    try {
      const response = await axios.get('/api/v1/loom/window');
      
      if (response.data && response.data.success) {
        setLoomWindow({
          start: new Date(response.data.data.start),
          end: new Date(response.data.data.end)
        });
        
        // Next roll is typically at 00:05 Sydney time the next day
        const nextRoll = new Date();
        nextRoll.setDate(nextRoll.getDate() + 1);
        nextRoll.setHours(0, 5, 0, 0);
        setNextRollTime(nextRoll);
      }
    } catch (err) {
      console.error('Error fetching loom window:', err);
    }
  };
  
  // Fetch schedule data from loom instances instead of cards
  const fetchScheduleData = async () => {
    if (!currentWeekStart) return;
    
    setLoading(true);
    try {
      const endDate = new Date(currentWeekStart);
      endDate.setDate(currentWeekStart.getDate() + (viewMode === 'week' ? 6 : 13));
      
      // Use loom instances API instead of cards API
      const response = await axios.get('/api/v1/loom/instances', {
        params: {
          startDate: formatDateForApi(currentWeekStart),
          endDate: formatDateForApi(endDate)
        }
      });
      
      if (response.data && response.data.success) {
        // Guard: if API returned no instances yet, show empty schedule
        if (!Array.isArray(response.data.data) || response.data.data.length === 0) {
          setScheduleData([]);
          setLoading(false);
          return;
        }

        // Transform loom instance data to match the existing card format, 
        // ensuring optional arrays are always defined.
        const transformedData = response.data.data.map(instance => {
          const participants = instance.participants || [];
          const staff        = instance.staff || [];

          return ({
          id: instance.id,
          title: instance.program_name,
          date: instance.date,
          startTime: instance.start_time,
          endTime: instance.end_time,
          type: 'MASTER',
          participants: participants.map(p => ({
            id: p.participant_id,
            first_name: p.first_name,
            last_name: p.last_name,
            supervision_multiplier: p.supervision_multiplier || 1.0,
            pickup_required: p.pickup_required,
            dropoff_required: p.dropoff_required
          })),
          staff: staff.map(s => ({
            id: s.staff_id,
            first_name: s.first_name,
            last_name: s.last_name,
            role: s.role,
            schadsLevel: s.schads_level,
            hourlyRate: s.hourly_rate
          })),
          financials: {
            revenue: instance.financials?.revenue || 0,
            staffCosts: instance.financials?.staff_costs || 0,
            adminCosts: instance.financials?.admin_costs || 0,
            profitLoss: instance.financials?.profit_loss || 0,
            profitMargin: instance.financials?.profit_margin || 0
          },
          // Add loom-specific properties
          hasIntents: instance.has_intents,
          hasExceptions: instance.has_exceptions,
          isAutoGenerated: instance.is_auto_generated,
          programId: instance.program_id,
          instanceId: instance.id
          });
        });
        
        setScheduleData(transformedData);
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
      fetchLoomWindow();
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
    
    // Check if day is outside loom window
    if (loomWindow.end && day > loomWindow.end) {
      setFutureDate(day);
      setShowFutureDatePicker(true);
    }
  };
  
  // Handle create new master card - now creates an intent
  const handleCreateMasterCard = async (formData) => {
    try {
      // Create an intent instead of directly creating a card
      const intentData = {
        intent_type: 'CREATE_PROGRAM',
        program_id: formData.programId,
        start_date: formData.startDate,
        end_date: formData.repeatEnd || null,
        days_of_week: formData.daysOfWeek || [],
        start_time: formData.startTime,
        end_time: formData.endTime,
        venue_id: formData.venueId,
        notes: formData.notes,
        participants: formData.participants
      };
      
      const response = await axios.post('/api/v1/intentions/intents', intentData);
      
      if (response.data && response.data.success) {
        setShowCreateModal(false);
        fetchScheduleData(); // Refresh data
      } else {
        throw new Error('Failed to create program intent');
      }
    } catch (err) {
      console.error('Error creating program intent:', err);
      alert('Failed to create program intent. Please try again.');
    }
  };
  
  // Handle edit master card - now creates an intent
  const handleEditMasterCard = async (cardId, formData) => {
    try {
      // Create an intent instead of directly editing
      const intentData = {
        intent_type: 'MODIFY_PROGRAM',
        program_id: formData.programId || selectedCard.programId,
        start_date: futureDate ? formatDateForApi(futureDate) : formatDateForApi(new Date()),
        end_date: formData.repeatEnd || null,
        start_time: formData.startTime,
        end_time: formData.endTime,
        venue_id: formData.venueId,
        notes: formData.notes,
        participants: formData.participants
      };
      
      const response = await axios.post('/api/v1/intentions/intents', intentData);
      
      if (response.data && response.data.success) {
        setShowCardModal(false);
        setShowFutureDatePicker(false);
        setFutureDate(null);
        fetchScheduleData(); // Refresh data
      } else {
        throw new Error('Failed to create modification intent');
      }
    } catch (err) {
      console.error('Error creating modification intent:', err);
      alert('Failed to create modification intent. Please try again.');
    }
  };
  
  // Handle delete master card - now creates a cancellation exception
  const handleDeleteMasterCard = async (cardId) => {
    if (!window.confirm('Are you sure you want to cancel this program?')) {
      return;
    }
    
    try {
      // Create a cancellation exception instead of deleting
      const exceptionData = {
        exception_type: 'PROGRAM_CANCELLATION',
        program_id: selectedCard.programId,
        exception_date: selectedCard.date,
        reason: 'User cancelled via Master Schedule',
      };
      
      const response = await axios.post('/api/v1/intentions/exceptions', exceptionData);
      
      if (response.data && response.data.success) {
        setShowCardModal(false);
        fetchScheduleData(); // Refresh data
      } else {
        throw new Error('Failed to create cancellation exception');
      }
    } catch (err) {
      console.error('Error creating cancellation exception:', err);
      alert('Failed to cancel program. Please try again.');
    }
  };
  
  // Handle optimize resources
  const handleOptimizeResources = async (cardId) => {
    try {
      const response = await axios.post(`/api/v1/loom/optimize/${selectedCard.instanceId}`);
      
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

  // Manual Loom Roll (Day-1 testing helper)
  const handleManualRoll = async () => {
    try {
      const response = await axios.post('/api/v1/loom/roll');
      if (response.data && response.data.success) {
        alert('Loom rolled successfully.');
        fetchScheduleData();
      } else {
        throw new Error('Roll failed');
      }
    } catch (err) {
      console.error('Error rolling loom:', err);
      alert('Failed to roll loom. Check server logs.');
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

  // Format next roll time
  const formatNextRollTime = () => {
    if (!nextRollTime) return 'Unknown';
    
    return nextRollTime.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' ' + nextRollTime.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short'
    });
  };
  
  // Format loom window range
  const formatLoomWindowRange = () => {
    if (!loomWindow.start || !loomWindow.end) return 'Loading...';
    
    const startStr = loomWindow.start.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short'
    });
    
    const endStr = loomWindow.end.toLocaleDateString('en-AU', {
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
        
        {/* Center section - View toggle */}
        <div className="view-toggle-container">
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

        {/* Right section - Action buttons */}
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
        </div>
      </div>
      
      {/*  --- Loom window info moved to sticky footer (see bottom) --- */}
      
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
                      className={`schedule-card-container ${card.hasIntents ? 'has-intents' : ''} ${card.hasExceptions ? 'has-exceptions' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(card);
                      }}
                    >
                      {/* Add loom status indicators */}
                      {card.hasIntents && <div className="intent-indicator" title="Has operator intents">●</div>}
                      {card.hasExceptions && <div className="exception-indicator" title="Has exceptions">●</div>}
                      {card.isAutoGenerated && <div className="auto-generated-indicator" title="Auto-generated">A</div>}
                      
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
        {/* Add loom status indicators to legend */}
        <div className="legend-item">
          <div className="legend-indicator intent-indicator">●</div>
          <span>Has Intents</span>
        </div>
        <div className="legend-item">
          <div className="legend-indicator exception-indicator">●</div>
          <span>Has Exceptions</span>
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
            {/* Add loom status badges */}
            <div className="loom-status-badges">
              {selectedCard.hasIntents && <span className="intent-badge">Modified</span>}
              {selectedCard.hasExceptions && <span className="exception-badge">Has Exceptions</span>}
              {selectedCard.isAutoGenerated && <span className="auto-badge">Auto-generated</span>}
            </div>
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
            
            {/* Future Date Picker for changes beyond current window */}
            {showFutureDatePicker && (
              <div className="card-detail-section future-date-section">
                <h3>Apply Changes From Date</h3>
                <p className="future-date-info">
                  This date is beyond the current loom window. Select when these changes should take effect:
                </p>
                <div className="future-date-picker">
                  <input 
                    type="date" 
                    value={futureDate ? formatDateForApi(futureDate) : ''}
                    onChange={(e) => setFutureDate(new Date(e.target.value))}
                    min={formatDateForApi(new Date())}
                  />
                  <p className="future-date-note">
                    Changes will apply "from this date forward" until you make another change.
                  </p>
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
                    // Set future date picker if needed
                    if (loomWindow.end && new Date(selectedCard.date) > loomWindow.end) {
                      setFutureDate(new Date(selectedCard.date));
                      setShowFutureDatePicker(true);
                    }
                    
                    // Would open edit form in real implementation
                    alert('Edit would create an intent "from this date forward" in a real implementation');
                  }}
                >
                  Edit Event
                </button>
                <button 
                  className="delete-button"
                  onClick={() => handleDeleteMasterCard(selectedCard.id)}
                >
                  Cancel Program
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
      
      {/* Revolutionary Repeating Programs Modal */}
      {showCreateModal && selectedDay && (
        <Modal onClose={() => setShowCreateModal(false)} className="advanced-program-modal">
          <div className="program-modal-header">
            <h2>Create Master Program</h2>
            <p className="modal-date">
              {selectedDay.toLocaleDateString('en-AU', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
            {/* Add future date notice */}
            {showFutureDatePicker && (
              <div className="future-date-notice">
                This date is beyond the current loom window. Your changes will be saved as future intents.
              </div>
            )}
          </div>

          <div className="program-modal-body">
            {/* Basic Program Info */}
            <div className="program-section">
              <h3>Program Details</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Program Name</label>
                  <input
                    type="text"
                    value={programForm.name}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, name: e.target.value })
                    }
                    placeholder="e.g., Saturday Adventure, Bowling Night"
                  />
                </div>
                <div className="form-group">
                  <label>Program Type</label>
                  <select
                    value={programForm.type}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, type: e.target.value })
                    }
                  >
                    <option value="center_based">Center Based</option>
                    <option value="social">Social</option>
                    <option value="evening_social">Evening Social</option>
                    <option value="birp_plus">BIRP+</option>
                    <option value="sil">SIL</option>
                    <option value="sta">STA</option>
                    <option value="cp">CP</option>
                    <option value="one_to_one">1:1</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Repeating Pattern */}
            <div className="program-section">
              <h3>Repeating Schedule</h3>
              <div className="repeating-controls">
                {/* Simplified checkbox – just says "Repeat" */}
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={programForm.isRepeating}
                    onChange={(e) =>
                      setProgramForm({
                        ...programForm,
                        isRepeating: e.target.checked,
                        repeatPattern: e.target.checked ? 'weekly' : 'none'
                      })
                    }
                  />
                  Repeat
                </label>

                {programForm.isRepeating && (
                  <div className="repeat-options">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Repeat Pattern</label>
                        <select
                          value={programForm.repeatPattern}
                          onChange={(e) =>
                            setProgramForm({
                              ...programForm,
                              repeatPattern: e.target.value
                            })
                          }
                        >
                          <option value="weekly">Every Week</option>
                          <option value="fortnightly">Every 2 Weeks</option>
                          <option value="monthly">Every Month</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>End Date (optional)</label>
                        <input
                          type="date"
                          value={programForm.repeatEnd}
                          onChange={(e) =>
                            setProgramForm({
                              ...programForm,
                              repeatEnd: e.target.value
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Time Slot Breakdown */}
            <div className="program-section">
              <h3>Time Slot Breakdown</h3>
              <p className="section-description">
                Break down your program into detailed time slots for accurate
                dashboard cards and billing
              </p>

              <div className="time-slots">
                {programForm.timeSlots.map((slot, index) => (
                  <div key={slot.id} className="time-slot-row">
                    <div className="slot-number">{index + 1}</div>

                    <div className="form-group">
                      <label>Start Time</label>
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => {
                          const newSlots = [...programForm.timeSlots];
                          newSlots[index].startTime = e.target.value;
                          setProgramForm({ ...programForm, timeSlots: newSlots });
                        }}
                      />
                    </div>

                    <div className="form-group">
                      <label>End Time</label>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => {
                          const newSlots = [...programForm.timeSlots];
                          newSlots[index].endTime = e.target.value;
                          setProgramForm({ ...programForm, timeSlots: newSlots });
                        }}
                      />
                    </div>

                    <div className="form-group">
                      <label>Activity Type</label>
                      <select
                        value={slot.type}
                        onChange={(e) => {
                          const newSlots = [...programForm.timeSlots];
                          newSlots[index].type = e.target.value;
                          setProgramForm({ ...programForm, timeSlots: newSlots });
                        }}
                      >
                        {slotTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {slot.type === 'other' && (
                      <div className="form-group">
                        <label>Description</label>
                        <input
                          type="text"
                          value={slot.description}
                          onChange={(e) => {
                            const newSlots = [...programForm.timeSlots];
                            newSlots[index].description = e.target.value;
                            setProgramForm({
                              ...programForm,
                              timeSlots: newSlots
                            });
                          }}
                          placeholder="Describe the activity"
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      className="remove-slot-btn"
                      onClick={() => {
                        const newSlots = programForm.timeSlots.filter(
                          (s) => s.id !== slot.id
                        );
                        setProgramForm({ ...programForm, timeSlots: newSlots });
                      }}
                    >
                      ❌
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="add-slot-btn"
                  onClick={() => {
                    const lastSlot =
                      programForm.timeSlots[programForm.timeSlots.length - 1];
                    const newSlot = {
                      id: nextSlotId,
                      startTime: lastSlot ? lastSlot.endTime : '09:00',
                      endTime: '10:00',
                      type: 'activity',
                      description: ''
                    };
                    setProgramForm({
                      ...programForm,
                      timeSlots: [...programForm.timeSlots, newSlot]
                    });
                    setNextSlotId(nextSlotId + 1);
                  }}
                >
                  ➕ Add Time Slot
                </button>
              </div>
            </div>

            {/* Participant Selection */}
            <div className="program-section">
              <h3>Participant Selection</h3>
              <div className="participant-selector">
                <div className="participant-search">
                  <input type="text" placeholder="Search participants..." />
                  <span className="search-icon">🔍</span>
                </div>

                <div className="participant-grid">
                  {participantsList.map((participant) => {
                      const participantId = participant.id;
                      return (
                        <div key={participantId} className="participant-card">
                          <div className="participant-label">
                            <input type="checkbox" id={participantId} />

                            <div className="participant-details">
                              <div className="participant-name">
                                {participant.first_name} {participant.last_name}
                              </div>

                              <div className="supervision">
                                Supervision:&nbsp;
                                {participant.supervision_multiplier
                                  ? `${participant.supervision_multiplier}x`
                                  : '1.0x'}
                              </div>

                              <div className="billing-inputs">
                                <div className="billing-field">
                                  <label>Total Hours:</label>
                                  <input
                                    type="number"
                                    step="0.25"
                                    min="0"
                                    max="8"
                                    placeholder="2.0"
                                    className="billing-hours-input"
                                    value={billingData[participantId]?.hours || ''}
                                    onChange={(e) =>
                                      updateParticipantBilling(participantId, 'hours', e.target.value)
                                    }
                                  />
                                </div>
                              </div>

                              {/* Multiple billing codes */}
                              <div className="billing-codes-section">
                                <label className="codes-section-label">Billing Codes:</label>
                                {(billingData[participantId]?.codes || [{ code: '', hours: '' }]).map(
                                  (codeEntry, codeIdx) => (
                                    <div key={codeIdx} className="code-entry">
                                      <select
                                        className="billing-code-select"
                                        value={codeEntry.code}
                                        onChange={(e) =>
                                          updateParticipantBilling(
                                            participantId,
                                            'code',
                                            e.target.value,
                                            codeIdx
                                          )
                                        }
                                      >
                                        <option value="">Select code...</option>
                                        {ndisCodeOptions.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        type="number"
                                        step="0.25"
                                        min="0"
                                        max="8"
                                        placeholder="2.5"
                                        className="code-hours-input"
                                        value={codeEntry.hours}
                                        onChange={(e) =>
                                          updateParticipantBilling(
                                            participantId,
                                            'codeHours',
                                            e.target.value,
                                            codeIdx
                                          )
                                        }
                                      />
                                      <button
                                        type="button"
                                        className="add-code-btn"
                                        onClick={() => addBillingCode(participantId)}
                                      >
                                        ➕
                                      </button>
                                      {(billingData[participantId]?.codes || []).length > 1 && (
                                        <button
                                          type="button"
                                          className="remove-code-btn"
                                          onClick={() => removeBillingCode(participantId, codeIdx)}
                                        >
                                          ❌
                                        </button>
                                      )}
                                    </div>
                                  )
                                )}
                              </div>

                              <div className="billing-hours">
                                Total: {billingData[participantId]?.hours || '0'} h &nbsp;|&nbsp;
                                Codes: {(billingData[participantId]?.codes || [{ code: '' }]).length}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>

            {/* Staff Assignment */}
            <div className="program-section">
              <h3>Staff Assignment</h3>
              <div className="staff-assignment-options">
                <div className="radio-group">
                  {['auto', 'assign_now'].map((mode) => (
                    <label key={mode} className="radio-label">
                      <input
                        type="radio"
                        name="staffAssignment"
                        value={mode}
                        checked={programForm.staffAssignment === mode}
                        onChange={(e) =>
                          setProgramForm({
                            ...programForm,
                            staffAssignment: e.target.value
                          })
                        }
                      />
                      <span>
                        {mode === 'auto'
                          ? 'Auto-assign based on availability'
                          : 'Assign now and make permanent'}
                      </span>
                      <p className="radio-description">
                        {mode === 'auto'
                          ? 'System will allocate available staff each occurrence.'
                          : 'Lock in the chosen staff for every repeat.'}
                      </p>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Additional Assist Staff – placeholder for future logic */}
            <div className="program-section">
              <h3>Additional Assist Staff (placeholder)</h3>
              <p className="section-description">
                Configure extra assist staff once participant count rules are calculated.
                (Coming soon)
              </p>
            </div>

            {/* Program Notes */}
            <div className="program-section">
              <h3>Program Notes</h3>
              <textarea
                rows="3"
                value={programForm.notes}
                placeholder="Special requirements, equipment needed, etc."
                onChange={(e) =>
                  setProgramForm({ ...programForm, notes: e.target.value })
                }
              />
            </div>
            
            {/* Future Date Picker for changes beyond current window */}
            {showFutureDatePicker && (
              <div className="program-section future-date-section">
                <h3>Apply Changes From Date</h3>
                <p className="future-date-info">
                  This date is beyond the current loom window. Select when these changes should take effect:
                </p>
                <div className="future-date-picker">
                  <input 
                    type="date" 
                    value={futureDate ? formatDateForApi(futureDate) : formatDateForApi(selectedDay)}
                    onChange={(e) => setFutureDate(new Date(e.target.value))}
                    min={formatDateForApi(new Date())}
                  />
                  <p className="future-date-note">
                    Program will be created "from this date forward" until any end date specified.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="program-modal-footer">
            <div className="footer-info">
              <div className="time-slots-preview">
                Will create {programForm.timeSlots.length} dashboard cards
              </div>
              {programForm.isRepeating && (
                <div className="repeat-info">
                  Repeating {programForm.repeatPattern}
                  {programForm.repeatEnd
                    ? ` until ${programForm.repeatEnd}`
                    : ' indefinitely'}
                </div>
              )}
            </div>

            <div className="footer-actions">
              <button
                onClick={() => setShowCreateModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                className="create-program-btn"
                onClick={() => {
                  // Create program intent instead of directly creating a program
                  const intentData = {
                    programId: null, // New program
                    name: programForm.name,
                    type: programForm.type,
                    startDate: futureDate ? formatDateForApi(futureDate) : formatDateForApi(selectedDay),
                    repeatPattern: programForm.isRepeating ? programForm.repeatPattern : 'none',
                    repeatEnd: programForm.repeatEnd,
                    startTime: programForm.timeSlots[0].startTime,
                    endTime: programForm.timeSlots[programForm.timeSlots.length - 1].endTime,
                    timeSlots: programForm.timeSlots,
                    participants: [], // Would be populated from selected participants
                    notes: programForm.notes,
                    staffAssignment: programForm.staffAssignment
                  };
                  
                  console.log('Creating program intent:', intentData);
                  handleCreateMasterCard(intentData);
                }}
              >
                Create Program
              </button>
            </div>
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

      {/* ---------- Sticky Footer with Live Loom Info ---------- */}
      <footer className="loom-footer">
        <div className="footer-content">
          <div className="footer-item">
            <strong>Loom Window:</strong>&nbsp;{formatLoomWindowRange()}
          </div>
          <div className="footer-item">
            <strong>Next Auto-Roll:</strong>&nbsp;{formatNextRollTime()}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MasterSchedule;
