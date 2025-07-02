import React, { useState, useEffect } from 'react';
import { getSchedule } from '../api/api';
import { useAppContext } from '../context/AppContext';
import CalendarView from '../components/CalendarView';

// Helper function to format a date as YYYY-MM-DD
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const MasterSchedule = () => {
  const [scheduleData, setScheduleData] = useState(null);
  // Global simulated date from context
  const { simulatedDate, setSimulatedDate } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      setError(null);
      try {
        // Calculate the start (Monday) and end (Sunday) of the week for the current date
        const dayOfWeek = simulatedDate.getDay(); // 0 = Sunday
        const diffToMonday = (dayOfWeek === 0) ? -6 : 1 - dayOfWeek;
        
        const monday = new Date(simulatedDate);
        monday.setDate(simulatedDate.getDate() + diffToMonday);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const startDate = formatDate(monday);
        const endDate = formatDate(sunday);

        const data = await getSchedule(startDate, endDate);
        setScheduleData(data);
      } catch (err) {
        setError('Failed to fetch schedule data. Please ensure the backend is running.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [simulatedDate]);

  // Handlers for week navigation
  const handlePrevWeek = () => {
    const newDate = new Date(simulatedDate);
    newDate.setDate(simulatedDate.getDate() - 7);
    setSimulatedDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(simulatedDate);
    newDate.setDate(simulatedDate.getDate() + 7);
    setSimulatedDate(newDate);
  };

  // Calculate the display string for the current week
  const dayOfWeek = simulatedDate.getDay();
  const diffToMonday = (dayOfWeek === 0) ? -6 : 1 - dayOfWeek;
  const monday = new Date(simulatedDate);
  monday.setDate(simulatedDate.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekDisplay = `${monday.toLocaleDateString()} - ${sunday.toLocaleDateString()}`;

  // Build an array with each date object for the current week (Mon–Sun)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
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
        <button onClick={handlePrevWeek}>&lt; Previous Week</button>
        <h2 style={{ margin: 0 }}>{weekDisplay}</h2>
        <button onClick={handleNextWeek}>Next Week &gt;</button>
      </div>

      {loading && <p>Loading schedule...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {scheduleData && (
        scheduleData.length > 0 ? (
          <CalendarView scheduleData={scheduleData} weekDates={weekDates} />
        ) : (
          !loading && <p>No activities scheduled for this week.</p>
        )
      )}
    </div>
  );
};

export default MasterSchedule;
