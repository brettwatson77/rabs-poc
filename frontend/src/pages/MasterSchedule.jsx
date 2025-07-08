import React, { useState, useEffect } from 'react';
import { getSchedule, getWeeklyChangeLog, createCancellation } from '../api/api';
import { useAppContext } from '../context/AppContext';
import CalendarView from '../components/CalendarView';
import { formatDateForApi } from '../utils/dateUtils';
import axios from 'axios';

// API base URL for dynamic resource endpoints
const API_BASE_URL = '/api/v1';

const MasterSchedule = () => {
  const [scheduleData, setScheduleData] = useState(null);
  // Global simulated date from context
  const { simulatedDate, setSimulatedDate } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weeklyLog, setWeeklyLog] = useState([]);
  
  // Dynamic resource allocation states
  const [resourceStatus, setResourceStatus] = useState({});
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [rebalanceMessage, setRebalanceMessage] = useState('');

  const fetchScheduleData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Calculate the start (Monday) and end (Sunday) of the week for the current date
      const dayOfWeek = simulatedDate.getDay(); // 0 = Sunday
      const diffToMonday = (dayOfWeek === 0) ? -6 : 1 - dayOfWeek;
      
      const monday = new Date(simulatedDate);
      monday.setDate(simulatedDate.getDate() + diffToMonday);

      const sunday = new Date(monday);
      // End of fortnight = Monday + 13 days (2 weeks)
      const fortnightEnd = new Date(monday);
      fortnightEnd.setDate(monday.getDate() + 13);

      const startDate = formatDateForApi(monday);
      const endDate = formatDateForApi(fortnightEnd);

      const data = await getSchedule(startDate, endDate);
      setScheduleData(data);

      /* -----------------------------------------------------------
       * Fetch aggregated change-log for the same date range so the
       * UI can show "what's changing this week" beneath the calendar.
       * --------------------------------------------------------- */
      try {
        const log = await getWeeklyChangeLog(startDate, endDate);
        setWeeklyLog(log);
        
        // Fetch dynamic resource status for all programs in the schedule
        if (data && data.length > 0) {
          const programIds = [...new Set(data.map(event => event.program_id))];
          await fetchResourceStatus(programIds);
        }
      } catch (logErr) {
        // Do not block schedule rendering if the log fails
        console.error('Failed to fetch weekly change log', logErr);
        setWeeklyLog([]);
      }
    } catch (err) {
      setError('Failed to fetch schedule data. Please ensure the backend is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch resource allocation status for multiple programs
  const fetchResourceStatus = async (programIds) => {
    try {
      const statusMap = {};
      
      // Fetch status for each program
      for (const programId of programIds) {
        const response = await axios.get(`${API_BASE_URL}/dynamic-resources/status/${programId}`);
        if (response.data && response.data.status) {
          statusMap[programId] = response.data.status;
        }
      }
      
      setResourceStatus(statusMap);
    } catch (error) {
      console.error('Failed to fetch resource status:', error);
    }
  };

  // Trigger dynamic rebalancing for a program
  const triggerRebalance = async (programId) => {
    setIsRebalancing(true);
    setRebalanceMessage(`Optimizing resources for program...`);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/dynamic-resources/rebalance/${programId}`);
      
      if (response.data && response.data.success) {
        // Update the resource status for this program
        setResourceStatus(prev => ({
          ...prev,
          [programId]: response.data.status
        }));
        
        setRebalanceMessage('Resources successfully optimized!');
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setRebalanceMessage('');
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to rebalance resources:', error);
      setRebalanceMessage('Failed to optimize resources. Please try again.');
    } finally {
      setIsRebalancing(false);
    }
  };

  useEffect(() => {
    fetchScheduleData();
  }, [simulatedDate]);

  // Handlers for week navigation
  const handlePrevFortnight = () => {
    const newDate = new Date(simulatedDate);
    // Jump back two weeks
    newDate.setDate(simulatedDate.getDate() - 14);
    setSimulatedDate(newDate);
  };

  const handleNextFortnight = () => {
    const newDate = new Date(simulatedDate);
    // Jump forward two weeks
    newDate.setDate(simulatedDate.getDate() + 14);
    setSimulatedDate(newDate);
  };

  // Enhanced cancellation handler that triggers rebalancing
  const handleCancel = async (participantId, programInstanceId, cancellationType) => {
    try {
      await createCancellation({ participantId, programInstanceId, type: cancellationType });
      alert(`Successfully processed ${cancellationType.replace('_', ' ')} cancellation.`);
      
      // Find the program_id for this instance to trigger rebalancing
      const instance = scheduleData.find(inst => inst.id === programInstanceId);
      if (instance && instance.program_id) {
        // Trigger dynamic rebalancing after cancellation
        await triggerRebalance(instance.program_id);
      }
      
      // After successful cancellation, re-fetch schedule data to update UI
      fetchScheduleData();
    } catch (err) {
      console.error('Error processing cancellation:', err);
      alert(`Failed to process cancellation: ${err.message}`);
    }
  };

  // Calculate the display string for the current week
  const dayOfWeek = simulatedDate.getDay();
  const diffToMonday = (dayOfWeek === 0) ? -6 : 1 - dayOfWeek;
  const monday = new Date(simulatedDate);
  monday.setDate(simulatedDate.getDate() + diffToMonday);
  const sunday = new Date(monday);
  // End of fortnight for display
  sunday.setDate(monday.getDate() + 13);
  const fortnightDisplay = `${monday.toLocaleDateString()} - ${sunday.toLocaleDateString()}`;

  // Build an array with each date object for the current week (Mon–Sun)
  const fortnightDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  // Helper to get status indicator color
  const getStatusColor = (status) => {
    if (!status) return '#888'; // gray for unknown
    switch (status.toLowerCase()) {
      case 'optimal': return '#4caf50'; // green
      case 'balanced': return '#2196f3'; // blue
      case 'warning': return '#ff9800'; // orange
      case 'critical': return '#f44336'; // red
      default: return '#888'; // gray
    }
  };

  // Render dynamic allocation status badge for an event
  const renderDynamicBadge = (programId) => {
    const status = resourceStatus[programId];
    if (!status) return null;
    
    return (
      <div 
        style={{
          display: 'inline-block',
          padding: '2px 6px',
          borderRadius: '12px',
          fontSize: '10px',
          fontWeight: 'bold',
          color: 'white',
          backgroundColor: getStatusColor(status.overall),
          marginLeft: '5px'
        }}
      >
        {status.overall === 'optimal' ? 'Optimized' : 'Needs Optimization'}
      </div>
    );
  };

  // Enhance CalendarView with dynamic resource information
  const enhancedScheduleData = scheduleData?.map(event => ({
    ...event,
    dynamicStatus: resourceStatus[event.program_id] || null,
    renderDynamicBadge: () => renderDynamicBadge(event.program_id),
    triggerRebalance: () => triggerRebalance(event.program_id)
  }));

  return (
    <>
      {/* Apply shared CRUD page styling for consistent layout */}
      <div className="crud-page-container" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Master Schedule</h1>
      {/* Center the week-navigation controls for better visual balance */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          marginBottom: '20px'
        }}
      >
        <button onClick={handlePrevFortnight}>&lt; Previous 2 Weeks</button>
        <h2 style={{ margin: 0 }}>{fortnightDisplay}</h2>
        <button onClick={handleNextFortnight}>Next 2 Weeks &gt;</button>
      </div>

      {/* Dynamic resource status message */}
      {rebalanceMessage && (
        <div 
          style={{
            padding: '10px',
            margin: '10px 0',
            backgroundColor: isRebalancing ? '#fff3cd' : '#d4edda',
            border: `1px solid ${isRebalancing ? '#ffeeba' : '#c3e6cb'}`,
            borderRadius: '4px',
            textAlign: 'center'
          }}
        >
          {isRebalancing && (
            <span style={{ display: 'inline-block', marginRight: '10px' }}>⟳</span>
          )}
          {rebalanceMessage}
        </div>
      )}

      {loading && <p>Loading schedule...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {enhancedScheduleData && (
        enhancedScheduleData.length > 0 ? (
          <CalendarView 
            scheduleData={enhancedScheduleData} 
            weekDates={fortnightDates} 
            handleCancel={handleCancel} 
          />
        ) : (
          !loading && <p>No activities scheduled for this week.</p>
        )
      )}

      {/* Dynamic Resource Legend */}
      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ 
            display: 'inline-block', 
            width: '12px', 
            height: '12px', 
            backgroundColor: '#4caf50',
            borderRadius: '50%',
            marginRight: '5px'
          }}></span>
          <span>Optimized</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ 
            display: 'inline-block', 
            width: '12px', 
            height: '12px', 
            backgroundColor: '#ff9800',
            borderRadius: '50%',
            marginRight: '5px'
          }}></span>
          <span>Needs Optimization</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ 
            display: 'inline-block', 
            width: '12px', 
            height: '12px', 
            backgroundColor: '#f44336',
            borderRadius: '50%',
            marginRight: '5px'
          }}></span>
          <span>Critical</span>
        </div>
      </div>

      {/* ------------------------ Weekly Change Log ------------------------- */}
      {weeklyLog.length > 0 && (
        <div style={{ marginTop: '30px', textAlign: 'left' }}>
          <h3>This Fortnight&apos;s Changes</h3>
          <ul>
            {weeklyLog.map((entry) => (
              <li key={entry.id}>
                {entry.effective_date}: {entry.first_name} {entry.last_name}{' '}
                {entry.action === 'add' ? 'joins' : 'leaves'} {entry.program_name}
                {entry.action === 'add' && (
                  <button 
                    onClick={() => triggerRebalance(entry.program_id)}
                    disabled={isRebalancing}
                    style={{ 
                      marginLeft: '10px',
                      padding: '2px 8px',
                      fontSize: '10px',
                      backgroundColor: '#2196f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Optimize Resources
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
    </>
  );
};

export default MasterSchedule;
