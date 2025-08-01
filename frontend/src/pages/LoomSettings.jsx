import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/LoomSettings.css';
import '../styles/Universal.css';

/**
 * LoomSettings - Control panel for the Loom system
 * 
 * This page allows users to:
 * - View and adjust the loom window size (2-16 weeks)
 * - Generate new loom instances
 * - View current loom instances
 * - Perform actions like reoptimize on instances
 */
const LoomSettings = () => {
  const navigate = useNavigate();
  
  // State hooks
  const [windowSize, setWindowSize] = useState(4);
  const [newWindowSize, setNewWindowSize] = useState(4);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState({
    windowSize: false,
    instances: false,
    generate: false,
    resize: false
  });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [dateRange, setDateRange] = useState({
    startDate: new Date(),
    endDate: new Date(new Date().setDate(new Date().getDate() + 28)) // Default 4 weeks
  });

  // Available window sizes
  const windowSizeOptions = [2, 4, 6, 8, 12, 16];

  // Fetch initial data
  useEffect(() => {
    fetchWindowSize();
    fetchInstances();
  }, []);

  // Fetch current window size
  const fetchWindowSize = async () => {
    setLoading(prev => ({ ...prev, windowSize: true }));
    try {
      const response = await axios.get('/api/v1/loom/window-size');
      if (response.data.success) {
        const size = response.data.data.windowWeeks;
        setWindowSize(size);
        setNewWindowSize(size);
        
        // Update date range based on window size
        const end = new Date();
        end.setDate(end.getDate() + (size * 7));
        setDateRange({
          startDate: new Date(),
          endDate: end
        });
      }
    } catch (error) {
      console.error('Error fetching window size:', error);
      setMessage({
        text: 'Failed to fetch current window size',
        type: 'error'
      });
    } finally {
      setLoading(prev => ({ ...prev, windowSize: false }));
    }
  };

  // Fetch loom instances
  const fetchInstances = async () => {
    setLoading(prev => ({ ...prev, instances: true }));
    try {
      const start = formatDateString(dateRange.startDate);
      const end = formatDateString(dateRange.endDate);
      const response = await axios.get('/api/v1/loom/instances', {
        params: { startDate: start, endDate: end }
      });
      
      if (response.data.success) {
        setInstances(response.data.data || []);
        // Clear any previous technical-error messages because
        // the request itself succeeded (empty array is OK)
        if ((response.data.data || []).length === 0) {
          setMessage({
            text: 'No loom instances found in the current window.',
            type: 'info'
          });
        } else {
          setMessage({ text: '', type: '' });
        }
      }
    } catch (error) {
      console.error('Error fetching instances:', error);
      setMessage({
        text: 'Unable to reach the server while fetching loom instances.',
        type: 'error'
      });
    } finally {
      setLoading(prev => ({ ...prev, instances: false }));
    }
  };

  // Generate loom window
  const handleGenerate = async () => {
    setLoading(prev => ({ ...prev, generate: true }));
    try {
      const response = await axios.post('/api/v1/loom/generate', {
        windowWeeks: windowSize
      });
      
      if (response.data.success) {
        setMessage({
          text: `Generated ${response.data.data.instanceCount} instances for ${response.data.data.windowWeeks} week window`,
          type: 'success'
        });
        fetchInstances();
      } else {
        setMessage({
          text: response.data.message || 'Failed to generate loom window',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error generating loom window:', error);
      setMessage({
        text: error.response?.data?.message || 'Failed to generate loom window',
        type: 'error'
      });
    } finally {
      setLoading(prev => ({ ...prev, generate: false }));
    }
  };

  // Resize loom window
  const handleResize = async () => {
    if (newWindowSize === windowSize) {
      setMessage({
        text: 'Window size is already set to this value',
        type: 'info'
      });
      return;
    }
    
    setLoading(prev => ({ ...prev, resize: true }));
    try {
      const response = await axios.patch('/api/v1/loom/resize', {
        windowWeeks: newWindowSize
      });
      
      if (response.data.success) {
        setWindowSize(newWindowSize);
        
        // Update date range
        const end = new Date();
        end.setDate(end.getDate() + (newWindowSize * 7));
        setDateRange({
          startDate: new Date(),
          endDate: end
        });
        
        setMessage({
          text: `Resized loom window from ${response.data.data.previousSize} to ${response.data.data.newSize} weeks`,
          type: 'success'
        });
        fetchInstances();
      } else {
        setMessage({
          text: response.data.message || 'Failed to resize loom window',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error resizing loom window:', error);
      setMessage({
        text: error.response?.data?.message || 'Failed to resize loom window',
        type: 'error'
      });
    } finally {
      setLoading(prev => ({ ...prev, resize: false }));
    }
  };

  // Reoptimize an instance
  const handleReoptimize = async (instanceId) => {
    try {
      setMessage({
        text: 'Reoptimizing instance...',
        type: 'info'
      });
      const response = await axios.post(
        `/api/v1/loom/instances/${instanceId}/reoptimize`
      );
      
      if (response.data.success) {
        setMessage({
          text: 'Instance reoptimized successfully',
          type: 'success'
        });
        fetchInstances();
      } else {
        setMessage({
          text: response.data.message || 'Failed to reoptimize instance',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error reoptimizing instance:', error);
      setMessage({
        text: error.response?.data?.message || 'Failed to reoptimize instance',
        type: 'error'
      });
    }
  };

  // View instance details
  const handleViewInstance = (instanceId) => {
    navigate(`/loom-instance/${instanceId}`);
  };

  // Format date for API
  const formatDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format date for display
  const formatDisplayDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  // Get status color based on instance status
  const getStatusColor = (instance) => {
    const state = instance.optimisation_state || {};
    
    if (instance.status === 'pending') return 'status-pending';
    if (instance.status === 'finalised') return 'status-finalised';
    
    if (state.staffing_status === 'insufficient' || state.vehicle_status === 'insufficient') {
      return 'status-warning';
    }
    if (state.staffing_status === 'needs_attention') {
      return 'status-danger';
    }
    
    return 'status-normal';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Loom Settings</h1>
        <p className="page-description">
          Configure and manage the Loom system - the dynamic resource allocation engine
        </p>
      </div>

      {/* Message display */}
      {message.text && (
        <div className={`message ${message.type}`}>
          <span>{message.text}</span>
          <button 
            className="close-button" 
            onClick={() => setMessage({ text: '', type: '' })}
          >
            ×
          </button>
        </div>
      )}

      <div className="loom-settings-container">
        {/* Window Size Controls */}
        <div className="settings-panel">
          <h2>Loom Window Size</h2>
          <div className="window-size-control">
            <p>Current window size: <strong>{windowSize} weeks</strong></p>
            
            <div className="window-size-selector">
              <label>Select new window size:</label>
              <div className="window-size-buttons">
                {windowSizeOptions.map((size) => (
                  <button
                    key={size}
                    className={`window-size-button ${newWindowSize === size ? 'selected' : ''}`}
                    onClick={() => setNewWindowSize(size)}
                  >
                    {size} weeks
                  </button>
                ))}
              </div>
            </div>
            
            <div className="action-buttons">
              <button 
                className="primary-button"
                onClick={handleResize}
                disabled={loading.resize || newWindowSize === windowSize}
              >
                {loading.resize ? 'Resizing...' : 'Resize Window'}
              </button>
              
              <button 
                className="secondary-button"
                onClick={handleGenerate}
                disabled={loading.generate}
              >
                {loading.generate ? 'Generating...' : 'Generate Loom'}
              </button>
            </div>
          </div>
        </div>

        {/* Instances List */}
        <div className="instances-panel">
          <h2>Loom Instances</h2>
          <p>
            Showing instances from {formatDisplayDate(dateRange.startDate)} to {formatDisplayDate(dateRange.endDate)}
          </p>
          
          {loading.instances ? (
            <div className="loading-spinner">Loading instances...</div>
          ) : instances.length === 0 ? (
            <div className="no-instances">
              <p>No instances found in the current window.</p>
              <button 
                className="primary-button"
                onClick={handleGenerate}
                disabled={loading.generate}
              >
                Generate Loom Instances
              </button>
            </div>
          ) : (
            <div className="instances-list">
              <div className="instance-header">
                <div className="instance-date">Date</div>
                <div className="instance-program">Program</div>
                <div className="instance-time">Time</div>
                <div className="instance-participants">Participants</div>
                <div className="instance-staff">Staff</div>
                <div className="instance-vehicles">Vehicles</div>
                <div className="instance-status">Status</div>
                <div className="instance-actions">Actions</div>
              </div>
              
              {instances.map((instance) => (
                <div 
                  key={instance.id} 
                  className={`instance-row ${getStatusColor(instance)}`}
                >
                  <div className="instance-date">
                    {formatDisplayDate(instance.instance_date)}
                  </div>
                  <div className="instance-program">{instance.program_name}</div>
                  <div className="instance-time">
                    {instance.start_time} - {instance.end_time}
                  </div>
                  <div className="instance-participants">
                    {instance.participant_count || 0}
                  </div>
                  <div className="instance-staff">
                    {instance.staff_count || 0}
                  </div>
                  <div className="instance-vehicles">
                    {instance.vehicle_count || 0}
                  </div>
                  <div className="instance-status">
                    {instance.status.charAt(0).toUpperCase() + instance.status.slice(1)}
                  </div>
                  <div className="instance-actions">
                    <button 
                      className="action-button view"
                      onClick={() => handleViewInstance(instance.id)}
                      title="View Details"
                    >
                      View
                    </button>
                    <button 
                      className="action-button reoptimize"
                      onClick={() => handleReoptimize(instance.id)}
                      title="Reoptimize"
                    >
                      Reoptimize
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoomSettings;
