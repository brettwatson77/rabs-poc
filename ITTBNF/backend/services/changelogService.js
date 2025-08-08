// backend/services/changelogService.js
const { getDbConnection } = require('../database');

/**
 * Fetches a log of all pending enrollment changes that have an effective_date
 * within a given date range. This is used to show an aggregate "what's happening this week"
 * view on the master schedule.
 *
 * @param {string} startDate - The start date of the range (YYYY-MM-DD).
 * @param {string} endDate - The end date of the range (YYYY-MM-DD).
 * @returns {Promise<Array>} A promise that resolves to an array of change log records.
 */
const getWeeklyChangeLog = async (startDate, endDate) => {
  const db = await getDbConnection();
  try {
    const query = `
      SELECT
        pec.id,
        pec.action,
        pec.effective_date,
        p.first_name,
        p.last_name,
        prog.name as program_name
      FROM pending_enrollment_changes pec
      JOIN participants p ON pec.participant_id = p.id
      JOIN programs prog ON pec.program_id = prog.id
      WHERE pec.effective_date BETWEEN ? AND ?
      ORDER BY pec.effective_date, p.last_name
    `;

    const rows = await new Promise((resolve, reject) => {
      db.all(query, [startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
    return rows;
  } finally {
    if (db) {
      db.close();
    }
  }
};

module.exports = {
  getWeeklyChangeLog,
};
