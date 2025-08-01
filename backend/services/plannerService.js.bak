// backend/services/plannerService.js
const { getDbConnection } = require('../database');

/**
 * Get all program enrollments for a specific participant
 * @param {number} participantId - Participant ID
 * @returns {Promise<Array>} Array of enrollment objects
 */
const getParticipantEnrollments = async (participantId) => {
  const db = await getDbConnection();
  try {
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
    const rows = await new Promise((resolve, reject) =>
      db.all(query, [participantId], (err, r) => (err ? reject(err) : resolve(r)))
    );
    return rows;
  } finally {
    db.close();
  }
};

/**
 * Get all available programs
 * @returns {Promise<Array>} Array of program objects
 */
const getAllPrograms = async () => {
  const db = await getDbConnection();
  try {
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
    const rows = await new Promise((resolve, reject) =>
      db.all(query, [], (err, r) => (err ? reject(err) : resolve(r)))
    );
    return rows;
  } finally {
    db.close();
  }
};

/**
 * Update program enrollments for a specific participant
 * @param {number} participantId - Participant ID
 * @param {Array<Object>} pendingChanges - Array with objects containing:
 *        { program_id, action: 'add'|'remove', effectiveDate: 'YYYY-MM-DD' }
 * @returns {Promise<Object>} Result object with count of pending changes queued
 */
const updateParticipantEnrollments = async (participantId, pendingChanges) => {
  // Ensure we have an array to work with
  if (!Array.isArray(pendingChanges) || pendingChanges.length === 0) {
    return { inserted: 0 };
  }

  // ------------------------------------------------------------------
  // DEBUG LOGGING – trace incoming data and execution flow
  // ------------------------------------------------------------------
  console.log('[plannerService] updateParticipantEnrollments called', {
    participantId,
    pendingChanges,
  });

  // Basic validation – filter out obviously bad objects instead of crashing
  const validChanges = pendingChanges.filter(
    (c) =>
      c &&
      c.program_id &&
      c.action &&
      c.effectiveDate &&
      (c.action === 'add' || c.action === 'remove')
  );

  if (validChanges.length === 0) {
    return { inserted: 0 };
  }

  const db = await getDbConnection();
  try {

    console.log(
      `[plannerService] Starting DB transaction for participant ${participantId}`
    );

    await new Promise((resolve, reject) =>
      db.run('BEGIN TRANSACTION', (err) => (err ? reject(err) : resolve()))
    );

    for (const change of validChanges) {
      console.log('[plannerService] Processing change', change);

      /* -----------------------------------------------------------
       * 1) APPLY CHANGE IMMEDIATELY TO program_enrollments
       * --------------------------------------------------------- */
      if (change.action === 'add') {
        // Add a new enrollment row if it does not already exist
        await new Promise((resolve, reject) =>
          db.run(
            `INSERT OR IGNORE INTO program_enrollments
             (participant_id, program_id, start_date)
             VALUES (?, ?, ?)`,
            [
              participantId,
              parseInt(change.program_id, 10),
              change.effectiveDate,
            ],
            (err) => (err ? reject(err) : resolve())
          )
        );
      } else if (change.action === 'remove') {
        // Soft-remove by stamping an end_date (only if currently active)
        await new Promise((resolve, reject) =>
          db.run(
            `UPDATE program_enrollments
               SET end_date = ?
             WHERE participant_id = ?
               AND program_id   = ?
               AND (end_date IS NULL OR end_date >= ?)`,
            [
              change.effectiveDate,
              participantId,
              parseInt(change.program_id, 10),
              change.effectiveDate,
            ],
            (err) => (err ? reject(err) : resolve())
          )
        );
      }

      /* -----------------------------------------------------------
       * 2) ALWAYS RECORD INTO pending_enrollment_changes FOR AUDIT
       * --------------------------------------------------------- */
      await new Promise((resolve, reject) =>
        db.run(
          `INSERT INTO pending_enrollment_changes 
           (participant_id, program_id, action, effective_date)
           VALUES (?, ?, ?, ?)`,
          [
            participantId,
            parseInt(change.program_id, 10),
            change.action,
            change.effectiveDate,
          ],
          (err) => (err ? reject(err) : resolve())
        )
      );
    }

    console.log(
      `[plannerService] Committing transaction for participant ${participantId}`
    );

    await new Promise((resolve, reject) =>
      db.run('COMMIT', (err) => (err ? reject(err) : resolve()))
    );

    return { inserted: validChanges.length };
  } catch (error) {
    console.error(
      `[plannerService] Error updating enrollments for participant ${participantId}`,
      error
    );

    if (db) {
      // Attempt rollback if transaction failed
      await new Promise((res) => db.run('ROLLBACK', () => res()));
    }
    throw error;
  } finally {
    db.close();
  }
};

