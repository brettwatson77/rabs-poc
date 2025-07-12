import axios from 'axios';

// ---------------------------------------------------------------------------
// Environment-aware backend URL helper
//   • Dev (Vite @ :3008 or localhost)  → http://<host>:3009/api/v1
//   • Prod / Staging (same origin)    → https://<origin>/api/v1
// ---------------------------------------------------------------------------

const { protocol, hostname, port, origin } = window.location;

let API_BASE_URL;

// Local dev (Vite) or explicitly running on localhost/127.0.0.1
const isLocalDev =
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  port === '3008';

if (isLocalDev) {
  // Use same host but backend port 3009
  API_BASE_URL = `${protocol}//${hostname}:3009/api/v1`;
} else {
  // Same origin (handles prod domain + any TLS)
  API_BASE_URL = `${origin}/api/v1`;
}

// Create an axios instance with the base URL pre-configured
const api = axios.create({
  baseURL: API_BASE_URL,
});


/* ---------------------------------------------------------------------------
 * Page-Specific Data Fetchers
 * ------------------------------------------------------------------------ */

/**
 * Fetches the master schedule for a given date range.
 * @param {string} startDate - The start date in YYYY-MM-DD format.
 * @param {string} endDate - The end date in YYYY-MM-DD format.
 * @returns {Promise<Array>} A promise that resolves to an array of schedule data.
 */
export const getSchedule = async (startDate, endDate) => {
  try {
    const response = await api.get('/schedule', { params: { startDate, endDate } });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching schedule:', error);
    throw error;
  }
};

/**
 * Fetches the daily roster and route sheet data for a specific date.
 * @param {string} date - The date in YYYY-MM-DD format.
 * @returns {Promise<Object>} A promise that resolves to the roster data object.
 */
export const getRoster = async (date) => {
  try {
    const response = await api.get('/roster', { params: { date } });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching roster:', error);
    throw error;
  }
};

/**
 * Fetches the program enrollments for a specific participant.
 * @param {number} participantId - The ID of the participant.
 * @returns {Promise<Object>} A promise that resolves to an object containing enrollments and available programs.
 */
export const getParticipantEnrollments = async (participantId) => {
  try {
    const response = await api.get(`/planner/${participantId}`);
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching enrollments for participant ${participantId}:`, error);
    throw error;
  }
};

/**
 * Updates the program enrollments for a specific participant.
 * @param {number} participantId - The ID of the participant.
 * @param {Array} enrollments - An array of program IDs to enroll the participant in.
 * @returns {Promise<Object>} A promise that resolves to the result of the update operation.
 */
export const updateParticipantEnrollments = async (participantId, enrollments) => {
  try {
    const response = await api.post(`/planner/${participantId}`, { enrollments });
    return response.data;
  } catch (error) {
    console.error(`Error updating enrollments for participant ${participantId}:`, error);
    throw error;
  }
};

/**
 * Fetches the enrollment-change history log for a specific participant.
 * @param {number} participantId - The ID of the participant.
 * @returns {Promise<Array>} A promise that resolves to an array of change-log records.
 */
export const getParticipantChangeHistory = async (participantId) => {
  try {
    const response = await api.get(`/planner/${participantId}/history`);
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching change history for participant ${participantId}:`, error);
    throw error;
  }
};

/**
 * Fetches the enrollment-only change history (Participant Planner actions)
 * for a specific participant.
 * @param {number} participantId - The ID of the participant.
 * @returns {Promise<Array>} A promise that resolves to an array of planner-history records.
 */
export const getParticipantEnrollmentHistory = async (participantId) => {
  try {
    const response = await api.get(
      `/planner/${participantId}/enrollment-history`
    );
    return response.data.data;
  } catch (error) {
    console.error(
      `Error fetching enrollment history for participant ${participantId}:`,
      error
    );
    throw error;
  }
};

/**
 * Fetches an aggregated change-log for a given date range (typically one week)
 * to display on the Master Schedule page.
 * @param {string} startDate - The start date in YYYY-MM-DD format.
 * @param {string} endDate   - The end date in YYYY-MM-DD format.
 * @returns {Promise<Array>} A promise that resolves to an array of change-log records.
 */
export const getWeeklyChangeLog = async (startDate, endDate) => {
  try {
    const response = await api.get('/changelog/weekly', {
      params: { startDate, endDate },
    });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching weekly change log:', error);
    throw error;
  }
};


/* ---------------------------------------------------------------------------
 * Finance & Billing Helpers
 * ------------------------------------------------------------------------ */

