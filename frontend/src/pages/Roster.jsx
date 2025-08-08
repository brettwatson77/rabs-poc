import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, startOfWeek, addDays } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

const Roster = () => {
  const [currentDate] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date()));
  const [tab, setTab] = useState('schedule');
  const [staff, setStaff] = useState([]);
  const [instances, setInstances] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(selectedWeek, i));
  const formatDate = (d) => d.toISOString().split('T')[0];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [staffRes, instRes] = await Promise.all([
          axios.get(`${API_URL}/api/v1/staff`),
          axios.get(`${API_URL}/api/v1/master-schedule/instances`, {
            params: {
              startDate: formatDate(weekDays[0]),
              endDate: formatDate(weekDays[6])
            }
          })
        ]);
        setStaff(staffRes?.data?.data || []);
        setInstances(instRes?.data?.data || []);
      } catch (e) {
        setError('Failed to load roster data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek]);

  const prevWeek = () => setSelectedWeek(addDays(selectedWeek, -7));
  const nextWeek = () => setSelectedWeek(addDays(selectedWeek, 7));

  const instancesForDate = (day) => {
    const d = formatDate(day);
    return instances.filter((i) => typeof i.date === 'string' && i.date.includes(d));
  };

  const staffFiltered = staff.filter((s) =>
    `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const periodLabel = `${format(weekDays[0], 'd MMM')} - ${format(weekDays[6], 'd MMM yyyy')}`;

  return (
    <div className="roster-container">
      <div className="page-header">
        <h2 className="page-title">Roster</h2>
        <div className="page-actions">
          <span className="date-display">{format(currentDate, 'EEEE, MMMM d, yyyy')}</span>
        </div>
      </div>

      <div className="roster-controls glass-card">
        <div className="view-buttons">
          <button className={`btn ${tab === 'schedule' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('schedule')}>Schedule</button>
          <button className={`btn ${tab === 'staff' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('staff')}>Staff</button>
        </div>
        {tab === 'schedule' && (
          <div className="week-navigation">
            <button className="nav-button glass-button" onClick={prevWeek}>&lt; Prev</button>
            <h3 className="period-display">{periodLabel}</h3>
            <button className="nav-button glass-button" onClick={nextWeek}>Next &gt;</button>
          </div>
        )}
        {tab === 'staff' && (
          <div className="search-input">
            <input type="text" placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && (
        <div className="loading">Loading...</div>
      )}

      {!loading && tab === 'schedule' && (
        <div className="calendar-grid">
          {weekDays.map((day, idx) => (
            <div key={idx} className="day-column glass-panel">
              <div className="day-header">
                <div className="day-name">{format(day, 'EEE')}</div>
                <div className="day-number">{format(day, 'd')}</div>
              </div>
              <div className="day-instances">
                {instancesForDate(day).length > 0 ? (
                  instancesForDate(day).map((inst) => {
                    const ratio = inst.staff_ratio || 0;
                    const participants = inst.participant_count || 0;
                    const required = ratio > 0 ? Math.ceil(participants / ratio) : null;
                    return (
                      <div key={inst.id} className="program-card glass-card">
                        <h3>{inst.program_name}</h3>
                        <p className="venue">{inst.venue_name}</p>
                        <p className="time">{inst.start_time} - {inst.end_time}</p>
                        <div className="meta-row">
                          <span>{participants} participants</span>
                          {required !== null && <span>Est. {required} staff</span>}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-day"><span>No programs</span></div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'staff' && (
        <div className="staff-list-container">
          <ul className="glass-panel" style={{listStyle: 'none', padding: 0, margin: 0}}>
            {staffFiltered.map((s) => (
              <li key={s.id} className="glass-card" style={{marginBottom: '8px', padding: '12px'}}>
                <div className="staff-row" style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  <div className="staff-avatar">{`${(s.first_name||'').charAt(0)}${(s.last_name||'').charAt(0)}`}</div>
                  <div className="staff-main">
                    <div className="staff-full-name">{s.first_name} {s.last_name}</div>
                    <div className="staff-role">{s.role || 'Support Worker'}</div>
                  </div>
                </div>
              </li>
            ))}
            {staffFiltered.length === 0 && (
              <li className="glass-card" style={{padding: '12px'}}>No staff match your search.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Roster;
