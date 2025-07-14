import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
    getRoster, 
    getResourceStatus, 
    createCancellation, 
    updateSingleStaffAssignment 
} from '../api/api';
import { formatDateForApi } from '../utils/dateUtils';
import Modal from '../components/Modal'; // Import the Modal component
import ActivityCard from '../components/ActivityCard'; // Reusable card
import ScheduleCard from '../components/ScheduleCard'; // Import the ScheduleCard component
import '../styles/Dashboard.css';

// Helper to format a Date object into HH:mm
const formatTime = (date) => {
    if (!(date instanceof Date) || isNaN(date)) {
        return 'Invalid Time';
    }
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const Dashboard = () => {
    const { simulatedDate } = useAppContext();
    const [roster, setRoster] = useState(null);
    const [nextRoster, setNextRoster] = useState(null); // For next day's morning runs
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedActivity, setSelectedActivity] = useState(null); // State for the modal
    // Map of instanceId -> dynamic resource status fetched from backend
    const [resourceStatusMap, setResourceStatusMap] = useState({});

    /* ------------------------------------------------------------------
     * Shared function: (re)load today & tomorrow roster data
     * ---------------------------------------------------------------- */
    const fetchRosterData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Today
            const todayStr = formatDateForApi(simulatedDate);
            const data     = await getRoster(todayStr);
            setRoster(data);

            // Tomorrow (for early-morning bus-run preview)
            const nextDateObj = new Date(simulatedDate);
            nextDateObj.setDate(nextDateObj.getDate() + 1);
            const nextStr   = formatDateForApi(nextDateObj);
            const nextData  = await getRoster(nextStr);
            setNextRoster(nextData);
        } catch (err) {
            setError('Failed to fetch daily roster. Please ensure the backend is running.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    /* Initial load and whenever simulatedDate changes */
    useEffect(() => {
        fetchRosterData();
    }, [simulatedDate]);

    /* ------------------------------------------------------------------
     * Fetch dynamic resource status for each program instance
     * whenever the roster data is (re)loaded.
     * ---------------------------------------------------------------- */
    useEffect(() => {
        const fetchStatuses = async () => {
            if (!roster || !Array.isArray(roster.programInstances)) return;
            const map = {};
            for (const pi of roster.programInstances) {
                try {
                    map[pi.id] = await getResourceStatus(pi.id);
                } catch (e) {
                    console.error(`Failed to fetch resource status for ${pi.id}`, e);
                }
            }
            setResourceStatusMap(map);
        };
        fetchStatuses();
    }, [roster]);

    /* ------------------------------------------------------------------
     * Participant cancellation handlers
     * ---------------------------------------------------------------- */
    const handleCancel = async (participantId, programInstanceId) => {
        try {
            await createCancellation({
                participantId,
                programInstanceId,
                type: 'normal',
            });
            await fetchRosterData(); // refresh UI
        } catch (err) {
            alert('Failed to cancel participant.');
            console.error(err);
        }
    };

    const handleShortNoticeCancel = async (participantId, programInstanceId) => {
        try {
            await createCancellation({
                participantId,
                programInstanceId,
                type: 'short_notice',
            });
            await fetchRosterData();
        } catch (err) {
            alert('Failed to process short-notice cancellation.');
            console.error(err);
        }
    };

    /* ------------------------------------------------------------------
     * Staff swap handler
     * ---------------------------------------------------------------- */
    const handleSwapStaff = async (staffId, instanceId) => {
        const newStaffId = window.prompt('Enter new staff ID:');
        if (!newStaffId) return;

        // Infer role from current selected activity
        const role =
            selectedActivity?.staff.find((s) => s.id === staffId)?.role ||
            'support';

        try {
            await updateSingleStaffAssignment(
                instanceId,
                staffId,
                newStaffId,
                role,
            );
            await fetchRosterData();
        } catch (err) {
            alert('Failed to swap staff member.');
            console.error(err);
        }
    };

    // Calculate dashboard metrics from roster data
    const dashboardMetrics = useMemo(() => {
        if (!roster || !Array.isArray(roster.programInstances)) {
            return {
                totalParticipants: 0,
                totalServiceHours: 0,
                totalRevenue: 0,
                totalPrograms: 0,
                staffUtilization: 0,
                vehiclesInUse: 0
            };
        }

        // Count unique participants across all programs
        const uniqueParticipants = new Set();
        let totalServiceHours = 0;
        let totalRevenue = 0;
        let staffCount = 0;
        const vehiclesInUse = new Set();

        roster.programInstances.forEach(pi => {
            // Add participants to set
            pi.participants.forEach(p => uniqueParticipants.add(p.id));
            
            // Calculate program duration in hours
            const startTime = new Date(`${pi.date}T${pi.start_time}`);
            const endTime = new Date(`${pi.date}T${pi.end_time}`);
            const durationHours = (endTime - startTime) / (1000 * 60 * 60);
            
            // Multiply by participant count for total service hours
            const programServiceHours = durationHours * pi.participants.length;
            totalServiceHours += programServiceHours;
            
            // Estimate revenue ($60/hour per participant as placeholder)
            totalRevenue += programServiceHours * 60;
            
            // Count staff
            staffCount += pi.staff?.length || 0;
            
            // Count vehicles
            pi.vehicles?.forEach(v => vehiclesInUse.add(v.id));
        });

        return {
            totalParticipants: uniqueParticipants.size,
            totalServiceHours: Math.round(totalServiceHours * 10) / 10, // Round to 1 decimal
            totalRevenue: Math.round(totalRevenue),
            totalPrograms: roster.programInstances.length,
            staffUtilization: roster.programInstances.length > 0 ? 
                Math.round((staffCount / roster.programInstances.length) * 10) / 10 : 0,
            vehiclesInUse: vehiclesInUse.size
        };
    }, [roster]);

    const categorizedActivities = useMemo(() => {
        const now = simulatedDate instanceof Date ? simulatedDate : new Date(simulatedDate);
        const events = [];

        if (roster && Array.isArray(roster.programInstances)) {
            roster.programInstances.forEach(pi => {
                const activityDate = pi.date;

                /* Helper to build Date objects in local time for this activityDate */
                const t = (hhmm) => new Date(`${activityDate}T${hhmm}`);

                let inboundStartTime,
                    inboundEndTime,
                    programStartTime,
                    programEndTime,
                    outboundStartTime,
                    outboundEndTime;

                // ------------------------------------------------------------------
                // Hard-coded windows per spec
                // ------------------------------------------------------------------
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

                    // Inbound Run - CBPU1-DSW004 format
                    events.push({
                        ...pi, id: `${pi.id}-inbound-${v.id}`, type: 'bus_run',
                        program_name: `${code}PU${seqNum}-${regNum}`,
                        runType: 'pickup',
                        start_time: formatTime(inboundStartTime), end_time: formatTime(inboundEndTime),
                        startTimeObj: inboundStartTime, endTimeObj: inboundEndTime,
                        vehicles: [v], participants: pi.participants.filter(p => p.pickup_required),
                        staff: v.driver_id ? [{ id: v.driver_id, first_name: v.driver_first_name, last_name: v.driver_last_name, role: 'driver' }] : [],
                    });

                    // Outbound Run - CBDO1-DSW004 format
                    events.push({
                        ...pi, id: `${pi.id}-outbound-${v.id}`, type: 'bus_run',
                        program_name: `${code}DO${seqNum}-${regNum}`,
                        runType: 'dropoff',
                        start_time: formatTime(outboundStartTime), end_time: formatTime(outboundEndTime),
                        startTimeObj: outboundStartTime, endTimeObj: outboundEndTime,
                        vehicles: [v], participants: pi.participants.filter(p => p.dropoff_required),
                        staff: v.driver_id ? [{ id: v.driver_id, first_name: v.driver_first_name, last_name: v.driver_last_name, role: 'driver' }] : [],
                    });
                });

                // 2. Add the core program event itself
                events.push({
                    ...pi, id: pi.id, type: 'program',
                    start_time: formatTime(programStartTime), end_time: formatTime(programEndTime),
                    startTimeObj: programStartTime, endTimeObj: programEndTime,
                });
            });
        }

        /* ------------------------------------------------------------------
         *  Simplified categorisation
         *    • before  → only the *latest* completed event(s)
         *    • now     → events overlapping the current simulated time
         *    • next    → the earliest upcoming event(s)
         * ---------------------------------------------------------------- */
        // Anything that has finished **on or before** the current moment is past
        const past = events.filter(e => e.endTimeObj <= now);
        let previous = [];
        if (past.length > 0) {
            const maxEnd = Math.max(...past.map(e => e.endTimeObj.getTime()));
            previous = past.filter(e => e.endTimeObj.getTime() === maxEnd);
        }

        // An event is considered "now" as long as it has started and its end
        // time is still in the future (strictly greater than now)
        const happeningNow = events.filter(
            e => e.startTimeObj <= now && e.endTimeObj > now
        );

        const future = events.filter(e => e.startTimeObj > now);

        // If no future events for today, look ahead to tomorrow's morning runs
        if (future.length === 0 && nextRoster && Array.isArray(nextRoster.programInstances)) {
            nextRoster.programInstances.forEach((pi, idx) => {
                const programStartTime = new Date(`${pi.date}T${pi.start_time}`);
                const isDayProgram = programStartTime.getHours() < 16; // Only grab morning runs

                if (isDayProgram) {
                    (pi.vehicles || []).forEach((v, vIdx) => {
                        const inboundStartTime = new Date(programStartTime.getTime() - 60 * 60 * 1000); // 8:30 AM
                        const inboundEndTime = programStartTime; // 9:30 AM
                        
                        // Map program name to code
                        const getProgramAbbreviation = (name) => {
                            if (!name) return '';
                            const n = name.toLowerCase();
                            if (n.includes('centre'))      return 'CB';
                            if (n.includes('bowling'))     return 'BW';
                            if (n.includes('spin'))        return 'SW';
                            if (n.includes('adventure'))   return 'SA';
                            if (n.includes('funday'))      return 'SF';
                            return name.slice(0, 2).toUpperCase();
                        };

                        const code = getProgramAbbreviation(pi.program_name);
                        const seqNum = vIdx + 1;
                        const regNum = v.registration || 'NOREG';
                        
                        future.push({
                            ...pi, id: `${pi.id}-inbound-${v.id}`, type: 'bus_run',
                            program_name: `${code}PU${seqNum}-${regNum}`,
                            start_time: formatTime(inboundStartTime), end_time: formatTime(inboundEndTime),
                            startTimeObj: inboundStartTime, endTimeObj: inboundEndTime,
                            vehicles: [v], participants: pi.participants.filter(p => p.pickup_required),
                            staff: v.driver_id ? [{ id: v.driver_id, first_name: v.driver_first_name, last_name: v.driver_last_name, role: 'driver' }] : [],
                        });
                    });
                }
            });
        }

        let next = [];
        if (future.length > 0) {
            const minStart = Math.min(...future.map(e => e.startTimeObj.getTime()));
            next = future.filter(e => e.startTimeObj.getTime() === minStart);
        }

        const sortByTime = (a, b) => a.startTimeObj - b.startTimeObj;
        previous.sort(sortByTime);
        happeningNow.sort(sortByTime);
        next.sort(sortByTime);

        return { previous, now: happeningNow, next };
    }, [roster, nextRoster, simulatedDate]);

    return (
        <div className="crud-page-container" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h1>Admin Command Center</h1>
            <p>
                Showing status for: <strong>{simulatedDate.toLocaleString()}</strong>
            </p>

            {loading && <p>Loading command center...</p>}
            {error && <p className="error-message">{error}</p>}

            {!loading && !error && (
                <>
                    {/* KPI Metrics Dashboard */}
                    <div className="metrics-dashboard">
                        <div className="metric-card">
                            <h3>Participants</h3>
                            <div className="metric-value">{dashboardMetrics.totalParticipants}</div>
                            <div className="metric-label">Active Today</div>
                        </div>
                        <div className="metric-card">
                            <h3>Service Hours</h3>
                            <div className="metric-value">{dashboardMetrics.totalServiceHours}</div>
                            <div className="metric-label">Total Hours</div>
                        </div>
                        <div className="metric-card">
                            <h3>Revenue</h3>
                            <div className="metric-value">${dashboardMetrics.totalRevenue}</div>
                            <div className="metric-label">Estimated</div>
                        </div>
                        <div className="metric-card">
                            <h3>Programs</h3>
                            <div className="metric-value">{dashboardMetrics.totalPrograms}</div>
                            <div className="metric-label">Today's Schedule</div>
                        </div>
                        <div className="metric-card">
                            <h3>Vehicles</h3>
                            <div className="metric-value">{dashboardMetrics.vehiclesInUse}</div>
                            <div className="metric-label">In Service</div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="quick-actions">
                        <button className="action-button">View Master Schedule</button>
                        <button className="action-button">Generate Billing Report</button>
                        <button className="action-button">Staff Roster</button>
                        <button className="action-button">Manage Cancellations</button>
                    </div>

                    <div className="dashboard-container">
                        <div className="dashboard-column">
                            <h2>Before</h2>
                            <div className="column-content">
                                {categorizedActivities.previous.length > 0 ? (
                                    categorizedActivities.previous.map(a => (
                                        <ActivityCard
                                            key={a.id}
                                            activity={a}
                                            onClick={setSelectedActivity}
                                        />
                                    ))
                                ) : (
                                    <p>No past activities for this date.</p>
                                )}
                            </div>
                        </div>
                        <div className="dashboard-column now">
                            <h2>Now</h2>
                             <div className="column-content">
                                {categorizedActivities.now.length > 0 ? (
                                    categorizedActivities.now.map(a => (
                                        <ActivityCard
                                            key={a.id}
                                            activity={a}
                                            onClick={setSelectedActivity}
                                        />
                                    ))
                                ) : (
                                    <p>No activities happening now.</p>
                                )}
                            </div>
                        </div>
                        <div className="dashboard-column">
                            <h2>Next</h2>
                             <div className="column-content">
                                {categorizedActivities.next.length > 0 ? (
                                    categorizedActivities.next.map(a => (
                                        <ActivityCard
                                            key={a.id}
                                            activity={a}
                                            onClick={setSelectedActivity}
                                        />
                                    ))
                                ) : (
                                    <p>No upcoming activities.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {selectedActivity && (
              <Modal onClose={() => setSelectedActivity(null)}>
                <ScheduleCard
                  instance={{
                    id: selectedActivity.id,
                    name: selectedActivity.program_name,
                    startTime: selectedActivity.start_time,
                    endTime: selectedActivity.end_time
                  }}
                  participants={selectedActivity.participants}
                  staffAssignments={selectedActivity.staff.map(s => ({ 
                    staff_id: s.id, 
                    first_name: s.first_name, 
                    last_name: s.last_name, 
                    role: s.role 
                  }))}
                  resourceStatus={
                    (() => {
                      // For bus_run cards, use the parent program instance id (before first '-')
                      const key = selectedActivity.type === 'bus_run'
                        ? selectedActivity.id.split('-')[0]
                        : selectedActivity.id;
                      return resourceStatusMap[key] || {
                        staff: { required: 0, assigned: 0 },
                        vehicles: { preferred: 0, assigned: 0 },
                        overall: 'unknown'
                      };
                    })()
                  }
                  busRuns={
                    selectedActivity.type === 'bus_run'
                      ? [{
                          id: selectedActivity.id,
                          route_type: selectedActivity.runType === 'pickup' ? 'Pickup' : 'Dropoff',
                          stops:
                            (selectedActivity.vehicles[0]?.[selectedActivity.runType === 'pickup' ? 'pickup_route' : 'dropoff_route']?.stops || [])
                              .map((stop, idx) => ({ address: stop.address, sequence: idx + 1 })),
                          estimated_duration: 0,
                          estimated_distance: 0
                        }]
                      : []
                  }
                  onCancel={handleCancel}
                  onShortNoticeCancel={handleShortNoticeCancel}
                  onSwapStaff={handleSwapStaff}
                />
              </Modal>
            )}
        </div>
    );
};

export default Dashboard;
