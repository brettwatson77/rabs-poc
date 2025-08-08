import React, { useState } from 'react';
import '../styles/CalendarView.css';
import Modal from './Modal';
import ScheduleCard from './ScheduleCard';
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

    // Debug: inspect incoming props (helps track weekDates .map crash)
    console.log('CalendarView props:', { scheduleData, weekDates });
    
    // Safety check to prevent .map errors on non-array weekDates
    const weeks = Array.isArray(weekDates) ? [weekDates.slice(0,7), weekDates.slice(7)] : [[],[]];

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
            case 'balanced': return '#ff9800'; // orange (changed from blue to match legend)
            case 'warning': return '#ff9800'; // orange
            case 'critical': return '#f44336'; // red
            default: return '#888'; // gray
        }
    };

    // Render dynamic allocation status badge for an event
    const renderDynamicBadge = (instanceId) => {
        const status = resourceStatus[instanceId];
        if (!status) return null;
        
        // Determine label based on status
        const label = 
            status.overall === 'optimal' ? 'Optimized' :
            status.overall === 'balanced' ? 'Needs Optimization' :
            status.overall === 'critical' ? 'Critical' :
            'Unknown';
        
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
                {label}
            </div>
        );
    };

    if (!scheduleData) {
        return <p>Loading schedule...</p>;
    }

    return (
        <>
        <div className="calendar-container">
            {/* Render two rows (weeks) – each row is a 7-day chunk */}
            {weeks.map((chunk, idx) => (
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
         * Modal showing full event details using ScheduleCard component
         * ---------------------------------------------------------------- */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            {selectedEvent && (
                <>
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

                    {/* Determine busRuns for the card */}
                    {(() => {
                        // Determine busRuns for the card
                        const runs = Array.isArray(selectedEvent.dynamicStatus?.routes)
                          ? selectedEvent.dynamicStatus.routes.map(route => ({
                              id: route.id,
                              route_type: route.route_type,
                              stops: route.stops || [],
                              estimated_duration: route.estimated_duration || 0,
                              estimated_distance: route.estimated_distance || 0,
                            }))
                          : selectedEvent.type === 'bus_run'
                          ? [{
                              id: selectedEvent.id,
                              route_type: selectedEvent.runType === 'pickup' ? 'Pickup' : 'Dropoff',
                              stops: selectedEvent.stops || [],
                              estimated_duration: selectedEvent.estimated_duration || 0,
                              estimated_distance: selectedEvent.estimated_distance || 0,
                            }]
                          : [];

                        return (
                            <ScheduleCard
                                instance={{
                                    id: selectedEvent.id,
                                    name: selectedEvent.program_name,
                                    startTime: selectedEvent.start_time,
                                    endTime: selectedEvent.end_time
                                }}
                                participants={selectedEvent.participants}
                                staffAssignments={selectedEvent.staff.map(s => ({ 
                                    staff_id: s.id, 
                                    first_name: s.first_name, 
                                    last_name: s.last_name, 
                                    role: s.role 
                                }))}
                                resourceStatus={{
                                    staff: {
                                        required: selectedEvent.dynamicStatus?.staff?.required || 0,
                                        assigned: selectedEvent.dynamicStatus?.staff?.assigned || 0
                                    },
                                    vehicles: {
                                        preferred: selectedEvent.dynamicStatus?.vehicles?.preferred || 0,
                                        assigned: selectedEvent.dynamicStatus?.vehicles?.assigned || 0
                                    },
                                    overall: selectedEvent.dynamicStatus?.overall || 'unknown'
                                }}
                                busRuns={runs}
                                onCancel={(participantId, instanceId) => handleCancellation(participantId, instanceId, 'normal')}
                                onShortNoticeCancel={(participantId, instanceId) => handleCancellation(participantId, instanceId, 'short_notice')}
                                onSwapStaff={(staffId, instanceId) => {/* stub: implement staff swap */}}
                            />
                        );
                    })()}
                </>
            )}
        </Modal>
        </>
    );
};

export default CalendarView;
