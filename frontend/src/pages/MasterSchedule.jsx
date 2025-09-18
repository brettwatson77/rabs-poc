import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import '../styles/MasterSchedule.css';

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
// Short weekday → index offset (Mon = 0)
const DOW = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
// Build Monday-based strip of {date} objects of given length
const buildWindowDates = (days = 14) => {
  const now = new Date();
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).format(now);
  const offset = DOW[short] ?? 0; // days since Monday
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12)); // UTC noon avoids DST
  base.setUTCDate(base.getUTCDate() - offset);
  const arr = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    arr.push({ date: fmtYmdTZ(d) });
  }
  return arr;
};

/**
 * Master Schedule Page
 * Shows program/event cards from loom instances in a date-based view
 */
const MasterSchedule = () => {
  // State for window and instances
  const [loading, setLoading] = useState(true);
  const [windowDates, setWindowDates] = useState([]);
  const [instances, setInstances] = useState([]);
  // No error banner state (was unused)
  
  // Fetch organization settings and window dates
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // First get org settings for window days
        const settingsResponse = await axios.get(`${API_URL}/api/v1/settings/org`);
        const days = settingsResponse.data?.data?.loom_window_days || 14;
        
        // Build Sydney-aware date strip
        const datesArr = buildWindowDates(days);
        setWindowDates(datesArr);

        // Call loom/window just for availability check
        try {
          await axios.get(`${API_URL}/api/v1/loom/window`, { params: { days } });
        } catch (wErr) {
          console.error(`Failed GET ${API_URL}/api/v1/loom/window`, wErr?.response?.status);
        }

        // Always attempt to fetch instances
        fetchInstancesForRange(datesArr);
      } catch (err) {
        // HTTP failure or network issue – show banner
        console.error(`Failed GET ${API_URL}/api/v1/settings/org`, err?.response?.status);
        // Fallback dates so page still renders
        generateWindowDates(14);
      }
    };
    
    fetchSettings();
  }, []);
  
  // Generate dates helper (start Monday) for fallback
  const generateWindowDates = (days = 14) => {
    setWindowDates(buildWindowDates(days));
    setLoading(false);
  };
  
  // Fetch instances for date range
  const fetchInstancesForRange = async (dates) => {
    if (!dates || dates.length === 0) return;
    
    setLoading(true);
    try {
      const startDate = dates[0].date;
      const endDate = dates[dates.length - 1].date;
      
      const response = await axios.get(`${API_URL}/api/v1/loom/instances`, {
        params: {
          startDate,
          endDate
        }
      });
      
      if (response.data && response.data.success) {
        setInstances(response.data.data);
      } else {
        throw new Error('Failed to fetch instances data');
      }
    } catch (err) {
      console.error(`Failed GET ${API_URL}/api/v1/loom/instances`, err?.response?.status);
    } finally {
      setLoading(false);
    }
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
      // Refresh current window
      fetchInstancesForRange(windowDates);
    } catch (err) {
      console.error(
        `Failed DELETE ${API_URL}/api/v1/templates/rules/${ruleId}`,
        err?.response?.status
      );
      window.alert('Failed to delete program – see console for details.');
    }
  };

  // Get instances for a specific day
  const getInstancesForDay = (dateStr) => {
    // normalise both DB string and target day to YYYY-MM-DD to avoid TZ issues
    const norm = (d) => fmtYmdTZ(new Date(d));
    return instances.filter(instance => norm(instance.instance_date) === dateStr);
  };
  
  // Format day header
  const formatDayHeader = (dateStr) => {
    const day = new Date(dateStr);
    const todayYmd = fmtYmdTZ(new Date());
    const isToday = dateStr === todayYmd;
    const dayName = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      weekday: 'short',
    }).format(day);
    const dayNum = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      day: 'numeric',
    }).format(day);
    const month = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      month: 'short',
    }).format(day);
    
    return (
      <div className={`day-header ${isToday ? 'today' : ''}`}>
        <div className="day-name">{dayName}</div>
        <div className="day-number">{dayNum}</div>
        <div className="day-month">{month}</div>
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
  
  return (
    <div className="master-schedule">
      <div className="schedule-header">
        <h1>Master Schedule</h1>
        <Link to="/template-wizard" className="create-button glass-button">
          Create Program
        </Link>
      </div>
      
      {loading && (
        <div className="loading">Loading schedule window...</div>
      )}
      
      {/* Date-based Calendar Grid */}
      <div
        className="calendar-grid"
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridTemplateColumns: `repeat(${windowDates.length}, minmax(280px, 1fr))`,
          gap: '16px',
          overflowX: 'auto'
        }}
      >
        {windowDates.map((dateObj, index) => (
          <div 
            key={index} 
            className="day-column glass-panel"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            {formatDayHeader(dateObj.date)}
            
            <div className="day-instances">
              {loading ? (
                <div className="loading-placeholder">Loading...</div>
              ) : getInstancesForDay(dateObj.date).length > 0 ? (
                getInstancesForDay(dateObj.date).map(instance => (
                  <div key={instance.id} className="program-card glass-card">
                    <button
                      className="delete-btn"
                      title="Delete program"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRule(instance.source_rule_id);
                      }}
                    >
                      ×
                    </button>
                    <h3>{instance.program_name || instance.source_rule_id}</h3>
                    <p className="time">
                      {formatTime(instance.start_time)} - {formatTime(instance.end_time)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="empty-day">
                  <span style={{ textAlign: 'center', padding: '24px 0' }}>
                    No programs scheduled
                  </span>
                </div>
              )}
            </div>
            {/* CTA always at bottom of tile */}
            <div className="day-cta">
              <Link to="/template-wizard" className="create-link">
                Create Program
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MasterSchedule;
