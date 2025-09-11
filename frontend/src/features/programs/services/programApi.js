import api from '../../../api/api';

// Minimal wrapper used by extracted components; composes existing endpoints.
const programApi = {
  // Create draft rule
  create: async () => api.post('/templates/rules'),

  // Patch rule fields
  patch: async (id, body) => api.patch(`/templates/rules/${id}`, body),

  // Finalize
  finalize: async (id) => api.post(`/templates/rules/${id}/finalize`),

  // Slots
  getSlots: async (id) => api.get(`/templates/rules/${id}/slots`),
  addSlot: async (id, slot) => api.post(`/templates/rules/${id}/slots`, slot),
  deleteSlot: async (id, slotId) => api.delete(`/templates/rules/${id}/slots/${slotId}`),

  // Requirements
  getRequirements: async (id) => api.get(`/templates/rules/${id}/requirements`),

  // Participants (basic list for selection)
  listParticipants: async () => api.get('/participants'),

  // Venues
  listVenues: async () => api.get('/venues'),
  createVenue: async (body) => api.post('/venues', body),

  // Staff & Vehicles catalog
  listStaff: async () => api.get('/staff'),
  listVehicles: async () => api.get('/vehicles'),

  // Placeholders
  getStaffPlaceholders: async (id) => api.get(`/templates/rules/${id}/staff-placeholders`),
  addStaffPlaceholder: async (id, body) => api.post(`/templates/rules/${id}/staff-placeholders`, body),
  deleteStaffPlaceholder: async (id, phId) => api.delete(`/templates/rules/${id}/staff-placeholders/${phId}`),

  getVehiclePlaceholders: async (id) => api.get(`/templates/rules/${id}/vehicle-placeholders`),
  addVehiclePlaceholder: async (id, body) => api.post(`/templates/rules/${id}/vehicle-placeholders`, body),
  deleteVehiclePlaceholder: async (id, phId) => api.delete(`/templates/rules/${id}/vehicle-placeholders/${phId}`),
  updateVehiclePlaceholder: async (id, phId, body) => api.patch(`/templates/rules/${id}/vehicle-placeholders/${phId}`, body),

  // Composite preload for Edit: gather what we can without adding endpoints
  preloadById: async (id) => {
    const [req, slots, staffPH, vehPH, participants, staff, vehicles, venues] = await Promise.all([
      api.get(`/templates/rules/${id}/requirements`).catch(() => ({ data: { data: null }})),
      api.get(`/templates/rules/${id}/slots`).catch(() => ({ data: { data: [] }})),
      api.get(`/templates/rules/${id}/staff-placeholders`).catch(() => ({ data: { data: [] }})),
      api.get(`/templates/rules/${id}/vehicle-placeholders`).catch(() => ({ data: { data: [] }})),
      api.get('/participants').catch(() => ({ data: { data: [] }})),
      api.get('/staff').catch(() => ({ data: { data: [] }})),
      api.get('/vehicles').catch(() => ({ data: { data: [] }})),
      api.get('/venues').catch(() => ({ data: { data: [] }})),
    ]);

    return {
      requirements: req?.data?.data || null,
      slots: slots?.data?.data || [],
      staffPlaceholders: staffPH?.data?.data || [],
      vehiclePlaceholders: vehPH?.data?.data || [],
      participants: participants?.data?.data || [],
      staff: staff?.data?.data || [],
      vehicles: vehicles?.data?.data || [],
      venues: venues?.data?.data || [],
      // Note: rule fields (name, description, etc.) don't have a GET; leave blank for now.
    };
  },
};

export default programApi;
