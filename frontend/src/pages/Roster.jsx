import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, startOfWeek, addDays } from 'date-fns';

// Relative path only – honours proxy / production deploy config
const API_URL = import.meta.env.VITE_API_URL || '';

const todayISO = () => new Date().toISOString().split('T')[0];

const Roster = () => {
  // View toggle state: 'day' or 'staff'
  const [view, setView] = useState('day');
  
  // build 14-day window starting Monday of current week
  const mondayThisWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  const initialDates = Array.from({ length: 14 }, (_, i) =>
    addDays(mondayThisWeek, i).toISOString().split('T')[0]
  );

  const [dates] = useState(initialDates); // static in this component
  const [instancesByDate, setInstancesByDate] = useState({});      // {date: []}
  const [staffDirectory, setStaffDirectory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // fetch 14 days in parallel once
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError('');
      try {
        const promises = dates.map((d) =>
          axios
            .get(`${API_URL}/api/v1/roster/day`, { params: { date: d } })
            .catch((err) => {
              // log and return null so other requests continue
              console.error(`GET /api/v1/roster/day?date=${d}`, err?.response?.status);
              return null;
            })
        );

        const results = await Promise.all(promises);
        const map = {};
        let staffSet = false;
        results.forEach((res, idx) => {
          const dateKey = dates[idx];
          if (res && res.data?.success) {
            map[dateKey] = res.data.data.instances || [];
            if (!staffSet && Array.isArray(res.data.data.staff_directory)) {
              setStaffDirectory(res.data.data.staff_directory);
              staffSet = true;
            }
          } else {
            // HTTP failure captured already; mark error banner
            setError('Failed to fetch some roster data.');
            map[dateKey] = [];
          }
        });
        setInstancesByDate(map);
        
        // If we didn't get staff from any day response, fetch staff directly
        if (!staffSet) {
          try {
            const staffRes = await axios.get(`${API_URL}/api/v1/staff`);
            if (staffRes.data?.success) {
              setStaffDirectory(staffRes.data.data || []);
            }
          } catch (staffErr) {
            console.error(`Failed GET ${API_URL}/api/v1/staff`, staffErr?.response?.status);
          }
        }
      } catch (e) {
        console.error('Roster bulk fetch error', e);
        setError('Failed to load roster data.');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staffFiltered = staffDirectory.filter((s) =>
    `${s.first_name || ''} ${s.last_name || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // Format date header for columns
  const formatDateHeader = (dateStr) => {
    const dateObj = new Date(dateStr);
    return `${format(dateObj, 'EEE')} ${format(dateObj, 'd')}`;
  };

  return (
    <div className="roster-container">
      <div className="page-header">
        <h2 className="page-title">Roster</h2>
        {/* Simple refresh */}
      </div>

      <div className="roster-controls glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        {/* View toggle buttons */}
        <div className="view-toggle" style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn ${view === 'day' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('day')}
            style={{ 
              padding: '8px 16px',
              borderRadius: '4px',
              fontWeight: view === 'day' ? 'bold' : 'normal',
              backgroundColor: view === 'day' ? '#4a6fa5' : '#e0e0e0',
              color: view === 'day' ? 'white' : 'black'
            }}
          >
            By Day
          </button>
          <button 
            className={`btn ${view === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('staff')}
            style={{ 
              padding: '8px 16px',
              borderRadius: '4px',
              fontWeight: view === 'staff' ? 'bold' : 'normal',
              backgroundColor: view === 'staff' ? '#4a6fa5' : '#e0e0e0',
              color: view === 'staff' ? 'white' : 'black'
            }}
          >
            By Staff
          </button>
        </div>
        
        {/* Search input */}
        <div className="search-input" style={{ flex: 1, maxWidth: '300px', marginLeft: '16px' }}>
          <input
            type="text"
            placeholder="Search staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input"
            style={{ width: '100%', padding: '8px', borderRadius: '4px' }}
          />
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && (
        <div className="loading">Loading...</div>
      )}

      {/* Main roster view - conditional rendering based on view state */}
      {!loading && view === 'day' && (
        <div className="roster-view-grid">
          {/* Grid of 14 day columns */}
          <div className="instances-area">
            <div 
              className="instances-columns"
              style={{
                display: 'grid',
                gridAutoFlow: 'column',
                gridTemplateColumns: 'repeat(14, minmax(320px, 1fr))',
                gap: '16px',
                overflowX: 'auto'
              }}
            >
              {dates.map((d) => {
                const dayInstances = instancesByDate[d] || [];
                return (
                  <div key={d} className="instance-column glass-card">
                    <div className="column-header">{formatDateHeader(d)}</div>
                    {dayInstances.length === 0 ? (
                      <div className="empty-day">No program instances today.</div>
                    ) : (
                      dayInstances.map((inst) => (
                        <div key={inst.instance_id} className="instance-card">
                          <strong>{inst.program_name}</strong>
                          <div>Staff: {inst.staff_required}</div>
                          <div>Vehicles: {inst.vehicles_required}</div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Staff View */}
      {!loading && view === 'staff' && (
        <div 
          className="staff-roster-view"
          style={{
            display: 'flex',
            height: 'calc(100vh - 200px)',
            overflow: 'hidden'
          }}
        >
          {/* Left sticky staff list */}
          <div 
            className="staff-list-container"
            style={{
              width: '280px',
              flexShrink: 0,
              overflowY: 'auto',
              paddingRight: '16px',
              position: 'sticky',
              left: 0,
              zIndex: 2,               // keep list above scrollable grid
              background: 'inherit'    // maintain page background while sticky
            }}
          >
            <ul
              className="glass-panel"
              style={{ listStyle: 'none', padding: 0, margin: 0 }}
            >
              {staffFiltered.length > 0 ? (
                staffFiltered.map((s) => (
                  <li
                    key={s.id}
                    className="glass-card"
                    style={{ marginBottom: '8px', padding: '12px' }}
                  >
                    <div
                      className="staff-row"
                      style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                    >
                      <div 
                        className="staff-avatar"
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: '#4a6fa5',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold'
                        }}
                      >
                        {`${(s.first_name || '').charAt(0)}${(s.last_name || '').charAt(0)}`}
                      </div>
                      <div className="staff-main">
                        <div className="staff-full-name">
                          {s.first_name} {s.last_name}
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              ) : (
                <li className="glass-card" style={{ padding: '12px' }}>
                  No staff match your search.
                </li>
              )}
              {staffDirectory.length === 0 && (
                <li className="glass-card" style={{ padding: '12px' }}>
                  No staff data available.
                </li>
              )}
            </ul>
          </div>

          {/* Right side scrollable grid of shift placeholders */}
          <div 
            className="staff-shifts-container"
            style={{
              overflowX: 'auto',
              flexGrow: 1
            }}
          >
            {staffFiltered.length > 0 ? (
              <div 
                className="staff-shifts-grid"
                style={{
                  display: 'grid',
                  gridTemplateRows: `repeat(${staffFiltered.length}, 60px)`,
                  gridTemplateColumns: 'repeat(14, minmax(320px, 1fr))',
                  gap: '8px',
                  paddingBottom: '16px'
                }}
              >
                {/* Generate placeholder cells for each staff member and date */}
                {staffFiltered.flatMap((staff, staffIdx) => 
                  dates.map((date, dateIdx) => (
                    <div
                      key={`${staff.id}-${date}`}
                      className="shift-placeholder glass-card"
                      style={{
                        gridRow: staffIdx + 1,
                        gridColumn: dateIdx + 1,
                        padding: '8px',
                        minHeight: '60px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontSize: '0.85rem',
                        color: '#666'
                      }}
                    >
                      <div>{formatDateHeader(date)}</div>
                      <div>No shifts assigned</div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="empty-staff-grid glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                No staff available to display shifts.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Roster;