/**
 * A helper function to handle file downloads from the API.
 * @param {Promise<Object>} request - The axios request promise.
 */
const handleFileDownload = async (request) => {
  try {
    const response = await request;
    
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'download.csv';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch && filenameMatch.length > 1) {
        filename = filenameMatch[1];
      }
    }
    
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
};

/**
 * Triggers the download of the agency billing CSV file.
 * @param {string} startDate - The start date in YYYY-MM-DD format.
 * @param {string} endDate - The end date in YYYY-MM-DD format.
 */
export const generateBillingCsv = (startDate, endDate) => {
  const request = api.get('/finance/billing-csv', {
    params: { startDate, endDate },
    responseType: 'blob',
  });
  return handleFileDownload(request);
};

/* ---------------------------------------------------------------------------
 * Attendance & Cancellation Helpers
 * ------------------------------------------------------------------------ */

/**
 * Creates a cancellation record for a participant for a specific program instance.
 * @param {Object} cancellationData - An object containing
 *   participantId, programInstanceId and the cancellation
 *   type (`'normal'` or `'short_notice'`).
 * @returns {Promise<Object>} The backend response.
 *
 * Example payload:
 * {
 *   participantId: 12,
 *   programInstanceId: 345,
 *   type: 'short_notice' // or 'normal'
 * }
 */
export const createCancellation = async (cancellationData) => {
  try {
    const response = await api.post('/cancellations', cancellationData);
    return response.data;
  } catch (error) {
    console.error('Error creating cancellation:', error);
    throw error;
  }
};


/* ---------------------------------------------------------------------------
 * System-level Helpers
 * ------------------------------------------------------------------------ */

/**
 * Tells the backend to process pending enrollment changes and recalculate
 * staffing / vehicle assignments for the provided simulated date.
 * @param {string} simulatedDate - Date string in YYYY-MM-DD format.
 * @returns {Promise<Object>} The backend response.
 */
export const triggerRecalculation = async (simulatedDate) => {
  try {
    const response = await api.post('/recalculate', { simulatedDate });
    return response.data;
  } catch (error) {
    console.error('Error triggering recalculation:', error);
    throw error;
  }
};

/**
 * Permanently commits any pending enrollment changes whose effective date
 * is on or before the provided simulated date.
 * @param {string} simulatedDate - Date string in YYYY-MM-DD format.
 * @returns {Promise<Object>} The backend response.
 */
export const processPendingChanges = async (simulatedDate) => {
  try {
    const response = await api.post('/recalculate/process', { simulatedDate });
    return response.data;
  } catch (error) {
    console.error('Error processing pending changes:', error);
    throw error;
  }
};

/**
 * Resets the entire database and re-runs the seed script on the backend.
 * Handy for quickly returning the POC to a clean state between demos.
 * @returns {Promise<Object>} The backend response.
 */
export const resetSystemData = async () => {
  try {
    const response = await api.post('/system/reset');
    return response.data;
  } catch (error) {
    console.error('Error resetting system data:', error);
    throw error;
  }
};

/**
 * Triggers the download of the plan-managed invoices CSV file.
 * @param {string} startDate - The start date in YYYY-MM-DD format.
 * @param {string} endDate - The end date in YYYY-MM-DD format.
 */
export const generateInvoicesCsv = (startDate, endDate) => {
  const request = api.get('/finance/invoices-csv', {
    params: { startDate, endDate },
    responseType: 'blob',
  });
  return handleFileDownload(request);
};


/* ---------------------------------------------------------------------------
 * Core Data CRUD Helpers
 * ------------------------------------------------------------------------ */

// --- Participants ---
export const getParticipants = async () => {
  try {
    const response = await api.get('/participants');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching participants:', error);
    throw error;
  }
};
export const createParticipant = async (participantData) => {
  try {
    const response = await api.post('/participants', participantData);
    return response.data;
  } catch (error) {
    console.error('Error creating participant:', error);
    throw error;
  }
};
export const updateParticipant = async (participantId, participantData) => {
  try {
    const response = await api.put(`/participants/${participantId}`, participantData);
    return response.data;
  } catch (error) {
    console.error(`Error updating participant ${participantId}:`, error);
    throw error;
  }
};
export const deleteParticipant = async (participantId) => {
  try {
    const response = await api.delete(`/participants/${participantId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting participant ${participantId}:`, error);
    throw error;
  }
};

// --- Programs ---
export const getPrograms = async () => {
  try {
    const response = await api.get('/programs');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching programs:', error);
    throw error;
  }
};

