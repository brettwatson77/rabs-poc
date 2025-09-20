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
        fmtYmdTZ(addDays(startMonday, i))
      ),
    [startMonday]
  );
  
  // State for loading and instances data
  const [loading, setLoading] = useState(true);
  const [instancesByDate, setInstancesByDate] = useState({});
  
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
      
      // Refresh current window data
      fetchInstancesForRange();
    } catch (err) {
      console.error(
        `Failed DELETE ${API_URL}/api/v1/templates/rules/${ruleId}`,
        err?.response?.status
      );
      window.alert('Failed to delete program – see console for details.');
    }
  };
  
  // Fetch instances for the current date range
  const fetchInstancesForRange = async () => {
    if (!dates || dates.length === 0) return;
    
    setLoading(true);
    try {
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];
      
      const response = await axios.get(`${API_URL}/api/v1/loom/instances`, {
        params: {
          startDate,
          endDate
        }
      });
      
      if (response.data && response.data.success) {
        // Group instances by date
        const instanceMap = {};
        
        // Initialize empty arrays for all dates
        dates.forEach(date => {
          instanceMap[date] = [];
        });
        
        // Populate with instances
        response.data.data.forEach(instance => {
          // Normalize date format to match our date keys
          const instanceDate = instance.instance_date.split('T')[0];
          if (instanceMap[instanceDate]) {
            instanceMap[instanceDate].push(instance);
          }
        });
        
        setInstancesByDate(instanceMap);
      } else {
        throw new Error('Failed to fetch instances data');
      }
    } catch (error) {
      console.error('Error fetching loom instances:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch instances when dates change
  useEffect(() => {
    fetchInstancesForRange();
  }, [dates]);
  
  // Format day header
  const formatDayHeader = (dateStr) => {
    // Helper: parse 'YYYY-MM-DD' into a Date anchored at 12:00 UTC
    const parseYmdToNoonUTC = (ymd) => {
      const [y, m, d] = ymd.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d, 12));
    };

    const day = parseYmdToNoonUTC(dateStr);
    const todayYmd = fmtYmdTZ(new Date());
    const isToday = dateStr === todayYmd;
    
    return (
      <div className={`day-header ${isToday ? 'today' : ''}`}>
        <div className="day-name">
          {new Intl.DateTimeFormat('en-AU', {
            timeZone: TZ,
            weekday: 'short',
          }).format(day)}
        </div>
        <div className="day-number">
          {new Intl.DateTimeFormat('en-AU', {
            timeZone: TZ,
            day: 'numeric',
          }).format(day)}
        </div>
        <div className="day-month">
          {new Intl.DateTimeFormat('en-AU', {
            timeZone: TZ,
            month: 'short',
          }).format(day)}
        </div>
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
  
  // Render a program card with consistent styling
  const renderProgramCard = (instance) => {
    return (
      <div 
        key={instance.id} 
        className="program-card glass-card"
        style={{
          padding: '8px',
          marginBottom: '8px',
          borderRadius: '8px',
          position: 'relative'
        }}
      >
        <button
          className="delete-btn"
          title="Delete program"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteRule(instance.source_rule_id);
          }}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255, 59, 48, 0.8)',
            color: 'white',
            fontSize: '16px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1
          }}
        >
          ×
        </button>
        <strong>{instance.program_name || instance.source_rule_id}</strong>
        <div>
          {instance.start_time && instance.end_time && (
            <div className="time">
              {formatTime(instance.start_time)} - {formatTime(instance.end_time)}
            </div>
          )}
          {instance.venue_name && <div className="venue">{instance.venue_name}</div>}
        </div>
      </div>
    );
  };
  
  return (
    <div className="master-schedule full-bleed">
      <div className="schedule-header">
        <h1>Schedule</h1>
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
          onClick={() =>
            setStartMonday(startOfWeek(new Date(), { weekStartsOn: 1 }))
          }
          style={{ minWidth: '100px' }}
        >
          Today
        </button>

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
        <div className="full-bleed fortnight-view" style={{ overflowX: 'auto' }}>
          {/* Week 1 (first 7 days) */}
          <div
            className="week-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}
          >
            {dates.slice(0, 7).map((date) => {
              const dayInstances = instancesByDate[date] || [];
              // Sort instances by start_time
              const sortedInstances = [...dayInstances].sort((a, b) => 
                a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0
              );
              
              return (
                <div key={date} className="day-column glass-panel">
                  {formatDayHeader(date)}
                  
                  <div className="day-instances">
                    {sortedInstances.length === 0 ? (
                      <div className="empty-day">
                        <span>No programs scheduled</span>
                      </div>
                    ) : (
                      sortedInstances.map(instance => renderProgramCard(instance))
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
              gridTemplateColumns: 'repeat(7, minmax(200px, 1fr))',
              gap: '16px'
            }}
          >
            {dates.slice(7, 14).map((date) => {
              const dayInstances = instancesByDate[date] || [];
              // Sort instances by start_time
              const sortedInstances = [...dayInstances].sort((a, b) => 
                a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0
              );
              
              return (
                <div key={date} className="day-column glass-panel">
                  {formatDayHeader(date)}
                  
                  <div className="day-instances">
                    {sortedInstances.length === 0 ? (
                      <div className="empty-day">
                        <span>No programs scheduled</span>
                      </div>
                    ) : (
                      sortedInstances.map(instance => renderProgramCard(instance))
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
