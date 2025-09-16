import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import '../styles/MasterSchedule.css';
import { startOfWeek, addDays } from 'date-fns';

// API base URL from environment (matches Dashboard pattern)
const API_URL = import.meta.env.VITE_API_URL || '';

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
        
        // Build date strip starting from Monday of current week
        const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
        const datesArr = [];
        for (let i = 0; i < days; i++) {
          const d = addDays(monday, i);
          datesArr.push({ date: d.toISOString().split('T')[0] });
        }
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
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const datesArr = [];
    for (let i = 0; i < days; i++) {
      datesArr.push({ date: addDays(monday, i).toISOString().split('T')[0] });
    }
    setWindowDates(datesArr);
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
  
  // Get instances for a specific day
  const getInstancesForDay = (dateStr) => {
    // normalise both DB string and target day to YYYY-MM-DD to avoid TZ issues
    const norm = (d) => new Date(d).toISOString().split('T')[0];
    return instances.filter(instance => norm(instance.instance_date) === dateStr);
  };
  
  // Format day header
  const formatDayHeader = (dateStr) => {
    const day = new Date(dateStr);
    const isToday = dateStr === new Date().toISOString().split('T')[0];
    const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = day.getDate();
    const month = day.toLocaleDateString('en-US', { month: 'short' });
    
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
                    <h3>{instance.source_rule_id}</h3>
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
