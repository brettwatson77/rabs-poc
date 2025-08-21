import { format } from 'date-fns';

/**
 * Format a date string to dd/MM/yyyy format
 * @param {string} dateString - The date string to format
 * @returns {string} Formatted date or 'N/A' if invalid
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return format(new Date(dateString), 'dd/MM/yyyy');
  } catch (error) {
    return 'Invalid Date';
  }
};

/**
 * Calculate age from date of birth
 * @param {string} dateOfBirth - The date of birth string
 * @returns {string|number} Age in years or 'N/A' if invalid
 */
export const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return 'N/A';
  try {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  } catch (error) {
    return 'N/A';
  }
};

/**
 * Get support level badge class
 * @param {string} level - Support level
 * @returns {string} CSS class for badge
 */
export const getSupportLevelBadge = (level) => {
  switch (level) {
    case 'high':
      return 'badge-red';
    case 'medium':
      return 'badge-yellow';
    case 'standard':
      return 'badge-blue';
    case 'low':
      return 'badge-green';
    default:
      return 'badge-gray';
  }
};

/**
 * Get status badge class
 * @param {string} status - Participant status
 * @returns {string} CSS class for badge
 */
export const getStatusBadge = (status) => {
  switch (status) {
    case 'active':
      return 'badge-green';
    case 'inactive':
      return 'badge-gray';
    case 'pending':
      return 'badge-yellow';
    case 'suspended':
      return 'badge-red';
    default:
      return 'badge-gray';
  }
};

/**
 * Get goal status badge class
 * @param {string} status - Goal status
 * @returns {string} CSS class for badge
 */
export const getGoalStatusBadge = (status) => {
  switch (status) {
    case 'completed':
      return 'badge-green';
    case 'in_progress':
      return 'badge-blue';
    case 'not_started':
      return 'badge-gray';
    case 'on_hold':
      return 'badge-yellow';
    case 'cancelled':
      return 'badge-red';
    default:
      return 'badge-gray';
  }
};

/**
 * Get supervision multiplier color
 * @param {number} multiplier - Supervision multiplier value
 * @returns {string} Color hex code
 */
export const getSupervisionColor = (multiplier) => {
  if (multiplier <= 1.0) return '#9e9e9e';
  if (multiplier <= 1.5) return '#4caf50';
  if (multiplier <= 2.0) return '#ff9800';
  return '#e53935';
};

/**
 * Get change type badge class
 * @param {string} type - Change type
 * @returns {string} CSS class for badge
 */
export const getChangeTypeBadge = (type) => {
  switch (type) {
    case 'PROGRAM_JOIN':
      return 'badge-green';
    case 'PROGRAM_LEAVE':
      return 'badge-red';
    case 'PROGRAM_CANCEL':
      return 'badge-yellow';
    case 'BILLING_CODE_CHANGE':
      return 'badge-blue';
    default:
      return 'badge-gray';
  }
};
