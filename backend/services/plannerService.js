// backend/services/plannerService.js
const db = require('../database');

/**
 * Get all program enrollments for a specific participant
 * @param {number} participantId - Participant ID
 * @returns {Promise<Array>} Array of enrollment objects
 */
const getParticipantEnrollments = (participantId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        pe.id,
        pe.participant_id,
        pe.program_id,
        pe.start_date,
        pe.end_date,
        p.name AS program_name,
        p.description AS program_description,
        p.day_of_week,
        p.start_time,
        p.end_time,
        p.is_weekend,
        p.is_centre_based,
        v.name AS venue_name
      FROM program_enrollments pe
      JOIN programs p ON pe.program_id = p.id
      LEFT JOIN venues v ON p.venue_id = v.id
      WHERE pe.participant_id = ? AND (pe.end_date IS NULL OR pe.end_date >= date('now'))
      ORDER BY p.day_of_week, p.start_time
    `;
    
    db.all(query, [participantId], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

/**
 * Get all available programs
 * @returns {Promise<Array>} Array of program objects
 */
const getAllPrograms = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.day_of_week,
        p.start_time,
        p.end_time,
        p.is_weekend,
        p.is_centre_based,
        v.name AS venue_name
      FROM programs p
      LEFT JOIN venues v ON p.venue_id = v.id
      WHERE p.active = 1
      ORDER BY p.day_of_week, p.start_time
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
};

/**
 * Update program enrollments for a specific participant
 * @param {number} participantId - Participant ID
 * @param {Object} pendingChanges - Object keyed by program_id containing
 *                                 { action: 'add'|'remove', effectiveDate: 'YYYY-MM-DD' }
 * @returns {Promise<Object>} Result object with count of pending changes queued
 */
const updateParticipantEnrollments = (participantId, pendingChanges) => {
  return new Promise((resolve, reject) => {
    const entries = Object.entries(pendingChanges || {});

    // nothing to do
    if (entries.length === 0) {
      resolve({ inserted: 0 });
      return;
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (beginErr) => {
        if (beginErr) {
          reject(beginErr);
          return;
        }

        let inserted = 0;
        const handleError = (e) => {
          db.run('ROLLBACK', () => reject(e));
        };

        entries.forEach(([programId, change]) => {
          db.run(
            `INSERT INTO pending_enrollment_changes 
             (participant_id, program_id, action, effective_date)
             VALUES (?, ?, ?, ?)`,
            [
              participantId,
              parseInt(programId, 10),
              change.action,
              change.effectiveDate
            ],
            (err) => {
              if (err) {
                handleError(err);
                return;
              }
              inserted += 1;
              if (inserted === entries.length) {
                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    handleError(commitErr);
                    return;
                  }
                  resolve({ inserted });
                });
              }
            }
          );
        });
      });
    });
  });
};

module.exports = {
  getParticipantEnrollments,
  getAllPrograms,
  updateParticipantEnrollments
};
