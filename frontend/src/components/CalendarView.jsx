import React, { useState } from 'react';
import '../styles/CalendarView.css';
import Modal from './Modal';
import { formatDateForApi } from '../utils/dateUtils';
import { useAppContext } from '../context/AppContext';
import { differenceInCalendarDays } from 'date-fns';
// Staff-assignment helpers
import {
    getAvailableStaff,
    updateSingleStaffAssignment,
    updateRecurringStaffAssignment,
    getStaffHours,
} from '../api/api';

// Generic HTTP client (used for dynamic-resource endpoints)
import axios from 'axios';

// Import the Bus Run Analysis Terminal component
import BusRunAnalysisTerminal from './BusRunAnalysisTerminal';

/* ------------------------------------------------------------------
 * CalendarView
 *   Renders a week-view calendar and provides per-participant
 *   cancellation buttons that respect the 7-day rule.
 *   `handleCancel` must be passed in from the parent component and
 *   should return a Promise so the UI can show loading state.
 * ---------------------------------------------------------------- */
const CalendarView = ({ scheduleData, weekDates, handleCancel }) => {
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const { simulatedDate } = useAppContext();

    /* ------------------------------------------------------------------
     * Modal state for detailed instance view
     * ---------------------------------------------------------------- */
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [loadingCancelId, setLoadingCancelId] = useState(null); // track which participant is cancelling
    const [availableStaff, setAvailableStaff] = useState([]);     // options for staff swap
    const [staffHours, setStaffHours] = useState({});             // { staffId: { percent_allocated, ... } }
    const [isOptimizing, setIsOptimizing] = useState(false);      // track optimization state
    
    /* ------------------------------------------------------------------
     * Bus Run Analysis Terminal state
     * ---------------------------------------------------------------- */
    const [showTerminal, setShowTerminal] = useState(false);      // control terminal visibility
    const [terminalMessages, setTerminalMessages] = useState([]); // analysis messages
    const [isAnalysisComplete, setIsAnalysisComplete] = useState(false); // analysis completion status

    const handleEventClick = (instance) => {
        setSelectedEvent(instance);
        setIsModalOpen(true);

        // Fetch available staff for dropdown & hours utilisation
        loadStaffMeta(instance);

        // Fetch latest dynamic-resource status (staff/vehicles/routes)
        loadDynamicStatus(instance);
    };

    /* ------------------------------------------------------------------
     * Helper: load available staff + hours for current instance
     * ---------------------------------------------------------------- */
    const loadStaffMeta = async (instance) => {
        if (!instance) return;
        try {
            // Fetch available staff
            const availResp = await getAvailableStaff(instance.id);
            setAvailableStaff(availResp.availableStaff || []);

            // Fetch hours for each currently-assigned staff (parallel)
            const promises = instance.staff.map((s) =>
                getStaffHours(s.id).then((d) => ({ id: s.id, hours: d.hours })),
            );
            const hoursArr = await Promise.all(promises);
            const map = {};
            hoursArr.forEach((h) => {
                map[h.id] = h.hours;
            });
            setStaffHours(map);
        } catch (err) {
            console.error('Failed loading staff meta', err);
        }
    };

    /* ------------------------------------------------------------------
     * Helper: load dynamic resource status + route details
     * ---------------------------------------------------------------- */
    const loadDynamicStatus = async (instance) => {
        if (!instance) return;
        try {
            // Core allocation status
            const statusResp = await axios.get(
                `/api/v1/dynamic-resources/status/${instance.id}`,
            );

            // Route details (may include map-ready data)
            let routes = [];
            try {
                const routeResp = await axios.get(
                    `/api/v1/dynamic-resources/routes/${instance.id}`,
                );
                routes = routeResp.data?.data?.routes ?? [];
            } catch (routeErr) {
                // Routes might not exist yet – not fatal
                console.warn('No route details yet:', routeErr.message);
            }

            setSelectedEvent((prev) =>
                prev
                    ? {
                          ...prev,
                          dynamicStatus: {
                              ...(statusResp.data?.data || {}),
                              routes,
                          },
                      }
                    : prev,
            );
        } catch (err) {
            console.error('Failed loading dynamic status', err);
        }
    };

    /* ------------------------------------------------------------------
     * Cancellation handler (delegates to parent `handleCancel`)
     * ---------------------------------------------------------------- */
    const handleCancellation = async (participantId, programInstanceId, cancellationType) => {
        if (!selectedEvent) return;

        try {
            setLoadingCancelId(participantId);

            await handleCancel(participantId, programInstanceId, cancellationType);

            // Optimistically update local state so UI reflects change immediately
            setSelectedEvent((prev) => {
                if (!prev) return prev;
                const updatedParticipants = prev.participants.map((p) =>
                    p.id === participantId ? { ...p, status: 'cancelled' } : p
                );
                return { ...prev, participants: updatedParticipants };
            });
        } catch (error) {
            alert('Failed to cancel attendance. Please try again.');
            console.error('Cancellation error:', error);
        } finally {
            setLoadingCancelId(null);
        }
    };

    /* ------------------------------------------------------------------
     * Resource optimization handler
     * ---------------------------------------------------------------- */
    const handleOptimize = async () => {
        if (!selectedEvent || !selectedEvent.triggerRebalance) return;
        
        try {
            setIsOptimizing(true);
            setIsAnalysisComplete(false);
            
            // Show the terminal with initial messages
            setShowTerminal(true);
            setTerminalMessages([
                { text: "RABS Bus Run Analysis & Optimisation", type: "header" },
                { text: `Analyzing program: ${selectedEvent.program_name}`, type: "info" },
                { text: `Date: ${selectedEvent.date}`, type: "info" },
                { text: "Requesting route alternatives from Google Maps...", type: "info", prefix: "🚌" }
            ]);
            
            // Make the API call
            const response = await axios.post(
                `/api/v1/dynamic-resources/rebalance/${selectedEvent.id}`,
                {},
                { timeout: 30000 } // 30 second timeout for longer operations
            );
            
            // Process analysis logs if available
            if (response.data?.data?.length > 0 && 
                response.data.data[0]?.routes?.analysisLogs?.length > 0) {
                
                const analysisLogs = response.data.data[0].routes.analysisLogs;
                
                // Transform logs into terminal message format
                const newMessages = analysisLogs.map(log => {
                    // Determine message type based on content
                    let type = "default";
                    let prefix = "";
                    
                    if (log.includes("Bus Run Analysis")) {
                        type = "header";
                        prefix = "🔍";
                    } else if (log.includes("Route")) {
                        type = "route";
                        prefix = "⚡";
                    } else if (log.includes("score")) {
                        type = "score";
                        prefix = "⚖️";
                    } else if (log.includes("Selected")) {
                        type = "result";
                        prefix = "✅";
                    } else if (log.includes("min") || log.includes("km")) {
                        type = "analysis";
                    }
                    
                    return { text: log, type, prefix };
                });
                
                // Add messages one by one with a slight delay for visual effect
                for (const msg of newMessages) {
                    setTerminalMessages(prev => [...prev, msg]);
                    // Small delay for visual typing effect
                    await new Promise(r => setTimeout(r, 100));
                }
            }
            
            // Add completion messages
            setTerminalMessages(prev => [
                ...prev,
                { text: "Resources successfully optimized!", type: "result", prefix: "🎉" },
                { text: "Bus run optimization complete", type: "info" }
            ]);
            
            // Success is handled by parent component (MasterSchedule)
            // Refresh dynamic status so modal reflects new allocations
            await loadDynamicStatus(selectedEvent);
            
            // Mark analysis as complete
            setIsAnalysisComplete(true);
            
        } catch (error) {
            console.error('Failed to optimize resources:', error);
            
            // Show error in terminal
            setTerminalMessages(prev => [
                ...prev,
                { text: `Error: ${error.message || 'Failed to optimize resources'}`, type: "error", prefix: "❌" }
            ]);
            
            alert('Failed to optimize resources. Please try again.');
        } finally {
            setIsOptimizing(false);
        }
    };
    
    /* ------------------------------------------------------------------
     * Close the terminal
     * ---------------------------------------------------------------- */
    const handleCloseTerminal = () => {
        setShowTerminal(false);
        // Reset messages for next time
        setTerminalMessages([]);
    };

    /* ------------------------------------------------------------------
     * Helper: Get status color for badges
     * ---------------------------------------------------------------- */
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

    if (!scheduleData) {
        return <p>Loading schedule...</p>;
    }

    return (
        <>
        <div className="calendar-container">
            {/* Render two rows (weeks) – each row is a 7-day chunk */}
            {[weekDates.slice(0, 7), weekDates.slice(7)].map((chunk, idx) => (
                <React.Fragment key={`week-row-${idx}`}>
                    {/* ---------- Header for the chunk ---------- */}
                    <div className="calendar-header">
                        {chunk.map((date) => (
                            <div key={date.toString()} className="day-header">
                                <strong>{DAY_NAMES[date.getDay()]}</strong>
                                <span className="date-number">{date.getDate()}</span>
                            </div>
                        ))}
                    </div>

                    {/* ---------- Body (events) for the chunk ---------- */}
                    <div className="calendar-body">
                        {chunk.map((date) => {
                            // Events for this day
                            const instancesForDay = scheduleData
                                .filter((instance) => instance.date === formatDateForApi(date))
                                .sort((a, b) => a.start_time.localeCompare(b.start_time));

                            return (
                                <div key={date.toString()} className="day-column">
                                    {instancesForDay.length > 0 ? (
                                        instancesForDay.map((instance) => (
                                            <div
                                                key={instance.id}
                                                className={`event-card${
                                                    instance.staffingStatus === 'understaffed'
                                                        ? ' understaffed'
                                                        : ''
                                                }`}
                                                onClick={() => handleEventClick(instance)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div className="event-title">
                                                    {instance.program_name}
                                                    {/* Dynamic status badge if available */}
                                                    {instance.renderDynamicBadge && instance.renderDynamicBadge()}
                                                </div>
                                                <div className="event-time">
                                                    {instance.start_time} - {instance.end_time}
                                                </div>
                                                <div className="event-venue">{instance.venue_name}</div>
                                                <div className="event-details">
                                                    <span>P: {instance.participants.length}</span>
                                                    <span>
                                                        S: {instance.staff.length} / {instance.requiredStaffCount}
                                                    </span>
                                                    {/* Show vehicle count if available */}
                                                    {instance.dynamicStatus && instance.dynamicStatus.vehicles && (
                                                        <span>V: {instance.dynamicStatus.vehicles.assigned}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="no-events" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </React.Fragment>
            ))}
        </div>

        {/* ------------------------------------------------------------------
         * Modal showing full event details
         * ---------------------------------------------------------------- */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            {selectedEvent && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ marginTop: 0 }}>{selectedEvent.program_name}</h2>
                        {/* Dynamic status indicator if available */}
                        {selectedEvent.dynamicStatus && (
                            <div 
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '16px',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    color: 'white',
                                    backgroundColor: getStatusColor(selectedEvent.dynamicStatus.overall),
                                }}
                            >
                                {selectedEvent.dynamicStatus.overall === 'optimal' ? 'Optimized' : 'Needs Optimization'}
                            </div>
                        )}
                    </div>
                    
                    <p>
                        <strong>Date:</strong> {selectedEvent.date}<br />
                        <strong>Time:</strong> {selectedEvent.start_time} - {selectedEvent.end_time}<br />
                        <strong>Venue:</strong> {selectedEvent.venue_name}
                    </p>

                    {/* Optimize Resources button */}
                    {selectedEvent.triggerRebalance && (
                        <div style={{ marginBottom: '20px' }}>
                            <button
                                onClick={handleOptimize}
                                disabled={isOptimizing}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#2196f3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                {isOptimizing && (
                                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                                )}
                                {isOptimizing ? 'Optimizing Resources...' : 'Optimize Resources'}
                            </button>
                        </div>
                    )}
                    
                    {/* Bus Run Analysis Terminal */}
                    {showTerminal && (
                        <div style={{ marginBottom: '20px' }}>
                            <BusRunAnalysisTerminal
                                messages={terminalMessages}
                                isAnalyzing={isOptimizing}
                                isComplete={isAnalysisComplete}
                                onClose={handleCloseTerminal}
                                title={`Bus Run Analysis: ${selectedEvent.program_name}`}
                            />
                        </div>
                    )}

                    {/* ------------------------------------------------------------------
                     * Resources Summary (participants / staff / vehicles)
                     * ---------------------------------------------------------------- */}
                    {selectedEvent.dynamicStatus && (
                        <>
                            <h3>Resource Summary</h3>
                            {/* Small helper to colour-code metrics */}
                            {(() => {
                                const {
                                    participants,
                                    staff,
                                    vehicles,
                                } = selectedEvent.dynamicStatus;

                                const getMetricColor = (ok) =>
                                    ok ? '#4caf50' : '#e63946';

                                return (
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
                                            gap: '12px',
                                            marginBottom: '24px',
                                        }}
                                    >
                                        {/* Participants */}
                                        <div
                                            style={{
                                                padding: '8px',
                                                borderRadius: '6px',
                                                background: '#f0f4f8',
                                            }}
                                        >
                                            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                Participants
                                            </div>
                                            <div style={{ fontSize: '20px' }}>
                                                {participants.count}
                                            </div>
                                        </div>

                                        {/* Staff */}
                                        <div
                                            style={{
                                                padding: '8px',
                                                borderRadius: '6px',
                                                background: '#f0f4f8',
                                            }}
                                        >
                                            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                Staff
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: '20px',
                                                    color: getMetricColor(
                                                        staff.assigned >= staff.required,
                                                    ),
                                                }}
                                            >
                                                {staff.assigned}/{staff.required}
                                            </div>
                                        </div>

                                        {/* Vehicles */}
                                        <div
                                            style={{
                                                padding: '8px',
                                                borderRadius: '6px',
                                                background: '#f0f4f8',
                                            }}
                                        >
                                            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                                Vehicles
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: '20px',
                                                    color: getMetricColor(
                                                        vehicles.assigned >= vehicles.preferred,
                                                    ),
                                                }}
                                            >
                                                {vehicles.assigned}/{vehicles.preferred}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </>
                    )}

                    {/* Participants */}
                    <h3>Participants ({selectedEvent.participants.length})</h3>
                    <ul>
                        {selectedEvent.participants.map((p) => (
                            <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>
                                    {p.first_name} {p.last_name} ({p.status})
                                </span>
                                {/* ---------------- Cancellation Buttons ---------------- */}
                                {p.status !== 'cancelled' && (() => {
                                    // Calculate day difference using date-fns (robust across TZ)
                                    const diffDays = differenceInCalendarDays(
                                        new Date(selectedEvent.date),
                                        simulatedDate
                                    );

                                    const btnStyles = {
                                        padding: '4px 8px',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer'
                                    };

                                    const isNormalAllowed       = diffDays >= 7;
                                    const isShortNoticeAllowed  = diffDays < 7;

                                    return (
                                      <>
                                        <button
                                          className="cancel-btn"
                                          disabled={!isNormalAllowed || loadingCancelId === p.id}
                                          style={btnStyles}
                                          onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleCancellation(
                                                p.id,
                                                selectedEvent.id,
                                                'normal'
                                              );
                                            }}
                                        >
                                            {loadingCancelId === p.id && isNormalAllowed
                                                ? 'Cancelling...'
                                                : 'Cancel'}
                                        </button>
                                        <button
                                          className="cancel-btn"
                                          disabled={!isShortNoticeAllowed || loadingCancelId === p.id}
                                          style={btnStyles}
                                          onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleCancellation(
                                                p.id,
                                                selectedEvent.id,
                                                'short_notice'
                                              );
                                            }}
                                        >
                                            {loadingCancelId === p.id && isShortNoticeAllowed
                                                ? 'Cancelling...'
                                                : 'Short Notice Cancel'}
                                        </button>
                                      </>
                                    );
                                })()}
                            </li>
                        ))}
                    </ul>

                    {/* Staff */}
                    <h3>
                        Staff ({selectedEvent.staff.length} / {selectedEvent.requiredStaffCount})
                    </h3>
                    <ul>
                        {selectedEvent.staff.map((s) => (
                            <li key={s.id}>
                                {/* Staff name w/ dropdown */}
                                <select
                                    defaultValue={s.id}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={async (e) => {
                                        const newStaffId = e.target.value;
                                        if (newStaffId === s.id) return;
                                        const single = window.confirm('Replace only this shift? Click "Cancel" for future shifts as well.');
                                        try {
                                            if (single) {
                                                await updateSingleStaffAssignment(
                                                    selectedEvent.id,
                                                    s.id,
                                                    newStaffId,
                                                    s.role,
                                                );
                                            } else {
                                                await updateRecurringStaffAssignment(
                                                    selectedEvent.program_id,
                                                    s.id,
                                                    newStaffId,
                                                    s.role,
                                                    selectedEvent.date,
                                                );
                                            }
                                            // Reload staff info
                                            await loadStaffMeta(selectedEvent);
                                            // Optimistic UI update
                                            setSelectedEvent((prev) => {
                                                if (!prev) return prev;
                                                const newStaffArr = prev.staff.map((st) =>
                                                    st.id === s.id ? { ...st, id: newStaffId, first_name: availableStaff.find(a=>a.id===newStaffId)?.first_name||'', last_name: availableStaff.find(a=>a.id===newStaffId)?.last_name||'' } : st,
                                                );
                                                return { ...prev, staff: newStaffArr };
                                            });
                                        } catch (err) {
                                            alert('Failed to update staff assignment.');
                                            console.error(err);
                                        }
                                    }}
                                >
                                    {[s, ...availableStaff.filter((a) => a.id !== s.id)].map((opt) => (
                                        <option key={opt.id} value={opt.id}>
                                            {opt.first_name} {opt.last_name}
                                        </option>
                                    ))}
                                </select>{' '}
                                ({s.role})
                                {/* Progress bar with hours display */}
                                {staffHours[s.id] && (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '8px' }}>
                                      <div
                                        style={{
                                            display: 'inline-block',
                                            width: '120px',
                                            height: '6px',
                                            background: '#ddd',
                                            marginRight: '8px',
                                            verticalAlign: 'middle',
                                        }}
                                      >
                                          <div
                                            style={{
                                                width: `${staffHours[s.id].percent_allocated}%`,
                                                height: '100%',
                                                background:
                                                    staffHours[s.id].over_allocated
                                                        ? '#e63946'
                                                        : '#4caf50',
                                            }}
                                          />
                                      </div>
                                      <small style={{ 
                                          color: staffHours[s.id].over_allocated ? '#e63946' : '#4a5568',
                                          fontWeight: staffHours[s.id].over_allocated ? 'bold' : 'normal',
                                          whiteSpace: 'nowrap'   /* keep on one line so it doesn't wrap under bar */
                                      }}>
                                          {/* Display as allocated / contracted hrs */}
                                          {(() => {
                                              const { allocated = 0, remaining = 0 } = staffHours[s.id];
                                              const contracted = allocated + remaining;
                                              return `${allocated.toFixed(1)}/${contracted.toFixed(1)} hrs`;
                                          })()}
                                      </small>
                                  </div>
                                )}
                            </li>
                        ))}
                    </ul>

                    {/* Vehicles */}
                    {selectedEvent.vehicles && selectedEvent.vehicles.length > 0 && (
                        <>
                            <h3>Vehicles ({selectedEvent.vehicles.length})</h3>
                            <ul>
                                {selectedEvent.vehicles.map((v) => (
                                    <li key={v.id}>
                                        {v.description} – Driver:{' '}
                                        {v.driver_first_name ? v.driver_first_name : 'Unassigned'}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    {/* Routes - Show if available from dynamic resource status */}
                    {selectedEvent.dynamicStatus && selectedEvent.dynamicStatus.routes && selectedEvent.dynamicStatus.routes.length > 0 && (
                        <>
                            <h3>Routes ({selectedEvent.dynamicStatus.routes.length})</h3>
                            <div style={{ marginBottom: '20px' }}>
                                {selectedEvent.dynamicStatus.routes.map((route, index) => (
                                    <div key={`route-${index}`} style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                                        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                                            {route.name || `Route ${index + 1}`} ({route.type === 'pickup' ? 'Pickup' : 'Drop-off'})
                                        </div>
                                        <div>
                                            <strong>Vehicle:</strong> {route.vehicle || 'Not assigned'}
                                        </div>
                                        <div>
                                            <strong>Driver:</strong> {route.driver || 'Not assigned'}
                                        </div>
                                        {route.estimatedTime && (
                                            <div>
                                                <strong>Estimated time:</strong> {route.estimatedTime} minutes
                                            </div>
                                        )}
                                        {route.distance && (
                                            <div>
                                                <strong>Distance:</strong> {route.distance} km
                                            </div>
                                        )}
                                        {route.stops && route.stops.length > 0 && (
                                            <div>
                                                <strong>Stops:</strong> {route.stops.length}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </Modal>
        </>
    );
};

export default CalendarView;
