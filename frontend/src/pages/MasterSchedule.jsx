import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/MasterSchedule.css';

// API base URL from environment (matches Dashboard pattern)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

/**
 * Master Schedule Page
 * Shows program/event cards from loom instances in a weekly calendar view
 */
const MasterSchedule = () => {
  // Local date state (replaces removed AppContext)
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [instances, setInstances] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  
  // Week navigation
  const [currentWeekStart, setCurrentWeekStart] = useState(null);
  const [weekDays, setWeekDays] = useState([]);
  
  // Form state for creating a new program
  const [programForm, setProgramForm] = useState({
    name: '',
    venue_id: '',
    startDate: '',
    startTime: '09:00',
    endTime: '15:00',
    isRepeating: false,
    repeatPattern: 'weekly',
    notes: ''
  });
  
  // Venues list for dropdown
  const [venuesList, setVenuesList] = useState([]);
  
  // Calculate week dates based on currentDate
  useEffect(() => {
    // Get Monday of current week
    const dayOfWeek = currentDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(currentDate);
    monday.setDate(currentDate.getDate() + diffToMonday);
    setCurrentWeekStart(monday);
    
    // Generate array of dates for the week
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      return day;
    });
    
    setWeekDays(days);
  }, [currentDate]);
  
  // Format date for API
  const formatDateForApi = (date) => {
    return date.toISOString().split('T')[0];
  };
  
  // Fetch schedule data
  const fetchInstances = async () => {
    if (!currentWeekStart) return;
    
    setLoading(true);
    try {
      const endDate = new Date(currentWeekStart);
      endDate.setDate(currentWeekStart.getDate() + 6);
      
      const response = await axios.get(`${API_URL}/api/v1/master-schedule/instances`, {
        params: {
          startDate: formatDateForApi(currentWeekStart),
          endDate: formatDateForApi(endDate)
        }
      });
      
      if (response.data && response.data.success) {
        setInstances(response.data.data);
      } else {
        throw new Error('Failed to fetch schedule data');
      }
    } catch (err) {
      console.error('Error fetching instances:', err);
      setError('Failed to load schedule. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch venues
  const fetchVenues = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/v1/venues`);
      if (response.data && response.data.success) {
        setVenuesList(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching venues:', err);
    }
  };
  
  // Load data when week changes
  useEffect(() => {
    if (currentWeekStart) {
      fetchInstances();
      fetchVenues();
    }
  }, [currentWeekStart]);
  
  // Handle week navigation
  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };
  
  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };
  
  // Handle day click for creating new program
  const handleDayClick = (day) => {
    setSelectedDay(day);
    setProgramForm({
      ...programForm,
      startDate: formatDateForApi(day)
    });
    setShowCreateModal(true);
  };
  
  // Handle create new program
  const handleCreateProgram = async () => {
    try {
      // Set up days of week array based on selected day
      const selectedDayOfWeek = new Date(programForm.startDate).getDay();
      const daysOfWeek = programForm.isRepeating 
        ? [selectedDayOfWeek] 
        : [selectedDayOfWeek];
      
      // Create program data
      const programData = {
        name: programForm.name,
        venue_id: programForm.venue_id,
        start_date: programForm.startDate,
        end_date: programForm.isRepeating ? null : programForm.startDate,
        repeat_pattern: programForm.isRepeating ? programForm.repeatPattern : 'none',
        days_of_week: daysOfWeek,
        start_time: programForm.startTime,
        end_time: programForm.endTime,
        notes: programForm.notes
      };
      
      const response = await axios.post(`${API_URL}/api/v1/programs`, programData);
      
      if (response.data && response.data.success) {
        setShowCreateModal(false);
        fetchInstances(); // Refresh data
        
        // Reset form
        setProgramForm({
          name: '',
          venue_id: '',
          startDate: '',
          startTime: '09:00',
          endTime: '15:00',
          isRepeating: false,
          repeatPattern: 'weekly',
          notes: ''
        });
      } else {
        throw new Error(response.data?.message || 'Failed to create program');
      }
    } catch (err) {
      console.error('Error creating program:', err);
      alert('Failed to create program: ' + (err.message || 'Unknown error'));
    }
  };
  
  // Get instances for a specific day
  const getInstancesForDay = (day) => {
    const dateStr = formatDateForApi(day);
    return instances.filter(instance => {
      // Handle both simple date strings and ISO strings
      return instance.date === dateStr || 
             (typeof instance.date === 'string' && instance.date.includes(dateStr));
    });
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
  
  // Format period display string
  const getPeriodDisplayString = () => {
    if (!currentWeekStart) return '';
    
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);
    
    const startStr = currentWeekStart.toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short'
    });
    
    const endStr = weekEnd.toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
    
    return `${startStr} - ${endStr}`;
  };
  
  return (
    <div className="master-schedule">
      <div className="schedule-header">
        <h1>Master Schedule</h1>
        <button 
          className="create-button glass-button" 
          onClick={() => setShowCreateModal(true)}
        >
          Create Program
        </button>
      </div>
      
      {/* Week Navigation */}
      <div className="week-navigation">
        <button className="nav-button glass-button" onClick={handlePrevWeek}>
          &lt; Previous Week
        </button>
        <h2 className="period-display">{getPeriodDisplayString()}</h2>
        <button className="nav-button glass-button" onClick={handleNextWeek}>
          Next Week &gt;
        </button>
      </div>
      
      {loading && (
        <div className="loading">Loading schedule...</div>
      )}
      
      {error && (
        <div className="error-message">{error}</div>
      )}
      
      {/* Weekly Calendar Grid */}
      {!loading && !error && (
        <div className="calendar-grid">
          {weekDays.map((day, index) => (
            <div 
              key={index} 
              className="day-column glass-panel"
              onClick={() => handleDayClick(day)}
            >
              {formatDayHeader(day)}
              
              <div className="day-instances">
                {getInstancesForDay(day).length > 0 ? (
                  getInstancesForDay(day).map(instance => (
                    <div key={instance.id} className="program-card glass-card">
                      <h3>{instance.program_name}</h3>
                      <p className="venue">{instance.venue_name}</p>
                      <p className="time">{instance.start_time} - {instance.end_time}</p>
                      {instance.participant_count > 0 && (
                        <div className="participant-count">
                          {instance.participant_count} participants
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="empty-day">
                    <span>Click to add program</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Create Program Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal glass-panel">
            <div className="modal-header">
              <h2>Create Program</h2>
              {selectedDay && (
                <div className="modal-subtitle">
                  {selectedDay.toLocaleDateString('en-AU', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
              )}
              <button className="close-button" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Program Name</label>
                <input 
                  type="text" 
                  value={programForm.name}
                  onChange={e => setProgramForm({...programForm, name: e.target.value})}
                  placeholder="Enter program name"
                />
              </div>
              
              <div className="form-group">
                <label>Venue</label>
                <select 
                  value={programForm.venue_id}
                  onChange={e => setProgramForm({...programForm, venue_id: e.target.value})}
                >
                  <option value="">Select venue</option>
                  {venuesList.map(venue => (
                    <option key={venue.id} value={venue.id}>{venue.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <input 
                    type="time" 
                    value={programForm.startTime}
                    onChange={e => setProgramForm({...programForm, startTime: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>End Time</label>
                  <input 
                    type="time" 
                    value={programForm.endTime}
                    onChange={e => setProgramForm({...programForm, endTime: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={programForm.isRepeating}
                    onChange={e => setProgramForm({...programForm, isRepeating: e.target.checked})}
                  />
                  Repeating Program
                </label>
              </div>
              
              {programForm.isRepeating && (
                <div className="form-group">
                  <label>Repeat Pattern</label>
                  <select 
                    value={programForm.repeatPattern}
                    onChange={e => setProgramForm({...programForm, repeatPattern: e.target.value})}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Every 2 Weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              )}
              
              <div className="form-group">
                <label>Notes</label>
                <textarea 
                  value={programForm.notes}
                  onChange={e => setProgramForm({...programForm, notes: e.target.value})}
                  placeholder="Optional notes"
                  rows="3"
                ></textarea>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="cancel-button" 
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button 
                className="create-button glass-button" 
                onClick={handleCreateProgram}
                disabled={!programForm.name || !programForm.venue_id}
              >
                Create Program
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterSchedule;
