import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX } from 'react-icons/fi';

const SystemLogPanel = ({ isOpen, onClose }) => {
  const panelRef = useRef(null);

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

  return (
    <AnimatePresence>
      {isOpen && (
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
              <pre className="system-log-pre">
                {`[2025-09-14 12:34:56] INFO: System initialized
[2025-09-14 12:35:01] INFO: Database connection established
[2025-09-14 12:35:03] INFO: User authentication service started
[2025-09-14 12:35:10] WARN: Cache size approaching limit (85%)
[2025-09-14 12:36:22] INFO: API request: GET /api/v1/participants
[2025-09-14 12:36:23] INFO: API response: 200 OK (32ms)
[2025-09-14 12:37:45] ERROR: Failed to connect to external service
[2025-09-14 12:37:46] INFO: Retrying connection (attempt 1/3)
[2025-09-14 12:37:48] INFO: Connection established to external service
[2025-09-14 12:38:12] INFO: Background job started: data-sync
[2025-09-14 12:40:05] INFO: Background job completed: data-sync
[2025-09-14 12:41:30] DEBUG: Memory usage: 256MB
[2025-09-14 12:42:11] INFO: API request: POST /api/v1/participants
[2025-09-14 12:42:12] INFO: API response: 201 Created (78ms)
[2025-09-14 12:43:01] WARN: Rate limit threshold reached for IP 192.168.1.105
[2025-09-14 12:44:23] INFO: Scheduled maintenance starting in 30 minutes
[2025-09-14 12:45:00] INFO: API request: GET /api/v1/settings
[2025-09-14 12:45:01] INFO: API response: 200 OK (45ms)
[2025-09-14 12:46:12] INFO: User brett.watson logged in
[2025-09-14 12:47:33] INFO: Configuration updated by admin
[2025-09-14 12:48:05] INFO: Email notification sent to 3 recipients
[2025-09-14 12:49:17] INFO: API request: PUT /api/v1/vehicles/12
[2025-09-14 12:49:18] INFO: API response: 200 OK (62ms)
[2025-09-14 12:50:22] INFO: File upload started: program_template.xlsx
[2025-09-14 12:50:25] INFO: File upload completed: program_template.xlsx (2.4MB)
[2025-09-14 12:51:10] INFO: Import job started for program_template.xlsx
[2025-09-14 12:51:45] INFO: Import completed: 28 records processed, 0 errors`}
              </pre>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default SystemLogPanel;
