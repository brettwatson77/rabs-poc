// backend/services/recalculationService.js
const { getDbConnection } = require('../database');
// Unified routing dispatcher – automatically chooses Google Maps or the
// nearest-neighbour fallback based on the presence of a GOOGLE_MAPS_API_KEY.
const { calculateRoute } = require('./routingService');

/**
 * Processes pending enrollment changes that are due based on the simulated date.
 * This function finds all pending changes and applies them to the permanent
 * enrollments table within a single database transaction.
 * @param {string} simulatedDate - The current simulated date in 'YYYY-MM-DD' format.
 * @returns {Promise<Object>} An object containing a success message and the number of changes processed.
 */
const processPendingChanges = async (simulatedDate) => {
  let db;
  try {
    // Get a new database connection for this operation
    db = await getDbConnection();

    // Begin a transaction to ensure atomicity
    await new Promise((resolve, reject) => db.run('BEGIN TRANSACTION', (err) => (err ? reject(err) : resolve())));

    try {
      // Find all pending changes that are due
      const findChangesSql = `
        SELECT id, participant_id, program_id, action, effective_date
        FROM pending_enrollment_changes
        WHERE status = 'pending' AND effective_date <= ?
      `;
      const changes = await new Promise((resolve, reject) => {
        db.all(findChangesSql, [simulatedDate], (err, rows) => (err ? reject(err) : resolve(rows)));
      });

      // If there's nothing to do, commit and exit early
      if (changes.length === 0) {
        await new Promise((resolve, reject) => db.run('COMMIT', (err) => (err ? reject(err) : resolve())));
        return { message: 'No pending changes to process.', changesProcessed: 0 };
      }

      // Process each change sequentially within the transaction
      for (const change of changes) {
        let actionSql = '';
        let actionParams = [];

        if (change.action === 'add') {
          // Add a new enrollment record starting from the effective date
          actionSql = `
            INSERT INTO program_enrollments (participant_id, program_id, start_date, end_date)
            VALUES (?, ?, ?, NULL)
          `;
          actionParams = [change.participant_id, change.program_id, change.effective_date];
        } else if (change.action === 'remove') {
          // Set an end date on the existing enrollment
          const effectiveDate = new Date(change.effective_date);
          const dayBefore = new Date(effectiveDate.setDate(effectiveDate.getDate() - 1)).toISOString().split('T')[0];
          
          actionSql = `
            UPDATE program_enrollments
            SET end_date = ?
            WHERE participant_id = ? 
              AND program_id = ? 
              AND (end_date IS NULL OR end_date >= ?)
          `;
          actionParams = [dayBefore, change.participant_id, change.program_id, change.effective_date];
        }

        // Execute the add/remove action
        if (actionSql) {
          await new Promise((resolve, reject) => {
            db.run(actionSql, actionParams, (err) => (err ? reject(err) : resolve()));
          });
        }

        // Mark the pending change as processed
        const updateStatusSql = `
          UPDATE pending_enrollment_changes
          SET status = 'processed'
          WHERE id = ?
        `;
        await new Promise((resolve, reject) => {
          db.run(updateStatusSql, [change.id], (err) => (err ? reject(err) : resolve()));
        });
      }

      // If all changes were processed successfully, commit the transaction
      await new Promise((resolve, reject) => db.run('COMMIT', (err) => (err ? reject(err) : resolve())));

      return {
        message: `Successfully processed ${changes.length} pending changes.`,
        changesProcessed: changes.length,
      };

    } catch (transactionError) {
      // If any error occurs during the transaction, roll it back
      await new Promise((resolve, reject) => db.run('ROLLBACK', (err) => (err ? reject(err) : resolve())));
      // Re-throw the error to be caught by the outer catch block
      throw transactionError;
    }
  } catch (error) {
    // This will catch errors from getting the connection or from the transaction itself
    console.error('Error in processPendingChanges service:', error);
    throw error; // Propagate the error to the controller
  } finally {
    // Always ensure the database connection is closed
    if (db) {
      db.close((err) => {
        if (err) console.error('Error closing the database connection in recalculationService:', err.message);
      });
    }
  }
};

module.exports = {
  processPendingChanges,
};