// --- Rate Line Items ---
export const getRateLineItems = async () => {
  try {
    const response = await api.get('/rates');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching rate line items:', error);
    throw error;
  }
};
export const createRateLineItem = async (itemData) => {
  try {
    const response = await api.post('/rates', itemData);
    return response.data;
  } catch (error) {
    console.error('Error creating rate line item:', error);
    throw error;
  }
};
export const updateRateLineItem = async (id, itemData) => {
  try {
    const response = await api.put(`/rates/${id}`, itemData);
    return response.data;
  } catch (error) {
    console.error(`Error updating rate line item ${id}:`, error);
    throw error;
  }
};
export const deleteRateLineItem = async (id) => {
  try {
    const response = await api.delete(`/rates/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting rate line item ${id}:`, error);
    throw error;
  }
};

// --- Staff ---
export const getStaff = async () => {
  try {
    const response = await api.get('/staff');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching staff:', error);
    throw error;
  }
};
export const createStaff = async (staffData) => {
  try {
    const response = await api.post('/staff', staffData);
    return response.data;
  } catch (error) {
    console.error('Error creating staff member:', error);
    throw error;
  }
};
export const updateStaff = async (staffId, staffData) => {
  try {
    const response = await api.put(`/staff/${staffId}`, staffData);
    return response.data;
  } catch (error) {
    console.error(`Error updating staff member ${staffId}:`, error);
    throw error;
  }
};
export const deleteStaff = async (staffId) => {
  try {
    const response = await api.delete(`/staff/${staffId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting staff member ${staffId}:`, error);
    throw error;
  }
};

// --- Venues ---
export const getVenues = async () => {
  try {
    const response = await api.get('/venues');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching venues:', error);
    throw error;
  }
};
export const createVenue = async (venueData) => {
  try {
    const response = await api.post('/venues', venueData);
    return response.data;
  } catch (error) {
    console.error('Error creating venue:', error);
    throw error;
  }
};
export const updateVenue = async (venueId, venueData) => {
  try {
    const response = await api.put(`/venues/${venueId}`, venueData);
    return response.data;
  } catch (error) {
    console.error(`Error updating venue ${venueId}:`, error);
    throw error;
  }
};
export const deleteVenue = async (venueId) => {
  try {
    const response = await api.delete(`/venues/${venueId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting venue ${venueId}:`, error);
    throw error;
  }
};

// --- Vehicles ---
export const getVehicles = async () => {
  try {
    const response = await api.get('/vehicles');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    throw error;
  }
};
export const createVehicle = async (vehicleData) => {
  try {
    const response = await api.post('/vehicles', vehicleData);
    return response.data;
  } catch (error) {
    console.error('Error creating vehicle:', error);
    throw error;
  }
};
export const updateVehicle = async (vehicleId, vehicleData) => {
  try {
    const response = await api.put(`/vehicles/${vehicleId}`, vehicleData);
    return response.data;
  } catch (error) {
    console.error(`Error updating vehicle ${vehicleId}:`, error);
    throw error;
  }
};
export const deleteVehicle = async (vehicleId) => {
  try {
    const response = await api.delete(`/vehicles/${vehicleId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting vehicle ${vehicleId}:`, error);
    throw error;
  }
};


/* ---------------------------------------------------------------------------
 * Staff-Assignment Helpers
 * ------------------------------------------------------------------------ */

/**
 * Fetch a list of available (and currently assigned) staff for a program instance.
 * @param {number} programInstanceId
 * @returns {Promise<Object>} Object containing `availableStaff` & `assignedStaff` arrays.
 */
