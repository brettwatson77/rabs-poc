import React from 'react';
import '../styles/ScheduleCard.css';

const ScheduleCard = ({ 
  instance, 
  participants, 
  staffAssignments, 
  resourceStatus, 
  busRuns,
  onCancel,
  onShortNoticeCancel,
  onSwapStaff
}) => {
  // Format time for display
  const formatTime = (timeString) => {
    const time = new Date(`1970-01-01T${timeString}`);
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Determine badge color based on overall status
  const getBadgeColor = (status) => {
    switch(status) {
      case 'optimal':
        return 'badge-success';
      case 'balanced':
        return 'badge-warning';
      case 'critical':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  };

  // Determine badge text based on overall status
  const getBadgeText = (status) => {
    switch(status) {
      case 'optimal':
        return 'Optimized';
      case 'balanced':
        return 'Needs Optimization';
      case 'critical':
        return 'Critical';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="schedule-card">
      {/* Header Section */}
      <div className="schedule-card-header">
        <h3>{instance.name}</h3>
        <div className="schedule-card-time">
          {formatTime(instance.startTime)} - {formatTime(instance.endTime)}
        </div>
        <div className={`resource-badge ${getBadgeColor(resourceStatus.overall)}`}>
          {getBadgeText(resourceStatus.overall)}
        </div>
      </div>

      {/* Resource Status Section */}
      <div className="resource-status-section">
        <h4>Resource Status</h4>
        <div className="resource-metrics">
          <div className="resource-metric">
            <span className="metric-label">Staff:</span>
            <span className="metric-value">
              {resourceStatus.staff.assigned}/{resourceStatus.staff.required}
            </span>
            {resourceStatus.staff.assigned < resourceStatus.staff.required && (
              <span className="understaffed-warning">Understaffed</span>
            )}
            {resourceStatus.staff.assigned > resourceStatus.staff.required && (
              <span className="overstaffed-warning">Overstaffed</span>
            )}
          </div>
          <div className="resource-metric">
            <span className="metric-label">Vehicles:</span>
            <span className="metric-value">
              {resourceStatus.vehicles.assigned}/{resourceStatus.vehicles.preferred}
            </span>
          </div>
        </div>
      </div>

      {/* Participants Section */}
      <div className="participants-section">
        <h4>Participants</h4>
        {participants.length === 0 ? (
          <p>No participants enrolled</p>
        ) : (
          <ul className="participant-list">
            {participants.map(participant => (
              <li key={participant.id} className="participant-item">
                <span className="participant-name">
                  {participant.first_name} {participant.last_name}
                </span>
                <span className="participant-status">{participant.status}</span>
                <div className="participant-actions">
                  <button 
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => onCancel(participant.id, instance.id)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-sm btn-outline-warning"
                    onClick={() => onShortNoticeCancel(participant.id, instance.id)}
                  >
                    Short-Notice Cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Staff Section */}
      <div className="staff-section">
        <h4>Staff Assignments</h4>
        {staffAssignments.length === 0 ? (
          <p>No staff assigned</p>
        ) : (
          <ul className="staff-list">
            {staffAssignments.map(staff => (
              <li key={staff.staff_id} className="staff-item">
                <span className="staff-name">
                  {staff.first_name} {staff.last_name}
                </span>
                <span className="staff-role">{staff.role}</span>
                <div className="staff-actions">
                  <button 
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => onSwapStaff(staff.staff_id, instance.id)}
                  >
                    Swap
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Bus Runs Section */}
      <div className="bus-runs-section">
        <h4>Bus Runs</h4>
        {busRuns.length === 0 ? (
          <p>No bus runs scheduled</p>
        ) : (
          <div className="bus-runs-list">
            {busRuns.map(busRun => (
              <div key={busRun.id} className="bus-run-item">
                <div className="bus-run-header">
                  <h5 className="bus-run-type">{busRun.route_type}</h5>
                  <div className="bus-run-metrics">
                    <span className="duration">
                      Duration: {Math.round(busRun.estimated_duration / 60)} min
                    </span>
                    <span className="distance">
                      Distance: {(busRun.estimated_distance / 1000).toFixed(1)} km
                    </span>
                  </div>
                </div>
                
                <div className="bus-run-stops">
                  <h6>Stops:</h6>
                  <ol className="stops-list">
                    {busRun.stops.map((stop, index) => (
                      <li key={index} className="stop-item">
                        <span className="stop-sequence">{stop.sequence}.</span>
                        <span className="stop-address">{stop.address}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                
                {/* Map placeholder */}
                <div className="route-map" id={`map-${busRun.id}`}></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleCard;
