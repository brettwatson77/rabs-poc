import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import '../styles/MasterSchedule.css';
import { format, startOfWeek, addDays, subDays } from 'date-fns';

// API base URL from environment (matches Dashboard pattern)
const API_URL = import.meta.env.VITE_API_URL || '';

/* ------------------------------------------------------------------
   Time-zone helpers – all dates displayed/stored as Australia/Sydney
   ------------------------------------------------------------------ */
const TZ = 'Australia/Sydney';
// Format Date → 'YYYY-MM-DD' in Sydney TZ
const fmtYmdTZ = (d) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

/**
 * Master Schedule Page
 * Shows program/event cards from loom instances in a date-based view
 */
const MasterSchedule = () => {
  // Track current fortnight via its starting Monday
  const [startMonday, setStartMonday] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // Derive the 14-day string array from startMonday
  const dates = React.useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) =>
        addDays(startMonday, i).toISOString().split('T')[0]
      ),
    [startMonday]
  );
  
  // State for loading and shift data
  const [loading, setLoading] = useState(true);
  const [shiftsByDate, setShiftsByDate] = useState({});
  
  // Human-readable label for the current 14-day window (Mon .. Sun)
  const fortnightLabel = `${format(startMonday, 'EEE d MMM')} — ${format(
    addDays(startMonday, 13),
    'EEE d MMM',
  )}`;

  const handlePrevFortnight = () => {
    setStartMonday((prev) => subDays(prev, 14));
  };

  const handleNextFortnight = () => {
    setStartMonday((prev) => addDays(prev, 14));
  };
  
  // Fetch roster data for the current fortnight
  useEffect(() => {
    const fetchRosterData = async () => {
      setLoading(true);
      try {
        const promises = dates.map((date) =>
          axios
            .get(`${API_URL}/api/v1/roster/day`, { params: { date } })
            .catch((err) => {
              console.error(`Failed GET /roster/day?date=${date}`, err?.response?.status);
              return null;
            })
        );

        const results = await Promise.all(promises);
        const shiftsMap = {};
        
        results.forEach((res, idx) => {
          const dateKey = dates[idx];
          if (res && res.data?.success) {
            shiftsMap[dateKey] = res.data.data.shifts || [];
          } else {
            shiftsMap[dateKey] = [];
          }
        });
        
        setShiftsByDate(shiftsMap);
      } catch (error) {
        console.error('Error fetching roster data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRosterData();
  }, [dates]);
  
  // Delete a rule and refresh instances
  const handleDeleteRule = async (ruleId) => {
    if (!ruleId) return;
    const confirmMsg =
      'Delete this program template and all its scheduled instances?';
    if (!window.confirm(confirmMsg)) return;

    try {
      await axios.delete(
        `${API_URL}/api/v1/templates/rules/${ruleId}`
      );
      
      // Refresh current fortnight data
      const promises = dates.map((date) =>
        axios
          .get(`${API_URL}/api/v1/roster/day`, { params: { date } })
          .catch((err) => {
            console.error(`Failed GET /roster/day?date=${date}`, err?.response?.status);
            return null;
          })
      );

      const results = await Promise.all(promises);
      const shiftsMap = {};
      
      results.forEach((res, idx) => {
        const dateKey = dates[idx];
        if (res && res.data?.success) {
          shiftsMap[dateKey] = res.data.data.shifts || [];
        } else {
          shiftsMap[dateKey] = [];
        }
      });
      
      setShiftsByDate(shiftsMap);
    } catch (err) {
      console.error(
        `Failed DELETE ${API_URL}/api/v1/templates/rules/${ruleId}`,
        err?.response?.status
      );
      window.alert('Failed to delete program – see console for details.');
    }
  };
  
  // Format day header
  const formatDayHeader = (dateStr) => {
    const day = new Date(dateStr);
    const todayYmd = fmtYmdTZ(new Date());
    const isToday = dateStr === todayYmd;
    
    return (
      <div className={`day-header ${isToday ? 'today' : ''}`}>
        <div className="day-name">{format(day, 'EEE')}</div>
        <div className="day-number">{format(day, 'd')}</div>
        <div className="day-month">{format(day, 'MMM')}</div>
      </div>
    );
  };
  
  // Format time for display
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    // Handle both HH:MM:SS and HH:MM formats
    const timeParts = timeStr.split(':');
    const hours = parseInt(timeParts[0], 10);
    const minutes = timeParts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  };
  
  // Render a shift card with consistent styling
  const renderShiftCard = (shift) => {
    return (
      <div 
        key={shift.shift_id} 
        className="shift-card glass-card"
        style={{
          padding: '8px',
          marginBottom: '8px',
          borderRadius: '8px',
          position: 'relative'
        }}
      >
        <strong>{shift.program_name}</strong>
        <div>
          {shift.start_time && shift.end_time && (
            <div className="time">
              {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
            </div>
          )}
          {shift.venue_name && <div className="venue">{shift.venue_name}</div>}
        </div>
        {shift.status !== 'assigned' ? (
          <span 
            className={`status-tag ${shift.status}`}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              backgroundColor: shift.status === 'open' ? '#f59e0b' : '#3b82f6',
              color: 'white'
            }}
          >
            {shift.status === 'open' ? 'Open' : 'Auto'}
          </span>
        ) : (
          <div className="staff-name">{shift.staff_name}</div>
        )}
      </div>
    );
  };
  
  return (
    <div className="master-schedule">
      <div className="schedule-header">
        <h1>Master Schedule</h1>
        <Link to="/template-wizard" className="create-button glass-button">
          Create Program
        </Link>
      </div>
      
      {/* Fortnight navigation */}
      <div
        className="fortnight-nav glass-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
          padding: '12px'
        }}
      >
        <button
          className="btn nav-button"
          onClick={handlePrevFortnight}
          style={{ minWidth: '140px' }}
        >
          Previous&nbsp;Fortnight
        </button>

        <div
          style={{
            flex: 1,
            textAlign: 'center',
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          {fortnightLabel}
        </div>

        <button
          className="btn nav-button"
          onClick={handleNextFortnight}
          style={{ minWidth: '140px' }}
        >
          Next&nbsp;Fortnight
        </button>
      </div>
      
      {loading && (
        <div className="loading">Loading schedule window...</div>
      )}
      
      {!loading && (
        <div className="fortnight-view">
          {/* Week 1 (first 7 days) */}
          <div
            className="week-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}
          >
            {dates.slice(0, 7).map((date) => {
              const dayShifts = shiftsByDate[date] || [];
              // Sort shifts by start_time
              const sortedShifts = [...dayShifts].sort((a, b) => 
                a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0
              );
              
              return (
                <div key={date} className="day-column glass-panel">
                  {formatDayHeader(date)}
                  
                  <div className="day-shifts">
                    {sortedShifts.length === 0 ? (
                      <div className="empty-day">
                        <span>No shifts scheduled</span>
                      </div>
                    ) : (
                      sortedShifts.map(shift => renderShiftCard(shift))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Week 2 (next 7 days) */}
          <div
            className="week-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(220px, 1fr))',
              gap: '16px'
            }}
          >
            {dates.slice(7, 14).map((date) => {
              const dayShifts = shiftsByDate[date] || [];
              // Sort shifts by start_time
              const sortedShifts = [...dayShifts].sort((a, b) => 
                a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0
              );
              
              return (
                <div key={date} className="day-column glass-panel">
                  {formatDayHeader(date)}
                  
                  <div className="day-shifts">
                    {sortedShifts.length === 0 ? (
                      <div className="empty-day">
                        <span>No shifts scheduled</span>
                      </div>
                    ) : (
                      sortedShifts.map(shift => renderShiftCard(shift))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterSchedule;