/**
 * Get the change-history log for a participant.
 * Returns the pending_enrollment_changes rows in reverse-chronological order
 * (most recent effective_date first).  This will allow the frontend to show a
 * rolling timeline of the last X changes that have been queued or processed
 * for the participant.
 *
 * @param {number} participantId
 * @returns {Promise<Array>} Array of change-log records
 */
const getParticipantChangeHistory = async (participantId) => {
  const db = await getDbConnection();
  try {
    /* ------------------------------------------------------------------
     * Build a unified history combining:
     *   • enrollment changes      (pending_enrollment_changes)
     *   • attendance status rows  (attendance)
     *   • cancellations           (activity_log)
     *
     * The result is limited to the 30 most-recent records so the frontend
     * can show a concise timeline.
     * ---------------------------------------------------------------- */
    const historyQuery = `
      /* ---------- Enrollment Adds / Removes (future-dated) ---------- */
      SELECT
        'enrollment'               AS event_type,
        pec.effective_date         AS event_date,
        pec.created_at             AS created_at,
        pec.action                 AS action,              -- 'add' | 'remove'
        pec.program_id             AS program_id,
        p.name                     AS program_name,
        NULL                       AS program_instance_id,
        NULL                       AS attendance_status,
        NULL                       AS description
      FROM pending_enrollment_changes pec
      JOIN programs p ON p.id = pec.program_id
      WHERE pec.participant_id = ?

      UNION ALL

      /* ---------- Attendance Records (confirmed / cancelled / no-show) ---------- */
      SELECT
        'attendance'               AS event_type,
        pi.date                    AS event_date,
        a.created_at               AS created_at,
        NULL                       AS action,
        pi.program_id              AS program_id,
        pr.name                    AS program_name,
        a.program_instance_id      AS program_instance_id,
        a.status                   AS attendance_status,    -- 'confirmed', 'cancelled', 'no-show'
        NULL                       AS description
      FROM attendance a
      JOIN program_instances pi ON pi.id = a.program_instance_id
      JOIN programs pr           ON pr.id = pi.program_id
      WHERE a.participant_id = ?

      UNION ALL

      /* ---------- Short / Normal Cancellations logged in activity_log ---------- */
      SELECT
        'cancellation'             AS event_type,
        al.created_at              AS event_date,
        al.created_at              AS created_at,
        NULL                       AS action,
        pr.id                      AS program_id,
        pr.name                    AS program_name,
        al.program_instance_id     AS program_instance_id,
        NULL                       AS attendance_status,
        al.description             AS description
      FROM activity_log al
      JOIN program_instances pi ON pi.id = al.program_instance_id
      JOIN programs pr          ON pr.id = pi.program_id
      WHERE al.participant_id = ? AND al.event_type = 'cancellation'

      ORDER BY event_date DESC, created_at DESC
      LIMIT 30
    `;

    const rows = await new Promise((resolve, reject) =>
      db.all(
        historyQuery,
        [participantId, participantId, participantId],
        (err, r) => (err ? reject(err) : resolve(r))
      )
    );

    return rows;
  } finally {
    db.close();
  }
};

/**
 * Fetch a **planner-only** history for a participant.
 * Includes ONLY rows from `pending_enrollment_changes` so the UI can
 * display a concise timeline of when the user (via Participant Planner)
 * scheduled future add / remove actions.  Attendance and cancellations
 * are intentionally excluded.
 *
 * @param {number} participantId
 * @returns {Promise<Array>} Array of enrollment-change records
 */
const getParticipantEnrollmentHistory = async (participantId) => {
  const db = await getDbConnection();
  try {
    const sql = `
      SELECT
        id,
        participant_id,
        program_id,
        action,
        effective_date,
        created_at
      FROM pending_enrollment_changes
      WHERE participant_id = ?
      ORDER BY effective_date DESC, created_at DESC
      LIMIT 30
    `;

    const rows = await new Promise((resolve, reject) =>
      db.all(sql, [participantId], (err, r) => (err ? reject(err) : resolve(r)))
    );

    return rows;
  } finally {
    db.close();
  }
};

// ---------------------------------------------------------------------------
// Export public API *after* all functions are declared
// ---------------------------------------------------------------------------
module.exports = {
  getParticipantEnrollments,
  getAllPrograms,
  updateParticipantEnrollments,
  getParticipantChangeHistory,
  getParticipantEnrollmentHistory,
};

