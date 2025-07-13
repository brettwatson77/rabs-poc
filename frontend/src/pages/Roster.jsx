import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { getRoster } from '../api/api';
import { formatDateForApi } from '../utils/dateUtils';
import ScheduleCard from '../components/ScheduleCard';
import '../styles/Roster.css';

// Helper to format a Date object into HH:mm
const formatTime = (date) => {
    if (!(date instanceof Date) || isNaN(date)) {
        return 'Invalid Time';
    }
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const Roster = () => {
    const { simulatedDate } = useAppContext();
    const [rosterData, setRosterData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('staff'); // 'staff' or 'schedule'

    useEffect(() => {
        const fetchRosterData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch current day's roster
                const dateString = formatDateForApi(simulatedDate);
                const data = await getRoster(dateString);
                setRosterData(data);
            } catch (err) {
                setError('Failed to fetch roster data. Please ensure the backend is running.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchRosterData();
    }, [simulatedDate]);

    // Process roster data into events
    const events = useMemo(() => {
        if (!rosterData || !Array.isArray(rosterData.programInstances)) {
            return [];
        }

        const allEvents = [];

        rosterData.programInstances.forEach(pi => {
            const activityDate = pi.date;

            /* Helper to build Date objects in local time for this activityDate */
            const t = (hhmm) => new Date(`${activityDate}T${hhmm}`);

            let inboundStartTime,
                inboundEndTime,
                programStartTime,
                programEndTime,
                outboundStartTime,
                outboundEndTime;

            // Hard-coded windows per spec
            if (pi.program_name === 'Centre-based') {
                inboundStartTime  = t('08:30');
                inboundEndTime    = t('09:30');
                programStartTime  = t('09:30');
                programEndTime    = t('15:00');
                outboundStartTime = t('15:00');
                outboundEndTime   = t('16:30');
            } else if (
                pi.program_name === 'Spin & Win' ||
                pi.program_name === 'Bowling Night'
            ) {
                inboundStartTime  = t('16:30');
                inboundEndTime    = t('18:00');
                programStartTime  = t('18:00');
                programEndTime    = t('20:30');
                outboundStartTime = t('20:30');
                outboundEndTime   = t('21:30');
            } else {
                // Fallback – use original stored times
                programStartTime  = new Date(`${activityDate}T${pi.start_time}`);
                programEndTime    = new Date(`${activityDate}T${pi.end_time}`);
                inboundStartTime  = new Date(programStartTime.getTime() - 60 * 60 * 1000);
                inboundEndTime    = programStartTime;
                outboundStartTime = programEndTime;
                outboundEndTime   = new Date(programEndTime.getTime() + 60 * 60 * 1000);
            }

            // 1. Add bus run events for each vehicle
            (pi.vehicles || []).forEach((v, idx) => {
                // Map long program names to a short code for concise titles
                const getProgramAbbreviation = (name) => {
                    if (!name) return '';
                    const n = name.toLowerCase();
                    if (n.includes('centre'))      return 'CB';
                    if (n.includes('bowling'))     return 'BW';
                    if (n.includes('spin'))        return 'SW';
                    if (n.includes('adventure'))   return 'SA';
                    if (n.includes('funday'))      return 'SF';
                    return name.slice(0, 2).toUpperCase(); // Fallback – first 2 chars
                };

                const code = getProgramAbbreviation(pi.program_name);
                const seqNum = idx + 1; // 1-based sequence number
                const regNum = v.registration || 'NOREG';

                // Only create bus run events if there's a driver assigned
                if (v.driver_id) {
                    // Inbound Run - CBPU1-DSW004 format
                    allEvents.push({
                        ...pi, id: `${pi.id}-inbound-${v.id}`, type: 'bus_run',
                        program_name: `${code}PU${seqNum}-${regNum}`,
                        runType: 'pickup',
                        start_time: formatTime(inboundStartTime), end_time: formatTime(inboundEndTime),
                        startTimeObj: inboundStartTime, endTimeObj: inboundEndTime,
                        vehicles: [v], participants: pi.participants.filter(p => p.pickup_required),
                        staff: [{ id: v.driver_id, first_name: v.driver_first_name, last_name: v.driver_last_name, role: 'driver' }],
                    });

                    // Outbound Run - CBDO1-DSW004 format
                    allEvents.push({
                        ...pi, id: `${pi.id}-outbound-${v.id}`, type: 'bus_run',
                        program_name: `${code}DO${seqNum}-${regNum}`,
                        runType: 'dropoff',
                        start_time: formatTime(outboundStartTime), end_time: formatTime(outboundEndTime),
                        startTimeObj: outboundStartTime, endTimeObj: outboundEndTime,
                        vehicles: [v], participants: pi.participants.filter(p => p.dropoff_required),
                        staff: [{ id: v.driver_id, first_name: v.driver_first_name, last_name: v.driver_last_name, role: 'driver' }],
                    });
                }
            });

            // 2. Add the core program event itself
            allEvents.push({
                ...pi, id: pi.id, type: 'program',
                start_time: formatTime(programStartTime), end_time: formatTime(programEndTime),
                startTimeObj: programStartTime, endTimeObj: programEndTime,
            });
        });

        return allEvents;
    }, [rosterData]);

    // Create staff map for Staff View
    const staffMap = useMemo(() => {
        const map = {};

        events.forEach(event => {
            (event.staff || []).forEach(staffMember => {
                const staffId = staffMember.id;
                
                if (!map[staffId]) {
                    map[staffId] = {
                        staffInfo: {
                            id: staffId,
                            first_name: staffMember.first_name,
                            last_name: staffMember.last_name,
                        },
                        events: []
                    };
                }

                map[staffId].events.push(event);
            });
        });

        // Sort each staff member's events by start time
        Object.values(map).forEach(staff => {
            staff.events.sort((a, b) => a.startTimeObj - b.startTimeObj);
        });

        return map;
    }, [events]);

    // Sort events by start time for Schedule View
    const sortedEvents = useMemo(() => {
        return [...events].sort((a, b) => a.startTimeObj - b.startTimeObj);
    }, [events]);

    return (
        <div className="crud-page-container" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h1>Staff Roster</h1>
            <p>
                Showing roster for: <strong>{simulatedDate.toLocaleDateString()}</strong>
            </p>

            {/* View Mode Toggle */}
            <div className="view-mode-toggle">
                <button 
                    className={`toggle-button ${viewMode === 'staff' ? 'active' : ''}`}
                    onClick={() => setViewMode('staff')}
                >
                    Staff View
                </button>
                <button 
                    className={`toggle-button ${viewMode === 'schedule' ? 'active' : ''}`}
                    onClick={() => setViewMode('schedule')}
                >
                    Schedule View
                </button>
            </div>

            {loading && <p>Loading roster data...</p>}
            {error && <p className="error-message">{error}</p>}

            {!loading && !error && (
                <div className="roster-container">
                    {viewMode === 'staff' ? (
                        // Staff View
                        <div className="staff-view">
                            {Object.values(staffMap).length > 0 ? (
                                Object.values(staffMap).map(staff => (
                                    <div key={staff.staffInfo.id} className="staff-section">
                                        <h2 className="staff-name">
                                            {staff.staffInfo.first_name} {staff.staffInfo.last_name}
                                        </h2>
                                        <div className="staff-events">
                                            {staff.events.map(event => (
                                                <div key={event.id} className="event-card-wrapper">
                                                    <ScheduleCard
                                                        instance={{
                                                            id: event.id,
                                                            name: event.program_name,
                                                            startTime: event.start_time,
                                                            endTime: event.end_time
                                                        }}
                                                        participants={event.participants || []}
                                                        staffAssignments={(event.staff || []).map(s => ({
                                                            staff_id: s.id,
                                                            first_name: s.first_name,
                                                            last_name: s.last_name,
                                                            role: s.role
                                                        }))}
                                                        resourceStatus={{
                                                            staff: {
                                                                required: Math.ceil((event.participants || []).length / 4),
                                                                assigned: (event.staff || []).length
                                                            },
                                                            vehicles: {
                                                                preferred: (event.vehicles || []).length,
                                                                assigned: (event.vehicles || []).length
                                                            },
                                                            overall: 'unknown'
                                                        }}
                                                        busRuns={
                                                            event.type === 'bus_run'
                                                                ? [{
                                                                    id: event.id,
                                                                    route_type: event.runType === 'pickup' ? 'Pickup' : 'Dropoff',
                                                                    stops:
                                                                        (event.vehicles[0]?.[event.runType === 'pickup' ? 'pickup_route' : 'dropoff_route']?.stops || [])
                                                                            .map((stop, idx) => ({ address: stop.address, sequence: idx + 1 })),
                                                                    estimated_duration: 0,
                                                                    estimated_distance: 0
                                                                }]
                                                                : []
                                                        }
                                                        onCancel={() => {}}
                                                        onShortNoticeCancel={() => {}}
                                                        onSwapStaff={() => {}}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p>No staff assignments found for this date.</p>
                            )}
                        </div>
                    ) : (
                        // Schedule View
                        <div className="schedule-view">
                            {sortedEvents.length > 0 ? (
                                sortedEvents.map(event => (
                                    <div key={event.id} className="event-card-wrapper">
                                        <ScheduleCard
                                            instance={{
                                                id: event.id,
                                                name: event.program_name,
                                                startTime: event.start_time,
                                                endTime: event.end_time
                                            }}
                                            participants={event.participants || []}
                                            staffAssignments={(event.staff || []).map(s => ({
                                                staff_id: s.id,
                                                first_name: s.first_name,
                                                last_name: s.last_name,
                                                role: s.role
                                            }))}
                                            resourceStatus={{
                                                staff: {
                                                    required: Math.ceil((event.participants || []).length / 4),
                                                    assigned: (event.staff || []).length
                                                },
                                                vehicles: {
                                                    preferred: (event.vehicles || []).length,
                                                    assigned: (event.vehicles || []).length
                                                },
                                                overall: 'unknown'
                                            }}
                                            busRuns={
                                                event.type === 'bus_run'
                                                    ? [{
                                                        id: event.id,
                                                        route_type: event.runType === 'pickup' ? 'Pickup' : 'Dropoff',
                                                        stops:
                                                            (event.vehicles[0]?.[event.runType === 'pickup' ? 'pickup_route' : 'dropoff_route']?.stops || [])
                                                                .map((stop, idx) => ({ address: stop.address, sequence: idx + 1 })),
                                                        estimated_duration: 0,
                                                        estimated_distance: 0
                                                    }]
                                                    : []
                                            }
                                            onCancel={() => {}}
                                            onShortNoticeCancel={() => {}}
                                            onSwapStaff={() => {}}
                                        />
                                    </div>
                                ))
                            ) : (
                                <p>No events scheduled for this date.</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Roster;
