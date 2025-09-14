import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { format } from 'date-fns';
import { 
  FiSettings, 
  FiCalendar, 
  FiLock, 
  FiDatabase,
  FiSave,
  FiRefreshCw,
  FiDownload,
  FiUpload,
  FiAlertCircle,
  FiXCircle,
  FiTrash2
} from 'react-icons/fi';
import { toast } from 'react-toastify';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// Settings component
const Settings = () => {
  const queryClient = useQueryClient();
  const [currentDate] = useState(new Date());
  const [activeSection, setActiveSection] = useState('general');
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [backupOptions, setBackupOptions] = useState({
    format: 'sql',
    includeData: true,
    includeSchema: true
  });
  const [restoreFile, setRestoreFile] = useState(null);
  const [loomWindowSettings, setLoomWindowSettings] = useState({
    auto_generate: true,
    rollover_time: '00:00'
  });
  // ------------------------------------------------------------------
  // Org-level numeric settings (+ derived fortnights)
  // ------------------------------------------------------------------
  const [orgSettings, setOrgSettings] = useState({
    staff_threshold_per_wpu: 5,
    vehicle_trigger_every_n_participants: 10,
    loom_window_days: 14
  });
  // Single fortnights value (future only)
  const [loomFortnights, setLoomFortnights] = useState(1);
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
  const { refetch: refetchSettings } = useQuery(
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

  // ------------------------------------------------------------------
  // Organisation settings query (staff/vehicle thresholds + loom days)
  // ------------------------------------------------------------------
  const { refetch: refetchOrgSettings } = useQuery(
    ['orgSettings'],
    async () => {
      const resp = await axios.get(`${API_URL}/api/v1/settings/org`);
      return resp.data;
    },
    {
      onSuccess: (res) => {
        if (res?.data) {
          setOrgSettings(res.data);
          const totalFortnights = Math.max(1, Math.round(res.data.loom_window_days / 14));
          // Set single fortnights value
          setLoomFortnights(totalFortnights);
        }
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
      }
    }
  );

  // Handle loom & org thresholds update
  const handleLoomWindowUpdate = async () => {
    const days = loomFortnights * 14;
    // 1) PUT org numeric settings
    const putOrg = axios.put(`${API_URL}/api/v1/settings/org`, {
      loom_window_days: days,
      staff_threshold_per_wpu: orgSettings.staff_threshold_per_wpu,
      vehicle_trigger_every_n_participants: orgSettings.vehicle_trigger_every_n_participants
    });

    // 2) legacy loom_window bulk entry
    const bulkBody = [{
      key: 'loom_window',
      value: {
        auto_generate: loomWindowSettings.auto_generate,
        rollover_time: loomWindowSettings.rollover_time,
        fortnights_after: loomFortnights,
        days_after: days
      },
      description: 'Loom window configuration',
      category: 'loom'
    }];
    const postBulk = axios.post(`${API_URL}/api/v1/settings/bulk`, { settings: bulkBody });

    try {
      await Promise.all([putOrg, postBulk]);
      queryClient.invalidateQueries(['systemSettings']);
      queryClient.invalidateQueries(['orgSettings']);
      toast.success('Loom & threshold settings saved');
      
      // Log successful save
      axios.post(`${API_URL}/api/v1/logs`, {
        severity: 'INFO',
        category: 'SETTINGS',
        message: 'Loom settings saved',
        details: {
          loom_window_days: days,
          fortnights: loomFortnights,
          staff_threshold_per_wpu: orgSettings.staff_threshold_per_wpu,
          vehicle_trigger_every_n_participants: orgSettings.vehicle_trigger_every_n_participants
        }
      }).catch(logErr => console.error('Failed to log loom settings update:', logErr));
    } catch (err) {
      console.error('Failed saving loom/org settings', err);
      toast.error('Save failed');
      
      // Log error
      axios.post(`${API_URL}/api/v1/logs`, {
        severity: 'ERROR',
        category: 'SETTINGS',
        message: 'Failed to save loom settings',
        details: {
          error: err.message
        }
      }).catch(logErr => console.error('Failed to log loom settings error:', logErr));
    }
  };

  // Handle general settings update
  const handleGeneralSettingsUpdate = () => {
    const settings = Object.entries(generalSettings).map(([key, value]) => ({
      key,
      value,
      description: `General setting: ${key}`,
      category: 'general'
    }));
    
    bulkUpdateSettingsMutation.mutate(settings, {
      onSuccess: () => {
        toast.success('General settings saved');
        
        // Log successful save
        axios.post(`${API_URL}/api/v1/logs`, {
          severity: 'INFO',
          category: 'SETTINGS',
          message: 'General settings saved',
          details: { settings: generalSettings }
        }).catch(logErr => console.error('Failed to log general settings update:', logErr));
      },
      onError: (error) => {
        toast.error('Failed to save general settings');
        
        // Log error
        axios.post(`${API_URL}/api/v1/logs`, {
          severity: 'ERROR',
          category: 'SETTINGS',
          message: 'Failed to save general settings',
          details: { error: error.message }
        }).catch(logErr => console.error('Failed to log general settings error:', logErr));
      }
    });
  };

  // Handle security settings update
  const handleSecuritySettingsUpdate = () => {
    const settings = Object.entries(securitySettings).map(([key, value]) => ({
      key,
      value,
      description: `Security setting: ${key}`,
      category: 'security'
    }));
    
    bulkUpdateSettingsMutation.mutate(settings, {
      onSuccess: () => {
        toast.success('Security settings saved');
        
        // Log successful save
        axios.post(`${API_URL}/api/v1/logs`, {
          severity: 'INFO',
          category: 'SETTINGS',
          message: 'Security settings saved',
          details: { settings: securitySettings }
        }).catch(logErr => console.error('Failed to log security settings update:', logErr));
      },
      onError: (error) => {
        toast.error('Failed to save security settings');
        
        // Log error
        axios.post(`${API_URL}/api/v1/logs`, {
          severity: 'ERROR',
          category: 'SETTINGS',
          message: 'Failed to save security settings',
          details: { error: error.message }
        }).catch(logErr => console.error('Failed to log security settings error:', logErr));
      }
    });
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

  // Render general settings section
  const renderGeneralSettings = () => (
    <div className="settings-section">
      <h3 className="section-title">General Settings</h3>
      <div className="settings-form glass-card">
        <div className="form-group">
          <label htmlFor="organization-name" className="form-label">Organization Name</label>
          <input
            id="organization-name"
            type="text"
            className="form-control"
            value={generalSettings.organization_name}
            onChange={(e) => setGeneralSettings({...generalSettings, organization_name: e.target.value})}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="timezone" className="form-label">Timezone</label>
          <select
            id="timezone"
            className="form-control"
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
          <label htmlFor="date-format" className="form-label">Date Format</label>
          <select
            id="date-format"
            className="form-control"
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
          <label htmlFor="time-format" className="form-label">Time Format</label>
          <select
            id="time-format"
            className="form-control"
            value={generalSettings.time_format}
            onChange={(e) => setGeneralSettings({...generalSettings, time_format: e.target.value})}
          >
            <option value="12h">12-hour (2:30 PM)</option>
            <option value="24h">24-hour (14:30)</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="default-view" className="form-label">Default View</label>
          <select
            id="default-view"
            className="form-control"
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

  // ------------------------------------------------------------------
  // Render loom settings section
  // ------------------------------------------------------------------
  const renderLoomSettings = () => (
    <div className="settings-section">
      <h3 className="section-title">Loom System Settings</h3>
      <div className="settings-form glass-card">
        <div className="loom-info">
          <p>
            The loom window controls how far forward the system looks when generating schedules.
            Adjusting these settings affects system performance and data visibility.
          </p>
        </div>
        
        {/* Single fortnight selector */}
        <div className="form-group">
          <label htmlFor="fortnights-ahead" className="form-label">Fortnights Ahead</label>
          <input
            id="fortnights-ahead"
            type="number"
            className="form-control"
            min="1"
            max="12"
            value={loomFortnights}
            onChange={(e) => setLoomFortnights(Math.max(1, parseInt(e.target.value) || 1))}
          />
          <div className="input-help">How many fortnights in the future to include (1-12)</div>
        </div>
        
        <div className="form-group">
          <label htmlFor="rollover-time" className="form-label">Daily Rollover Time</label>
          <input
            id="rollover-time"
            type="time"
            className="form-control"
            value={loomWindowSettings.rollover_time}
            onChange={(e) => setLoomWindowSettings({...loomWindowSettings, rollover_time: e.target.value})}
          />
          <div className="input-help">When the system should process the next day&apos;s schedule</div>
        </div>
        
        <div className="form-group checkbox-group">
          <div className="checkbox-item" style={{ display: 'flex', alignItems: 'center' }}>
            <input
              id="auto-generate"
              type="checkbox"
              checked={loomWindowSettings.auto_generate}
              onChange={(e) => setLoomWindowSettings({...loomWindowSettings, auto_generate: e.target.checked})}
              style={{ marginRight: '8px' }}
            />
            <label htmlFor="auto-generate">Generate instances from template</label>
          </div>
          <div className="input-help">Automatically create instances from program templates</div>
        </div>
        
        {/* Operational thresholds */}
        <div className="form-group">
          <label htmlFor="staff-threshold" className="form-label">Staff per WPU: {orgSettings.staff_threshold_per_wpu}</label>
          <input
            id="staff-threshold"
            type="range"
            className="form-control"
            min="1"
            max="10"
            step="1"
            value={orgSettings.staff_threshold_per_wpu}
            onChange={(e) =>
              setOrgSettings({
                ...orgSettings,
                staff_threshold_per_wpu: parseInt(e.target.value) || 1
              })
            }
            style={{ width: '100%' }}
          />
        </div>
        <div className="form-group">
          <label htmlFor="vehicle-threshold" className="form-label">Vehicle trigger per participants: {orgSettings.vehicle_trigger_every_n_participants}</label>
          <input
            id="vehicle-threshold"
            type="range"
            className="form-control"
            min="2"
            max="20"
            step="1"
            value={orgSettings.vehicle_trigger_every_n_participants}
            onChange={(e) =>
              setOrgSettings({
                ...orgSettings,
                vehicle_trigger_every_n_participants: parseInt(e.target.value) || 2
              })
            }
            style={{ width: '100%' }}
          />
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
          <label htmlFor="session-timeout" className="form-label">Session Timeout (minutes)</label>
          <input
            id="session-timeout"
            type="number"
            className="form-control"
            min="5"
            max="240"
            value={securitySettings.session_timeout}
            onChange={(e) => setSecuritySettings({...securitySettings, session_timeout: parseInt(e.target.value)})}
          />
          <div className="input-help">How long until inactive users are logged out</div>
        </div>
        
        <div className="form-group">
          <label htmlFor="password-expiry" className="form-label">Password Expiry (days)</label>
          <input
            id="password-expiry"
            type="number"
            className="form-control"
            min="0"
            max="365"
            value={securitySettings.password_expiry_days}
            onChange={(e) => setSecuritySettings({...securitySettings, password_expiry_days: parseInt(e.target.value)})}
          />
          <div className="input-help">How often users must change their password (0 = never)</div>
        </div>
        
        <div className="form-group">
          <label htmlFor="failed-login-attempts" className="form-label">Failed Login Attempts</label>
          <input
            id="failed-login-attempts"
            type="number"
            className="form-control"
            min="1"
            max="10"
            value={securitySettings.failed_login_attempts}
            onChange={(e) => setSecuritySettings({...securitySettings, failed_login_attempts: parseInt(e.target.value)})}
          />
          <div className="input-help">Number of failed attempts before account lockout</div>
        </div>
        
        <div className="form-group checkbox-group">
          <div className="checkbox-item" style={{ display: 'flex', alignItems: 'center' }}>
            <input
              id="require-2fa"
              type="checkbox"
              checked={securitySettings.require_2fa}
              onChange={(e) => setSecuritySettings({...securitySettings, require_2fa: e.target.checked})}
              style={{ marginRight: '8px' }}
            />
            <label htmlFor="require-2fa">Require Two-Factor Authentication</label>
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
        
        <div className="backup-actions" style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
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
            <div className="checkbox-item" style={{ display: 'flex', alignItems: 'center' }}>
              <input
                id="auto-backup"
                type="checkbox"
                checked={true}
                onChange={() => {}}
                style={{ marginRight: '8px' }}
              />
              <label htmlFor="auto-backup">Enable Automatic Backups</label>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="backup-frequency" className="form-label">Backup Frequency</label>
            <select
              id="backup-frequency"
              className="form-control"
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
            <label htmlFor="backup-retention" className="form-label">Retention Period (days)</label>
            <input
              id="backup-retention"
              type="number"
              className="form-control"
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
                    <button className="icon-link" title="Download">
                      <FiDownload />
                    </button>
                    <button className="icon-link" title="Restore">
                      <FiUpload />
                    </button>
                    <button className="icon-link" title="Delete">
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
                    <button className="icon-link" title="Download">
                      <FiDownload />
                    </button>
                    <button className="icon-link" title="Restore">
                      <FiUpload />
                    </button>
                    <button className="icon-link" title="Delete">
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
              <label htmlFor="backup-format" className="form-label">Backup Format</label>
              <select
                id="backup-format"
                className="form-control"
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
              <label htmlFor="backup-file" className="form-label">Backup File</label>
              <input
                id="backup-file"
                type="file"
                className="form-control"
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

  return (
    <div className="settings-container">
      <div className="page-header">
        <h2 className="page-title">Settings</h2>
        <div className="page-actions">
          <button 
            className="icon-link" 
            onClick={() => {
              refetchSettings();
              refetchOrgSettings();
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
        {/* Settings Navigation - Changed to horizontal buttons */}
        <div className="tab-bar">
          <button 
            type="button"
            className={`tab-btn ${activeSection === 'general' ? 'active' : ''}`}
            onClick={() => setActiveSection('general')}
          >
            <FiSettings /> General
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeSection === 'loom' ? 'active' : ''}`}
            onClick={() => setActiveSection('loom')}
          >
            <FiCalendar /> Loom System
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeSection === 'security' ? 'active' : ''}`}
            onClick={() => setActiveSection('security')}
          >
            <FiLock /> Security
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeSection === 'backup' ? 'active' : ''}`}
            onClick={() => setActiveSection('backup')}
          >
            <FiDatabase /> Backup & Restore
          </button>
        </div>
        
        {/* Settings Content */}
        <div className="settings-content">
          {activeSection === 'general' && renderGeneralSettings()}
          {activeSection === 'loom' && renderLoomSettings()}
          {activeSection === 'security' && renderSecuritySettings()}
          {activeSection === 'backup' && renderBackupSettings()}
        </div>
      </div>
      
      {/* System Status bar removed */}
      
      {/* Modals */}
      {isBackupModalOpen && renderBackupModal()}
      {isRestoreModalOpen && renderRestoreModal()}
    </div>
  );
};

export default Settings;
