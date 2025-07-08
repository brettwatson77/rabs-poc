import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/DynamicResourceDemo.css';
import { useAppContext } from '../context/AppContext';
import { getParticipants } from '../api/api';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';

const API_BASE_URL = 'http://localhost:3009/api/v1';

const DynamicResourceDemo = () => {
  const navigate = useNavigate();
  const { simulatedDate } = useAppContext();
  
  // State management
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [availableParticipants, setAvailableParticipants] = useState([]);
  const [resourceStatus, setResourceStatus] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [mapCenter, setMapCenter] = useState({ lat: -33.8916, lng: 150.8651 }); // Default to depot
  
  // Form state for new program
  const [newProgram, setNewProgram] = useState({
    name: '',
    description: '',
    dayOfWeek: 1, // Monday
    startTime: '09:00',
    endTime: '15:00',
    venueId: '',
    isCentreBased: true
  });
  
  // Google Maps API loading
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  // Fetch programs on mount
  useEffect(() => {
    fetchPrograms();
    fetchAllParticipants();
  }, []);
  
  // Fetch resource status when selected program changes
  useEffect(() => {
    if (selectedProgram) {
      fetchResourceStatus(selectedProgram.id);
      fetchRoutes(selectedProgram.id);
    }
  }, [selectedProgram]);
  
  // Refetch data when simulated date changes
  useEffect(() => {
    if (selectedProgram) {
      fetchResourceStatus(selectedProgram.id);
      fetchRoutes(selectedProgram.id);
    }
  }, [simulatedDate]);

  // API calls
  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/schedule`, {
        params: {
          startDate: formatDate(new Date()), // Today
          endDate: formatDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)) // 2 weeks from now
        }
      });
      
      // Group instances by program
      const programMap = {};
      response.data.data.forEach(instance => {
        if (!programMap[instance.program_id]) {
          programMap[instance.program_id] = {
            id: instance.program_id,
            name: instance.program_name,
            instances: []
          };
        }
        programMap[instance.program_id].instances.push(instance);
      });
      
      setPrograms(Object.values(programMap));
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch programs');
      setLoading(false);
      console.error('Error fetching programs:', err);
    }
  };
  
  const fetchAllParticipants = async () => {
    try {
      const data = await getParticipants();
      setParticipants(data);
    } catch (err) {
      console.error('Error fetching participants:', err);
    }
  };
  
  const fetchResourceStatus = async (programInstanceId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/dynamic-resources/status/${programInstanceId}`);
      setResourceStatus(response.data.data);
      
      // Update available participants
      if (selectedProgram) {
        fetchAvailableParticipants(programInstanceId);
      }
    } catch (err) {
      console.error('Error fetching resource status:', err);
    }
  };
  
  const fetchAvailableParticipants = async (programInstanceId) => {
    try {
      // Get all participants not already in this program instance
      const response = await axios.get(`${API_BASE_URL}/participants`);
      const allParticipants = response.data.data;
      
      // Get participants in this program instance
      const instanceResponse = await axios.get(`${API_BASE_URL}/schedule/instance/${programInstanceId}`);
      const instanceParticipants = instanceResponse.data.data?.participants || [];
      
      // Filter out participants already in the program
      const participantIds = instanceParticipants.map(p => p.id);
      const available = allParticipants.filter(p => !participantIds.includes(p.id));
      
      setAvailableParticipants(available);
    } catch (err) {
      console.error('Error fetching available participants:', err);
    }
  };
  
  const fetchRoutes = async (programInstanceId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/dynamic-resources/routes/${programInstanceId}`);
      setRoutes(response.data.data.routes);
      
      // Set map center to first route's first stop if available
      if (response.data.data.routes.length > 0 && response.data.data.routes[0].stops.length > 0) {
        const firstStop = response.data.data.routes[0].stops[0];
        if (firstStop.latitude && firstStop.longitude) {
          setMapCenter({ lat: firstStop.latitude, lng: firstStop.longitude });
        }
      }
    } catch (err) {
      console.error('Error fetching routes:', err);
    }
  };
  
  const handleAddParticipant = async (participantId) => {
    if (!selectedProgram) return;
    
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/dynamic-resources/participant-change`, {
        participantId,
        programInstanceId: selectedProgram.id,
        changeType: 'add'
      });
      
      setSuccessMessage('Participant added successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Refresh data
      fetchResourceStatus(selectedProgram.id);
      fetchRoutes(selectedProgram.id);
    } catch (err) {
      setError('Failed to add participant');
      setTimeout(() => setError(null), 3000);
      console.error('Error adding participant:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRemoveParticipant = async (participantId) => {
    if (!selectedProgram) return;
    
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/dynamic-resources/participant-change`, {
        participantId,
        programInstanceId: selectedProgram.id,
        changeType: 'cancel'
      });
      
      setSuccessMessage('Participant removed successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Refresh data
      fetchResourceStatus(selectedProgram.id);
      fetchRoutes(selectedProgram.id);
    } catch (err) {
      setError('Failed to remove participant');
      setTimeout(() => setError(null), 3000);
      console.error('Error removing participant:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleTriggerRebalance = async () => {
    if (!selectedProgram) return;
    
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/dynamic-resources/rebalance/${selectedProgram.id}`);
      
      setSuccessMessage('Resources rebalanced successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Refresh data
      fetchResourceStatus(selectedProgram.id);
      fetchRoutes(selectedProgram.id);
    } catch (err) {
      setError('Failed to rebalance resources');
      setTimeout(() => setError(null), 3000);
      console.error('Error rebalancing resources:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleOptimizeRoutes = async () => {
    if (!selectedProgram) return;
    
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/dynamic-resources/optimize-routes/${selectedProgram.id}`);
      
      setSuccessMessage('Routes optimized successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Refresh routes
      fetchRoutes(selectedProgram.id);
    } catch (err) {
      setError('Failed to optimize routes');
      setTimeout(() => setError(null), 3000);
      console.error('Error optimizing routes:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateProgram = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/dynamic-resources/programs`, newProgram);
      
      setSuccessMessage('Program created successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Reset form
      setNewProgram({
        name: '',
        description: '',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '15:00',
        venueId: '',
        isCentreBased: true
      });
      
      // Refresh programs
      fetchPrograms();
    } catch (err) {
      setError('Failed to create program');
      setTimeout(() => setError(null), 3000);
      console.error('Error creating program:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Helper functions
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };
  
  const getStaffStatusColor = (status) => {
    return status === 'adequate' ? 'green' : 'red';
  };
  
  const getVehicleStatusColor = (status) => {
    return status === 'adequate' ? 'green' : 'red';
  };
  
  const getDayName = (dayOfWeek) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  };
  
  // Render functions
  const renderProgramList = () => {
    if (loading && programs.length === 0) {
      return <div className="loading">Loading programs...</div>;
    }
    
    if (programs.length === 0) {
      return <div className="no-data">No programs found</div>;
    }
    
    return (
      <div className="program-list">
        <h3>Available Programs</h3>
        <div className="program-cards">
          {programs.map(program => (
            <div 
              key={program.id} 
              className={`program-card ${selectedProgram?.id === program.instances[0].id ? 'selected' : ''}`}
              onClick={() => setSelectedProgram(program.instances[0])}
            >
              <h4>{program.name}</h4>
              <p>Instances: {program.instances.length}</p>
              <p>Next: {program.instances[0]?.date}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  const renderResourceStatus = () => {
    if (!selectedProgram || !resourceStatus) {
      return <div className="no-data">Select a program to view resource status</div>;
    }
    
    return (
      <div className="resource-status">
        <h3>Resource Status</h3>
        <div className="status-card">
          <div className="status-header">
            <h4>{resourceStatus.programName}</h4>
            <p>{resourceStatus.date} | {resourceStatus.time}</p>
            <p>Venue: {resourceStatus.venue}</p>
          </div>
          
          <div className="status-metrics">
            <div className="metric">
              <span className="label">Participants:</span>
              <span className="value">{resourceStatus.participants.count}</span>
            </div>
            <div className="metric">
              <span className="label">Staff Required:</span>
              <span className="value">{resourceStatus.staff.required}</span>
            </div>
            <div className="metric">
              <span className="label">Staff Assigned:</span>
              <span className="value" style={{ color: getStaffStatusColor(resourceStatus.staff.status) }}>
                {resourceStatus.staff.assigned}
              </span>
            </div>
            <div className="metric">
              <span className="label">Vehicles Required:</span>
              <span className="value">{resourceStatus.vehicles.preferred}</span>
            </div>
            <div className="metric">
              <span className="label">Vehicles Assigned:</span>
              <span className="value" style={{ color: getVehicleStatusColor(resourceStatus.vehicles.status) }}>
                {resourceStatus.vehicles.assigned}
              </span>
            </div>
          </div>
          
          <div className="status-actions">
            <button 
              className="action-button rebalance" 
              onClick={handleTriggerRebalance}
              disabled={loading}
            >
              Rebalance Resources
            </button>
            <button 
              className="action-button optimize" 
              onClick={handleOptimizeRoutes}
              disabled={loading}
            >
              Optimize Routes
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  const renderParticipantManagement = () => {
    if (!selectedProgram || !resourceStatus) {
      return null;
    }
    
    return (
      <div className="participant-management">
        <h3>Participant Management</h3>
        
        <div className="participant-section">
          <h4>Current Participants ({resourceStatus.participants.count})</h4>
          {resourceStatus.participants.count === 0 ? (
            <p>No participants enrolled</p>
          ) : (
            <div className="participant-list">
              {/* We don't have the actual participants from the status API, so we'd need to fetch them separately */}
              {/* This is a placeholder for demonstration */}
              {Array.from({ length: resourceStatus.participants.count }).map((_, index) => (
                <div key={index} className="participant-item">
                  <span>Participant #{index + 1}</span>
                  <button 
                    className="remove-button"
                    onClick={() => handleRemoveParticipant(index + 1)}
                    disabled={loading}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="participant-section">
          <h4>Add Participant</h4>
          <div className="add-participant">
            <select 
              disabled={loading || availableParticipants.length === 0}
              onChange={(e) => {
                if (e.target.value) {
                  handleAddParticipant(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="">Select a participant</option>
              {availableParticipants.map(p => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
            <button 
              className="action-button"
              onClick={() => {
                // Generate a random participant ID between 1-10 for demo purposes
                const randomId = Math.floor(Math.random() * 10) + 1;
                handleAddParticipant(randomId);
              }}
              disabled={loading}
            >
              Add Random Participant
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  const renderRouteVisualization = () => {
    if (!selectedProgram || routes.length === 0) {
      return <div className="no-data">No routes available</div>;
    }
    
    return (
      <div className="route-visualization">
        <h3>Route Visualization</h3>
        
        {routes.map((route, index) => (
          <div key={index} className="route-card">
            <h4>Vehicle: {route.registration}</h4>
            <p>Driver: {route.driver || 'Unassigned'}</p>
            <p>Route Type: {route.routeType === 'pickup' ? 'Pickup' : 'Dropoff'}</p>
            <p>Estimated Duration: {route.estimatedDuration} minutes</p>
            <p>Estimated Distance: {route.estimatedDistance} km</p>
            
            <div className="route-stops">
              <h5>Stops ({route.stops.length})</h5>
              <ol>
                {route.stops.map((stop, stopIndex) => (
                  <li key={stopIndex}>
                    <strong>{stop.type === 'depot' ? 'Depot' : stop.type === 'venue' ? stop.name : stop.name}</strong>
                    <p>{stop.address}</p>
                    {stop.estimatedArrivalTime && (
                      <p>ETA: {stop.estimatedArrivalTime}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ))}
        
        {mapsLoaded && (
          <div className="map-container">
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '400px' }}
              center={mapCenter}
              zoom={12}
            >
              {routes.flatMap((route, routeIndex) => {
                // Create markers for each stop
                const markers = route.stops.map((stop, stopIndex) => {
                  if (!stop.latitude || !stop.longitude) return null;
                  
                  return (
                    <Marker
                      key={`marker-${routeIndex}-${stopIndex}`}
                      position={{ lat: stop.latitude, lng: stop.longitude }}
                      label={`${stopIndex + 1}`}
                    />
                  );
                }).filter(Boolean);
                
                // Create polyline for the route
                const path = route.stops
                  .filter(stop => stop.latitude && stop.longitude)
                  .map(stop => ({ lat: stop.latitude, lng: stop.longitude }));
                
                const polyline = path.length > 1 ? (
                  <Polyline
                    key={`polyline-${routeIndex}`}
                    path={path}
                    options={{
                      strokeColor: route.routeType === 'pickup' ? '#0088FF' : '#FF8800',
                      strokeWeight: 3
                    }}
                  />
                ) : null;
                
                return [...markers, polyline].filter(Boolean);
              })}
            </GoogleMap>
          </div>
        )}
      </div>
    );
  };
  
  const renderNewProgramForm = () => {
    return (
      <div className="new-program-form">
        <h3>Create New Dynamic Program</h3>
        <form onSubmit={handleCreateProgram}>
          <div className="form-group">
            <label htmlFor="name">Program Name</label>
            <input
              type="text"
              id="name"
              value={newProgram.name}
              onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={newProgram.description}
              onChange={(e) => setNewProgram({ ...newProgram, description: e.target.value })}
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="dayOfWeek">Day of Week</label>
              <select
                id="dayOfWeek"
                value={newProgram.dayOfWeek}
                onChange={(e) => setNewProgram({ ...newProgram, dayOfWeek: parseInt(e.target.value) })}
                required
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="startTime">Start Time</label>
              <input
                type="time"
                id="startTime"
                value={newProgram.startTime}
                onChange={(e) => setNewProgram({ ...newProgram, startTime: e.target.value })}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="endTime">End Time</label>
              <input
                type="time"
                id="endTime"
                value={newProgram.endTime}
                onChange={(e) => setNewProgram({ ...newProgram, endTime: e.target.value })}
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="venueId">Venue</label>
            <select
              id="venueId"
              value={newProgram.venueId}
              onChange={(e) => setNewProgram({ ...newProgram, venueId: e.target.value })}
            >
              <option value="">Select a venue</option>
              <option value="1">Green Valley Library</option>
              <option value="2">Alt Centre</option>
              <option value="3">Bowlarama</option>
              <option value="4">Merrylands RSL</option>
            </select>
          </div>
          
          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={newProgram.isCentreBased}
                onChange={(e) => setNewProgram({ ...newProgram, isCentreBased: e.target.checked })}
              />
              Centre-based Program
            </label>
          </div>
          
          <button type="submit" className="action-button create" disabled={loading}>
            Create Program
          </button>
        </form>
      </div>
    );
  };
  
  return (
    <div className="dynamic-resource-demo">
      <div className="page-header">
        <h1>Dynamic Resource Allocation Demo</h1>
        <p className="subtitle">
          This demo showcases automatic staff allocation, vehicle assignment, and route optimization
          as participants are added or removed from programs.
        </p>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}
      
      <div className="demo-container">
        <div className="left-panel">
          {renderProgramList()}
          {renderResourceStatus()}
          {renderParticipantManagement()}
        </div>
        
        <div className="right-panel">
          {renderRouteVisualization()}
          {renderNewProgramForm()}
        </div>
      </div>
    </div>
  );
};

export default DynamicResourceDemo;
