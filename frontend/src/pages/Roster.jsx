import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, startOfWeek, addDays } from 'date-fns';

// Relative path only – honours proxy / production deploy config
const API_URL = import.meta.env.VITE_API_URL || '';

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
  }, [dates]);

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
        
        {/* Search input - only show in staff view */}
        {view === 'staff' && (
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
        )}
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

      {/* Staff View - Single grid with sticky first column */}
      {!loading && view === 'staff' && (
        <div className="rosterGrid" style={{
          display: 'grid',
          gridTemplateColumns: '280px repeat(14, minmax(220px, 1fr))',
          gridAutoRows: 'minmax(64px, auto)',
          overflow: 'auto',
          height: 'calc(100vh - 200px)'
        }}>
          {/* Header row with date headers */}
          <div className="headerCell" style={{
            position: 'sticky',
            left: 0,
            top: 0,
            zIndex: 3,
            background: 'var(--panel-bg)',
            padding: '12px',
            fontWeight: 'bold',
            borderBottom: '1px solid #ddd'
          }}>
            Staff
          </div>
          
          {/* Date headers */}
          {dates.map((date) => (
            <div 
              key={`header-${date}`} 
              className="headerCell"
              style={{
                padding: '12px',
                fontWeight: 'bold',
                borderBottom: '1px solid #ddd',
                textAlign: 'center'
              }}
            >
              {formatDateHeader(date)}
            </div>
          ))}
          
          {/* Staff rows with day cells */}
          {staffFiltered.length > 0 ? (
            staffFiltered.map((staff) => (
              React.Fragment.apply(null, [
                // Staff name cell (sticky)
                <div 
                  key={`staff-${staff.id}`}
                  className="staffCell"
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    background: 'var(--panel-bg)',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    borderBottom: '1px solid #eee'
                  }}
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
                    {`${(staff.first_name || '').charAt(0)}${(staff.last_name || '').charAt(0)}`}
                  </div>
                  <div>
                    {staff.first_name} {staff.last_name}
                  </div>
                </div>,
                
                // Day cells for this staff member
                ...dates.map((date) => (
                  <div
                    key={`${staff.id}-${date}`}
                    className="dayCell"
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #eee',
                      fontSize: '0.85rem',
                      color: '#666',
                      textAlign: 'center'
                    }}
                  >
                    <div>No shifts assigned</div>
                  </div>
                ))
              ])
            ))
          ) : (
            <div 
              style={{
                gridColumn: 'span 15',
                padding: '24px',
                textAlign: 'center'
              }}
            >
              No staff match your search criteria.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Roster;
