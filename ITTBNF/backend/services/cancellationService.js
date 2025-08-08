/**
 * backend/services/cancellationService.js
 *
 * This service handles the business logic for processing cancellations.
 */
const { getDbConnection } = require('../database');
// Trigger automatic staff/vehicle/route rebalance after a cancellation
const {
  rebalanceResources,
} = require('./dynamicResourceService');

/**
 * Processes a cancellation for a participant for a specific program instance.
 * It handles 'normal' and 'short_notice' cancellations differently, ensuring
 * atomicity with a database transaction and logging the event.
 * @param {object} options - The options for cancellation.
 * @param {number} options.participantId - The ID of the participant being cancelled.
 * @param {number} options.programInstanceId - The ID of the program instance being cancelled.
 * @param {string} options.type - The type of cancellation ('normal' or 'short_notice').
 * @returns {Promise<Object>} An object confirming the successful cancellation.
 */
const createCancellation = async ({ participantId, programInstanceId, type }) => {
  const VALID_TYPES = ['normal', 'short_notice'];
  let db;
  try {
    // Get a new database connection for this atomic operation
    db = await getDbConnection();

    // Begin a transaction to ensure all operations succeed or fail together
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => (err ? reject(err) : resolve()));
    });

    try {
      let logDescription = '';
      if (!VALID_TYPES.includes(type)) {
        throw new Error(`Invalid cancellation type provided: ${type}`);
      }

      if (type === 'short_notice') {
        /* --------------------------------------------------------------
         * Short-notice: ensure a *cancelled* attendance record exists.
         * 1. Look for an existing attendance row.
         * 2. If found  -> UPDATE it to 'cancelled'.
         *    If absent -> INSERT a new 'cancelled' attendance record.
         * ----------------------------------------------------------- */

        const existingAttendance = await new Promise((resolve, reject) => {
          const selSql = `
            SELECT id
            FROM attendance
            WHERE participant_id = ? AND program_instance_id = ?
            LIMIT 1
          `;
          db.get(selSql, [participantId, programInstanceId], (err, row) =>
            err ? reject(err) : resolve(row)
          );
        });

        if (existingAttendance) {
          const updateSql = `
            UPDATE attendance
            SET status = 'cancelled', notes = 'Short Notice Cancellation'
            WHERE id = ?
          `;
          await new Promise((resolve, reject) => {
            db.run(updateSql, [existingAttendance.id], (err) =>
              err ? reject(err) : resolve()
            );
          });
        } else {
          const insertSql = `
            INSERT INTO attendance (participant_id, program_instance_id, status, notes)
            VALUES (?, ?, 'cancelled', 'Short Notice Cancellation')
          `;
          await new Promise((resolve, reject) => {
            db.run(insertSql, [participantId, programInstanceId], (err) =>
              err ? reject(err) : resolve()
            );
          });
        }

        // Also annotate any existing billing records.
        const updateBillingSql = `
          UPDATE billing_records
          SET notes = 'Short Notice Cancellation'
          WHERE participant_id = ? AND program_instance_id = ?
        `;
        await new Promise((resolve, reject) => {
          db.run(updateBillingSql, [participantId, programInstanceId], (err) => (err ? reject(err) : resolve()));
        });

        logDescription = `Participant ${participantId} short notice cancelled from Program Instance ${programInstanceId}`;

      } else if (type === 'normal') {
        // For normal cancellation, we completely remove the attendance record.
        // This ensures the participant is not included in billing runs for this instance.
        const deleteAttendanceSql = `
          DELETE FROM attendance
          WHERE participant_id = ? AND program_instance_id = ?
        `;
        await new Promise((resolve, reject) => {
          db.run(deleteAttendanceSql, [participantId, programInstanceId], function (err) {
            if (err) return reject(err);
            // Even if no existing attendance row was found, a normal cancellation
            // is still considered successful because the desired post-condition
            // (“no attendance record exists for this participant / instance”) is met.
            resolve();
          });
        });

        logDescription = `Participant ${participantId} normally cancelled from Program Instance ${programInstanceId}`;

        /* --------------------------------------------------------------
         * Remove or void any *unbilled* billing records linked to this
         * participant / program instance so they are excluded from CSVs.
         * We preserve already-billed items (status = 'billed', 'paid')
         * but mark them for auditing if we attempted to void them.
         * ----------------------------------------------------------- */
        const voidSql = `
          UPDATE billing_records
          SET status = 'void', notes = COALESCE(notes,'') || ' | Normal Cancellation (>7 days)'
          WHERE participant_id = ? AND program_instance_id = ? AND status = 'unbilled'
        `;
        await new Promise((resolve, reject) => {
          db.run(voidSql, [participantId, programInstanceId], (err) =>
            err ? reject(err) : resolve()
          );
        });

        // Optional: log a debug if nothing was voided (changes == 0)
        // Using function callback to inspect `this.changes`
        /* eslint-disable prefer-arrow-callback */
        db.run(voidSql, [participantId, programInstanceId], function (err) {
          if (!err && this.changes === 0) {
            console.debug(
              `No unbilled billing_records found for normal cancellation P${participantId} / PI${programInstanceId}`
            );
          }
        });
        /* eslint-enable prefer-arrow-callback */

      } else {
        throw new Error('Invalid cancellation type provided.');
      }

      // Log the event to the activity log regardless of type
      const logSql = `
        INSERT INTO activity_log (event_type, participant_id, program_instance_id, description)
        VALUES ('cancellation', ?, ?, ?)
      `;
      await new Promise((resolve, reject) => {
        db.run(
          logSql,
          [participantId, programInstanceId, logDescription],
          (err) => (err ? reject(err) : resolve())
        );
      });

      // If all operations were successful, commit the transaction
      await new Promise((resolve, reject) => {
        db.run('COMMIT', (err) => (err ? reject(err) : resolve()));
      });

      /* ------------------------------------------------------------------
       * Trigger dynamic resource rebalancing.  This is intentionally done
       * AFTER the commit so that rebalance reads a consistent state. Any
       * failure here is logged but will NOT invalidate the cancellation.
       * ---------------------------------------------------------------- */
      try {
        // Fire-and-await so that upstream callers can optionally inspect the
        // result in logs, while still guaranteeing the cancellation succeeds.
        await rebalanceResources(programInstanceId);
      } catch (rebalanceErr) {
        console.error(
          `Rebalancing failed after cancellation for PI${programInstanceId}:`,
          rebalanceErr
        );
        // Swallow the error – the core cancellation has already succeeded.
      }

      return { participantId, programInstanceId, status: 'cancelled', type };

    } catch (transactionError) {
      // If any error occurs within the transaction, roll it back
      await new Promise((resolve, reject) => {
        db.run('ROLLBACK', (err) => (err ? reject(err) : resolve()));
      });
      // Re-throw the error to be caught by the outer catch block
      throw transactionError;
    }
  } catch (error) {
    console.error(`Error processing cancellation for participant ${participantId}:`, error);
    throw error; // Propagate the error to the controller
  } finally {
    // Always ensure the database connection is closed
    if (db) {
      db.close((err) => {
        if (err) console.error('Error closing the database connection in cancellationService:', err.message);
      });
    }
  }
};

module.exports = {
  createCancellation,
};
