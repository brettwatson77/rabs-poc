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

/**
 * Parse a database date string back to a JavaScript Date object
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date|null} JavaScript Date object or null if invalid
 */
const parseDbDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  return new Date(year, month - 1, day); // month is 0-indexed
};

/**
 * Get today's date in Sydney timezone as YYYY-MM-DD string
 * @returns {string} Today's date in Sydney timezone
 */
const getTodaySydney = () => {
  const now = new Date();
  // Use Intl API to convert to Australia/Sydney timezone
  const sydneyDate = new Date(
    now.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })
  );
  return formatDateForApi(sydneyDate);
};

/**
 * Validate if a string is a valid date in YYYY-MM-DD format
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid date format and real date
 */
const isValidDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return false;

  // Quick format check
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;

  // Validate actual date
  const date = new Date(dateStr);
  return (
    date instanceof Date &&
    !isNaN(date.getTime()) &&
    date.toISOString().startsWith(dateStr)
  );
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
  formatDateForDb: formatDateForApi,
  // Newly added helpers
  parseDbDate,
  getTodaySydney,
  isValidDate
};
