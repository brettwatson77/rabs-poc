import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { format, startOfWeek, addDays, subDays } from 'date-fns';

const Roster = () => {
  // View toggle state: 'day' or 'staff'
  const [view, setView] = useState('day');
  
  // Track current fortnight via its starting Monday
  const [startMonday, setStartMonday] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // Derive the 14-day string array from startMonday (memoised for stability)
  const dates = React.useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) =>
        addDays(startMonday, i).toISOString().split('T')[0]
      ),
    [startMonday]
  );
  const [shiftsByDate, setShiftsByDate] = useState({});           // {date: []}
  const [staffDirectory, setStaffDirectory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  /* ---------------------------------------------------------------------- */
  /* Local week toggle (0 = week 1, 1 = week 2) – only affects By Day view   */
  /* ---------------------------------------------------------------------- */
  const [week, setWeek] = useState(0); // 0 or 1

  /* ---------------------------------------------------------------------- */
  /* Fortnight helpers & navigation                                         */
  /* ---------------------------------------------------------------------- */

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

  // Format time helper (HH:MM:SS → 12:MM AM/PM)
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };

  // Render a shift card with consistent styling
  const renderShiftCard = (shift) => {
    return (
      <div 
        key={shift.shift_id} 
        className="shift-card glass-card"
        style={{
          padding: '6px',
          marginBottom: '6px',
          borderRadius: '6px',
          position: 'relative',
          width: '100%'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <strong style={{ fontSize: '0.9rem', marginRight: '20px' }}>{shift.program_name}</strong>
          {shift.status !== 'assigned' ? (
            <span 
              className={`status-tag ${shift.status}`}
              style={{
                padding: '1px 4px',
                borderRadius: '3px',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                backgroundColor: shift.status === 'open' ? '#f59e0b' : '#3b82f6',
                color: 'white'
              }}
            >
              {shift.status === 'open' ? 'Open' : 'Auto'}
            </span>
          ) : null}
        </div>
        
        <div style={{ fontSize: '0.8rem' }}>
          {shift.start_time && shift.end_time && (
            <span className="time">
              {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
            </span>
          )}
          {shift.status === 'assigned' && (
            <span className="staff-name" style={{ marginLeft: '8px', fontWeight: 'bold' }}>
              {shift.staff_name}
            </span>
          )}
        </div>
        
        {shift.venue_name && (
          <div className="venue" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
            {shift.venue_name}
          </div>
        )}
      </div>
    );
  };

  // fetch 14 days in parallel once
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError('');
      try {
        const promises = dates.map((d) =>
          api
            .get('/roster/day', { params: { date: d } })
            .catch((err) => {
              // log and return null so other requests continue
              console.error(`GET /roster/day?date=${d}`, err?.response?.status);
              return null;
            })
        );

        const results = await Promise.all(promises);
        const shiftsMap = {};
        let staffSet = false;
        
        results.forEach((res, idx) => {
          const dateKey = dates[idx];
          if (res && res.data?.success) {
            shiftsMap[dateKey] = res.data.data.shifts || [];
            
            if (!staffSet && Array.isArray(res.data.data.staff_directory)) {
              setStaffDirectory(res.data.data.staff_directory);
              staffSet = true;
            }
          } else {
            // HTTP failure captured already; mark error banner
            setError('Failed to fetch some roster data.');
            shiftsMap[dateKey] = [];
          }
        });
        setShiftsByDate(shiftsMap);
        
        // If we didn't get staff from any day response, fetch staff directly
        if (!staffSet) {
          try {
            const staffRes = await api.get('/staff');
            if (staffRes.data?.success) {
              setStaffDirectory(staffRes.data.data || []);
            }
          } catch (staffErr) {
            console.error('Failed GET /staff', staffErr?.response?.status);
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

      {/* Fortnight navigation ------------------------------------------------ */}
      <div
        className="fortnight-nav glass-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
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

      {/* Week selector (only visible in By Day view) ----------------------- */}
      {view === 'day' && (
        <div
          className="week-toggle glass-card"
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            marginBottom: '16px',
            padding: '8px',
          }}
        >
          <button
            className={`btn ${week === 0 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setWeek(0)}
          >
            Week&nbsp;1
          </button>
          <button
            className={`btn ${week === 1 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setWeek(1)}
          >
            Week&nbsp;2
          </button>
        </div>
      )}

      <div className="roster-controls glass-card" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '16px',
        position: 'relative',
        zIndex: 4
      }}>
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
          <div className="roster-search" style={{ 
            height: '40px', 
            width: '100%', 
            maxWidth: '320px', 
            marginLeft: '16px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <input
              type="text"
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input"
              style={{ 
                width: '100%', 
                height: '100%',
                padding: '8px 12px', 
                borderRadius: '10px' 
              }}
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
        <div className="roster-view-grid" style={{ overflowX: 'auto' }}>
          <div
            className="week-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            {dates
              .slice(week * 7, week * 7 + 7)
              .map((d) => {
                const dayShifts = shiftsByDate[d] || [];
                // Sort shifts by start_time
                const sortedShifts = [...dayShifts].sort((a, b) => 
                  a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0
                );
                
                return (
                  <div key={d} className="instance-column glass-card">
                    <div className="column-header">{formatDateHeader(d)}</div>
                    {sortedShifts.length === 0 ? (
                      <div className="empty-day">No shifts scheduled today.</div>
                    ) : (
                      sortedShifts.map(shift => renderShiftCard(shift))
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Staff View - Single grid with sticky first column */}
      {!loading && view === 'staff' && (
        <div className="rosterGrid" style={{
          display: 'grid',
          gridTemplateColumns: '280px repeat(14, minmax(200px, 1fr))',
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
            background: 'var(--panel-bg, rgba(30, 34, 42, 0.7))',
            padding: '12px',
            fontWeight: 'bold',
            borderBottom: '1px solid var(--ui-border, rgba(255,255,255,0.08))',
            boxShadow: '2px 0 0 rgba(0,0,0,0.08)'
          }}>
            Staff
          </div>
          
          {/* Date headers */}
          {dates.map((date) => (
            <div 
              key={`header-${date}`} 
              className="headerCell"
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                background: 'var(--panel-bg, rgba(30, 34, 42, 0.7))',
                padding: '12px',
                fontWeight: 'bold',
                borderBottom: '1px solid var(--ui-border, rgba(255,255,255,0.08))',
                textAlign: 'center'
              }}
            >
              {formatDateHeader(date)}
            </div>
          ))}
          
          {/* Open Shifts row */}
          <div 
            className="staffCell"
            style={{
              position: 'sticky',
              left: 0,
              zIndex: 2,
              background: 'var(--panel-bg, rgba(30, 34, 42, 0.7))',
              padding: '12px 16px',
              fontWeight: 'bold',
              borderBottom: '1px solid var(--ui-border, rgba(255,255,255,0.08))',
              boxShadow: '2px 0 0 rgba(0,0,0,0.08)'
            }}
          >
            Open Shifts
          </div>
          
          {/* Open shifts for each day */}
          {dates.map((date) => {
            const dayShifts = shiftsByDate[date] || [];
            const openShifts = dayShifts.filter(s => s.status === 'open');
            return (
              <div
                key={`open-${date}`}
                className="dayCell"
                style={{
                  padding: '8px',
                  borderBottom: '1px solid var(--ui-border, rgba(255,255,255,0.08))',
                  background: 'rgba(255,255,255,0.02)'
                }}
              >
                {openShifts.length > 0 ? (
                  openShifts.map(shift => renderShiftCard(shift))
                ) : (
                  <div style={{ color: 'var(--ui-text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                    No open shifts
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Auto Assign row */}
          <div 
            className="staffCell"
            style={{
              position: 'sticky',
              left: 0,
              zIndex: 2,
              background: 'var(--panel-bg, rgba(30, 34, 42, 0.7))',
              padding: '12px 16px',
              fontWeight: 'bold',
              borderBottom: '1px solid var(--ui-border, rgba(255,255,255,0.08))',
              boxShadow: '2px 0 0 rgba(0,0,0,0.08)'
            }}
          >
            Auto Assign
          </div>
          
          {/* Auto shifts for each day */}
          {dates.map((date) => {
            const dayShifts = shiftsByDate[date] || [];
            const autoShifts = dayShifts.filter(s => s.status === 'auto');
            return (
              <div
                key={`auto-${date}`}
                className="dayCell"
                style={{
                  padding: '8px',
                  borderBottom: '1px solid var(--ui-border, rgba(255,255,255,0.08))',
                  background: 'rgba(255,255,255,0.02)'
                }}
              >
                {autoShifts.length > 0 ? (
                  autoShifts.map(shift => renderShiftCard(shift))
                ) : (
                  <div style={{ color: 'var(--ui-text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                    No auto shifts
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Staff rows with day cells */}
          {staffFiltered.length > 0 ? (
            staffFiltered.map((staff) => (
              <React.Fragment key={`row-${staff.id}`}>
                {/* Staff name cell (sticky) */}
                <div 
                  className="staffCell"
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    background: 'var(--panel-bg, rgba(30, 34, 42, 0.7))',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    borderBottom: '1px solid var(--ui-border, rgba(255,255,255,0.08))',
                    boxShadow: '2px 0 0 rgba(0,0,0,0.08)'
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
                </div>
                
                {/* Day cells for this staff member */}
                {dates.map((date) => {
                  const dayShifts = shiftsByDate[date] || [];
                  const staffShifts = dayShifts.filter(
                    s => s.status === 'assigned' && s.staff_id === staff.id
                  ).sort((a, b) => 
                    a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0
                  );
                  
                  return (
                    <div
                      key={`${staff.id}-${date}`}
                      className="dayCell"
                      style={{
                        padding: '8px',
                        borderBottom: '1px solid var(--ui-border, rgba(255,255,255,0.08))',
                        background: 'rgba(255,255,255,0.02)'
                      }}
                    >
                      {staffShifts.length > 0 ? (
                        staffShifts.map(shift => renderShiftCard(shift))
                      ) : (
                        <div style={{ color: 'var(--ui-text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                          No shifts assigned
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
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
