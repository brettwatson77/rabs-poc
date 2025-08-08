import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { format, parseISO, isToday, isBefore, isAfter } from 'date-fns';
import { 
  FiCalendar, 
  FiClock, 
  FiUsers, 
  FiTruck, 
  FiAlertCircle,
  FiCheckCircle,
  FiRefreshCw,
  FiPlusCircle,
  FiFileText,
  FiSettings,
  FiChevronRight
} from 'react-icons/fi';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// Dashboard component
const Dashboard = () => {
  const [currentDate] = useState(new Date());
  const formattedDate = format(currentDate, 'yyyy-MM-dd');
  
  // Fetch today's time slots for the dashboard
  const { 
    data: timeSlotsData, 
    isLoading: timeSlotsLoading, 
    error: timeSlotsError,
    refetch: refetchTimeSlots
  } = useQuery(
    ['dashboardTimeSlots', formattedDate],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/dashboard/time-slots`, {
        params: { date: formattedDate }
      });
      return response.data;
    },
    {
      refetchInterval: 60000, // Refresh every minute
      staleTime: 30000
    }
  );
  
  // Fetch staff on duty today
  const { 
    data: staffData, 
    isLoading: staffLoading, 
    error: staffError 
  } = useQuery(
    ['dashboardStaff', formattedDate],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/dashboard/staff`, {
        params: { date: formattedDate }
      });
      return response.data;
    }
  );
  
  // Fetch vehicle assignments
  const { 
    data: vehiclesData, 
    isLoading: vehiclesLoading, 
    error: vehiclesError 
  } = useQuery(
    ['dashboardVehicles', formattedDate],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/dashboard/vehicles`, {
        params: { date: formattedDate }
      });
      return response.data;
    }
  );
  
  // Fetch participant status
  const { 
    data: participantsData, 
    isLoading: participantsLoading, 
    error: participantsError 
  } = useQuery(
    ['dashboardParticipants', formattedDate],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/dashboard/participants`, {
        params: { date: formattedDate }
      });
      return response.data;
    }
  );
  
  // Organize time slots into columns (Before/Now/Next/Later/After)
  const organizeTimeSlots = () => {
    if (!timeSlotsData || !timeSlotsData.data) return {
      before: [],
      now: [],
      next: [],
      later: [],
      after: []
    };
    
    const now = new Date();
    const slots = timeSlotsData.data;
    
    return {
      before: slots.filter(slot => {
        const endTime = parseISO(`${formattedDate}T${slot.end_time}`);
        return isBefore(endTime, now);
      }),
      now: slots.filter(slot => {
        const startTime = parseISO(`${formattedDate}T${slot.start_time}`);
        const endTime = parseISO(`${formattedDate}T${slot.end_time}`);
        return isBefore(startTime, now) && isAfter(endTime, now);
      }),
      next: slots.filter(slot => {
        const startTime = parseISO(`${formattedDate}T${slot.start_time}`);
        const endTime = parseISO(`${formattedDate}T${slot.end_time}`);
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        return isAfter(startTime, now) && isBefore(startTime, oneHourFromNow);
      }),
      later: slots.filter(slot => {
        const startTime = parseISO(`${formattedDate}T${slot.start_time}`);
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
        return isAfter(startTime, oneHourFromNow) && isBefore(startTime, fourHoursFromNow);
      }),
      after: slots.filter(slot => {
        const startTime = parseISO(`${formattedDate}T${slot.start_time}`);
        const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
        return isAfter(startTime, fourHoursFromNow);
      })
    };
  };
  
  const timeSlotColumns = organizeTimeSlots();
  
  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return '';
    return format(parseISO(`${formattedDate}T${timeString}`), 'h:mm a');
  };
  
  // Handle refresh button click
  const handleRefresh = () => {
    refetchTimeSlots();
  };
  
  // Render time slot card
  const renderTimeSlotCard = (slot) => {
    if (!slot) return null;
    
    const slotType = slot.slot_type || 'event';
    const iconMap = {
      pickup: <FiTruck className="card-icon pickup" />,
      event: <FiCalendar className="card-icon event" />,
      dropoff: <FiTruck className="card-icon dropoff" />
    };
    
    return (
      <div key={slot.id} className="glass-card time-slot-card">
        <div className={`card-header ${slotType}`}>
          <div className="card-header-content">
            {iconMap[slotType] || iconMap.event}
            <h4>{slot.title || 'Untitled'}</h4>
          </div>
          <span className="time-badge">
            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
          </span>
        </div>
        <div className="card-body">
          <div className="card-detail">
            <strong>Program:</strong> {slot.program_title || 'N/A'}
          </div>
          {slot.venue_name && (
            <div className="card-detail">
              <strong>Venue:</strong> {slot.venue_name}
            </div>
          )}
          {slot.participants_count > 0 && (
            <div className="card-detail">
              <strong>Participants:</strong> {slot.participants_count}
            </div>
          )}
          {slot.staff_count > 0 && (
            <div className="card-detail">
              <strong>Staff:</strong> {slot.staff_count}
            </div>
          )}
        </div>
        <div className="card-footer">
          <button className="btn-link">
            View Details <FiChevronRight />
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <div className="page-actions">
          <button 
            className="btn btn-icon" 
            onClick={handleRefresh} 
            title="Refresh Dashboard"
          >
            <FiRefreshCw />
          </button>
          <span className="date-display">
            {format(currentDate, 'EEEE, MMMM d, yyyy')}
          </span>
        </div>
      </div>
      
      {/* Welcome Card */}
      <div className="glass-card welcome-card mb-4">
        <div className="card-header">
          <h3>Welcome to RABS v3</h3>
        </div>
        <div className="card-body">
          <p>
            The all-new Roster & Billing System for NDIS providers. This clean-slate rebuild 
            follows the RP2 methodology, with API-IS-KING principle in full effect.
          </p>
          <p>
            <strong>The Loom System:</strong> RABS uses a "loom" metaphor where programs are woven 
            into the schedule. The Wall (program templates) + Calendar (dates) create the Master Schedule, 
            which breaks down into time slots shown below (Before/Now/Next/Later/After).
          </p>
        </div>
      </div>
      
      {/* Time Slots Section */}
      <section className="dashboard-section">
        <div className="section-header">
          <h3>
            <FiClock /> Today's Timeline
          </h3>
        </div>
        
        {timeSlotsLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading time slots...</p>
          </div>
        ) : timeSlotsError ? (
          <div className="error-container glass-card">
            <FiAlertCircle className="error-icon" />
            <p>Error loading time slots: {timeSlotsError.message}</p>
            <button className="btn btn-primary" onClick={handleRefresh}>
              Try Again
            </button>
          </div>
        ) : (
          <div className="time-slots-grid">
            <div className="time-column">
              <div className="column-header before">
                <h4>Before</h4>
                <span className="count-badge">{timeSlotColumns.before.length}</span>
              </div>
              <div className="column-content">
                {timeSlotColumns.before.length === 0 ? (
                  <div className="empty-column-message">No previous activities</div>
                ) : (
                  timeSlotColumns.before.map(slot => renderTimeSlotCard(slot))
                )}
              </div>
            </div>
            
            <div className="time-column">
              <div className="column-header now">
                <h4>Now</h4>
                <span className="count-badge">{timeSlotColumns.now.length}</span>
              </div>
              <div className="column-content">
                {timeSlotColumns.now.length === 0 ? (
                  <div className="empty-column-message">No current activities</div>
                ) : (
                  timeSlotColumns.now.map(slot => renderTimeSlotCard(slot))
                )}
              </div>
            </div>
            
            <div className="time-column">
              <div className="column-header next">
                <h4>Next</h4>
                <span className="count-badge">{timeSlotColumns.next.length}</span>
              </div>
              <div className="column-content">
                {timeSlotColumns.next.length === 0 ? (
                  <div className="empty-column-message">No upcoming activities</div>
                ) : (
                  timeSlotColumns.next.map(slot => renderTimeSlotCard(slot))
                )}
              </div>
            </div>
            
            <div className="time-column">
              <div className="column-header later">
                <h4>Later</h4>
                <span className="count-badge">{timeSlotColumns.later.length}</span>
              </div>
              <div className="column-content">
                {timeSlotColumns.later.length === 0 ? (
                  <div className="empty-column-message">No activities later today</div>
                ) : (
                  timeSlotColumns.later.map(slot => renderTimeSlotCard(slot))
                )}
              </div>
            </div>
            
            <div className="time-column">
              <div className="column-header after">
                <h4>After</h4>
                <span className="count-badge">{timeSlotColumns.after.length}</span>
              </div>
              <div className="column-content">
                {timeSlotColumns.after.length === 0 ? (
                  <div className="empty-column-message">No evening activities</div>
                ) : (
                  timeSlotColumns.after.map(slot => renderTimeSlotCard(slot))
                )}
              </div>
            </div>
          </div>
        )}
      </section>
      
      {/* Staff & Vehicles Grid */}
      <div className="dashboard-grid">
        {/* Staff Section */}
        <section className="dashboard-section grid-item">
          <div className="section-header">
            <h3>
              <FiUsers /> Staff on Duty
            </h3>
          </div>
          
          {staffLoading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading staff data...</p>
            </div>
          ) : staffError ? (
            <div className="error-container glass-card">
              <FiAlertCircle className="error-icon" />
              <p>Error loading staff data</p>
            </div>
          ) : (
            <div className="staff-grid">
              {!staffData || !staffData.data || staffData.data.length === 0 ? (
                <div className="empty-data-message glass-card">
                  <p>No staff scheduled for today</p>
                </div>
              ) : (
                staffData.data.slice(0, 4).map(staff => (
                  <div key={staff.id} className="glass-card staff-card">
                    <div className="staff-avatar">
                      {staff.first_name.charAt(0)}{staff.last_name.charAt(0)}
                    </div>
                    <div className="staff-info">
                      <h4>{staff.first_name} {staff.last_name}</h4>
                      <p className="staff-role">{staff.role || 'Support Worker'}</p>
                      <div className="staff-schedule">
                        <FiClock className="icon-small" />
                        <span>{staff.start_time ? formatTime(staff.start_time) : '9:00 am'} - {staff.end_time ? formatTime(staff.end_time) : '5:00 pm'}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {staffData && staffData.data && staffData.data.length > 4 && (
                <div className="glass-card view-more-card">
                  <button className="btn-link">
                    View All Staff ({staffData.data.length})
                    <FiChevronRight />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
        
        {/* Vehicles Section */}
        <section className="dashboard-section grid-item">
          <div className="section-header">
            <h3>
              <FiTruck /> Vehicle Assignments
            </h3>
          </div>
          
          {vehiclesLoading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading vehicle data...</p>
            </div>
          ) : vehiclesError ? (
            <div className="error-container glass-card">
              <FiAlertCircle className="error-icon" />
              <p>Error loading vehicle data</p>
            </div>
          ) : (
            <div className="vehicles-grid">
              {!vehiclesData || !vehiclesData.data || vehiclesData.data.length === 0 ? (
                <div className="empty-data-message glass-card">
                  <p>No vehicles assigned for today</p>
                </div>
              ) : (
                vehiclesData.data.slice(0, 4).map(vehicle => (
                  <div key={vehicle.id} className="glass-card vehicle-card">
                    <div className={`vehicle-status ${vehicle.status || 'available'}`}>
                      {vehicle.status || 'Available'}
                    </div>
                    <h4>{vehicle.make} {vehicle.model}</h4>
                    <p className="vehicle-registration">{vehicle.registration}</p>
                    {vehicle.fuel_type && (
                      <div className={`fuel-type-badge ${vehicle.fuel_type.toLowerCase()}`}>
                        {vehicle.fuel_type}
                      </div>
                    )}
                    {vehicle.assigned_to && (
                      <div className="vehicle-assignment">
                        <strong>Driver:</strong> {vehicle.assigned_to}
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {vehiclesData && vehiclesData.data && vehiclesData.data.length > 4 && (
                <div className="glass-card view-more-card">
                  <button className="btn-link">
                    View All Vehicles ({vehiclesData.data.length})
                    <FiChevronRight />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      
      {/* Participant Status Section */}
      <section className="dashboard-section">
        <div className="section-header">
          <h3>
            <FiUsers /> Participant Status
          </h3>
        </div>
        
        {participantsLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading participant data...</p>
          </div>
        ) : participantsError ? (
          <div className="error-container glass-card">
            <FiAlertCircle className="error-icon" />
            <p>Error loading participant data</p>
          </div>
        ) : (
          <div className="participants-overview glass-card">
            {!participantsData || !participantsData.data ? (
              <div className="empty-data-message">
                <p>No participant data available</p>
              </div>
            ) : (
              <div className="participant-stats">
                <div className="stat-item">
                  <div className="stat-value">{participantsData.summary?.total || 0}</div>
                  <div className="stat-label">Total Participants</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{participantsData.summary?.active || 0}</div>
                  <div className="stat-label">Active Today</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{participantsData.summary?.checked_in || 0}</div>
                  <div className="stat-label">Checked In</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{participantsData.summary?.absent || 0}</div>
                  <div className="stat-label">Absent</div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
      
      {/* Quick Actions */}
      <section className="dashboard-section">
        <div className="section-header">
          <h3>Quick Actions</h3>
        </div>
        
        <div className="quick-actions-grid">
          <button className="glass-card action-card">
            <FiPlusCircle className="action-icon" />
            <span>Create Program</span>
          </button>
          <button className="glass-card action-card">
            <FiUsers className="action-icon" />
            <span>Staff Roster</span>
          </button>
          <button className="glass-card action-card">
            <FiFileText className="action-icon" />
            <span>Generate Reports</span>
          </button>
          <button className="glass-card action-card">
            <FiSettings className="action-icon" />
            <span>System Settings</span>
          </button>
        </div>
      </section>
      
      {/* System Status */}
      <section className="dashboard-section">
        <div className="glass-card system-status-card">
          <div className="system-status-header">
            <h4>System Status</h4>
            <div className="status-indicator online">
              <FiCheckCircle />
              <span>Online</span>
            </div>
          </div>
          <div className="system-status-details">
            <div className="status-item">
              <strong>Loom Window:</strong> 7 days before, 30 days ahead
            </div>
            <div className="status-item">
              <strong>Last Updated:</strong> {format(new Date(), 'MMM d, yyyy h:mm a')}
            </div>
            <div className="status-item">
              <strong>API Version:</strong> v1
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
