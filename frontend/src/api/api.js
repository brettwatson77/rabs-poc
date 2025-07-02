import axios from 'axios';

// Define the base URL for the backend API
const API_BASE_URL = 'http://localhost:3009/api/v1';

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
