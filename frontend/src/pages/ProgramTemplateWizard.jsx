import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { toast } from 'react-toastify';
import { 
  FiSave, 
  FiPlusCircle, 
  FiUsers, 
  FiCalendar,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiList,
  FiTrash2,
  FiLink,
  FiX,
  FiChevronDown,
  FiChevronRight,
  FiMapPin,
  FiRepeat,
  FiUserCheck,
  FiTruck,
  FiCheck
} from 'react-icons/fi';
import { ProgramFormProvider } from '../features/programs/context/ProgramFormContext';
import ProgramDetailsPanel from '../features/programs/components/ProgramDetailsPanel';
import TimeSlotsEditor from '../features/programs/components/TimeSlotsEditor';

const ProgramTemplateWizard = () => {
  const navigate = useNavigate();
  
  // State for rule data
  const [ruleId, setRuleId] = useState(null);
  const [ruleName, setRuleName] = useState('New Program');
  const [ruleDescription, setRuleDescription] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [anchorDate, setAnchorDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [recurrencePattern, setRecurrencePattern] = useState('fortnightly');
  const [venueId, setVenueId] = useState('');
  // NEW: program type (standard | program | user_select_program)
  const [programType, setProgramType] = useState('standard');
  
  // State for UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState('');
  const [addedParticipantIds, setAddedParticipantIds] = useState([]);
  const [venues, setVenues] = useState([]);
  const [requirements, setRequirements] = useState({
    participant_count: 0,
    wpu_total: 0,
    staff_required: 0,
    vehicles_required: 0,
    staff_threshold_per_wpu: 5,
    vehicle_trigger_every_n_participants: 10
  });
  const [openParticipants, setOpenParticipants] = useState({});
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  // State for PC functionality
  const [pcMenuOpenId, setPcMenuOpenId] = useState(null);
  const [pcSelections, setPcSelections] = useState({});
  
  // Helper to update last updated timestamp
  const updateLastUpdated = () => setLastUpdated(new Date());
  
  // Toggle participant open state
  const toggleParticipantOpen = (id) => setOpenParticipants(prev => ({...prev, [id]: !prev[id]}));

  // State for new venue form
  const [showNewVenueForm, setShowNewVenueForm] = useState(false);
  const [newVenue, setNewVenue] = useState({
    name: '',
    address: '',
    postcode: '',
    contact_phone: '',
    contact_email: '',
    capacity: '',
    include_in_transport: false,
    accessibility_features: '',
    venue_type: '',
    is_active: true
  });

  // State for time slots
  const [slots, setSlots] = useState([]);
  const [newSlot, setNewSlot] = useState({
    slot_type: 'activity',
    start_time: '09:00',
    end_time: '15:00',
    label: ''
  });

  // State for billing
  const [billingCodes, setBillingCodes] = useState([]);
  const [participantBilling, setParticipantBilling] = useState({});
  const [addedParticipants, setAddedParticipants] = useState([]);

  // Map of rpp_id -> array of staged billing lines
  const [billingLines, setBillingLines] = useState({});
  
  // State for staff and vehicles
  const [staffList, setStaffList] = useState([]);
  const [vehiclesList, setVehiclesList] = useState([]);
  const [staffPlaceholders, setStaffPlaceholders] = useState([]);
  const [vehiclePlaceholders, setVehiclePlaceholders] = useState([]);

  // ---------------------------------------------------------------
  // NEW: participant address details + prefs
  // ---------------------------------------------------------------
  // Cache of participant_id -> full record (including addresses)
  const [participantDetails, setParticipantDetails] = useState({});
  // Map of rule_participant_id -> { pickup: 'primary'|'secondary', dropoff: same }
  const [addressPrefs, setAddressPrefs] = useState({});
  
  // Currency formatter helper
  const formatCurrency = (amount) => {
    return `$${(parseFloat(amount) || 0).toFixed(2)}`;
  };

  /* --------------------------------------------------------------
     Helpers for pickup / drop-off address handling
     -------------------------------------------------------------- */
  const fetchParticipantDetailsFull = async (pid) => {
    if (!pid || participantDetails[pid]) return;
    try {
      const resp = await api.get(`/participants/${pid}`);
      if (resp.data.success && resp.data.data) {
        setParticipantDetails((prev) => ({ ...prev, [pid]: resp.data.data }));
      }
    } catch (e) {
      console.warn('Failed to fetch participant details:', e);
    }
  };

  const buildAddressString = (addr) => {
    if (!addr) return '';
    const parts = [
      addr.line1 || addr.address || '',
      addr.suburb,
      addr.state,
      addr.postcode,
    ]
      .filter(Boolean)
      .join(', ');
    return parts;
  };

  const getPrimaryAddressLabel = (p) =>
    buildAddressString({
      line1: p.address,
      suburb: p.suburb,
      state: p.state,
      postcode: p.postcode,
    });

  const getSecondaryAddressLabel = (details) => {
    if (!details) return '';
    // prefer nested structure
    if (details.addresses?.secondary) {
      return buildAddressString(details.addresses.secondary);
    }
    // fallback to flattened fields
    return buildAddressString({
      line1: details.secondary_address_line1,
      suburb: details.secondary_address_suburb,
      state: details.secondary_address_state,
      postcode: details.secondary_address_postcode,
    });
  };

  const updateAddressPref = async (rppId, field, value) => {
    // Translate backend field name → local state key
    const localKey =
      field === 'pickup_address_pref'
        ? 'pickup'
        : field === 'dropoff_address_pref'
        ? 'dropoff'
        : field;

    setAddressPrefs((prev) => ({
      ...prev,
      [rppId]: { ...prev[rppId], [localKey]: value },
    }));
    if (!ruleId) return;
    try {
      await api.patch(
        `/templates/rules/${ruleId}/participants/${rppId}`,
        { [field]: value }
      );
    } catch (e) {
      console.error('Pref update failed:', e);
      toast.error('Failed to save address preference');
    }
  };

  // Derive day of week from anchor date
  useEffect(() => {
    if (anchorDate) {
      const date = new Date(anchorDate);
      if (!isNaN(date.getTime())) {
        // getDay returns 0 for Sunday, but we want 1-7 where 1 is Monday and 7 is Sunday
        const day = date.getDay();
        const adjustedDay = day === 0 ? 7 : day;
        setDayOfWeek(adjustedDay);
      }
    }
  }, [anchorDate]);
  
  // Auto-prefill next time slot based on last slot's end time
  useEffect(() => {
    if (slots.length > 0) {
      // Sort slots by sequence
      const sortedSlots = [...slots].sort((a, b) => a.seq - b.seq);
      const lastSlot = sortedSlots[sortedSlots.length - 1];
      
      // Set next slot's start time to last slot's end time
      const startTime = lastSlot.end_time;
      
      // Calculate end time as start time + 1 hour (bounded to 23:59)
      let [hours, minutes] = startTime.split(':').map(Number);
      hours += 1;
      if (hours >= 24) hours = 23;
      if (hours === 23 && minutes > 0) minutes = 59;
      const endTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      setNewSlot(prev => ({
        ...prev,
        start_time: startTime,
        end_time: endTime
      }));
    }
  }, [slots]);
  
  /* ------------------------------------------------------------------
     Persist program_type whenever it changes (after draft created)
     ------------------------------------------------------------------ */
  useEffect(() => {
    if (!ruleId) return;
    (async () => {
      try {
        await api.patch(`/templates/rules/${ruleId}`, {
          program_type: programType,
        });
      } catch (err) {
        console.error('Error saving program type:', err);
        toast.error('Failed to save program type');
      }
    })();
  }, [programType, ruleId]);

  // Create draft rule on component mount
  useEffect(() => {
    const createDraftRule = async () => {
      try {
        setLoading(true);
        const response = await api.post('/templates/rules');
        if (response.data.success && response.data.data) {
          const ruleId = response.data.data.id;
          setRuleId(ruleId);
          // After getting rule ID, fetch participants and venues
          fetchParticipants();
          fetchVenues();
          fetchBillingCodes();
          fetchStaff();
          fetchVehicles();
          // Start polling requirements
          fetchRequirements(ruleId);
          // Fetch slots if any
          fetchSlots(ruleId);
          // Fetch placeholders
          fetchStaffPlaceholders(ruleId);
          fetchVehiclePlaceholders(ruleId);
        } else {
          throw new Error('Failed to create draft rule');
        }
      } catch (err) {
        console.error('Error creating draft rule:', err);
        setError('Failed to create draft rule. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    createDraftRule();
  }, []);
  
  // Fetch participants for dropdown
  const fetchParticipants = async () => {
    try {
      const response = await api.get('/participants');
      if (response.data.success && response.data.data) {
        setParticipants(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching participants:', err);
      toast.error('Failed to load participants');
    }
  };
  
  // Fetch venues for dropdown
  const fetchVenues = async () => {
    try {
      const response = await api.get('/venues');
      if (response.data.success && response.data.data) {
        setVenues(response.data.data);
        // Set default venue if available
        if (response.data.data.length > 0) {
          setVenueId(response.data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching venues:', err);
      toast.error('Failed to load venues');
    }
  };

  // Fetch staff list
  const fetchStaff = async () => {
    try {
      const response = await api.get('/staff');
      if (response.data.success && response.data.data) {
        setStaffList(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching staff:', err);
      toast.error('Failed to load staff');
    }
  };

  // Fetch vehicles list
  const fetchVehicles = async () => {
    try {
      const response = await api.get('/vehicles');
      if (response.data.success && response.data.data) {
        setVehiclesList(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching vehicles:', err);
      toast.error('Failed to load vehicles');
    }
  };

  // Fetch staff placeholders
  const fetchStaffPlaceholders = async (id) => {
    if (!id) return;
    try {
      const response = await api.get(`/templates/rules/${id}/staff-placeholders`);
      if (response.data.success && response.data.data) {
        setStaffPlaceholders(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching staff placeholders:', err);
      // Don't show toast for initial fetch
    }
  };

  // Fetch vehicle placeholders
  const fetchVehiclePlaceholders = async (id) => {
    if (!id) return;
    try {
      const response = await api.get(`/templates/rules/${id}/vehicle-placeholders`);
      if (response.data.success && response.data.data) {
        setVehiclePlaceholders(response.data.data);
        
        // Initialize pcSelections with existing pc_participant_ids
        const newSelections = { ...pcSelections };
        response.data.data.forEach(placeholder => {
          if (placeholder.mode === 'pc' && placeholder.pc_participant_ids) {
            newSelections[placeholder.id] = new Set(placeholder.pc_participant_ids);
          }
        });
        setPcSelections(newSelections);
      }
    } catch (err) {
      console.error('Error fetching vehicle placeholders:', err);
      // Don't show toast for initial fetch
    }
  };

  /* --------------------------------------------------------------------- */
  /* Auto-fill vehicle placeholders to satisfy requirements                */
  /* --------------------------------------------------------------------- */
  useEffect(() => {
    if (!ruleId) return;
    const needed = Math.max(
      0,
      requirements.vehicles_required - vehiclePlaceholders.length
    );
    if (needed > 0) {
      (async () => {
        try {
          setSaving(true);
          for (let i = 0; i < needed; i++) {
            await api.post(
              `/templates/rules/${ruleId}/vehicle-placeholders`,
              { mode: 'auto', vehicle_id: null }
            );
          }
          // refresh local list
          fetchVehiclePlaceholders(ruleId);
        } catch (e) {
          console.error('Auto-fill vehicle placeholders failed:', e);
        } finally {
          setSaving(false);
        }
      })();
    }
  }, [ruleId, requirements.vehicles_required, vehiclePlaceholders.length]);

  // Fetch billing codes
  const fetchBillingCodes = async () => {
    try {
      const response = await api.get('/finance/billing-codes');
      if (response.data.success && response.data.data) {
        setBillingCodes(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching billing codes:', err);
      toast.error('Failed to load billing codes');
    }
  };

  // Fetch slots for a rule
  const fetchSlots = async (id) => {
    if (!id) return;
    
    try {
      const response = await api.get(`/templates/rules/${id}/slots`);
      if (response.data.success && response.data.data) {
        setSlots(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
      // Don't show toast for initial fetch
    }
  };
  
  // Fetch requirements (staff/vehicles needed)
  const fetchRequirements = async (id) => {
    if (!id) return;
    
    try {
      const response = await api.get(`/templates/rules/${id}/requirements`);
      if (response.data.success && response.data.data) {
        setRequirements(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching requirements:', err);
      // Don't show toast for requirements errors as it's polled
    }
  };
  
  // Create new venue
  const createVenue = async () => {
    if (!newVenue.name.trim() || !newVenue.address.trim()) {
      toast.error('Venue name and address are required');
      return;
    }

    try {
      setSaving(true);
      const response = await api.post('/venues', newVenue);

      if (response.data.success && response.data.data) {
        const createdVenue = response.data.data;
        setVenues([...venues, createdVenue]);
        setVenueId(createdVenue.id);
        setShowNewVenueForm(false);
        setNewVenue({
          name: '',
          address: '',
          postcode: '',
          contact_phone: '',
          contact_email: '',
          capacity: '',
          include_in_transport: false,
          accessibility_features: '',
          venue_type: '',
          is_active: true
        });
        toast.success('New venue created');
        updateLastUpdated();
      } else {
        throw new Error('Failed to create venue');
      }
    } catch (err) {
      console.error('Error creating venue:', err);
      toast.error('Failed to create venue');
    } finally {
      setSaving(false);
    }
  };
  
  // Add a time slot
  const addSlot = async () => {
    if (!ruleId) return;
    
    try {
      setSaving(true);
      // Calculate next sequence number
      const seq = slots.length > 0 ? Math.max(...slots.map(s => s.seq)) + 1 : 1;
      
      const slotToAdd = {
        ...newSlot,
        seq
      };
      
      const response = await api.post(`/templates/rules/${ruleId}/slots`, slotToAdd);
      
      if (response.data.success) {
        toast.success('Time slot added');
        // Fetch updated slots - the useEffect will auto-update the next slot times
        fetchSlots(ruleId);
        updateLastUpdated();
      } else {
        throw new Error('Failed to add slot');
      }
    } catch (err) {
      console.error('Error adding slot:', err);
      toast.error('Failed to add time slot');
    } finally {
      setSaving(false);
    }
  };

  // Delete a time slot
  const deleteSlot = async (slotId) => {
    if (!ruleId || !slotId) return;
    
    try {
      setSaving(true);
      const response = await api.delete(`/templates/rules/${ruleId}/slots/${slotId}`);
      
      if (response.data.success) {
        toast.success('Time slot deleted');
        // Refresh slots
        fetchSlots(ruleId);
        updateLastUpdated();
      } else {
        throw new Error('Failed to delete slot');
      }
    } catch (err) {
      console.error('Error deleting slot:', err);
      toast.error('Failed to delete time slot');
    } finally {
      setSaving(false);
    }
  };

  // Helper to add staff placeholders up to requirements + 1 extra
  const addExtraStaffShift = async () => {
    if (!ruleId) return;
    
    try {
      setSaving(true);
      
      // Calculate how many placeholders we need to add to meet requirements + 1
      const requiredCount = requirements.staff_required;
      const currentCount = staffPlaceholders.length;
      const toAdd = Math.max(0, requiredCount - currentCount + 1);
      
      if (toAdd <= 0) {
        // We already have enough placeholders, just add one more
        await addStaffPlaceholder('auto');
      } else {
        // Add placeholders to meet requirements + 1 extra
        for (let i = 0; i < toAdd; i++) {
          await api.post(`/templates/rules/${ruleId}/staff-placeholders`, {
            mode: 'auto',
            staff_id: null
          });
        }
        fetchStaffPlaceholders(ruleId);
        updateLastUpdated();
      }
    } catch (err) {
      console.error('Error adding staff shifts:', err);
      toast.error('Failed to add staff shifts');
    } finally {
      setSaving(false);
    }
  };

  // Helper to add vehicle placeholders up to requirements + 1 extra
  const addExtraVehicleSlot = async () => {
    if (!ruleId) return;
    
    try {
      setSaving(true);
      
      // Calculate how many placeholders we need to add to meet requirements + 1
      const requiredCount = requirements.vehicles_required;
      const currentCount = vehiclePlaceholders.length;
      const toAdd = Math.max(0, requiredCount - currentCount + 1);
      
      if (toAdd <= 0) {
        // We already have enough placeholders, just add one more
        await addVehiclePlaceholder('auto');
      } else {
        // Add placeholders to meet requirements + 1 extra
        for (let i = 0; i < toAdd; i++) {
          await api.post(`/templates/rules/${ruleId}/vehicle-placeholders`, {
            mode: 'auto',
            vehicle_id: null
          });
        }
        fetchVehiclePlaceholders(ruleId);
        updateLastUpdated();
      }
    } catch (err) {
      console.error('Error adding vehicle slots:', err);
      toast.error('Failed to add vehicle slots');
    } finally {
      setSaving(false);
    }
  };

  // Add staff placeholder
  const addStaffPlaceholder = async (mode = 'auto', staffId = null) => {
    if (!ruleId) return;
    
    try {
      setSaving(true);
      const response = await api.post(`/templates/rules/${ruleId}/staff-placeholders`, {
        mode,
        staff_id: mode === 'manual' ? staffId : null
      });
      
      if (response.data.success) {
        fetchStaffPlaceholders(ruleId);
        updateLastUpdated();
      } else {
        throw new Error('Failed to add staff placeholder');
      }
    } catch (err) {
      console.error('Error adding staff placeholder:', err);
      toast.error('Failed to add staff placeholder');
    } finally {
      setSaving(false);
    }
  };

  // Update staff placeholder
  const updateStaffPlaceholder = async (placeholderId, mode, staffId = null) => {
    if (!ruleId) return;
    
    try {
      setSaving(true);
      // Delete existing placeholder
      await api.delete(`/templates/rules/${ruleId}/staff-placeholders/${placeholderId}`);
      
      // Create new placeholder with updated values
      await api.post(`/templates/rules/${ruleId}/staff-placeholders`, {
        mode,
        staff_id: mode === 'manual' ? staffId : null
      });
      
      fetchStaffPlaceholders(ruleId);
      updateLastUpdated();
    } catch (err) {
      console.error('Error updating staff placeholder:', err);
      toast.error('Failed to update staff assignment');
    } finally {
      setSaving(false);
    }
  };

  // Delete staff placeholder
  const deleteStaffPlaceholder = async (placeholderId) => {
    if (!ruleId) return;
    
    try {
      setSaving(true);
      const response = await api.delete(`/templates/rules/${ruleId}/staff-placeholders/${placeholderId}`);
      
      if (response.data.success) {
        fetchStaffPlaceholders(ruleId);
        updateLastUpdated();
      } else {
        throw new Error('Failed to delete staff placeholder');
      }
    } catch (err) {
      console.error('Error deleting staff placeholder:', err);
      toast.error('Failed to remove staff placeholder');
    } finally {
      setSaving(false);
    }
  };

  // Add vehicle placeholder
  const addVehiclePlaceholder = async (mode = 'auto', vehicleId = null) => {
    if (!ruleId) return;
    
    try {
      setSaving(true);
      const response = await api.post(`/templates/rules/${ruleId}/vehicle-placeholders`, {
        mode,
        vehicle_id: mode === 'manual' ? vehicleId : null
      });
      
      if (response.data.success) {
        fetchVehiclePlaceholders(ruleId);
        updateLastUpdated();
      } else {
        throw new Error('Failed to add vehicle placeholder');
      }
    } catch (err) {
      console.error('Error adding vehicle placeholder:', err);
      toast.error('Failed to add vehicle placeholder');
    } finally {
      setSaving(false);
    }
  };

  // Update vehicle placeholder
  const updateVehiclePlaceholder = async (placeholderId, mode, vehicleId = null) => {
    if (!ruleId) return;
    
    try {
      setSaving(true);
      // Delete existing placeholder
      await api.delete(`/templates/rules/${ruleId}/vehicle-placeholders/${placeholderId}`);
      
      // Create new placeholder with updated values
      await api.post(`/templates/rules/${ruleId}/vehicle-placeholders`, {
        mode,
        vehicle_id: mode === 'manual' ? vehicleId : null
      });
      
      fetchVehiclePlaceholders(ruleId);
      updateLastUpdated();
    } catch (err) {
      console.error('Error updating vehicle placeholder:', err);
      toast.error('Failed to update vehicle assignment');
    } finally {
      setSaving(false);
    }
  };

  // Delete vehicle placeholder
  const deleteVehiclePlaceholder = async (placeholderId) => {
    if (!ruleId) return;
    
    try {
      setSaving(true);
      const response = await api.delete(`/templates/rules/${ruleId}/vehicle-placeholders/${placeholderId}`);
      
      if (response.data.success) {
        fetchVehiclePlaceholders(ruleId);
        updateLastUpdated();
      } else {
        throw new Error('Failed to delete vehicle placeholder');
      }
    } catch (err) {
      console.error('Error deleting vehicle placeholder:', err);
      toast.error('Failed to remove vehicle placeholder');
    } finally {
      setSaving(false);
    }
  };

  // Convert vehicle placeholder to personal car
  const convertToPC = async (placeholderId) => {
    if (!ruleId) return;
    
    try {
      setSaving(true);
      const response = await api.patch(`/templates/rules/${ruleId}/vehicle-placeholders/${placeholderId}`, {
        mode: 'pc',
        vehicle_id: null,
        pc_participant_ids: []
      });
      
      if (response.data.success) {
        // Initialize empty selection set for this placeholder
        setPcSelections(prev => ({
          ...prev,
          [placeholderId]: new Set()
        }));
        fetchVehiclePlaceholders(ruleId);
        updateLastUpdated();
        toast.success('Converted to personal car');
      } else {
        throw new Error('Failed to convert to personal car');
      }
    } catch (err) {
      console.error('Error converting to personal car:', err);
      toast.error('Failed to convert to personal car');
    } finally {
      setSaving(false);
    }
  };

  // Revert personal car to organizational vehicle
  const revertPcToOrg = async (placeholderId) => {
    if (!ruleId) return;
    try {
      setSaving(true);
      await api.patch(`/templates/rules/${ruleId}/vehicle-placeholders/${placeholderId}`, {
        mode: 'auto',
        vehicle_id: null,
        pc_participant_ids: []
      });
      setPcMenuOpenId(null);
      fetchVehiclePlaceholders(ruleId);
      updateLastUpdated();
      toast.success('Reverted to organisational vehicle');
    } catch (err) {
      console.error('Error reverting vehicle placeholder:', err);
      toast.error('Failed to revert to organisational vehicle');
    } finally {
      setSaving(false);
    }
  };

  // Toggle PC participant selection menu
  const togglePcMenu = (placeholderId) => {
    setPcMenuOpenId(pcMenuOpenId === placeholderId ? null : placeholderId);
  };

  // Toggle participant selection for a PC
  const togglePcSelection = (placeholderId, participantId) => {
    setPcSelections(prev => {
      const currentSelections = prev[placeholderId] || new Set();
      const newSelections = new Set(currentSelections);
      
      if (newSelections.has(participantId)) {
        newSelections.delete(participantId);
      } else {
        newSelections.add(participantId);
      }
      
      return {
        ...prev,
        [placeholderId]: newSelections
      };
    });
  };

  // Save PC participant selections
  const savePcSelections = async (placeholderId) => {
    if (!ruleId) return;
    
    try {
      setSaving(true);
      const selectedIds = Array.from(pcSelections[placeholderId] || []);
      
      const response = await api.patch(`/templates/rules/${ruleId}/vehicle-placeholders/${placeholderId}`, {
        pc_participant_ids: selectedIds
      });
      
      if (response.data.success) {
        fetchVehiclePlaceholders(ruleId);
        updateLastUpdated();
        setPcMenuOpenId(null); // Close menu
        toast.success('Participants assigned to personal car');
      } else {
        throw new Error('Failed to assign participants');
      }
    } catch (err) {
      console.error('Error assigning participants to PC:', err);
      toast.error('Failed to assign participants');
    } finally {
      setSaving(false);
    }
  };

  // Delete participant
  const deleteParticipant = async (rppId) => {
    if (!ruleId || !rppId) return;
    
    try {
      setSaving(true);
      const response = await api.delete(`/templates/rules/${ruleId}/participants/${rppId}`);
      
      if (response.data.success) {
        toast.success('Participant removed');
        // Remove from local state
        const participant = addedParticipants.find(p => p.id === rppId);
        if (participant) {
          setAddedParticipantIds(prev => prev.filter(id => id !== participant.participant_id));
          setAddedParticipants(prev => prev.filter(p => p.id !== rppId));
          // Clean up billing lines
          setBillingLines(prev => {
            const newState = {...prev};
            delete newState[rppId];
            return newState;
          });
        }
        // Refresh requirements
        fetchRequirements(ruleId);
        updateLastUpdated();
      } else {
        throw new Error('Failed to remove participant');
      }
    } catch (err) {
      console.error('Error removing participant:', err);
      toast.error('Failed to remove participant');
    } finally {
      setSaving(false);
    }
  };

  // Calculate shift length from slots
  const calculateShiftLength = () => {
    if (slots.length === 0) return null;
    
    // Find earliest start time and latest end time
    let earliestStart = '23:59';
    let latestEnd = '00:00';
    
    slots.forEach(slot => {
      if (slot.start_time < earliestStart) {
        earliestStart = slot.start_time;
      }
      if (slot.end_time > latestEnd) {
        latestEnd = slot.end_time;
      }
    });
    
    return { start: earliestStart, end: latestEnd };
  };

  // Format time for display
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };
  
  // Get day name from day number
  const getDayName = (day) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[day - 1] || '';
  };
  
  // Get recurrence pattern name
  const getRecurrencePatternName = (pattern) => {
    const patterns = {
      'one_off': 'One-off',
      'weekly': 'Weekly',
      'fortnightly': 'Fortnightly',
      'monthly': 'Monthly'
    };
    return patterns[pattern] || pattern;
  };
  
  // Add participant to program
  const addParticipant = async () => {
    if (!ruleId || !selectedParticipantId) return;
    
    try {
      setSaving(true);
      const response = await api.post(`/templates/rules/${ruleId}/participants`, {
        participant_id: selectedParticipantId
      });
      
      if (response.data.success) {
        toast.success('Participant added');
        // Store the full response data for billing
        const newParticipant = {
          id: response.data.data.id,
          participant_id: selectedParticipantId,
          name: getParticipantName(selectedParticipantId)
        };
        setAddedParticipants([...addedParticipants, newParticipant]);
        setAddedParticipantIds([...addedParticipantIds, selectedParticipantId]);
        setSelectedParticipantId('');
        
        // Initialize billing form for this participant
        setParticipantBilling({
          ...participantBilling,
          [newParticipant.id]: { billing_code: '', hours: '' }
        });

        // Initialise address prefs (default → primary)
        setAddressPrefs((prev) => ({
          ...prev,
          [newParticipant.id]: { pickup: 'primary', dropoff: 'primary' },
        }));

        // fetch full details for address strings
        fetchParticipantDetailsFull(selectedParticipantId);
        
        // Refresh requirements after adding participant
        fetchRequirements(ruleId);

        // Prime billing list for this participant
        fetchParticipantBilling(newParticipant.id);
        
        updateLastUpdated();
      } else {
        throw new Error('Failed to add participant');
      }
    } catch (err) {
      console.error('Error adding participant:', err);
      // Special handling for 409 conflict (participant already added)
      if (err.response && err.response.status === 409) {
        toast.warning('Participant already added to this program');
      } else {
        toast.error('Failed to add participant');
      }
    } finally {
      setSaving(false);
    }
  };

  // Add billing line for a participant
  const addBillingLine = async (rppId) => {
    if (!ruleId || !rppId) return;
    
    const billing = participantBilling[rppId];
    if (!billing || !billing.billing_code || !billing.hours) {
      toast.error('Billing code and hours are required');
      return;
    }
    
    try {
      setSaving(true);
      const response = await api.post(
        `/templates/rules/${ruleId}/participants/${rppId}/billing`,
        {
          billing_code: billing.billing_code,
          hours: parseFloat(billing.hours)
        }
      );
      
      if (response.data.success) {
        toast.success('Billing line added');
        // Reset form
        setParticipantBilling({
          ...participantBilling,
          [rppId]: { billing_code: '', hours: '' }
        });

        // Refresh displayed lines
        fetchParticipantBilling(rppId);
        updateLastUpdated();
      } else {
        throw new Error('Failed to add billing line');
      }
    } catch (err) {
      console.error('Error adding billing line:', err);
      toast.error('Failed to add billing line');
    } finally {
      setSaving(false);
    }
  };
  
  // Finalize program and trigger syncRethread
  const finalizeProgram = async () => {
    if (!ruleId) return;
    
    // Frontend guard: if no org vehicles, ensure all participants assigned to some PC
    const orgVehiclesCount = vehiclePlaceholders.filter(p => p.mode !== 'pc').length;
    if (orgVehiclesCount === 0) {
      const assignedSet = new Set();
      vehiclePlaceholders.forEach(p => {
        if (p.mode === 'pc' && Array.isArray(p.pc_participant_ids)) {
          p.pc_participant_ids.forEach(id => assignedSet.add(id));
        }
      });
      const missing = addedParticipants.filter(p => !assignedSet.has(p.participant_id));
      if (missing.length > 0) {
        toast.error(`Finalize blocked: ${missing.length} participant(s) are not assigned to a personal car and there are no organisational vehicles.`);
        return;
      }
    }
    
    try {
      setSaving(true);
      const response = await api.post(`/templates/rules/${ruleId}/finalize`);
      
      if (response.data.success) {
        const summary = response.data.data;
        const highlightDate = anchorDate || new Date().toISOString().split('T')[0];
        
        toast.success(
          <div>
            <strong>Program finalized!</strong>
            <div>Dates processed: {summary.datesProcessed}</div>
            <div>Rules touched: {summary.rulesTouched}</div>
            <div>Instances created: {summary.instancesUpserted}</div>
            <div>Cards written: {summary.cardsWritten}</div>
            <div className="toast-actions" style={{ marginTop: '10px' }}>
              <button 
                onClick={() => navigate(`/schedule?highlightDate=${highlightDate}`)}
                className="btn btn-sm btn-primary"
                style={{ marginRight: '10px' }}
              >
                <FiCalendar /> View on Schedule
              </button>
              <button 
                onClick={() => navigate(`/dashboard?date=${highlightDate}`)}
                className="btn btn-sm btn-primary"
              >
                <FiLink /> Open Dashboard
              </button>
            </div>
          </div>,
          { autoClose: 8000 } // Give more time to use the buttons
        );
        
        // Navigate to dashboard after short delay if they don't click a button
        setTimeout(() => {
          navigate('/');
        }, 8000);
      } else {
        throw new Error('Failed to finalize program');
      }
    } catch (err) {
      console.error('Error finalizing program:', err);
      toast.error('Failed to finalize program');
    } finally {
      setSaving(false);
    }
  };
  
  // Recurrence pattern options
  const patternOptions = [
    { value: 'one_off', label: 'One-off' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'fortnightly', label: 'Fortnightly' },
    { value: 'monthly', label: 'Monthly' }
  ];
  // Slot type options
  const slotTypeOptions = [
    { value: 'pickup', label: 'Pickup' },
    { value: 'activity', label: 'Activity' },
    { value: 'meal', label: 'Meal' },
    { value: 'other', label: 'Other' },
    { value: 'dropoff', label: 'Dropoff' }
  ];
  
  // Get participant name by ID
  const getParticipantName = (id) => {
    const participant = participants.find(p => p.id === id);
    return participant ? `${participant.first_name} ${participant.last_name}` : 'Unknown';
  };

  // Fetch staged billing lines for a participant
  const fetchParticipantBilling = async (rppId) => {
    if (!ruleId || !rppId) return;
    try {
      const response = await api.get(
        `/templates/rules/${ruleId}/participants/${rppId}/billing`
      );
      if (response.data.success && Array.isArray(response.data.data)) {
        setBillingLines((prev) => ({ ...prev, [rppId]: response.data.data }));
      }
    } catch (err) {
      console.error('Error fetching participant billing lines:', err);
    }
  };

  // Delete a staged billing line
  const deleteBillingLine = async (rppId, lineId) => {
    if (!ruleId || !rppId || !lineId) return;
    try {
      setSaving(true);
      const resp = await api.delete(
        `/templates/rules/${ruleId}/participants/${rppId}/billing/${lineId}`
      );
      if (resp.data.success) {
        toast.success('Billing line removed');
        fetchParticipantBilling(rppId);
        updateLastUpdated();
      } else {
        throw new Error('Delete failed');
      }
    } catch (err) {
      console.error('Error deleting billing line:', err);
      toast.error('Failed to remove billing line');
    } finally {
      setSaving(false);
    }
  };

  // Helper to compute billing line stats
  const getBillingStats = (rppId) => {
    const lines = Array.isArray(billingLines[rppId]) ? billingLines[rppId] : [];
    const totalHours = lines.reduce((sum, l) => sum + (parseFloat(l.hours) || 0), 0);
    const totalAmount = lines.reduce((sum, l) => {
      // Use line.amount if available, otherwise calculate from unit_price * hours
      const lineAmount = l.amount ? parseFloat(l.amount) : (parseFloat(l.unit_price || 0) * parseFloat(l.hours || 0));
      return sum + lineAmount;
    }, 0);
    return { count: lines.length, totalHours, totalAmount };
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Creating new program template...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="error-container glass-card">
        <FiAlertCircle className="error-icon" />
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  // Calculate shift length from slots
  const shiftLength = calculateShiftLength();
  
  // Compute program revenue - sum of all billing line totals across participants
  const programRevenue = addedParticipants.reduce((total, p) => {
    return total + getBillingStats(p.id).totalAmount;
  }, 0);

  // Calculate PC count
  const pcCount = vehiclePlaceholders.filter(p => p.mode === 'pc').length;

  // Build list of assigned vehicle registrations/names (excluding PC mode)
  const assignedVehiclesDisplay = vehiclePlaceholders
    .filter(p => p.mode === 'manual' && p.vehicle_id)
    .map(p => {
      const vehicle = vehiclesList.find(v => v.id === p.vehicle_id);
      return vehicle ? (vehicle.registration || vehicle.name) : null;
    })
    .filter(Boolean)
    .join(', ');
  
  // Compute set of participants assigned to any PC
  const assignedToAnyPC = new Set();
  vehiclePlaceholders.forEach(p => {
    if (p.mode === 'pc' && Array.isArray(p.pc_participant_ids)) {
      p.pc_participant_ids.forEach(id => assignedToAnyPC.add(id));
    }
  });
  
  return (
    <ProgramFormProvider value={{}}>
      <div className="program-template-wizard">
        <div className="page-header">
          <h2 className="page-title">Program Template Wizard</h2>
          <div className="page-actions">
            <button 
              className="btn btn-primary"
              onClick={finalizeProgram}
              disabled={saving || requirements.participant_count === 0}
            >
              <FiCheckCircle /> Finalize Program
            </button>
          </div>
        </div>
        
        {/* Requirements chip bar */}
        <div className="requirements-chip-bar">
          <div className="req-chip">
            <FiCalendar /> <span>{getDayName(dayOfWeek)}</span>
          </div>
          <div className="req-chip">
            <FiRepeat /> <span>{getRecurrencePatternName(recurrencePattern)}</span>
          </div>
          <div
            className="req-chip"
            title="Headcount / Weighted Participant Units (WPU)"
          >
            <FiUsers />{' '}
            <span>
              Participants: {requirements.participant_count} /{' '}
              {Number(
                requirements.wpu_total ?? requirements.participant_count ?? 0
              ).toFixed(1)}
            </span>
          </div>
          <div
            className="req-chip"
            title={`1 per ${requirements.staff_threshold_per_wpu} WPU`}
          >
            <FiUserCheck /> <span>{requirements.staff_required} staff</span>
          </div>
          <div
            className="req-chip"
            title={`1 per ${requirements.vehicle_trigger_every_n_participants} participants (org vehicles only)`}
          >
            <FiTruck />{' '}
            <span>
              {Math.max(0, requirements.vehicles_required - pcCount)} vehicles
            </span>
          </div>
          {pcCount > 0 && (
            <div className="req-chip">
              <FiTruck /> <span>{pcCount} pc</span>
            </div>
          )}
          <div className="req-chip">
            <FiList /> <span>{slots.length} slots</span>
          </div>
          {shiftLength && (
            <div className="req-chip">
              <FiClock />{' '}
              <span>{`${formatTime(shiftLength.start)} – ${formatTime(
                shiftLength.end
              )}`}</span>
            </div>
          )}
          <div className="req-chip">
            <FiCheckCircle /> <span>{formatCurrency(programRevenue)}</span>
          </div>
          {assignedVehiclesDisplay && (
            <div className="req-chip">
              <FiTruck /> <span>{assignedVehiclesDisplay}</span>
            </div>
          )}
          <div className="req-chip" title={lastUpdated.toLocaleString()}>
            <FiClock /> <span>{lastUpdated.toLocaleDateString()}</span>
          </div>
          {venues.find(v => v.id === venueId) && (
            <div className="req-chip venue-chip">
              <FiMapPin /> <span>{venues.find(v => v.id === venueId)?.name}</span>
            </div>
          )}
        </div>
        
        {/* Program Details - Using extracted component */}
        <ProgramDetailsPanel
          ruleName={ruleName}
          setRuleName={setRuleName}
          ruleDescription={ruleDescription}
          setRuleDescription={setRuleDescription}
          anchorDate={anchorDate}
          setAnchorDate={setAnchorDate}
          recurrencePattern={recurrencePattern}
          setRecurrencePattern={setRecurrencePattern}
          programType={programType}
          setProgramType={setProgramType}
          venueId={venueId}
          setVenueId={setVenueId}
          venues={venues}
          showNewVenueForm={showNewVenueForm}
          setShowNewVenueForm={setShowNewVenueForm}
          newVenue={newVenue}
          setNewVenue={setNewVenue}
          patternOptions={patternOptions}
          createVenue={createVenue}
          saving={saving}
        />
        
        {/* Time Slots - Using extracted component */}
        <TimeSlotsEditor
          slots={slots}
          newSlot={newSlot}
          setNewSlot={setNewSlot}
          addSlot={addSlot}
          deleteSlot={deleteSlot}
          formatTime={formatTime}
          shiftLength={shiftLength}
          slotTypeOptions={slotTypeOptions}
          saving={saving}
        />
        
        {/* Participants */}
        <div className="glass-card mb-4">
          <div className="card-header">
            <h3><FiUsers /> Participants</h3>
          </div>
          <div className="card-body">
            <div className="participant-select-row">
              <select
                id="participantSelect"
                value={selectedParticipantId}
                onChange={(e) => setSelectedParticipantId(e.target.value)}
                className="form-control"
              >
                <option value="">Select Participant</option>
                {participants
                  .filter(p => !addedParticipantIds.includes(p.id))
                  .map(participant => (
                    <option key={participant.id} value={participant.id}>
                      {participant.first_name} {participant.last_name}
                    </option>
                  ))
                }
              </select>
              <button 
                className="btn btn-primary"
                onClick={addParticipant}
                disabled={saving || !selectedParticipantId}
              >
                <FiPlusCircle /> Add
              </button>
            </div>
            
            <h4>Added Participants ({addedParticipants.length})</h4>
            {addedParticipants.length === 0 ? (
              <p className="muted">No participants added yet</p>
            ) : (
              <ul className="participant-list participants-grid">
                {addedParticipants.map(participant => {
                  const stats = getBillingStats(participant.id);
                  return (
                    <li key={participant.id} className="participant-item">
                      <div className="participant-header" onClick={() => toggleParticipantOpen(participant.id)}>
                        <div className="participant-name">{participant.name}</div>
                        <div className="participant-badges">
                          <span className="badge">{stats.count} lines</span>
                          <span className="badge">{stats.totalHours.toFixed(1)} h</span>
                          <span className="badge">{formatCurrency(stats.totalAmount)}</span>
                        </div>
                        <div className="participant-actions">
                          <button 
                            className="btn btn-icon btn-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteParticipant(participant.id);
                            }}
                            title="Remove participant"
                          >
                            <FiTrash2 />
                          </button>
                          {openParticipants[participant.id] ? <FiChevronDown /> : <FiChevronRight />}
                        </div>
                      </div>
                      
                      {openParticipants[participant.id] && (
                        <>
                          {/* ---------------- Pickup / Dropoff Address prefs ------------- */}
                          <div className="form-row" style={{ marginBottom: 12 }}>
                            {(() => {
                              const pid = participant.participant_id;
                              const details = participantDetails[pid];
                              const primaryLabel = getPrimaryAddressLabel(
                                participants.find((p) => p.id === pid) || {}
                              );
                              const secondaryLabel = getSecondaryAddressLabel(details);
                              const prefs = addressPrefs[participant.id] || {
                                pickup: 'primary',
                                dropoff: 'primary',
                              };
                              return (
                                <>
                                  <div className="form-group">
                                    <label>Pickup Address</label>
                                    <select
                                      className="form-control"
                                      value={prefs.pickup}
                                      onChange={(e) =>
                                        updateAddressPref(
                                          participant.id,
                                          'pickup_address_pref',
                                          e.target.value
                                        )
                                      }
                                    >
                                      {/* No Transport */}
                                      <option value="none">No Transport</option>
                                      {/* Participant addresses */}
                                      <optgroup label="Participant Addresses">
                                        <option value="primary">
                                          Primary — {primaryLabel}
                                        </option>
                                        <option
                                          value="secondary"
                                          disabled={!secondaryLabel}
                                        >
                                          Secondary — {secondaryLabel || 'N/A'}
                                        </option>
                                      </optgroup>
                                      {/* Transport Venues */}
                                      {venues.some(
                                        (v) => v.include_in_transport
                                      ) && (
                                        <optgroup label="Transport Venues">
                                          {venues
                                            .filter(
                                              (v) => v.include_in_transport
                                            )
                                            .map((v) => (
                                              <option
                                                key={v.id}
                                                value={`venue:${v.id}`}
                                              >
                                                {v.name} —{' '}
                                                {[
                                                  v.address,
                                                  v.suburb,
                                                  v.state,
                                                  v.postcode,
                                                ]
                                                  .filter(Boolean)
                                                  .join(', ')}
                                              </option>
                                            ))}
                                        </optgroup>
                                      )}
                                    </select>
                                  </div>
                                  <div className="form-group">
                                    <label>Drop-off Address</label>
                                    <select
                                      className="form-control"
                                      value={prefs.dropoff}
                                      onChange={(e) =>
                                        updateAddressPref(
                                          participant.id,
                                          'dropoff_address_pref',
                                          e.target.value
                                        )
                                      }
                                    >
                                      {/* No Transport */}
                                      <option value="none">No Transport</option>
                                      {/* Participant addresses */}
                                      <optgroup label="Participant Addresses">
                                        <option value="primary">
                                          Primary — {primaryLabel}
                                        </option>
                                        <option
                                          value="secondary"
                                          disabled={!secondaryLabel}
                                        >
                                          Secondary — {secondaryLabel || 'N/A'}
                                        </option>
                                      </optgroup>
                                      {/* Transport Venues */}
                                      {venues.some(
                                        (v) => v.include_in_transport
                                      ) && (
                                        <optgroup label="Transport Venues">
                                          {venues
                                            .filter(
                                              (v) => v.include_in_transport
                                            )
                                            .map((v) => (
                                              <option
                                                key={v.id}
                                                value={`venue:${v.id}`}
                                              >
                                                {v.name} —{' '}
                                                {[
                                                  v.address,
                                                  v.suburb,
                                                  v.state,
                                                  v.postcode,
                                                ]
                                                  .filter(Boolean)
                                                  .join(', ')}
                                              </option>
                                            ))}
                                        </optgroup>
                                      )}
                                    </select>
                                  </div>
                                </>
                              );
                            })()}
                          </div>

                          {/* Billing Lines mini-form */}
                          <div className="billing-form">
                            <div className="form-row">
                              <div className="form-group">
                                <label>Billing Code</label>
                                <select
                                  value={participantBilling[participant.id]?.billing_code || ''}
                                  onChange={(e) => setParticipantBilling({
                                    ...participantBilling,
                                    [participant.id]: {
                                      ...participantBilling[participant.id],
                                      billing_code: e.target.value
                                    }
                                  })}
                                  className="form-control"
                                >
                                  <option value="">Select Code</option>
                                  {billingCodes.map(code => (
                                    <option key={code.option_id} value={code.option_id}>
                                      {code.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="form-group hours-group">
                                <label>Hours</label>
                                <input
                                  type="number"
                                  value={participantBilling[participant.id]?.hours || ''}
                                  onChange={(e) => setParticipantBilling({
                                    ...participantBilling,
                                    [participant.id]: {
                                      ...participantBilling[participant.id],
                                      hours: e.target.value
                                    }
                                  })}
                                  className="form-control hours-input"
                                  min="0.5"
                                  step="0.5"
                                  placeholder="e.g., 3.5"
                                />
                              </div>
                              <div className="form-group button-group">
                                <label>&nbsp;</label>
                                <button
                                  className="btn btn-primary"
                                  onClick={() => addBillingLine(participant.id)}
                                  disabled={
                                    saving || 
                                    !participantBilling[participant.id]?.billing_code ||
                                    !participantBilling[participant.id]?.hours
                                  }
                                >
                                  <FiPlusCircle /> Add
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Staged lines list */}
                          {Array.isArray(billingLines[participant.id]) && billingLines[participant.id].length > 0 ? (
                            <div className="billing-lines">
                              <div className="grid-header">
                                <div>Code</div>
                                <div>Hours</div>
                                <div>Amount</div>
                                <div>Actions</div>
                              </div>
                              {billingLines[participant.id].map((line) => (
                                <div className="grid-row" key={line.id}>
                                  <div className="code-cell">{line.code ? `${line.code} — ${line.description || ''}` : line.billing_code_id}</div>
                                  <div className="hours-cell">{line.hours}</div>
                                  <div className="amount-cell">{formatCurrency(line.amount || (line.unit_price * line.hours))}</div>
                                  <div className="actions-cell">
                                    <button
                                      className="btn btn-icon btn-danger"
                                      onClick={() => deleteBillingLine(participant.id, line.id)}
                                      disabled={saving}
                                      title="Remove"
                                    >
                                      <FiTrash2 />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="muted" style={{ marginTop: '6px' }}>
                              No billing lines yet
                            </p>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        
        {/* Resources (Staff & Vehicles) */}
        <div className="glass-card mb-4">
          <div className="card-header">
            <h3><FiUsers /> Resources</h3>
          </div>
          <div className="card-body">
            {/* Staff Roster */}
            <div className="section-container">
              <div className="section-header">
                <h4>Roster</h4>
                <button
                  className="btn btn-primary"
                  onClick={addExtraStaffShift}
                  disabled={saving}
                >
                  <FiPlusCircle /> Add shift
                </button>
              </div>
              <div className="placeholders-list">
                {staffPlaceholders.length === 0 && requirements.staff_required === 0 ? (
                  <p className="muted">No staff required yet</p>
                ) : (
                  <div className="placeholder-grid">
                    {/* Display existing placeholders first */}
                    {staffPlaceholders.map((placeholder, index) => (
                      <div key={placeholder.id} className="placeholder-item staff-placeholder">
                        <span className="placeholder-label">Shift {index+1}</span>
                        <select
                          value={placeholder.mode === 'auto' ? 'auto' : (placeholder.mode === 'open' ? 'open' : placeholder.staff_id)}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'auto') {
                              updateStaffPlaceholder(placeholder.id, 'auto');
                            } else if (value === 'open') {
                              updateStaffPlaceholder(placeholder.id, 'open');
                            } else {
                              updateStaffPlaceholder(placeholder.id, 'manual', value);
                            }
                          }}
                          className="form-control"
                        >
                          <option value="auto">Auto-assign</option>
                          <option value="open">Open shift</option>
                          {staffList.map(staff => (
                            <option key={staff.id} value={staff.id}>
                              {staff.first_name} {staff.last_name}
                            </option>
                          ))}
                        </select>
                        {index >= requirements.staff_required && (
                          <button
                            className="btn btn-icon btn-danger"
                            onClick={() => deleteStaffPlaceholder(placeholder.id)}
                            disabled={saving}
                            title="Remove"
                          >
                            <FiX />
                          </button>
                        )}
                        {index < requirements.staff_required && (
                          <button
                            className="btn btn-icon btn-disabled"
                            disabled={true}
                            title="Required placeholder"
                          >
                            <FiX style={{ opacity: 0.3 }} />
                          </button>
                        )}
                      </div>
                    ))}
                    
                    {/* Add auto placeholders up to staff_required */}
                    {Array.from({ length: Math.max(0, requirements.staff_required - staffPlaceholders.length) }).map((_, index) => (
                      <div key={`auto-${index}`} className="placeholder-item staff-placeholder">
                        <span className="placeholder-label">Shift {staffPlaceholders.length + index + 1}</span>
                        <select
                          defaultValue="auto"
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === 'auto') {
                              // No-op, it's already auto
                            } else if (value === 'open') {
                              addStaffPlaceholder('open');
                            } else {
                              addStaffPlaceholder('manual', value);
                            }
                          }}
                          className="form-control"
                        >
                          <option value="auto">Auto-assign</option>
                          <option value="open">Open shift</option>
                          {staffList.map(staff => (
                            <option key={staff.id} value={staff.id}>
                              {staff.first_name} {staff.last_name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn btn-icon btn-disabled"
                          disabled={true}
                          title="Default placeholder"
                        >
                          <FiX style={{ opacity: 0.3 }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Vehicles */}
            <div className="section-container">
              <div className="section-header">
                <h4>Vehicles</h4>
                <button
                  className="btn btn-primary"
                  onClick={addExtraVehicleSlot}
                  disabled={saving}
                >
                  <FiPlusCircle /> Add vehicle
                </button>
              </div>
              <div className="placeholders-list">
                {vehiclePlaceholders.length === 0 && requirements.vehicles_required === 0 ? (
                  <p className="muted">No vehicles required yet</p>
                ) : (
                  <div className="placeholder-grid">
                    {/* Display existing placeholders first */}
                    {vehiclePlaceholders.map((placeholder, index) => (
                      <div key={placeholder.id} className="placeholder-item">
                        {placeholder.mode === 'pc' ? (
                          <>
                            <span className="placeholder-label">Personal car</span>
                            <button
                              className="btn btn-secondary"
                              onClick={() => togglePcMenu(placeholder.id)}
                              disabled={saving}
                            >
                              Assign participants
                            </button>
                            
                            {/* PC participant selection menu */}
                            {pcMenuOpenId === placeholder.id && (
                              <div className="pc-menu">
                                <div className="pc-menu-header">
                                  Select participants for this personal car:
                                </div>
                                <div className="pc-menu-items">
                                  {addedParticipants.length === 0 ? (
                                    <div className="pc-menu-empty">No participants added yet</div>
                                  ) : (
                                    addedParticipants.map(participant => {
                                      const isAssignedAnywhere = assignedToAnyPC.has(participant.participant_id);
                                      const isSelectedHere = pcSelections[placeholder.id]?.has(participant.participant_id);
                                      return (
                                        <div 
                                          key={participant.id} 
                                          className={`pc-item ${isAssignedAnywhere ? 'assigned-any' : ''}`}
                                          onClick={() => togglePcSelection(placeholder.id, participant.participant_id)}
                                        >
                                          {isSelectedHere && (
                                            <FiCheck className="pc-item-check" />
                                          )}
                                          <span>{participant.name}</span>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                                <div style={{borderTop:'1px solid var(--glass-border)', margin:'8px 0'}} />
                                <button
                                  className="btn btn-danger pc-revert-btn"
                                  onClick={() => revertPcToOrg(placeholder.id)}
                                  disabled={saving}
                                >
                                  Revert vehicle
                                </button>
                                <div className="pc-menu-actions">
                                  <button
                                    className="btn btn-secondary"
                                    onClick={() => setPcMenuOpenId(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="btn btn-primary"
                                    onClick={() => savePcSelections(placeholder.id)}
                                    disabled={saving}
                                  >
                                    <FiSave /> Save
                                  </button>
                                </div>
                              </div>
                            )}
                            
                            {index >= requirements.vehicles_required && (
                              <button
                                className="btn btn-icon btn-danger"
                                onClick={() => deleteVehiclePlaceholder(placeholder.id)}
                                disabled={saving}
                                title="Remove"
                              >
                                <FiX />
                              </button>
                            )}
                            {index < requirements.vehicles_required && (
                              <button
                                className="btn btn-icon btn-disabled"
                                disabled={true}
                                title="Required placeholder"
                              >
                                <FiX style={{ opacity: 0.3 }} />
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <select
                              value={placeholder.mode === 'auto' ? 'auto' : placeholder.vehicle_id}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === 'auto') {
                                  updateVehiclePlaceholder(placeholder.id, 'auto');
                                } else {
                                  updateVehiclePlaceholder(placeholder.id, 'manual', value);
                                }
                              }}
                              className="form-control"
                            >
                              <option value="auto">Auto-assign</option>
                              {vehiclesList.map(vehicle => (
                                <option key={vehicle.id} value={vehicle.id}>
                                  {vehicle.name} {vehicle.capacity_total ? `(${vehicle.capacity_total} seats)` : ''}
                                </option>
                              ))}
                            </select>
                            
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => convertToPC(placeholder.id)}
                              disabled={saving}
                            >
                              Convert to PC
                            </button>
                            
                            {index >= requirements.vehicles_required && (
                              <button
                                className="btn btn-icon btn-danger"
                                onClick={() => deleteVehiclePlaceholder(placeholder.id)}
                                disabled={saving}
                                title="Remove"
                              >
                                <FiX />
                              </button>
                            )}
                            {index < requirements.vehicles_required && (
                              <button
                                className="btn btn-icon btn-disabled"
                                disabled={true}
                                title="Required placeholder"
                              >
                                <FiX style={{ opacity: 0.3 }} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Finalize */}
        <div className="glass-card mb-4">
          <div className="card-header">
            <h3><FiCheckCircle /> Finalize</h3>
          </div>
          <div className="card-body">
            <p>When you are ready to finalize this program, click the button below.</p>
            <div className="form-actions">
              <button 
                className="btn btn-primary btn-lg"
                onClick={finalizeProgram}
                disabled={saving || requirements.participant_count === 0}
              >
                <FiCheckCircle /> Finalize Program
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProgramFormProvider>
  );
};

export default ProgramTemplateWizard;
