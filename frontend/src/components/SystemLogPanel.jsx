import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import api from '../api/api';

const SystemLogPanel = ({ isOpen, onClose }) => {
  const panelRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const MAX_LOGS = 500;

  // Format timestamp to readable format
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Load initial logs and set up SSE
  useEffect(() => {
    if (!isOpen) return;

    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get('/logs?limit=200');
        if (response.data?.data) {
          setLogs(response.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch logs:', err);
        setError('Failed to load logs. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    const setupSSE = () => {
      try {
        // Close any existing connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        // Create new EventSource connection
        eventSourceRef.current = new EventSource('/api/v1/logs/stream');
        
        // Handle incoming log events
        eventSourceRef.current.onmessage = (event) => {
          try {
            const logEntry = JSON.parse(event.data);
            setLogs(prevLogs => {
              const newLogs = [logEntry, ...prevLogs];
              // Cap the logs array at MAX_LOGS entries
              return newLogs.slice(0, MAX_LOGS);
            });
          } catch (err) {
            console.error('Error processing log event:', err);
          }
        };

        // Handle connection error
        eventSourceRef.current.onerror = () => {
          console.error('SSE connection error');
          // Close and retry in 5 seconds
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
            setTimeout(setupSSE, 5000);
          }
        };
      } catch (err) {
        console.error('Failed to set up SSE:', err);
      }
    };

    // Fetch initial logs and set up SSE
    fetchLogs();
    setupSSE();

    // Cleanup function
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isOpen]);

  // Handle Escape key to close panel
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      // Prevent body scrolling when panel is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      // Restore body scrolling when panel is closed
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Log entry component with collapsible details
  const LogEntry = ({ log }) => {
    const [expanded, setExpanded] = useState(false);
    const hasDetails = log.details && Object.keys(log.details).length > 0;

    return (
      <div className={`log-item sev-${log.severity}`}>
        <div className="log-header">
          <span className="log-time">{formatTimestamp(log.ts)}</span>
          <span className={`log-severity sev-${log.severity}`}>{log.severity}</span>
          <span className="log-category">{log.category}</span>
        </div>
        <div className="log-message">{log.message}</div>
        
        {hasDetails && (
          <div className="log-details-container">
            <button 
              className="log-details-toggle" 
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <FiChevronDown /> : <FiChevronRight />}
              Details
            </button>
            
            {expanded && (
              <pre className="log-details">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ---------------------------------------------------------------------
   * Footer Actions
   * ------------------------------------------------------------------*/

  // Export current logs to a JSON file
  const handleExport = () => {
    if (!logs || logs.length === 0) return;
    try {
      const ts = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .split('T')
        .join('_')
        .replace('Z', '');
      const filename = `system_logs_${ts}.json`;
      const json = JSON.stringify(logs, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to export logs.');
    }
  };

  // Clear all logs via backend and local state
  const handleClear = async () => {
    if (!window.confirm('Clear all system log entries?')) return;
    try {
      await api.delete('/system/logs', { params: { confirm: true } });
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs:', err);
      setError('Failed to clear logs. Please try again later.');
    }
  };

  // Render via portal to avoid stacking/overflow issues
  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
        <>
          {/* Overlay */}
          <motion.div
            className="system-log-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            ref={panelRef}
            className="system-log-panel"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="system-log-header">
              <h3>System Log</h3>
              <button 
                className="system-log-close-btn"
                onClick={onClose}
                aria-label="Close system log"
              >
                <FiX />
              </button>
            </div>

            {/* Content */}
            <div className="system-log-content">
              {isLoading && <div className="log-loading">Loading logs...</div>}
              {error && <div className="log-error">{error}</div>}
              
              {!isLoading && !error && logs.length === 0 && (
                <div className="log-empty">No logs available</div>
              )}
              
              <div className="log-list">
                {logs.map(log => (
                  <LogEntry key={log.id} log={log} />
                ))}
              </div>

              {/* Footer actions */}
              <div className="system-log-footer">
                <button
                  className="log-export-btn"
                  onClick={handleExport}
                  disabled={logs.length === 0}
                >
                  Export
                </button>
                <button
                  className="log-clear-btn"
                  onClick={handleClear}
                  disabled={logs.length === 0}
                >
                  Clear log
                </button>
              </div>
            </div>
          </motion.aside>
        </>
    </AnimatePresence>,
    document.body
  );
};

export default SystemLogPanel;
