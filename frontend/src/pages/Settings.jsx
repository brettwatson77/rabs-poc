import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { format } from 'date-fns';
import { 
  FiSettings, 
  FiCalendar, 
  FiServer, 
  FiLock, 
  FiDatabase,
  FiInfo,
  FiSave,
  FiRefreshCw,
  FiDownload,
  FiUpload,
  FiAlertCircle,
  FiCheckCircle,
  FiXCircle,
  FiEdit2,
  FiTrash2,
  FiPlusCircle,
  FiCpu,
  FiHardDrive,
  FiUsers,
  FiGlobe,
  FiClock,
  FiToggleLeft,
  FiToggleRight,
  FiSliders,
  FiGrid
} from 'react-icons/fi';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// Settings component
const Settings = () => {
  const queryClient = useQueryClient();
  const [currentDate] = useState(new Date());
  const [activeSection, setActiveSection] = useState('general');
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState(null);
  const [newSettingValue, setNewSettingValue] = useState('');
  const [backupOptions, setBackupOptions] = useState({
    format: 'sql',
    includeData: true,
    includeSchema: true
  });
  const [restoreFile, setRestoreFile] = useState(null);
  const [loomWindowSettings, setLoomWindowSettings] = useState({
    days_before: 7,
    days_after: 30,
    auto_generate: true,
    rollover_time: '00:00'
  });
  const [generalSettings, setGeneralSettings] = useState({
    organization_name: 'RABS Organization',
    timezone: 'Australia/Sydney',
    date_format: 'dd/MM/yyyy',
    time_format: '12h',
    default_view: 'dashboard'
  });
  const [securitySettings, setSecuritySettings] = useState({
    session_timeout: 30,
    password_expiry_days: 90,
    require_2fa: false,
    failed_login_attempts: 5
  });

  // Fetch all settings
  const { 
    data: settingsData, 
    isLoading: settingsLoading, 
    error: settingsError,
    refetch: refetchSettings
  } = useQuery(
    ['systemSettings'],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/settings`);
      return response.data;
    },
    {
      onSuccess: (data) => {
        // Update state with fetched settings
        if (data && data.data) {
          // Process loom window settings
          const loomSettings = data.data.find(s => s.key === 'loom_window');
          if (loomSettings && loomSettings.value) {
            setLoomWindowSettings(loomSettings.value);
          }
          
          // Process general settings
          data.data.forEach(setting => {
            if (setting.category === 'general') {
              setGeneralSettings(prev => ({
                ...prev,
                [setting.key]: setting.value
              }));
            } else if (setting.category === 'security') {
              setSecuritySettings(prev => ({
                ...prev,
                [setting.key]: setting.value
              }));
            }
          });
        }
      }
    }
  );

  // Fetch system info
  const { 
    data: systemInfoData, 
    isLoading: systemInfoLoading, 
    error: systemInfoError,
    refetch: refetchSystemInfo
  } = useQuery(
    ['systemInfo'],
    async () => {
      const response = await axios.get(`${API_URL}/api/v1/system/info`);
      return response.data;
    }
  );

  // Update setting mutation
  const updateSettingMutation = useMutation(
    async ({ key, value, description, category }) => {
      const response = await axios.put(`${API_URL}/api/v1/settings/${key}`, {
        value,
        description,
        category
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['systemSettings']);
        setIsEditModalOpen(false);
      }
    }
  );

  // Bulk update settings mutation
  const bulkUpdateSettingsMutation = useMutation(
    async (settings) => {
      const response = await axios.post(`${API_URL}/api/v1/settings/bulk`, {
        settings
      });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['systemSettings']);
      }
    }
  );

  // Create backup mutation
  const createBackupMutation = useMutation(
    async (options) => {
      const response = await axios.post(`${API_URL}/api/v1/system/backup`, options);
      return response.data;
    },
    {
      onSuccess: (data) => {
        // In a real app, this would trigger a file download
        console.log('Backup created:', data);
        setIsBackupModalOpen(false);
      }
    }
  );

  // Restore database mutation
  const restoreDatabaseMutation = useMutation(
    async (formData) => {
      const response = await axios.post(`${API_URL}/api/v1/system/restore`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    },
    {
      onSuccess: () => {
        setIsRestoreModalOpen(false);
        refetchSettings();
        refetchSystemInfo();
      }
    }
  );

  // Handle setting edit
  const handleSettingEdit = (setting) => {
    setSelectedSetting(setting);
    setNewSettingValue(setting.value);
    setIsEditModalOpen(true);
  };

  // Handle setting update
  const handleSettingUpdate = () => {
    if (!selectedSetting) return;
    
    updateSettingMutation.mutate({
      key: selectedSetting.key,
      value: newSettingValue,
      description: selectedSetting.description,
      category: selectedSetting.category
    });
  };

  // Handle loom window settings update
  const handleLoomWindowUpdate = () => {
    bulkUpdateSettingsMutation.mutate([
      {
        key: 'loom_window',
        value: loomWindowSettings,
        description: 'Loom window configuration',
        category: 'loom'
      }
    ]);
  };

  // Handle general settings update
  const handleGeneralSettingsUpdate = () => {
    const settings = Object.entries(generalSettings).map(([key, value]) => ({
      key,
      value,
      description: `General setting: ${key}`,
      category: 'general'
    }));
    
    bulkUpdateSettingsMutation.mutate(settings);
  };

  // Handle security settings update
  const handleSecuritySettingsUpdate = () => {
    const settings = Object.entries(securitySettings).map(([key, value]) => ({
      key,
      value,
      description: `Security setting: ${key}`,
      category: 'security'
    }));
    
    bulkUpdateSettingsMutation.mutate(settings);
  };

  // Handle backup creation
  const handleBackupCreate = () => {
    createBackupMutation.mutate(backupOptions);
  };

  // Handle database restore
  const handleDatabaseRestore = (e) => {
    e.preventDefault();
    
    if (!restoreFile) return;
    
    const formData = new FormData();
    formData.append('backup_file', restoreFile);
    
    restoreDatabaseMutation.mutate(formData);
  };

  // Handle file selection for restore
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setRestoreFile(e.target.files[0]);
    }
  };

  // Format bytes to human-readable format
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Render general settings section
  const renderGeneralSettings = () => (
    <div className="settings-section">
      <h3 className="section-title">General Settings</h3>
      <div className="settings-form glass-card">
        <div className="form-group">
          <label htmlFor="organization-name">Organization Name</label>
          <input
            id="organization-name"
            type="text"
            value={generalSettings.organization_name}
            onChange={(e) => setGeneralSettings({...generalSettings, organization_name: e.target.value})}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="timezone">Timezone</label>
          <select
            id="timezone"
            value={generalSettings.timezone}
            onChange={(e) => setGeneralSettings({...generalSettings, timezone: e.target.value})}
          >
            <option value="Australia/Sydney">Australia/Sydney</option>
            <option value="Australia/Melbourne">Australia/Melbourne</option>
            <option value="Australia/Brisbane">Australia/Brisbane</option>
            <option value="Australia/Adelaide">Australia/Adelaide</option>
            <option value="Australia/Perth">Australia/Perth</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="date-format">Date Format</label>
          <select
            id="date-format"
            value={generalSettings.date_format}
            onChange={(e) => setGeneralSettings({...generalSettings, date_format: e.target.value})}
          >
            <option value="dd/MM/yyyy">DD/MM/YYYY (31/12/2025)</option>
            <option value="MM/dd/yyyy">MM/DD/YYYY (12/31/2025)</option>
            <option value="yyyy-MM-dd">YYYY-MM-DD (2025-12-31)</option>
            <option value="d MMMM yyyy">D MMMM YYYY (31 December 2025)</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="time-format">Time Format</label>
          <select
            id="time-format"
            value={generalSettings.time_format}
            onChange={(e) => setGeneralSettings({...generalSettings, time_format: e.target.value})}
          >
            <option value="12h">12-hour (2:30 PM)</option>
            <option value="24h">24-hour (14:30)</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="default-view">Default View</label>
          <select
            id="default-view"
            value={generalSettings.default_view}
            onChange={(e) => setGeneralSettings({...generalSettings, default_view: e.target.value})}
          >
            <option value="dashboard">Dashboard</option>
            <option value="master-schedule">Master Schedule</option>
            <option value="roster">Roster</option>
            <option value="finance">Finance</option>
          </select>
        </div>
        
        <div className="form-actions">
          <button 
            className="btn btn-primary"
            onClick={handleGeneralSettingsUpdate}
            disabled={bulkUpdateSettingsMutation.isLoading}
          >
            {bulkUpdateSettingsMutation.isLoading ? (
              <>
                <div className="loading-spinner-small"></div>
                Saving...
              </>
            ) : (
              <>
                <FiSave /> Save General Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Render loom settings section
  const renderLoomSettings = () => (
    <div className="settings-section">
      <h3 className="section-title">Loom System Settings</h3>
      <div className="settings-form glass-card">
        <div className="loom-info">
          <p>
            The loom window controls how far back and forward the system looks when generating schedules.
            Adjusting these settings affects system performance and data visibility.
          </p>
        </div>
        
        <div className="form-group">
          <label htmlFor="days-before">Days Before (Past)</label>
          <input
            id="days-before"
            type="number"
            min="1"
            max="90"
            value={loomWindowSettings.days_before}
            onChange={(e) => setLoomWindowSettings({...loomWindowSettings, days_before: parseInt(e.target.value)})}
          />
          <div className="input-help">How many days in the past to include in the loom window</div>
        </div>
        
        <div className="form-group">
          <label htmlFor="days-after">Days After (Future)</label>
          <input
            id="days-after"
            type="number"
            min="1"
            max="365"
            value={loomWindowSettings.days_after}
            onChange={(e) => setLoomWindowSettings({...loomWindowSettings, days_after: parseInt(e.target.value)})}
          />
          <div className="input-help">How many days in the future to include in the loom window</div>
        </div>
        
        <div className="form-group">
          <label htmlFor="rollover-time">Daily Rollover Time</label>
          <input
            id="rollover-time"
            type="time"
            value={loomWindowSettings.rollover_time}
            onChange={(e) => setLoomWindowSettings({...loomWindowSettings, rollover_time: e.target.value})}
          />
          <div className="input-help">When the system should process the next day's schedule</div>
        </div>
        
        <div className="form-group checkbox-group">
          <div className="toggle-switch">
            <input
              id="auto-generate"
              type="checkbox"
              checked={loomWindowSettings.auto_generate}
              onChange={(e) => setLoomWindowSettings({...loomWindowSettings, auto_generate: e.target.checked})}
            />
            <label htmlFor="auto-generate">
              <div className="toggle-icon">
                {loomWindowSettings.auto_generate ? <FiToggleRight /> : <FiToggleLeft />}
              </div>
              <div className="toggle-text">
                Auto-generate instances from programs
              </div>
            </label>
          </div>
          <div className="input-help">Automatically create instances from program templates</div>
        </div>
        
        <div className="loom-visualization">
          <h4>Loom Window Visualization</h4>
          <div className="loom-timeline">
            <div className="timeline-past" style={{flex: loomWindowSettings.days_before}}>
              Past ({loomWindowSettings.days_before} days)
            </div>
            <div className="timeline-today">Today</div>
            <div className="timeline-future" style={{flex: loomWindowSettings.days_after}}>
              Future ({loomWindowSettings.days_after} days)
            </div>
          </div>
        </div>
        
        <div className="form-actions">
          <button 
            className="btn btn-primary"
            onClick={handleLoomWindowUpdate}
            disabled={bulkUpdateSettingsMutation.isLoading}
          >
            {bulkUpdateSettingsMutation.isLoading ? (
              <>
                <div className="loading-spinner-small"></div>
                Saving...
              </>
            ) : (
              <>
                <FiSave /> Save Loom Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Render security settings section
  const renderSecuritySettings = () => (
    <div className="settings-section">
      <h3 className="section-title">Security Settings</h3>
      <div className="settings-form glass-card">
        <div className="security-info">
          <p>
            Configure security settings to protect your data and control user access.
            These settings affect all users of the system.
          </p>
        </div>
        
        <div className="form-group">
          <label htmlFor="session-timeout">Session Timeout (minutes)</label>
          <input
            id="session-timeout"
            type="number"
            min="5"
            max="240"
            value={securitySettings.session_timeout}
            onChange={(e) => setSecuritySettings({...securitySettings, session_timeout: parseInt(e.target.value)})}
          />
          <div className="input-help">How long until inactive users are logged out</div>
        </div>
        
        <div className="form-group">
          <label htmlFor="password-expiry">Password Expiry (days)</label>
          <input
            id="password-expiry"
            type="number"
            min="0"
            max="365"
            value={securitySettings.password_expiry_days}
            onChange={(e) => setSecuritySettings({...securitySettings, password_expiry_days: parseInt(e.target.value)})}
          />
          <div className="input-help">How often users must change their password (0 = never)</div>
        </div>
        
        <div className="form-group">
          <label htmlFor="failed-login-attempts">Failed Login Attempts</label>
          <input
            id="failed-login-attempts"
            type="number"
            min="1"
            max="10"
            value={securitySettings.failed_login_attempts}
            onChange={(e) => setSecuritySettings({...securitySettings, failed_login_attempts: parseInt(e.target.value)})}
          />
          <div className="input-help">Number of failed attempts before account lockout</div>
        </div>
        
        <div className="form-group checkbox-group">
          <div className="toggle-switch">
            <input
              id="require-2fa"
              type="checkbox"
              checked={securitySettings.require_2fa}
              onChange={(e) => setSecuritySettings({...securitySettings, require_2fa: e.target.checked})}
            />
            <label htmlFor="require-2fa">
              <div className="toggle-icon">
                {securitySettings.require_2fa ? <FiToggleRight /> : <FiToggleLeft />}
              </div>
              <div className="toggle-text">
                Require Two-Factor Authentication
              </div>
            </label>
          </div>
          <div className="input-help">Enforce 2FA for all user accounts</div>
        </div>
        
        <div className="form-actions">
          <button 
            className="btn btn-primary"
            onClick={handleSecuritySettingsUpdate}
            disabled={bulkUpdateSettingsMutation.isLoading}
          >
            {bulkUpdateSettingsMutation.isLoading ? (
              <>
                <div className="loading-spinner-small"></div>
                Saving...
              </>
            ) : (
              <>
                <FiSave /> Save Security Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Render backup settings section
  const renderBackupSettings = () => (
    <div className="settings-section">
      <h3 className="section-title">Backup & Restore</h3>
      <div className="settings-form glass-card">
        <div className="backup-info">
          <p>
            Create backups of your database to prevent data loss. 
            Backups can be restored in case of emergencies.
          </p>
        </div>
        
        <div className="backup-actions">
          <button 
            className="btn btn-primary"
            onClick={() => setIsBackupModalOpen(true)}
          >
            <FiDownload /> Create Backup
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setIsRestoreModalOpen(true)}
          >
            <FiUpload /> Restore Backup
          </button>
        </div>
        
        <div className="backup-schedule">
          <h4>Scheduled Backups</h4>
          <div className="form-group checkbox-group">
            <div className="toggle-switch">
              <input
                id="auto-backup"
                type="checkbox"
                checked={true}
                onChange={() => {}}
              />
              <label htmlFor="auto-backup">
                <div className="toggle-icon">
                  <FiToggleRight />
                </div>
                <div className="toggle-text">
                  Enable Automatic Backups
                </div>
              </label>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="backup-frequency">Backup Frequency</label>
            <select
              id="backup-frequency"
              value="daily"
              onChange={() => {}}
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="backup-retention">Retention Period (days)</label>
            <input
              id="backup-retention"
              type="number"
              min="1"
              max="365"
              value="30"
              onChange={() => {}}
            />
          </div>
        </div>
        
        <div className="recent-backups">
          <h4>Recent Backups</h4>
          <table className="backup-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Size</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{format(new Date(), 'MMM d, yyyy h:mm a')}</td>
                <td>4.2 MB</td>
                <td>Full</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn btn-icon" title="Download">
                      <FiDownload />
                    </button>
                    <button className="btn btn-icon" title="Restore">
                      <FiUpload />
                    </button>
                    <button className="btn btn-icon" title="Delete">
                      <FiTrash2 />
                    </button>
                  </div>
                </td>
              </tr>
              <tr>
                <td>{format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'MMM d, yyyy h:mm a')}</td>
                <td>4.1 MB</td>
                <td>Full</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn btn-icon" title="Download">
                      <FiDownload />
                    </button>
                    <button className="btn btn-icon" title="Restore">
                      <FiUpload />
                    </button>
                    <button className="btn btn-icon" title="Delete">
                      <FiTrash2 />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Render system info section
  const renderSystemInfo = () => (
    <div className="settings-section">
      <h3 className="section-title">System Information</h3>
      <div className="settings-form glass-card">
        {systemInfoLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading system information...</p>
          </div>
        ) : systemInfoError ? (
          <div className="error-container">
            <FiAlertCircle className="error-icon" />
            <p>Error loading system information: {systemInfoError.message}</p>
            <button className="btn btn-primary" onClick={() => refetchSystemInfo()}>
              Try Again
            </button>
          </div>
        ) : (
          <>
            <div className="system-info-grid">
              <div className="info-section">
                <h4><FiInfo /> Application</h4>
                <div className="info-item">
                  <div className="info-label">Name:</div>
                  <div className="info-value">{systemInfoData?.data?.app?.name || 'RABS'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Version:</div>
                  <div className="info-value">{systemInfoData?.data?.app?.version || '3.0.0'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">API Version:</div>
                  <div className="info-value">{systemInfoData?.data?.app?.api_version || 'v1'}</div>
                </div>
              </div>
              
              <div className="info-section">
                <h4><FiServer /> Server</h4>
                <div className="info-item">
                  <div className="info-label">Platform:</div>
                  <div className="info-value">{systemInfoData?.data?.system?.platform || 'Unknown'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Node Version:</div>
                  <div className="info-value">{systemInfoData?.data?.node?.version || 'Unknown'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Uptime:</div>
                  <div className="info-value">
                    {systemInfoData?.data?.system?.uptime 
                      ? `${Math.floor(systemInfoData.data.system.uptime / 86400)} days, ${Math.floor((systemInfoData.data.system.uptime % 86400) / 3600)} hours` 
                      : 'Unknown'}
                  </div>
                </div>
              </div>
              
              <div className="info-section">
                <h4><FiDatabase /> Database</h4>
                <div className="info-item">
                  <div className="info-label">Version:</div>
                  <div className="info-value">{systemInfoData?.data?.database?.version?.split(' ')[0] || 'Unknown'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Size:</div>
                  <div className="info-value">
                    {systemInfoData?.data?.database?.tables?.reduce((acc, table) => acc + parseInt(table.size_bytes || 0), 0)
                      ? formatBytes(systemInfoData.data.database.tables.reduce((acc, table) => acc + parseInt(table.size_bytes || 0), 0))
                      : 'Unknown'}
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label">Tables:</div>
                  <div className="info-value">{systemInfoData?.data?.database?.tables?.length || 'Unknown'}</div>
                </div>
              </div>
              
              <div className="info-section">
                <h4><FiCpu /> Resources</h4>
                <div className="info-item">
                  <div className="info-label">CPU Cores:</div>
                  <div className="info-value">{systemInfoData?.data?.system?.cpus || 'Unknown'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Memory:</div>
                  <div className="info-value">
                    {systemInfoData?.data?.system?.memory?.total
                      ? `${formatBytes(systemInfoData.data.system.memory.used)} / ${formatBytes(systemInfoData.data.system.memory.total)}`
                      : 'Unknown'}
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label">Memory Usage:</div>
                  <div className="info-value">
                    {systemInfoData?.data?.system?.memory?.total
                      ? `${Math.round((systemInfoData.data.system.memory.used / systemInfoData.data.system.memory.total) * 100)}%`
                      : 'Unknown'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="table-counts">
              <h4><FiGrid /> Data Summary</h4>
              <div className="counts-grid">
                <div className="count-item">
                  <div className="count-value">{systemInfoData?.data?.database?.table_counts?.participants_count || 0}</div>
                  <div className="count-label">Participants</div>
                </div>
                <div className="count-item">
                  <div className="count-value">{systemInfoData?.data?.database?.table_counts?.staff_count || 0}</div>
                  <div className="count-label">Staff</div>
                </div>
                <div className="count-item">
                  <div className="count-value">{systemInfoData?.data?.database?.table_counts?.programs_count || 0}</div>
                  <div className="count-label">Programs</div>
                </div>
                <div className="count-item">
                  <div className="count-value">{systemInfoData?.data?.database?.table_counts?.loom_instances_count || 0}</div>
                  <div className="count-label">Loom Instances</div>
                </div>
                <div className="count-item">
                  <div className="count-value">{systemInfoData?.data?.database?.table_counts?.vehicles_count || 0}</div>
                  <div className="count-label">Vehicles</div>
                </div>
                <div className="count-item">
                  <div className="count-value">{systemInfoData?.data?.database?.table_counts?.system_logs_count || 0}</div>
                  <div className="count-label">System Logs</div>
                </div>
              </div>
            </div>
          </>
        )}
        
        <div className="system-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => refetchSystemInfo()}
          >
            <FiRefreshCw /> Refresh System Info
          </button>
        </div>
      </div>
    </div>
  );

  // Render all settings
  const renderAllSettings = () => (
    <div className="settings-section">
      <h3 className="section-title">All Settings</h3>
      <div className="settings-form glass-card">
        {settingsLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading settings...</p>
          </div>
        ) : settingsError ? (
          <div className="error-container">
            <FiAlertCircle className="error-icon" />
            <p>Error loading settings: {settingsError.message}</p>
            <button className="btn btn-primary" onClick={() => refetchSettings()}>
              Try Again
            </button>
          </div>
        ) : (
          <div className="settings-table-container">
            <table className="settings-table glass-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {settingsData?.data?.map(setting => (
                  <tr key={setting.key}>
                    <td>{setting.key}</td>
                    <td>
                      {typeof setting.value === 'object' 
                        ? JSON.stringify(setting.value).substring(0, 50) + (JSON.stringify(setting.value).length > 50 ? '...' : '')
                        : String(setting.value).substring(0, 50) + (String(setting.value).length > 50 ? '...' : '')}
                    </td>
                    <td>{setting.category}</td>
                    <td>{setting.description}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn btn-icon" 
                          onClick={() => handleSettingEdit(setting)}
                          disabled={setting.is_system}
                          title={setting.is_system ? 'System setting (read-only)' : 'Edit setting'}
                        >
                          <FiEdit2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!settingsData?.data || settingsData.data.length === 0) && (
                  <tr>
                    <td colSpan="5" className="no-results">
                      No settings found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="settings-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => refetchSettings()}
          >
            <FiRefreshCw /> Refresh Settings
          </button>
        </div>
      </div>
    </div>
  );

  // Render backup modal
  const renderBackupModal = () => (
    <div className="modal-overlay" onClick={() => setIsBackupModalOpen(false)}>
      <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create Database Backup</h3>
          <button className="btn-close" onClick={() => setIsBackupModalOpen(false)}>
            <FiXCircle />
          </button>
        </div>
        <div className="modal-body">
          <form className="backup-form">
            <div className="form-group">
              <label htmlFor="backup-format">Backup Format</label>
              <select
                id="backup-format"
                value={backupOptions.format}
                onChange={e => setBackupOptions({...backupOptions, format: e.target.value})}
              >
                <option value="sql">SQL Script</option>
                <option value="custom">Custom Format</option>
                <option value="directory">Directory Format</option>
                <option value="tar">TAR Archive</option>
              </select>
            </div>
            
            <div className="form-group checkbox-group">
              <div className="checkbox-item">
                <input
                  id="include-data"
                  type="checkbox"
                  checked={backupOptions.includeData}
                  onChange={e => setBackupOptions({...backupOptions, includeData: e.target.checked})}
                />
                <label htmlFor="include-data">Include Data</label>
              </div>
            </div>
            
            <div className="form-group checkbox-group">
              <div className="checkbox-item">
                <input
                  id="include-schema"
                  type="checkbox"
                  checked={backupOptions.includeSchema}
                  onChange={e => setBackupOptions({...backupOptions, includeSchema: e.target.checked})}
                />
                <label htmlFor="include-schema">Include Schema</label>
              </div>
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => setIsBackupModalOpen(false)}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleBackupCreate}
            disabled={createBackupMutation.isLoading}
          >
            {createBackupMutation.isLoading ? (
              <>
                <div className="loading-spinner-small"></div>
                Creating Backup...
              </>
            ) : (
              <>
                <FiDownload /> Create Backup
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Render restore modal
  const renderRestoreModal = () => (
    <div className="modal-overlay" onClick={() => setIsRestoreModalOpen(false)}>
      <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Restore Database</h3>
          <button className="btn-close" onClick={() => setIsRestoreModalOpen(false)}>
            <FiXCircle />
          </button>
        </div>
        <div className="modal-body">
          <div className="warning-message">
            <FiAlertCircle className="warning-icon" />
            <p>
              <strong>Warning:</strong> Restoring a database will overwrite all current data. 
              This action cannot be undone. Make sure you have a backup of your current data before proceeding.
            </p>
          </div>
          
          <form className="restore-form" onSubmit={handleDatabaseRestore}>
            <div className="form-group">
              <label htmlFor="backup-file">Backup File</label>
              <input
                id="backup-file"
                type="file"
                onChange={handleFileChange}
                required
              />
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => setIsRestoreModalOpen(false)}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-danger"
            onClick={handleDatabaseRestore}
            disabled={!restoreFile || restoreDatabaseMutation.isLoading}
          >
            {restoreDatabaseMutation.isLoading ? (
              <>
                <div className="loading-spinner-small"></div>
                Restoring...
              </>
            ) : (
              <>
                <FiUpload /> Restore Database
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Render setting edit modal
  const renderEditModal = () => {
    if (!selectedSetting) return null;
    
    return (
      <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
        <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Edit Setting</h3>
            <button className="btn-close" onClick={() => setIsEditModalOpen(false)}>
              <FiXCircle />
            </button>
          </div>
          <div className="modal-body">
            <form className="edit-setting-form">
              <div className="form-group">
                <label htmlFor="setting-key">Key</label>
                <input
                  id="setting-key"
                  type="text"
                  value={selectedSetting.key}
                  disabled
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="setting-value">Value</label>
                {typeof selectedSetting.value === 'boolean' ? (
                  <div className="toggle-switch">
                    <input
                      id="setting-value"
                      type="checkbox"
                      checked={newSettingValue === true}
                      onChange={e => setNewSettingValue(e.target.checked)}
                    />
                    <label htmlFor="setting-value">
                      <div className="toggle-icon">
                        {newSettingValue === true ? <FiToggleRight /> : <FiToggleLeft />}
                      </div>
                      <div className="toggle-text">
                        {newSettingValue === true ? 'Enabled' : 'Disabled'}
                      </div>
                    </label>
                  </div>
                ) : typeof selectedSetting.value === 'number' ? (
                  <input
                    id="setting-value"
                    type="number"
                    value={newSettingValue}
                    onChange={e => setNewSettingValue(parseFloat(e.target.value))}
                  />
                ) : typeof selectedSetting.value === 'object' ? (
                  <textarea
                    id="setting-value"
                    value={JSON.stringify(newSettingValue, null, 2)}
                    onChange={e => {
                      try {
                        setNewSettingValue(JSON.parse(e.target.value));
                      } catch (error) {
                        // Allow invalid JSON during editing
                        setNewSettingValue(e.target.value);
                      }
                    }}
                    rows="10"
                  />
                ) : (
                  <input
                    id="setting-value"
                    type="text"
                    value={newSettingValue}
                    onChange={e => setNewSettingValue(e.target.value)}
                  />
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="setting-category">Category</label>
                <input
                  id="setting-category"
                  type="text"
                  value={selectedSetting.category}
                  disabled
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="setting-description">Description</label>
                <input
                  id="setting-description"
                  type="text"
                  value={selectedSetting.description || ''}
                  disabled
                />
              </div>
            </form>
          </div>
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={handleSettingUpdate}
              disabled={updateSettingMutation.isLoading}
            >
              {updateSettingMutation.isLoading ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Saving...
                </>
              ) : (
                <>
                  <FiSave /> Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="settings-container">
      <div className="page-header">
        <h2 className="page-title">Settings</h2>
        <div className="page-actions">
          <button 
            className="btn btn-icon" 
            onClick={() => {
              refetchSettings();
              refetchSystemInfo();
            }}
            title="Refresh All"
          >
            <FiRefreshCw />
          </button>
          <span className="date-display">
            {format(currentDate, 'EEEE, MMMM d, yyyy')}
          </span>
        </div>
      </div>
      
      <div className="settings-layout">
        {/* Settings Navigation */}
        <div className="settings-nav glass-card">
          <ul className="nav-list">
            <li 
              className={activeSection === 'general' ? 'active' : ''}
              onClick={() => setActiveSection('general')}
            >
              <FiSettings /> General
            </li>
            <li 
              className={activeSection === 'loom' ? 'active' : ''}
              onClick={() => setActiveSection('loom')}
            >
              <FiCalendar /> Loom System
            </li>
            <li 
              className={activeSection === 'security' ? 'active' : ''}
              onClick={() => setActiveSection('security')}
            >
              <FiLock /> Security
            </li>
            <li 
              className={activeSection === 'backup' ? 'active' : ''}
              onClick={() => setActiveSection('backup')}
            >
              <FiDatabase /> Backup & Restore
            </li>
            <li 
              className={activeSection === 'system' ? 'active' : ''}
              onClick={() => setActiveSection('system')}
            >
              <FiInfo /> System Info
            </li>
            <li 
              className={activeSection === 'all' ? 'active' : ''}
              onClick={() => setActiveSection('all')}
            >
              <FiSliders /> All Settings
            </li>
          </ul>
        </div>
        
        {/* Settings Content */}
        <div className="settings-content">
          {activeSection === 'general' && renderGeneralSettings()}
          {activeSection === 'loom' && renderLoomSettings()}
          {activeSection === 'security' && renderSecuritySettings()}
          {activeSection === 'backup' && renderBackupSettings()}
          {activeSection === 'system' && renderSystemInfo()}
          {activeSection === 'all' && renderAllSettings()}
        </div>
      </div>
      
      {/* System Status */}
      <div className="system-status glass-card">
        <div className="status-item">
          <div className="status-label">API Status:</div>
          <div className="status-value online">
            <FiCheckCircle /> Online
          </div>
        </div>
        <div className="status-item">
          <div className="status-label">Database:</div>
          <div className="status-value online">
            <FiCheckCircle /> Connected
          </div>
        </div>
        <div className="status-item">
          <div className="status-label">Last Backup:</div>
          <div className="status-value">
            {format(new Date(), 'MMM d, yyyy h:mm a')}
          </div>
        </div>
        <div className="status-item">
          <div className="status-label">Version:</div>
          <div className="status-value">
            RABS v3.0.0
          </div>
        </div>
      </div>
      
      {/* Modals */}
      {isBackupModalOpen && renderBackupModal()}
      {isRestoreModalOpen && renderRestoreModal()}
      {isEditModalOpen && renderEditModal()}
    </div>
  );
};

export default Settings;
