/**
 * Shared date utility functions to ensure consistent, timezone-aware
 * date handling across the backend application.
 */

/**
 * Formats a JavaScript Date object into a 'YYYY-MM-DD' string,
 * correctly reflecting the local timezone. This avoids the off-by-one-day
 * errors that can occur when using .toISOString() in timezones behind UTC.
 *
 * @param {Date} date - The date object to format.
 * @returns {string} The formatted date string (e.g., "2025-07-02").
 */
const formatDateForApi = (date) => {
  if (!date || !(date instanceof Date)) {
    console.error("Invalid date provided to formatDateForApi:", date);
    return '';
  }

  const year = date.getFullYear();
  // getMonth() is 0-indexed, so we add 1. Pad with '0' if needed.
  const month = String(date.getMonth() + 1).padStart(2, '0');
  // Pad the day with '0' if needed.
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

module.exports = {
  formatDateForApi,
  /**
   * Alias of formatDateForApi. The backend often refers to `formatDateForDb`
   * when inserting or querying dates. Both functions produce the exact same
   * YYYY-MM-DD string, so we simply expose the existing implementation under
   * a different name for convenience and backward-compatibility.
   *
   * @type {(date: Date) => string}
   */
  formatDateForDb: formatDateForApi
};
