/**
 * Validators Utility
 * 
 * Common validation functions for use throughout the backend controllers.
 * Provides helpers for validating UUIDs, dates, times, emails, phone numbers, etc.
 */

/**
 * Validates if a string is a valid UUID
 * @param {string} uuid - The UUID string to validate
 * @returns {boolean} - True if valid UUID, false otherwise
 */
const isValidUUID = (uuid) => {
  if (!uuid) return false;
  
  // UUID v4 regex pattern
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Validates if a string is a valid date in YYYY-MM-DD format
 * @param {string} date - The date string to validate
 * @returns {boolean} - True if valid date, false otherwise
 */
const isValidDate = (date) => {
  if (!date) return false;
  
  // Check format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  
  // Check if it's a valid date (not just format)
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  
  return (
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day
  );
};

/**
 * Validates if a string is a valid time in HH:MM or HH:MM:SS format
 * @param {string} time - The time string to validate
 * @returns {boolean} - True if valid time, false otherwise
 */
const isValidTime = (time) => {
  if (!time) return false;
  
  // Check format (HH:MM or HH:MM:SS)
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
  return timeRegex.test(time);
};

/**
 * Validates if a string is a valid email
 * @param {string} email - The email to validate
 * @returns {boolean} - True if valid email, false otherwise
 */
const isValidEmail = (email) => {
  if (!email) return false;
  
  // Simple email regex (for basic validation)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates if a string is a valid phone number
 * Accepts various formats: +61412345678, 0412 345 678, (02) 1234 5678, etc.
 * @param {string} phone - The phone number to validate
 * @returns {boolean} - True if valid phone number, false otherwise
 */
const isValidPhoneNumber = (phone) => {
  if (!phone) return false;
  
  // Remove spaces, dashes, parentheses
  const cleanedPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // Australian phone number formats (mobile, landline with area code)
  // Also allows international format with country code
  const phoneRegex = /^(?:\+?61|0)[2-478](?:[ -]?[0-9]){8}$/;
  return phoneRegex.test(cleanedPhone);
};

/**
 * Sanitizes a string by removing potentially dangerous characters
 * @param {string} str - The string to sanitize
 * @returns {string} - Sanitized string
 */
const sanitizeString = (str) => {
  if (!str) return '';
  
  // Remove HTML tags and special characters
  return String(str)
    .replace(/<[^>]*>/g, '')
    .replace(/[<>&"'`]/g, (match) => {
      switch (match) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        case "'": return '&#x27;';
        case '`': return '&#x60;';
        default: return match;
      }
    });
};

/**
 * Validates if a value is a positive number
 * @param {number|string} value - The value to validate
 * @returns {boolean} - True if positive number, false otherwise
 */
const isPositiveNumber = (value) => {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
};

/**
 * Validates if a value is a non-negative number (zero or positive)
 * @param {number|string} value - The value to validate
 * @returns {boolean} - True if non-negative number, false otherwise
 */
const isNonNegativeNumber = (value) => {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0;
};

/**
 * Validates if a value is within a specified range
 * @param {number|string} value - The value to validate
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {boolean} - True if within range, false otherwise
 */
const isInRange = (value, min, max) => {
  const num = parseFloat(value);
  return !isNaN(num) && num >= min && num <= max;
};

/**
 * Validates if a string has a minimum length
 * @param {string} str - The string to validate
 * @param {number} minLength - Minimum length required
 * @returns {boolean} - True if string meets minimum length, false otherwise
 */
const hasMinLength = (str, minLength) => {
  if (!str) return false;
  return String(str).length >= minLength;
};

/**
 * Validates if a string does not exceed maximum length
 * @param {string} str - The string to validate
 * @param {number} maxLength - Maximum length allowed
 * @returns {boolean} - True if string does not exceed maximum length, false otherwise
 */
const hasMaxLength = (str, maxLength) => {
  if (!str) return true; // Empty string is valid for max length check
  return String(str).length <= maxLength;
};

/**
 * Validates if a string is alphanumeric (letters and numbers only)
 * @param {string} str - The string to validate
 * @returns {boolean} - True if alphanumeric, false otherwise
 */
const isAlphanumeric = (str) => {
  if (!str) return false;
  return /^[a-zA-Z0-9]+$/.test(str);
};

/**
 * Validates if a value is a valid boolean (true/false, 0/1, "true"/"false")
 * @param {any} value - The value to validate
 * @returns {boolean} - True if valid boolean representation, false otherwise
 */
const isValidBoolean = (value) => {
  if (typeof value === 'boolean') return true;
  if (value === 0 || value === 1) return true;
  if (typeof value === 'string') {
    const lowercased = value.toLowerCase();
    return lowercased === 'true' || lowercased === 'false' || lowercased === '0' || lowercased === '1';
  }
  return false;
};

module.exports = {
  isValidUUID,
  isValidDate,
  isValidTime,
  isValidEmail,
  isValidPhoneNumber,
  sanitizeString,
  isPositiveNumber,
  isNonNegativeNumber,
  isInRange,
  hasMinLength,
  hasMaxLength,
  isAlphanumeric,
  isValidBoolean
};
