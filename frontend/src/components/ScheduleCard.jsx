import React, { useEffect, useState } from 'react';
import '../styles/ScheduleCard.css';
import loadGoogleMaps from '../utils/loadGoogleMaps';

const ScheduleCard = ({
  instance,
  participants = [],
  staffAssignments = [],
  resourceStatus = { staff: {}, vehicles: {}, overall: 'unknown' },
  busRuns = [],
  onCancel = () => {},
  onShortNoticeCancel = () => {},
  onSwapStaff = () => {},
}) => {
  // ------------------------------------------------------------------
  // Local state so we can surface Google Maps loading issues in the UI
  // ------------------------------------------------------------------
  const [mapError, setMapError] = useState(null);

  const formatTime = (timeString) => {
    const date = new Date(`1970-01-01T${timeString}`);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getBadgeColor = (status) => {
    switch (status) {
      case 'optimal': return 'badge-success';
      case 'balanced': return 'badge-warning';
      case 'critical': return 'badge-danger';
      default: return 'badge-secondary';
    }
  };

  const getBadgeText = (status) => {
    switch (status) {
      case 'optimal': return 'Optimized';
      case 'balanced': return 'Needs Optimization';
      case 'critical': return 'Critical';
      default: return 'Unknown';
    }
  };

  // Render Google Maps for bus runs
  useEffect(() => {
    if (!busRuns.length) return;
    loadGoogleMaps()
      .then((google) => {
        busRuns.forEach((run) => {
          const mapEl = document.getElementById(`map-${run.id}`);
          if (!mapEl || mapEl.dataset.initialised) return;

          const firstStop = run.stops[0] || {};
          const centre = firstStop.latitude && firstStop.longitude
            ? { lat: firstStop.latitude, lng: firstStop.longitude }
            : { lat: -33.8916, lng: 150.8651 };

          const map = new google.maps.Map(mapEl, { center: centre, zoom: 11 });
          mapEl.dataset.initialised = '1';

          // ------------------------------------------------------------------
          // Real Google Directions API call to render an optimised route
          // ------------------------------------------------------------------
          const positions = run.stops
            .map((s) =>
              s.latitude && s.longitude ? { lat: s.latitude, lng: s.longitude } : null
            )
            .filter(Boolean);

          if (positions.length > 1) {
            const directionsService = new google.maps.DirectionsService();
            const directionsRenderer = new google.maps.DirectionsRenderer({ map });

            const origin = positions[0];
            const destination = positions[positions.length - 1];
            const waypoints = positions
              .slice(1, -1)
              .map((loc) => ({ location: loc, stopover: true }));

            directionsService.route(
              {
                origin,
                destination,
                waypoints,
                travelMode: google.maps.TravelMode.DRIVING,
                optimizeWaypoints: true,
              },
              (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                  directionsRenderer.setDirections(result);
                } else {
                  console.error('Directions request failed:', status);
                  // Fallback — simple markers so at least stops show on the map
                  positions.forEach((loc) => new google.maps.Marker({ map, position: loc }));
                }
              }
            );
          } else {
            // Not enough points for routing – just drop markers
            positions.forEach((loc) => new google.maps.Marker({ map, position: loc }));
          }
        });
      })
      .catch((e) => {
        console.error('Google Maps load failed:', e);
        setMapError(e.message || 'Failed to load Google Maps');
      });
  }, [busRuns]);

  return (
    <div className="schedule-card">
      <div className="schedule-card-header">
        <h3>{instance.name}</h3>
        <div className="schedule-card-time">
          {formatTime(instance.startTime)} - {formatTime(instance.endTime)}
        </div>
        <div className={`resource-badge ${getBadgeColor(resourceStatus.overall)}`}>
          {getBadgeText(resourceStatus.overall)}
        </div>
      </div>

      <div className="resource-status-section">
        <h4>Resource Status</h4>
        <div className="resource-metrics">
          <div>
            <strong>Staff:</strong> {resourceStatus.staff.assigned}/{resourceStatus.staff.required}
          </div>
          <div>
            <strong>Vehicles:</strong> {resourceStatus.vehicles.assigned}/{resourceStatus.vehicles.preferred}
          </div>
        </div>
      </div>

      <div className="participants-section">
        <h4>Participants</h4>
        {participants.length === 0 ? <p>None</p> : (
          <ul>
            {participants.map(p => (
              <li key={p.id}>
                {p.first_name} {p.last_name} ({p.status})
                <button onClick={() => onCancel(p.id, instance.id)}>Cancel</button>
                <button onClick={() => onShortNoticeCancel(p.id, instance.id)}>Short-Notice</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="staff-section">
        <h4>Staff</h4>
        {staffAssignments.length === 0 ? <p>None</p> : (
          <ul>
            {staffAssignments.map(s => (
              <li key={s.staff_id}>
                {s.first_name} {s.last_name} ({s.role})
                <button onClick={() => onSwapStaff(s.staff_id, instance.id)}>Swap</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Surface any map-loading error so the API key can be tested easily */}
      {mapError && (
        <p
          className="map-error"
          style={{ color: 'red', fontStyle: 'italic', marginTop: '8px' }}
        >
          Map error: {mapError}
        </p>
      )}

      <div className="bus-runs-section">
        <h4>Bus Runs</h4>
        {busRuns.length === 0 ? <p>None</p> : (
          busRuns.map(run => (
            <div key={run.id} className="bus-run-item">
              <div>{run.route_type}</div>
              <ol>
                {run.stops.map((stop, idx) => (
                  <li key={`${run.id}-${idx}`}>{stop.address}</li>
                ))}
              </ol>
              <div id={`map-${run.id}`} className="route-map" style={{ height: '150px' }} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ScheduleCard;
