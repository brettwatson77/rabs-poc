import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../styles/LoomControls.css';

/**
 * Loom Controls Dashboard
 * 
 * Advanced control interface for the loom logic engine with real-time
 * configuration, testing, and monitoring capabilities.
 */
const LoomControls = () => {
  // Configuration state
  const [config, setConfig] = useState({
    PARTICIPANTS_PER_LEAD: 5,
    PARTICIPANTS_PER_SUPPORT: 5,
    MIN_SUPERVISION_MULTIPLIER: 1.0,
    HIGH_SUPPORT_THRESHOLD: 2.5,
    OPTIMAL_BUS_RUN_DURATION: 45,
    MAX_BUS_RUN_DURATION: 90,
    VEHICLE_CAPACITY_BUFFER: 0.9,
    MIN_PICKUP_DURATION: 30,
    MIN_DROPOFF_DURATION: 30,
    ACTIVITY_PADDING_BEFORE: 15,
    ACTIVITY_PADDING_AFTER: 15,
    TARGET_PROFIT_MARGIN: 0.15,
    ADMIN_COST_PERCENTAGE: 0.18,
    PREFER_CASUAL_STAFF: true
  });

  // Form state for unsaved changes
  const [formConfig, setFormConfig] = useState({...config});
  
  // UI state
  const [loading, setLoading] = useState({
    config: false,
    saving: false,
    rebalancing: false,
    testing: false,
    metrics: false,
    logs: false
  });
  
  const [notification, setNotification] = useState({
    show: false,
    type: 'info',
    message: ''
  });
  
  // Control state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedInstance, setSelectedInstance] = useState('');
  const [instances, setInstances] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [testResults, setTestResults] = useState(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('configuration');
  
  // Emergency control state
  const [emergencyForm, setEmergencyForm] = useState({
    type: 'participant',
    participantId: '',
    staffId: '',
    date: new Date(),
    reason: ''
  });
  
  // Preview state
  const [previewData, setPreviewData] = useState({
    participants: 10,
    supervisionLoad: 12.5,
    staffNeeded: 3
  });

  // System Log state
  const [logs, setLogs] = useState([]);
  const [logFilters, setLogFilters] = useState({
    severity: 'ALL',
    category: 'ALL',
    resolutionRequired: false
  });
  const [wsConnected, setWsConnected] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState({});
  const logEndRef = useRef(null);
  const wsRef = useRef(null);

  // Load configuration on mount
  useEffect(() => {
    fetchConfiguration();
    fetchInstances();
    fetchInitialLogs();
    initWebSocket();

    // Cleanup WebSocket on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  // Update preview when form config changes
  useEffect(() => {
    updateStaffingPreview();
  }, [formConfig]);

  // Scroll to bottom when logs update
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);
  
  // Initialize WebSocket connection for real-time logs
  const initWebSocket = () => {
    // Use secure WebSocket if on HTTPS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port || (protocol === 'wss:' ? '443' : '80');
    const wsUrl = `${protocol}//${host}:${port}/api/v1/loom/logs`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      setWsConnected(true);
      console.log('WebSocket connected');
    };

    wsRef.current.onclose = () => {
      setWsConnected(false);
      console.log('WebSocket disconnected');
      
      // Try to reconnect after 5 seconds
      setTimeout(initWebSocket, 5000);
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'NEW_LOG') {
          // Add new log to state
          setLogs(prevLogs => [data.data, ...prevLogs].slice(0, 1000)); // Limit to 1000 logs
        } else if (data.type === 'INITIAL_LOGS') {
          // Replace logs with initial set
          setLogs(data.data);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
  };

  // Fetch initial logs from API
  const fetchInitialLogs = async () => {
    setLoading({...loading, logs: true});
    
    try {
      // For initial display, add some example logs
      const exampleLogs = [
        {
          timestamp: new Date(),
          timestamp_iso: new Date().toISOString(),
          severity: 'ERROR',
          category: 'RESOURCE',
          message: 'STAFF SHORTAGE: Need 55, have 52 (shortage of 3)',
          details: {
            resourceType: 'STAFF',
            required: 55,
            available: 52,
            shortage: 3,
            date: new Date().toISOString().split('T')[0]
          },
          affected_entities: [
            { type: 'PROGRAM', name: 'Monday Social Group', unassigned_shifts: 2 },
            { type: 'PROGRAM', name: 'Cooking Skills', unassigned_shifts: 1 }
          ],
          resolution_required: true,
          resolution_suggestions: [
            'Contact casual staff pool immediately',
            'Review staff availability for the day',
            'Prioritize programs by participant needs'
          ]
        },
        {
          timestamp: new Date(Date.now() - 5 * 60000), // 5 minutes ago
          timestamp_iso: new Date(Date.now() - 5 * 60000).toISOString(),
          severity: 'WARN',
          category: 'OPTIMIZATION',
          message: 'Bus run to Blue Mountains exceeds target duration by 45 minutes (target: 60, actual: 105)',
          details: {
            run_id: '12345',
            vehicle_id: 'v-123',
            vehicle_name: 'Bus 3',
            target_duration: 60,
            actual_duration: 105,
            difference: 45,
            destination: 'Blue Mountains',
            pickup_count: 8,
            distance_km: 85
          },
          affected_entities: [
            { type: 'PARTICIPANT', id: 'p-123', name: 'John D.' },
            { type: 'PARTICIPANT', id: 'p-124', name: 'Sarah M.' }
          ],
          resolution_required: true,
          resolution_suggestions: [
            'Review program timing to accommodate longer travel',
            'Consider closer pickup points for distant participants'
          ]
        },
        {
          timestamp: new Date(Date.now() - 15 * 60000), // 15 minutes ago
          timestamp_iso: new Date(Date.now() - 15 * 60000).toISOString(),
          severity: 'ERROR',
          category: 'CONSTRAINT',
          message: 'Supervision multiplier conflict: 3 participants require 4.25 supervision units',
          details: {
            program_id: 'prog-123',
            program_name: 'Thursday Adventure',
            total_participants: 3,
            total_supervision_load: 4.25,
            current_staff: 1,
            required_staff: 2,
            shortage: 1
          },
          affected_entities: [
            { type: 'PARTICIPANT', id: 'p-125', name: 'Alex T.', supervision_multiplier: 1.5 },
            { type: 'PARTICIPANT', id: 'p-126', name: 'Emma L.', supervision_multiplier: 1.5 },
            { type: 'PARTICIPANT', id: 'p-127', name: 'Michael R.', supervision_multiplier: 1.25 }
          ],
          resolution_required: true,
          resolution_suggestions: [
            'Add additional support staff',
            'Review participant groupings',
            'Check supervision multiplier accuracy'
          ]
        },
        {
          timestamp: new Date(Date.now() - 30 * 60000), // 30 minutes ago
          timestamp_iso: new Date(Date.now() - 30 * 60000).toISOString(),
          severity: 'INFO',
          category: 'OPERATIONAL',
          message: 'Daily loom roll completed successfully',
          details: {
            date: new Date().toISOString().split('T')[0],
            instances_created: 42,
            participants_allocated: 156,
            staff_assigned: 28,
            vehicles_assigned: 12
          },
          affected_entities: [],
          resolution_required: false,
          resolution_suggestions: []
        },
        {
          timestamp: new Date(Date.now() - 60 * 60000), // 1 hour ago
          timestamp_iso: new Date(Date.now() - 60 * 60000).toISOString(),
          severity: 'CRITICAL',
          category: 'SYSTEM',
          message: 'Database connection error during loom roll',
          details: {
            errorType: 'DATABASE',
            error: 'Connection timeout after 30000ms',
            operation: 'Daily roll',
            attempts: 3
          },
          affected_entities: [],
          resolution_required: true,
          resolution_suggestions: [
            'Check database connection',
            'Verify table structure',
            'Review SQL queries'
          ]
        }
      ];
      
      setLogs(exampleLogs);

      // In a real implementation, you would fetch logs from the API:
      /*
      const response = await axios.get('/api/v1/loom/logs', {
        params: {
          limit: 100,
          ...logFilters
        }
      });
      
      if (response.data && response.data.success) {
        setLogs(response.data.data);
      } else {
        showNotification('error', 'Failed to fetch logs');
      }
      */
    } catch (error) {
      console.error('Error fetching logs:', error);
      showNotification('error', 'Error loading logs: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading({...loading, logs: false});
    }
  };

  // Filter logs based on current filters
  const getFilteredLogs = () => {
    return logs.filter(log => {
      // Filter by severity
      if (logFilters.severity !== 'ALL' && log.severity !== logFilters.severity) {
        return false;
      }
      
      // Filter by category
      if (logFilters.category !== 'ALL' && log.category !== logFilters.category) {
        return false;
      }
      
      // Filter by resolution required
      if (logFilters.resolutionRequired && !log.resolution_required) {
        return false;
      }
      
      return true;
    });
  };

  // Toggle log expansion
  const toggleLogExpansion = (index) => {
    setExpandedLogs(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Clear all logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Update log filters
  const handleFilterChange = (key, value) => {
    setLogFilters({
      ...logFilters,
      [key]: value
    });
  };

  // Get severity badge color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'INFO': return 'info';
      case 'WARN': return 'warning';
      case 'ERROR': return 'danger';
      case 'CRITICAL': return 'danger';
      default: return 'secondary';
    }
  };

  // Get category badge color
  const getCategoryColor = (category) => {
    switch (category) {
      case 'RESOURCE': return 'primary';
      case 'OPTIMIZATION': return 'info';
      case 'CONSTRAINT': return 'warning';
      case 'SYSTEM': return 'danger';
      case 'OPERATIONAL': return 'success';
      case 'FINANCIAL': return 'dark';
      default: return 'secondary';
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Format date
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  // Fetch current configuration from API
  const fetchConfiguration = async () => {
    setLoading({...loading, config: true});
    
    try {
      const response = await axios.get('/api/v1/loom/config');
      
      if (response.data && response.data.success) {
        const configData = response.data.data;
        setConfig(configData);
        setFormConfig(configData);
      } else {
        showNotification('error', 'Failed to load configuration');
      }
    } catch (error) {
      console.error('Error fetching configuration:', error);
      showNotification('error', 'Error loading configuration: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading({...loading, config: false});
    }
  };
  
  // Fetch available instances for testing
  const fetchInstances = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await axios.get(`/api/v1/loom/instances`, {
        params: {
          start: today,
          limit: 50
        }
      });
      
      if (response.data && response.data.success) {
        setInstances(response.data.data);
        if (response.data.data.length > 0) {
          setSelectedInstance(response.data.data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching instances:', error);
    }
  };
  
  // Save configuration changes
  const saveConfiguration = async () => {
    setLoading({...loading, saving: true});
    
    try {
      const response = await axios.post('/api/v1/loom/config', formConfig);
      
      if (response.data && response.data.success) {
        setConfig(formConfig);
        showNotification('success', 'Configuration saved successfully');
      } else {
        showNotification('error', 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      showNotification('error', 'Error saving configuration: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading({...loading, saving: false});
    }
  };
  
  // Reset configuration to defaults
  const resetConfiguration = async () => {
    if (!window.confirm('Are you sure you want to reset all configuration to defaults?')) {
      return;
    }
    
    setLoading({...loading, saving: true});
    
    try {
      const response = await axios.post('/api/v1/loom/config/reset');
      
      if (response.data && response.data.success) {
        const configData = response.data.config;
        setConfig(configData);
        setFormConfig(configData);
        showNotification('success', 'Configuration reset to defaults');
      } else {
        showNotification('error', 'Failed to reset configuration');
      }
    } catch (error) {
      console.error('Error resetting configuration:', error);
      showNotification('error', 'Error resetting configuration: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading({...loading, saving: false});
    }
  };
  
  // Rebalance staff for a specific date
  const rebalanceStaff = async () => {
    setLoading({...loading, rebalancing: true});
    
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await axios.post(`/api/v1/loom/rebalance/${dateStr}`);
      
      if (response.data && response.data.success) {
        showNotification('success', `Rebalanced staff for ${dateStr}`);
        fetchMetrics(dateStr);
      } else {
        showNotification('error', 'Failed to rebalance staff');
      }
    } catch (error) {
      console.error('Error rebalancing staff:', error);
      showNotification('error', 'Error rebalancing staff: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading({...loading, rebalancing: false});
    }
  };
  
  // Handle emergency cancellations/absences
  const handleEmergencyAction = async () => {
    setLoading({...loading, rebalancing: true});
    
    try {
      const dateStr = emergencyForm.date.toISOString().split('T')[0];
      
      if (emergencyForm.type === 'participant') {
        if (!emergencyForm.participantId) {
          showNotification('error', 'Participant ID is required');
          return;
        }
        
        const response = await axios.post('/api/v1/loom/cancellation', {
          participant_id: emergencyForm.participantId,
          date: dateStr,
          reason: emergencyForm.reason || 'Emergency cancellation'
        });
        
        if (response.data && response.data.success) {
          showNotification('success', `Handled cancellation for participant ${emergencyForm.participantId}`);
          fetchMetrics(dateStr);
        } else {
          showNotification('error', 'Failed to handle cancellation');
        }
      } else {
        if (!emergencyForm.staffId) {
          showNotification('error', 'Staff ID is required');
          return;
        }
        
        const response = await axios.post('/api/v1/loom/absence', {
          staff_id: emergencyForm.staffId,
          date: dateStr,
          reason: emergencyForm.reason || 'Emergency absence'
        });
        
        if (response.data && response.data.success) {
          showNotification('success', `Handled absence for staff ${emergencyForm.staffId}`);
          fetchMetrics(dateStr);
        } else {
          showNotification('error', 'Failed to handle absence');
        }
      }
    } catch (error) {
      console.error('Error handling emergency action:', error);
      showNotification('error', 'Error handling emergency action: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading({...loading, rebalancing: false});
    }
  };
  
  // Fetch metrics for a specific date
  const fetchMetrics = async (dateStr = null) => {
    setLoading({...loading, metrics: true});
    
    try {
      const date = dateStr || selectedDate.toISOString().split('T')[0];
      const response = await axios.get(`/api/v1/loom/metrics/${date}`);
      
      if (response.data && response.data.success) {
        setMetrics(response.data.data);
      } else {
        showNotification('error', 'Failed to fetch metrics');
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      showNotification('error', 'Error fetching metrics: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading({...loading, metrics: false});
    }
  };
  
  // Run tests on selected instance
  const runTest = async (testType) => {
    if (!selectedInstance) {
      showNotification('error', 'Please select an instance to test');
      return;
    }
    
    setLoading({...loading, testing: true});
    setTestResults(null);
    
    try {
      let endpoint = '';
      
      switch (testType) {
        case 'cards':
          endpoint = `/api/v1/loom/test/cards/${selectedInstance}`;
          break;
        case 'staff':
          endpoint = `/api/v1/loom/test/staff/${selectedInstance}`;
          break;
        case 'vehicles':
          endpoint = `/api/v1/loom/test/vehicles/${selectedInstance}`;
          break;
        default:
          throw new Error('Invalid test type');
      }
      
      const response = await axios.get(endpoint);
      
      if (response.data && response.data.success) {
        setTestResults({
          type: testType,
          data: response.data.data
        });
      } else {
        showNotification('error', 'Test failed');
      }
    } catch (error) {
      console.error('Error running test:', error);
      showNotification('error', 'Error running test: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading({...loading, testing: false});
    }
  };
  
  // Process selected instance
  const processInstance = async () => {
    if (!selectedInstance) {
      showNotification('error', 'Please select an instance to process');
      return;
    }
    
    setLoading({...loading, testing: true});
    
    try {
      const response = await axios.post(`/api/v1/loom/process/${selectedInstance}`);
      
      if (response.data && response.data.success) {
        showNotification('success', 'Instance processed successfully');
        setTestResults({
          type: 'process',
          data: response.data.data
        });
      } else {
        showNotification('error', 'Failed to process instance');
      }
    } catch (error) {
      console.error('Error processing instance:', error);
      showNotification('error', 'Error processing instance: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading({...loading, testing: false});
    }
  };
  
  // Update staffing preview based on current form values
  const updateStaffingPreview = () => {
    // Calculate staffing requirements based on current form values
    const participantCount = previewData.participants;
    const supervisionLoad = previewData.supervisionLoad;
    
    const needsLead = participantCount > formConfig.PARTICIPANTS_PER_LEAD;
    const supportStaffCount = Math.ceil(supervisionLoad / formConfig.PARTICIPANTS_PER_SUPPORT);
    const totalStaffNeeded = needsLead ? supportStaffCount + 1 : Math.max(supportStaffCount, 1);
    
    setPreviewData({
      ...previewData,
      staffNeeded: totalStaffNeeded
    });
  };
  
  // Handle form input changes
  const handleConfigChange = (key, value) => {
    setFormConfig({
      ...formConfig,
      [key]: value
    });
  };
  
  // Handle emergency form changes
  const handleEmergencyFormChange = (key, value) => {
    setEmergencyForm({
      ...emergencyForm,
      [key]: value
    });
  };
  
  // Handle preview participant count change
  const handlePreviewParticipantChange = (value) => {
    const newParticipants = parseInt(value);
    const newSupervisionLoad = newParticipants * 1.25; // Simple estimation
    
    setPreviewData({
      ...previewData,
      participants: newParticipants,
      supervisionLoad: newSupervisionLoad
    });
  };
  
  // Show notification message
  const showNotification = (type, message) => {
    setNotification({
      show: true,
      type,
      message
    });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setNotification({
        ...notification,
        show: false
      });
    }, 5000);
  };
  
  // Format currency values
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Format percentage values
  const formatPercent = (value) => {
    return `${Math.round(value)}%`;
  };
  
  // Get color class based on value comparison
  const getColorClass = (value, optimal, warning) => {
    if (value >= optimal) return 'text-success';
    if (value >= warning) return 'text-warning';
    return 'text-danger';
  };
  
  // Get color class for profit margin
  const getProfitMarginClass = (margin) => {
    if (margin >= formConfig.TARGET_PROFIT_MARGIN) return 'text-success';
    if (margin >= formConfig.TARGET_PROFIT_MARGIN / 2) return 'text-warning';
    return 'text-danger';
  };
  
  return (
    <div className="container-fluid loom-controls-container">
      <h1 className="page-title">Loom Control Center</h1>
      <p className="page-description">
        Advanced configuration and control interface for the perpetual calendar system
      </p>
      
      {/* Notification Alert */}
      {notification.show && (
        <div 
          className={`alert ${notification.type === 'success' ? 'alert-success' : 'alert-danger'} notification-alert`}
        >
          <span className="me-2">{notification.type === 'success' ? '✅' : '❌'}</span>
          {notification.message}
          <button 
            type="button" 
            className="close-button" 
            onClick={() => setNotification({...notification, show: false})}
          >
            &times;
          </button>
        </div>
      )}
      
      {/* Tab Navigation */}
      <div className="loom-tabs mb-4">
        <div className="tab-buttons">
          <button 
            className={`tab-button ${activeTab === 'configuration' ? 'active' : ''}`}
            onClick={() => setActiveTab('configuration')}
          >
            Configuration
          </button>
          <button 
            className={`tab-button ${activeTab === 'control' ? 'active' : ''}`}
            onClick={() => setActiveTab('control')}
          >
            Real-time Control
          </button>
          <button 
            className={`tab-button ${activeTab === 'testing' ? 'active' : ''}`}
            onClick={() => setActiveTab('testing')}
          >
            Testing & Debug
          </button>
          <button 
            className={`tab-button ${activeTab === 'system-log' ? 'active' : ''}`}
            onClick={() => setActiveTab('system-log')}
          >
            System Log
          </button>
        </div>
        
        {/* Configuration Tab */}
        {activeTab === 'configuration' && (
          <div className="card mb-4">
            <div className="card-header">
              <h2>Loom Logic Configuration</h2>
              <p className="text-muted">Adjust parameters that control how the loom system allocates resources</p>
            </div>
            <div className="card-body">
              <div className="row">
                {/* Staff Allocation Settings */}
                <div className="col-md-6 mb-4">
                  <h3>Staff Allocation</h3>
                  
                  <div className="form-group mb-3">
                    <label>
                      Participants Per Lead Staff
                      <span className="ms-2 text-info tooltip-icon" title="Add lead staff when exceeding this number of participants">ⓘ</span>
                    </label>
                    <div className="d-flex align-items-center">
                      <input
                        type="range"
                        className="form-range"
                        min={3}
                        max={10}
                        step={1}
                        value={formConfig.PARTICIPANTS_PER_LEAD}
                        onChange={(e) => handleConfigChange('PARTICIPANTS_PER_LEAD', parseInt(e.target.value))}
                      />
                      <span className="ms-2 config-value">{formConfig.PARTICIPANTS_PER_LEAD}</span>
                    </div>
                  </div>
                  
                  <div className="form-group mb-3">
                    <label>
                      Participants Per Support Staff
                      <span className="ms-2 text-info tooltip-icon" title="Add support staff for every N participants">ⓘ</span>
                    </label>
                    <div className="d-flex align-items-center">
                      <input
                        type="range"
                        className="form-range"
                        min={3}
                        max={10}
                        step={1}
                        value={formConfig.PARTICIPANTS_PER_SUPPORT}
                        onChange={(e) => handleConfigChange('PARTICIPANTS_PER_SUPPORT', parseInt(e.target.value))}
                      />
                      <span className="ms-2 config-value">{formConfig.PARTICIPANTS_PER_SUPPORT}</span>
                    </div>
                  </div>
                  
                  <div className="form-group mb-3">
                    <label>
                      High Support Threshold
                      <span className="ms-2 text-info tooltip-icon" title="Participants above this supervision multiplier need dedicated staff">ⓘ</span>
                    </label>
                    <div className="d-flex align-items-center">
                      <input
                        type="range"
                        className="form-range"
                        min={1.5}
                        max={4.0}
                        step={0.5}
                        value={formConfig.HIGH_SUPPORT_THRESHOLD}
                        onChange={(e) => handleConfigChange('HIGH_SUPPORT_THRESHOLD', parseFloat(e.target.value))}
                      />
                      <span className="ms-2 config-value">{formConfig.HIGH_SUPPORT_THRESHOLD}x</span>
                    </div>
                  </div>
                  
                  <div className="form-group mb-3">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="prefer-casual-staff"
                        checked={formConfig.PREFER_CASUAL_STAFF}
                        onChange={(e) => handleConfigChange('PREFER_CASUAL_STAFF', e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="prefer-casual-staff">
                        Prefer casual staff for short programs
                      </label>
                    </div>
                  </div>
                </div>
                
                {/* Transport Settings */}
                <div className="col-md-6 mb-4">
                  <h3>Transport & Timing</h3>
                  
                  <div className="form-group mb-3">
                    <label>
                      Optimal Bus Run Duration (minutes)
                      <span className="ms-2 text-info tooltip-icon" title="Target minutes for a bus run">ⓘ</span>
                    </label>
                    <div className="d-flex align-items-center">
                      <input
                        type="range"
                        className="form-range"
                        min={15}
                        max={120}
                        step={5}
                        value={formConfig.OPTIMAL_BUS_RUN_DURATION}
                        onChange={(e) => handleConfigChange('OPTIMAL_BUS_RUN_DURATION', parseInt(e.target.value))}
                      />
                      <span className="ms-2 config-value">{formConfig.OPTIMAL_BUS_RUN_DURATION} min</span>
                    </div>
                  </div>
                  
                  <div className="form-group mb-3">
                    <label>
                      Vehicle Capacity Buffer
                      <span className="ms-2 text-info tooltip-icon" title="Don't fill vehicles beyond this percentage of capacity">ⓘ</span>
                    </label>
                    <div className="d-flex align-items-center">
                      <input
                        type="range"
                        className="form-range"
                        min={0.5}
                        max={1.0}
                        step={0.05}
                        value={formConfig.VEHICLE_CAPACITY_BUFFER}
                        onChange={(e) => handleConfigChange('VEHICLE_CAPACITY_BUFFER', parseFloat(e.target.value))}
                      />
                      <span className="ms-2 config-value">{Math.round(formConfig.VEHICLE_CAPACITY_BUFFER * 100)}%</span>
                    </div>
                  </div>
                  
                  <div className="form-group mb-3">
                    <label>
                      Minimum Pickup Duration (minutes)
                      <span className="ms-2 text-info tooltip-icon" title="Minimum minutes allocated for pickup runs">ⓘ</span>
                    </label>
                    <div className="d-flex align-items-center">
                      <input
                        type="range"
                        className="form-range"
                        min={15}
                        max={60}
                        step={5}
                        value={formConfig.MIN_PICKUP_DURATION}
                        onChange={(e) => handleConfigChange('MIN_PICKUP_DURATION', parseInt(e.target.value))}
                      />
                      <span className="ms-2 config-value">{formConfig.MIN_PICKUP_DURATION} min</span>
                    </div>
                  </div>
                </div>
                
                {/* Financial Settings */}
                <div className="col-md-6 mb-4">
                  <h3>Financial Parameters</h3>
                  
                  <div className="form-group mb-3">
                    <label>
                      Admin Cost Percentage
                      <span className="ms-2 text-info tooltip-icon" title="Percentage of revenue allocated to admin costs">ⓘ</span>
                    </label>
                    <div className="d-flex align-items-center">
                      <input
                        type="range"
                        className="form-range"
                        min={0.05}
                        max={0.30}
                        step={0.01}
                        value={formConfig.ADMIN_COST_PERCENTAGE}
                        onChange={(e) => handleConfigChange('ADMIN_COST_PERCENTAGE', parseFloat(e.target.value))}
                      />
                      <span className="ms-2 config-value">{Math.round(formConfig.ADMIN_COST_PERCENTAGE * 100)}%</span>
                    </div>
                  </div>
                  
                  <div className="form-group mb-3">
                    <label>
                      Target Profit Margin
                      <span className="ms-2 text-info tooltip-icon" title="Target profit margin percentage">ⓘ</span>
                    </label>
                    <div className="d-flex align-items-center">
                      <input
                        type="range"
                        className="form-range"
                        min={0.05}
                        max={0.30}
                        step={0.01}
                        value={formConfig.TARGET_PROFIT_MARGIN}
                        onChange={(e) => handleConfigChange('TARGET_PROFIT_MARGIN', parseFloat(e.target.value))}
                      />
                      <span className="ms-2 config-value">{Math.round(formConfig.TARGET_PROFIT_MARGIN * 100)}%</span>
                    </div>
                  </div>
                </div>
                
                {/* Live Preview */}
                <div className="col-md-6 mb-4">
                  <h3>Live Preview</h3>
                  <div className="card preview-card">
                    <div className="card-body">
                      <h4>Staff Calculation Preview</h4>
                      <div className="form-group mb-3">
                        <label>Participant Count</label>
                        <input 
                          type="number" 
                          className="form-control"
                          min="1" 
                          max="30"
                          value={previewData.participants}
                          onChange={(e) => handlePreviewParticipantChange(e.target.value)}
                        />
                      </div>
                      
                      <div className="preview-metrics">
                        <div className="preview-metric">
                          <div className="metric-label">Supervision Load:</div>
                          <div className="metric-value">{previewData.supervisionLoad.toFixed(1)}</div>
                        </div>
                        <div className="preview-metric">
                          <div className="metric-label">Staff Needed:</div>
                          <div className="metric-value">
                            <span className={getColorClass(previewData.staffNeeded, 2, 1)}>
                              {previewData.staffNeeded}
                            </span>
                          </div>
                        </div>
                        <div className="preview-metric">
                          <div className="metric-label">Lead Staff:</div>
                          <div className="metric-value">
                            {previewData.participants > formConfig.PARTICIPANTS_PER_LEAD ? '1' : '0'}
                          </div>
                        </div>
                        <div className="preview-metric">
                          <div className="metric-label">Support Staff:</div>
                          <div className="metric-value">
                            {previewData.participants > formConfig.PARTICIPANTS_PER_LEAD 
                              ? (previewData.staffNeeded - 1) 
                              : previewData.staffNeeded}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="config-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={resetConfiguration}
                  disabled={loading.saving}
                >
                  Reset to Defaults
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={saveConfiguration}
                  disabled={loading.saving}
                >
                  {loading.saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Saving...
                    </>
                  ) : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Real-time Control Tab */}
        {activeTab === 'control' && (
          <div className="row">
            <div className="col-lg-6 mb-4">
              <div className="card">
                <div className="card-header">
                  <h2>Daily Operations</h2>
                  <p className="text-muted">Manage and rebalance resources for specific dates</p>
                </div>
                <div className="card-body">
                  <div className="form-group mb-4">
                    <label>Select Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={selectedDate.toISOString().split('T')[0]}
                      onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    />
                  </div>
                  
                  <div className="d-flex gap-3 mb-4">
                    <button 
                      className="btn btn-primary flex-grow-1" 
                      onClick={rebalanceStaff}
                      disabled={loading.rebalancing}
                    >
                      {loading.rebalancing ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Rebalancing...
                        </>
                      ) : (
                        <>
                          🔄 Rebalance Staff
                        </>
                      )}
                    </button>
                    
                    <button 
                      className="btn btn-info flex-grow-1" 
                      onClick={() => fetchMetrics()}
                      disabled={loading.metrics}
                    >
                      {loading.metrics ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Loading...
                        </>
                      ) : (
                        <>
                          📊 View Metrics
                        </>
                      )}
                    </button>
                  </div>
                  
                  <h4>Emergency Handling</h4>
                  <form className="emergency-form">
                    <div className="form-group mb-3">
                      <label>Action Type</label>
                      <div>
                        <div className="form-check form-check-inline">
                          <input
                            className="form-check-input"
                            type="radio"
                            id="participant-cancellation"
                            name="emergencyType"
                            checked={emergencyForm.type === 'participant'}
                            onChange={() => handleEmergencyFormChange('type', 'participant')}
                          />
                          <label className="form-check-label" htmlFor="participant-cancellation">
                            Participant Cancellation
                          </label>
                        </div>
                        <div className="form-check form-check-inline">
                          <input
                            className="form-check-input"
                            type="radio"
                            id="staff-absence"
                            name="emergencyType"
                            checked={emergencyForm.type === 'staff'}
                            onChange={() => handleEmergencyFormChange('type', 'staff')}
                          />
                          <label className="form-check-label" htmlFor="staff-absence">
                            Staff Absence
                          </label>
                        </div>
                      </div>
                    </div>
                    
                    {emergencyForm.type === 'participant' ? (
                      <div className="form-group mb-3">
                        <label>Participant ID</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter participant ID"
                          value={emergencyForm.participantId}
                          onChange={(e) => handleEmergencyFormChange('participantId', e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="form-group mb-3">
                        <label>Staff ID</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter staff ID"
                          value={emergencyForm.staffId}
                          onChange={(e) => handleEmergencyFormChange('staffId', e.target.value)}
                        />
                      </div>
                    )}
                    
                    <div className="form-group mb-3">
                      <label>Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={emergencyForm.date.toISOString().split('T')[0]}
                        onChange={(e) => handleEmergencyFormChange('date', new Date(e.target.value))}
                      />
                    </div>
                    
                    <div className="form-group mb-3">
                      <label>Reason</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        placeholder="Enter reason"
                        value={emergencyForm.reason}
                        onChange={(e) => handleEmergencyFormChange('reason', e.target.value)}
                      ></textarea>
                    </div>
                    
                    <button 
                      type="button"
                      className="btn btn-warning" 
                      onClick={handleEmergencyAction}
                      disabled={loading.rebalancing}
                    >
                      {loading.rebalancing ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Processing...
                        </>
                      ) : (
                        <>
                          ⚠️ Process Emergency
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
            
            <div className="col-lg-6 mb-4">
              <div className="card metrics-card">
                <div className="card-header">
                  <h2>Daily Metrics</h2>
                  <p className="text-muted">
                    {metrics ? `Metrics for ${metrics.date}` : 'Select a date and click "View Metrics"'}
                  </p>
                </div>
                <div className="card-body">
                  {loading.metrics ? (
                    <div className="text-center p-5">
                      <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="mt-3">Loading metrics...</p>
                    </div>
                  ) : metrics ? (
                    <>
                      <div className="summary-metrics">
                        <div className="summary-metric">
                          <div className="metric-value">{metrics.summary.instance_count}</div>
                          <div className="metric-label">Programs</div>
                        </div>
                        <div className="summary-metric">
                          <div className="metric-value">{metrics.summary.total_participants}</div>
                          <div className="metric-label">Participants</div>
                        </div>
                        <div className="summary-metric">
                          <div className="metric-value">{metrics.summary.total_staff}</div>
                          <div className="metric-label">Staff</div>
                        </div>
                        <div className="summary-metric">
                          <div className="metric-value">{metrics.summary.total_vehicles}</div>
                          <div className="metric-label">Vehicles</div>
                        </div>
                      </div>
                      
                      <div className="financial-summary">
                        <h4>Financial Summary</h4>
                        <div className="financial-metrics">
                          <div className="financial-metric">
                            <div className="metric-label">Revenue</div>
                            <div className="metric-value text-primary">
                              {formatCurrency(metrics.summary.financials.revenue)}
                            </div>
                          </div>
                          <div className="financial-metric">
                            <div className="metric-label">Staff Costs</div>
                            <div className="metric-value text-danger">
                              {formatCurrency(metrics.summary.financials.staff_costs)}
                            </div>
                          </div>
                          <div className="financial-metric">
                            <div className="metric-label">Admin Costs</div>
                            <div className="metric-value text-warning">
                              {formatCurrency(metrics.summary.financials.admin_costs)}
                            </div>
                          </div>
                          <div className="financial-metric">
                            <div className="metric-label">Profit/Loss</div>
                            <div className={`metric-value ${getProfitMarginClass(metrics.summary.financials.profit_margin)}`}>
                              {formatCurrency(metrics.summary.financials.profit_loss)}
                              <span className="ms-2">
                                ({formatPercent(metrics.summary.financials.profit_margin)})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <h4 className="mt-4">Programs</h4>
                      <div className="table-responsive">
                        <table className="table table-striped table-hover table-sm">
                          <thead>
                            <tr>
                              <th>Program</th>
                              <th>Time</th>
                              <th>Participants</th>
                              <th>Staff</th>
                              <th>Profit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {metrics.instances.map((instance, index) => (
                              <tr key={index}>
                                <td>{instance.program_name}</td>
                                <td>{instance.start_time.substring(0, 5)} - {instance.end_time.substring(0, 5)}</td>
                                <td>{instance.participant_count}</td>
                                <td>{instance.staff_count}</td>
                                <td className={getProfitMarginClass(instance.financials?.profit_margin || 0)}>
                                  {formatCurrency(instance.financials?.profit_loss || 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <h4 className="mt-4">Staff Utilization</h4>
                      <div className="table-responsive">
                        <table className="table table-striped table-hover table-sm">
                          <thead>
                            <tr>
                              <th>Staff</th>
                              <th>SCHADS</th>
                              <th>Shifts</th>
                              <th>Hours</th>
                            </tr>
                          </thead>
                          <tbody>
                            {metrics.staff_utilization
                              .filter(staff => staff.shift_count > 0)
                              .map((staff, index) => (
                                <tr key={index}>
                                  <td>{staff.name}</td>
                                  <td>{staff.schads_level}</td>
                                  <td>{staff.shift_count}</td>
                                  <td>{staff.total_hours ? staff.total_hours.toFixed(1) : '0'}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-5 text-muted">
                      <div className="mb-3">📊</div>
                      <p>No metrics data available. Select a date and click "View Metrics".</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Testing Tab */}
        {activeTab === 'testing' && (
          <div className="card mb-4">
            <div className="card-header">
              <h2>Loom Testing Tools</h2>
              <p className="text-muted">Test and debug the loom logic engine with real instances</p>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6 mb-4">
                  <div className="form-group mb-3">
                    <label>Select Instance</label>
                    <select
                      className="form-select"
                      value={selectedInstance}
                      onChange={(e) => setSelectedInstance(e.target.value)}
                    >
                      <option value="">-- Select an instance --</option>
                      {instances.map((instance) => (
                        <option key={instance.id} value={instance.id}>
                          {instance.date} - {instance.program_name} ({instance.start_time.substring(0, 5)})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="d-flex flex-wrap gap-2 mb-4">
                    <button 
                      className="btn btn-outline-primary" 
                      onClick={() => runTest('staff')}
                      disabled={loading.testing || !selectedInstance}
                    >
                      👥 Test Staff Calculation
                    </button>
                    
                    <button 
                      className="btn btn-outline-primary" 
                      onClick={() => runTest('vehicles')}
                      disabled={loading.testing || !selectedInstance}
                    >
                      🚌 Test Vehicle Assignment
                    </button>
                    
                    <button 
                      className="btn btn-outline-primary" 
                      onClick={() => runTest('cards')}
                      disabled={loading.testing || !selectedInstance}
                    >
                      📊 Test Card Generation
                    </button>
                    
                    <button 
                      className="btn btn-primary" 
                      onClick={processInstance}
                      disabled={loading.testing || !selectedInstance}
                    >
                      🔄 Process Instance
                    </button>
                  </div>
                </div>
                
                <div className="col-md-6 mb-4">
                  <div className="test-status">
                    {loading.testing ? (
                      <div className="text-center p-4">
                        <div className="spinner-border" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="mt-3">Running test...</p>
                      </div>
                    ) : testResults ? (
                      <div className="test-success">
                        <div className="d-flex align-items-center mb-3">
                          <span className="text-success me-2">✅</span>
                          <h4 className="mb-0">Test Completed: {testResults.type}</h4>
                        </div>
                        
                        {testResults.type === 'staff' && (
                          <>
                            <div className="result-summary mb-3">
                              <span className="badge bg-info me-2">
                                {testResults.data.participants.count} Participants
                              </span>
                              <span className="badge bg-success me-2">
                                {testResults.data.requirements.totalStaffNeeded} Staff Needed
                              </span>
                              <span className="badge bg-warning me-2">
                                {testResults.data.requirements.totalSupervisionLoad.toFixed(1)} Supervision Load
                              </span>
                            </div>
                            
                            <h5>Staff Requirements</h5>
                            <ul className="mb-4">
                              <li>Lead Staff: {testResults.data.requirements.needsLead ? 'Yes' : 'No'}</li>
                              <li>Support Staff: {testResults.data.requirements.supportStaffCount}</li>
                              <li>High Support Participants: {testResults.data.requirements.highSupportParticipants}</li>
                            </ul>
                            
                            <h5>Assigned Staff</h5>
                            <div className="table-responsive">
                              <table className="table table-striped table-hover table-sm">
                                <thead>
                                  <tr>
                                    <th>Name</th>
                                    <th>Role</th>
                                    <th>SCHADS</th>
                                    <th>Rate</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {testResults.data.assigned_staff.map((staff, index) => (
                                    <tr key={index}>
                                      <td>{staff.first_name} {staff.last_name}</td>
                                      <td>{staff.role}</td>
                                      <td>{staff.schads_level}</td>
                                      <td>{formatCurrency(staff.hourly_rate)}/hr</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                        
                        {testResults.type === 'vehicles' && (
                          <>
                            <div className="result-summary mb-3">
                              <span className="badge bg-info me-2">
                                {testResults.data.participants.pickup_required} Pickups
                              </span>
                              <span className="badge bg-info me-2">
                                {testResults.data.participants.dropoff_required} Dropoffs
                              </span>
                              <span className="badge bg-warning me-2">
                                {testResults.data.assigned_vehicles.length} Vehicles
                              </span>
                            </div>
                            
                            <h5>Assigned Vehicles</h5>
                            <div className="table-responsive">
                              <table className="table table-striped table-hover table-sm">
                                <thead>
                                  <tr>
                                    <th>Vehicle</th>
                                    <th>Registration</th>
                                    <th>Pickups</th>
                                    <th>Dropoffs</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {testResults.data.assigned_vehicles.map((vehicle, index) => (
                                    <tr key={index}>
                                      <td>{vehicle.name}</td>
                                      <td>{vehicle.registration}</td>
                                      <td>{vehicle.assigned_pickups}</td>
                                      <td>{vehicle.assigned_dropoffs}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            
                            <h5>Transport Cards</h5>
                            <div className="transport-cards">
                              <div className="pickup-cards">
                                <h6>Pickup Cards: {testResults.data.transport_cards.pickupCards.length}</h6>
                                {testResults.data.transport_cards.pickupCards.map((card, index) => (
                                  <div key={index} className="mini-card pickup-card">
                                    <div className="mini-card-title">{card.title}</div>
                                    <div className="mini-card-time">{card.start_time.substring(0, 5)} - {card.end_time.substring(0, 5)}</div>
                                    <div className="mini-card-details">
                                      {card.participant_count} participants | {card.vehicle_name}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              
                              <div className="dropoff-cards">
                                <h6>Dropoff Cards: {testResults.data.transport_cards.dropoffCards.length}</h6>
                                {testResults.data.transport_cards.dropoffCards.map((card, index) => (
                                  <div key={index} className="mini-card dropoff-card">
                                    <div className="mini-card-title">{card.title}</div>
                                    <div className="mini-card-time">{card.start_time.substring(0, 5)} - {card.end_time.substring(0, 5)}</div>
                                    <div className="mini-card-details">
                                      {card.participant_count} participants | {card.vehicle_name}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                        
                        {testResults.type === 'cards' && (
                          <>
                            <div className="result-summary mb-3">
                              <span className="badge bg-primary me-2">
                                {testResults.data.cards.total} Total Cards
                              </span>
                              <span className="badge bg-info me-2">
                                {testResults.data.cards.pickup} Pickup
                              </span>
                              <span className="badge bg-success me-2">
                                {testResults.data.cards.activity} Activity
                              </span>
                              <span className="badge bg-info me-2">
                                {testResults.data.cards.dropoff} Dropoff
                              </span>
                              <span className="badge bg-secondary me-2">
                                {testResults.data.cards.roster} Roster
                              </span>
                            </div>
                            
                            <h5>Financial Metrics</h5>
                            <div className="financial-metrics">
                              <div className="financial-metric">
                                <div className="metric-label">Revenue</div>
                                <div className="metric-value text-primary">
                                  {formatCurrency(testResults.data.financials.revenue)}
                                </div>
                              </div>
                              <div className="financial-metric">
                                <div className="metric-label">Staff Costs</div>
                                <div className="metric-value text-danger">
                                  {formatCurrency(testResults.data.financials.staff_costs)}
                                </div>
                              </div>
                              <div className="financial-metric">
                                <div className="metric-label">Admin Costs</div>
                                <div className="metric-value text-warning">
                                  {formatCurrency(testResults.data.financials.admin_costs)}
                                </div>
                              </div>
                              <div className="financial-metric">
                                <div className="metric-label">Profit/Loss</div>
                                <div className={`metric-value ${getProfitMarginClass(testResults.data.financials.profit_margin)}`}>
                                  {formatCurrency(testResults.data.financials.profit_loss)}
                                  <span className="ms-2">
                                    ({formatPercent(testResults.data.financials.profit_margin * 100)})
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <h5 className="mt-4">Generated Cards</h5>
                            <div className="card-timeline">
                              {testResults.data.all_cards.map((card, index) => (
                                <div key={index} className={`timeline-card ${card.type.toLowerCase()}-card`}>
                                  <div className="card-type-badge">{card.type}</div>
                                  <div className="card-title">{card.title}</div>
                                  <div className="card-time">{card.start_time.substring(0, 5)} - {card.end_time.substring(0, 5)}</div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        
                        {testResults.type === 'process' && (
                          <>
                            <div className="result-summary mb-3">
                              <span className="badge bg-success me-2">
                                Instance Processed Successfully
                              </span>
                              <span className="badge bg-info me-2">
                                {testResults.data.participants} Participants
                              </span>
                              <span className="badge bg-secondary me-2">
                                {testResults.data.staff} Staff
                              </span>
                              <span className="badge bg-warning me-2">
                                {testResults.data.vehicles} Vehicles
                              </span>
                              <span className="badge bg-primary me-2">
                                {testResults.data.cards} Cards
                              </span>
                            </div>
                            
                            <h5>Financial Summary</h5>
                            <div className="financial-metrics">
                              <div className="financial-metric">
                                <div className="metric-label">Revenue</div>
                                <div className="metric-value text-primary">
                                  {formatCurrency(testResults.data.financials.revenue)}
                                </div>
                              </div>
                              <div className="financial-metric">
                                <div className="metric-label">Staff Costs</div>
                                <div className="metric-value text-danger">
                                  {formatCurrency(testResults.data.financials.staff_costs)}
                                </div>
                              </div>
                              <div className="financial-metric">
                                <div className="metric-label">Admin Costs</div>
                                <div className="metric-value text-warning">
                                  {formatCurrency(testResults.data.financials.admin_costs)}
                                </div>
                              </div>
                              <div className="financial-metric">
                                <div className="metric-label">Profit/Loss</div>
                                <div className={`metric-value ${getProfitMarginClass(testResults.data.financials.profit_margin)}`}>
                                  {formatCurrency(testResults.data.financials.profit_loss)}
                                  <span className="ms-2">
                                    ({formatPercent(testResults.data.financials.profit_margin * 100)})
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="alert alert-success mt-4">
                              <span className="me-2">✅</span>
                              Instance has been processed and all cards have been generated. The changes are now live in the system.
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="text-center p-5 text-muted">
                        <div className="mb-3">👥</div>
                        <p>Select an instance and run a test to see results here.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* System Log Tab */}
        {activeTab === 'system-log' && (
          <div className="card mb-4">
            <div className="card-header">
              <h2>System Log</h2>
              <p className="text-muted">Real-time monitoring of loom system events and issues</p>
            </div>
            <div className="card-body">
              <div className="row mb-4">
                <div className="col-md-12">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center">
                      <h3 className="mb-0 me-3">Log Entries</h3>
                      {wsConnected ? (
                        <span className="badge bg-success d-flex align-items-center">
                          📶 Connected
                        </span>
                      ) : (
                        <span className="badge bg-danger d-flex align-items-center">
                          📵 Disconnected
                        </span>
                      )}
                    </div>
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-outline-secondary btn-sm"
                        onClick={clearLogs}
                      >
                        🗑️ Clear Logs
                      </button>
                      <button 
                        className="btn btn-outline-primary btn-sm"
                        onClick={fetchInitialLogs}
                        disabled={loading.logs}
                      >
                        🔄 Refresh
                      </button>
                    </div>
                  </div>
                  
                  <div className="log-filters mb-3">
                    <div className="row">
                      <div className="col-md-4">
                        <div className="form-group">
                          <label>
                            🔍 Severity
                          </label>
                          <select
                            className="form-select form-select-sm"
                            value={logFilters.severity}
                            onChange={(e) => handleFilterChange('severity', e.target.value)}
                          >
                            <option value="ALL">All Severities</option>
                            <option value="INFO">Info</option>
                            <option value="WARN">Warning</option>
                            <option value="ERROR">Error</option>
                            <option value="CRITICAL">Critical</option>
                          </select>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="form-group">
                          <label>
                            🔍 Category
                          </label>
                          <select
                            className="form-select form-select-sm"
                            value={logFilters.category}
                            onChange={(e) => handleFilterChange('category', e.target.value)}
                          >
                            <option value="ALL">All Categories</option>
                            <option value="RESOURCE">Resource</option>
                            <option value="OPTIMIZATION">Optimization</option>
                            <option value="CONSTRAINT">Constraint</option>
                            <option value="SYSTEM">System</option>
                            <option value="OPERATIONAL">Operational</option>
                            <option value="FINANCIAL">Financial</option>
                          </select>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="form-group mt-4 pt-2">
                          <div className="form-check form-switch">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="resolution-required"
                              checked={logFilters.resolutionRequired}
                              onChange={(e) => handleFilterChange('resolutionRequired', e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor="resolution-required">
                              Resolution Required Only
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="system-log-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    {loading.logs ? (
                      <div className="text-center p-5">
                        <div className="spinner-border" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="mt-3">Loading logs...</p>
                      </div>
                    ) : getFilteredLogs().length > 0 ? (
                      <div className="log-entries">
                        {getFilteredLogs().map((log, index) => (
                          <div 
                            key={index} 
                            className={`log-entry mb-2 p-2 ${log.resolution_required ? 'border-start border-3 border-danger' : ''}`}
                            style={{ backgroundColor: '#f8f9fa', borderRadius: '0.375rem' }}
                          >
                            <div 
                              className="d-flex justify-content-between align-items-start"
                              onClick={() => toggleLogExpansion(index)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="d-flex align-items-center">
                                <div className="log-timestamp me-2 text-muted">
                                  <small>{formatDate(log.timestamp)} {formatTimestamp(log.timestamp)}</small>
                                </div>
                                <span 
                                  className={`badge bg-${getSeverityColor(log.severity)} me-2`}
                                  style={{ minWidth: '70px', textAlign: 'center' }}
                                >
                                  {log.severity === 'INFO' && 'ℹ️ '}
                                  {log.severity === 'WARN' && '⚠️ '}
                                  {log.severity === 'ERROR' && '❌ '}
                                  {log.severity === 'CRITICAL' && '🔔 '}
                                  {log.severity}
                                </span>
                                <span 
                                  className={`badge bg-${getCategoryColor(log.category)} me-3`}
                                >
                                  {log.category}
                                </span>
                                <div className="log-message">{log.message}</div>
                              </div>
                              <span className="ms-2">
                                {expandedLogs[index] ? '🔼' : '🔽'}
                              </span>
                            </div>
                            
                            {expandedLogs[index] && (
                              <div className="log-details mt-2 ps-3">
                                {log.details && Object.keys(log.details).length > 0 && (
                                  <div className="mb-2">
                                    <strong>Details:</strong>
                                    <pre className="mt-1 p-2 bg-light" style={{ fontSize: '0.85rem', borderRadius: '0.25rem' }}>
                                      {JSON.stringify(log.details, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                
                                {log.affected_entities && log.affected_entities.length > 0 && (
                                  <div className="mb-2">
                                    <strong>Affected:</strong>
                                    <ul className="mt-1 mb-0">
                                      {log.affected_entities.map((entity, i) => (
                                        <li key={i}>
                                          {entity.type}: {entity.name || entity.id}
                                          {entity.supervision_multiplier && ` (Supervision: ${entity.supervision_multiplier}x)`}
                                          {entity.unassigned_shifts && ` (Unassigned shifts: ${entity.unassigned_shifts})`}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {log.resolution_required && log.resolution_suggestions && log.resolution_suggestions.length > 0 && (
                                  <div>
                                    <strong className="text-danger">Resolution Required:</strong>
                                    <ul className="mt-1 mb-0">
                                      {log.resolution_suggestions.map((suggestion, i) => (
                                        <li key={i}>{suggestion}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        <div ref={logEndRef} />
                      </div>
                    ) : (
                      <div className="text-center p-5 text-muted">
                        <div className="mb-3">ℹ️</div>
                        <p>No log entries match your current filters.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoomControls;