export const getAvailableStaff = async (programInstanceId) => {
  try {
    const response = await api.get('/staff-assignments/available', {
      params: { programInstanceId },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching available staff:', error);
    throw error;
  }
};

/**
 * Replace one staff member with another for a single program instance.
 * @param {number} programInstanceId
 * @param {string} oldStaffId
 * @param {string} newStaffId
 * @param {string} role - Optional override role (e.g. 'lead', 'support')
 */
export const updateSingleStaffAssignment = async (
  programInstanceId,
  oldStaffId,
  newStaffId,
  role = undefined,
) => {
  try {
    const response = await api.put(
      `/staff-assignments/${programInstanceId}/single`,
      { oldStaffId, newStaffId, role },
    );
    return response.data;
  } catch (error) {
    console.error('Error updating single staff assignment:', error);
    throw error;
  }
};

/**
 * Replace a staff member across ALL future instances of a program ("forever" option).
 * @param {number} programId
 * @param {string} oldStaffId
 * @param {string} newStaffId
 * @param {string} role
 * @param {string} startDate - YYYY-MM-DD date from which the change applies
 */
export const updateRecurringStaffAssignment = async (
  programId,
  oldStaffId,
  newStaffId,
  role,
  startDate,
) => {
  try {
    const response = await api.put(
      `/staff-assignments/${programId}/recurring`,
      { oldStaffId, newStaffId, role, startDate },
    );
    return response.data;
  } catch (error) {
    console.error('Error updating recurring staff assignment:', error);
    throw error;
  }
};

/**
 * Manually add a staff member to a single program instance.
 */
export const addStaffAssignment = async (
  programInstanceId,
  staffId,
  role = 'support',
) => {
  try {
    const response = await api.post(`/staff-assignments/${programInstanceId}`, {
      staffId,
      role,
    });
    return response.data;
  } catch (error) {
    console.error('Error adding staff assignment:', error);
    throw error;
  }
};

/**
 * Remove a staff assignment by its assignment ID.
 */
export const removeStaffAssignment = async (assignmentId) => {
  try {
    const response = await api.delete(`/staff-assignments/${assignmentId}`);
    return response.data;
  } catch (error) {
    console.error('Error removing staff assignment:', error);
    throw error;
  }
};

/**
 * Get contracted vs allocated hours for a staff member in the current (or given) fortnight.
 * @param {string} staffId
 * @param {string} [startDate] - optional YYYY-MM-DD start of fortnight
 * @param {string} [endDate]   - optional YYYY-MM-DD end of fortnight
 */
export const getStaffHours = async (staffId, startDate, endDate) => {
  try {
    const response = await api.get(`/staff-assignments/hours/${staffId}`, {
      params: { startDate, endDate },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching staff hours:', error);
    throw error;
  }
};


/* ---------------------------------------------------------------------------
 * Dynamic Resource-Allocation Helpers
 * ------------------------------------------------------------------------ */

/**
 * Rebalance staff & vehicle resources for a specific program instance.
 * @param {number} programInstanceId
 * @returns {Promise<Object>} Result object with new allocation summary.
 */
export const triggerRebalance = async (programInstanceId) => {
  try {
    const response = await api.post(
      `/dynamic-resources/rebalance/${programInstanceId}`
    );
    return response.data;
  } catch (error) {
    console.error(
      `Error triggering rebalance for program instance ${programInstanceId}:`,
      error
    );
    throw error;
  }
};

/**
 * Notify backend of a participant change (add / cancel / leave) so it can
 * auto-rebalance resources.
 * @param {number} participantId
 * @param {number} programInstanceId
 * @param {'add'|'cancel'|'leave'} changeType
 */
export const handleParticipantChange = async (
  participantId,
  programInstanceId,
  changeType
) => {
  try {
    const response = await api.post(`/dynamic-resources/participant-change`, {
      participantId,
      programInstanceId,
      changeType,
    });
    return response.data;
  } catch (error) {
    console.error('Error handling participant change:', error);
    throw error;
  }
};

/**
 * Get current resource allocation status for a program instance.
 * @param {number} programInstanceId
 */
export const getResourceStatus = async (programInstanceId) => {
  try {
    const response = await api.get(
      `/dynamic-resources/status/${programInstanceId}`
    );
    return response.data.data;
  } catch (error) {
    console.error(
      `Error fetching resource status for program instance ${programInstanceId}:`,
      error
    );
    throw error;
  }
};

/**
 * Optimise pickup/drop-off routes for a program instance.
 * @param {number} programInstanceId
 */
export const optimizeRoutes = async (programInstanceId) => {
  try {
    const response = await api.post(
      `/dynamic-resources/optimize-routes/${programInstanceId}`
    );
    return response.data;
  } catch (error) {
    console.error(
      `Error optimising routes for program instance ${programInstanceId}:`,
      error
    );
    throw error;
  }
};

/**
 * Get detailed route information (including stops) for a program instance.
 * @param {number} programInstanceId
 */
export const getRouteDetails = async (programInstanceId) => {
  try {
    const response = await api.get(
      `/dynamic-resources/routes/${programInstanceId}`
    );
    return response.data.data;
  } catch (error) {
    console.error(
      `Error fetching route details for program instance ${programInstanceId}:`,
      error
    );
    throw error;
  }
};

/**
 * Create a new dynamic program that will auto-allocate resources.
 * @param {Object} programData – payload accepted by backend (/programs)
 */
export const createDynamicProgram = async (programData) => {
  try {
    const response = await api.post('/dynamic-resources/programs', programData);
    return response.data;
  } catch (error) {
    console.error('Error creating dynamic program:', error);
    throw error;
  }
};
