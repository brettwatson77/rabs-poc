import React, { useState } from 'react';
import { useQuery } from 'react-query';
import api from '../api/api';
import { format, parseISO, isBefore, isAfter } from 'date-fns';
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
  FiChevronRight,
  FiMail
} from 'react-icons/fi';

// Dashboard component
const Dashboard = () => {
  const [currentDate] = useState(new Date());
  const formattedDate = format(currentDate, 'yyyy-MM-dd');
  
  // Fetch today's time slots for the dashboard
  const { 
    data: cardsData, 
    isLoading: cardsLoading, 
    error: cardsError,
    refetch: refetchCards
  } = useQuery(
    ['dashboardCards', formattedDate],
    async () => {
      const response = await api.get('/dashboard/cards', {
        params: { date: formattedDate }
      });
      return response.data;
    },
    {
      refetchInterval: 60000, // Refresh every minute
      staleTime: 30000
    }
  );
  
  // Organize time slots into columns (Earlier/Before/Now/Next/Later)
  const organizeTimeSlots = () => {
    if (!cardsData || !cardsData.data) return {
      earlier: [],
      before: [],
      now: [],
      next: [],
      later: []
    };
    
    const now = new Date();
    const slots = cardsData.data;
    
    return {
      // Ended more than 1 hour ago
      // 1. Earlier: ended more than 2h ago
      earlier: slots.filter(slot => {
        const endTime = parseISO(slot.display_time_end);
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        return isBefore(endTime, twoHoursAgo);
      }),
      // 2. Before: ended between now-2h and now (inclusive)
      before: slots.filter(slot => {
        const endTime = parseISO(slot.display_time_end);
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        return !isBefore(endTime, twoHoursAgo) && !isAfter(endTime, now);
      }),
      // 3. Now: currently in progress
      now: slots.filter(slot => {
        const startTime = parseISO(slot.display_time_start);
        const endTime = parseISO(slot.display_time_end);
        return !isAfter(startTime, now) && isAfter(endTime, now);
      }),
      // 4. Next: starts within next 2h
      next: slots.filter(slot => {
        const startTime = parseISO(slot.display_time_start);
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        return isAfter(startTime, now) && !isAfter(startTime, twoHoursFromNow);
      }),
      // 5. Later: starts after next 2h window
      later: slots.filter(slot => {
        const startTime = parseISO(slot.display_time_start);
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        return isAfter(startTime, twoHoursFromNow);
      })
    };
  };
  
  const timeSlotColumns = organizeTimeSlots();
  
  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return '';
    return format(parseISO(timeString), 'h:mm a');
  };
  
  // Handle refresh button click
  const handleRefresh = () => {
    refetchCards();
    // Metrics & alerts disabled
  };
  
  // Render time slot card
  const renderTimeSlotCard = (slot) => {
    if (!slot) return null;
    
    const slotType = (slot.card_type || 'event').toLowerCase();
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
            <h4>{slot.display_title || 'Untitled'}</h4>
          </div>
          <span className="time-badge">
            {formatTime(slot.display_time_start)} - {formatTime(slot.display_time_end)}
          </span>
        </div>
        <div className="card-body">
          {slot.display_subtitle && (
            <div className="card-detail">
              <strong>Program:</strong> {slot.display_subtitle}
            </div>
          )}
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
            disabled={cardsLoading}
            title="Refresh Dashboard"
          >
            <FiRefreshCw />
            {cardsLoading && <span className="ml-2">Refreshing...</span>}
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
            <strong>The Loom System:</strong> RABS uses a &quot;loom&quot; metaphor where programs are woven 
            into the schedule. The Wall (program templates) + Calendar (dates) create the Master Schedule, 
            which breaks down into time slots shown below (Earlier/Before/Now/Next/Later).
          </p>
        </div>
      </div>
      
      {/* Time Slots Section */}
      <section className="dashboard-section mb-4">
        <div className="section-header">
          <h3>
            <FiClock /> Today&rsquo;s Timeline
          </h3>
        </div>
        
        {cardsLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading time slots...</p>
          </div>
        ) : cardsError ? (
          <div className="error-container glass-card">
            <FiAlertCircle className="error-icon" />
            <p>Error loading time slots: {cardsError.message}</p>
            <button className="btn btn-primary" onClick={handleRefresh}>
              Try Again
            </button>
          </div>
        ) : (
          <div
            className="time-slots-grid responsive-5col"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '16px',
              overflowX: 'visible'
            }}
          >
            {/* Earlier */}
            <div className="time-column">
              <div className="column-header earlier">
                <h4>Earlier</h4>
                {timeSlotColumns.earlier.length > 0 && (
                  <span className="count-badge">{timeSlotColumns.earlier.length}</span>
                )}
              </div>
              <div className="column-content">
                {timeSlotColumns.earlier.length === 0 ? (
                  <div className="empty-dotted-card">
                    No cards to display
                  </div>
                ) : (
                  timeSlotColumns.earlier.map(slot => renderTimeSlotCard(slot))
                )}
              </div>
            </div>

            {/* Before */}
            <div className="time-column">
              <div className="column-header before">
                <h4>Before</h4>
                {timeSlotColumns.before.length > 0 && (
                  <span className="count-badge">{timeSlotColumns.before.length}</span>
                )}
              </div>
              <div className="column-content">
                {timeSlotColumns.before.length === 0 ? (
                  <div className="empty-dotted-card">
                    No cards to display
                  </div>
                ) : (
                  timeSlotColumns.before.map(slot => renderTimeSlotCard(slot))
                )}
              </div>
            </div>
            
            {/* Now */}
            <div className="time-column">
              <div className="column-header now">
                <h4>Now</h4>
                {timeSlotColumns.now.length > 0 && (
                  <span className="count-badge">{timeSlotColumns.now.length}</span>
                )}
              </div>
              <div className="column-content">
                {timeSlotColumns.now.length === 0 ? (
                  <div className="empty-dotted-card">
                    No cards to display
                  </div>
                ) : (
                  timeSlotColumns.now.map(slot => renderTimeSlotCard(slot))
                )}
              </div>
            </div>
            
            {/* Next */}
            <div className="time-column">
              <div className="column-header next">
                <h4>Next</h4>
                {timeSlotColumns.next.length > 0 && (
                  <span className="count-badge">{timeSlotColumns.next.length}</span>
                )}
              </div>
              <div className="column-content">
                {timeSlotColumns.next.length === 0 ? (
                  <div className="empty-dotted-card">
                    No cards to display
                  </div>
                ) : (
                  timeSlotColumns.next.map(slot => renderTimeSlotCard(slot))
                )}
              </div>
            </div>
            
            {/* Later */}
            <div className="time-column">
              <div className="column-header later">
                <h4>Later</h4>
                {timeSlotColumns.later.length > 0 && (
                  <span className="count-badge">{timeSlotColumns.later.length}</span>
                )}
              </div>
              <div className="column-content">
                {timeSlotColumns.later.length === 0 ? (
                  <div className="empty-dotted-card">
                    No cards to display
                  </div>
                ) : (
                  timeSlotColumns.later.map(slot => renderTimeSlotCard(slot))
                )}
              </div>
            </div>
          </div>
        )}
      </section>
      
      {/* KPI Overview and Alerts sections hidden until endpoints exist */}
      
      {/* Quick Actions */}
      <section className="dashboard-section mb-4">
        <div className="section-header">
          <h3>Quick Actions</h3>
        </div>
        
        <div className="quick-actions-grid integrated">
          <button className="glass-card action-card action-cta">
            <FiPlusCircle className="action-icon" />
            <span>Create Program</span>
          </button>
          <button className="glass-card action-card action-cta">
            <FiUsers className="action-icon" />
            <span>Publish Roster</span>
          </button>
          <button className="glass-card action-card action-cta">
            <FiMail className="action-icon" />
            <span>Message All Clients</span>
          </button>
          <button className="glass-card action-card action-cta">
            <FiMail className="action-icon" />
            <span>Message All Staff</span>
          </button>
          <button className="glass-card action-card action-cta">
            <FiTruck className="action-icon" />
            <span>Vehicle Locator</span>
          </button>
        </div>
      </section>
      
      {/* System Status and Photo Highlights */}
      <section className="dashboard-section mb-4">
        <div className="system-photo-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* System Settings */}
          <div className="glass-card system-status-card">
            <div className="system-status-header">
              <h4>System Settings</h4>
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
          
          {/* Photo Highlights */}
          <div className="glass-card photo-highlights-card">
            <div className="card-header">
              <h4>Photo Highlights</h4>
            </div>
            <div className="photo-container">
              <img src="/dashphoto.jpg" alt="Highlights" style={{ width: '100%', height: 'auto' }} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
