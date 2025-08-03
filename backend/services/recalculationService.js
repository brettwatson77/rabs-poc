// backend/services/recalculationService.js
const { pool } = require('../database');
// Unified routing dispatcher – automatically chooses Google Maps or the
// nearest-neighbour fallback based on the presence of a GOOGLE_MAPS_API_KEY.
const { calculateRoute } = require('./routingService');
const logger = require('../utils/logger');

/**
 * Processes pending enrollment changes that are due based on the simulated date.
 * This function finds all pending changes and applies them to the permanent
 * enrollments table within a single database transaction.
 * @param {string} simulatedDate - The current simulated date in 'YYYY-MM-DD' format.
 * @returns {Promise<Object>} An object containing a success message and the number of changes processed.
 */
const processPendingChanges = async (simulatedDate) => {
  const client = await pool.connect();
  
  try {
    // Begin a transaction to ensure atomicity
    await client.query('BEGIN');

    try {
      // Find all pending changes that are due
      const findChangesSql = `
        SELECT id, participant_id, program_id, action, effective_date
        FROM pending_enrollment_changes
        WHERE status = 'pending' AND effective_date <= $1
      `;
      const { rows: changes } = await client.query(findChangesSql, [simulatedDate]);

      // If there's nothing to do, commit and exit early
      if (changes.length === 0) {
        await client.query('COMMIT');
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
            VALUES ($1, $2, $3, NULL)
          `;
          actionParams = [change.participant_id, change.program_id, change.effective_date];
        } else if (change.action === 'remove') {
          // Set an end date on the existing enrollment
          const effectiveDate = new Date(change.effective_date);
          const dayBefore = new Date(effectiveDate.setDate(effectiveDate.getDate() - 1)).toISOString().split('T')[0];
          
          actionSql = `
            UPDATE program_enrollments
            SET end_date = $1
            WHERE participant_id = $2 
              AND program_id = $3 
              AND (end_date IS NULL OR end_date >= $4)
          `;
          actionParams = [dayBefore, change.participant_id, change.program_id, change.effective_date];
        }

        // Execute the add/remove action
        if (actionSql) {
          await client.query(actionSql, actionParams);
        }

        // Mark the pending change as processed
        const updateStatusSql = `
          UPDATE pending_enrollment_changes
          SET status = 'processed'
          WHERE id = $1
        `;
        await client.query(updateStatusSql, [change.id]);
      }

      // If all changes were processed successfully, commit the transaction
      await client.query('COMMIT');

      return {
        message: `Successfully processed ${changes.length} pending changes.`,
        changesProcessed: changes.length,
      };

    } catch (transactionError) {
      // If any error occurs during the transaction, roll it back
      await client.query('ROLLBACK');
      // Re-throw the error to be caught by the outer catch block
      throw transactionError;
    }
  } catch (error) {
    // This will catch errors from getting the connection or from the transaction itself
    logger.error('Error in processPendingChanges service:', { error });
    throw error; // Propagate the error to the controller
  } finally {
    // Release the client back to the pool
    client.release();
  }
};

module.exports = {
  processPendingChanges,
};
