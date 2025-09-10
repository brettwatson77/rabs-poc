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
  FiRefreshCw,
  FiList,
  FiTrash2,
  FiLink,
  FiX,
  FiChevronDown,
  FiChevronRight
} from 'react-icons/fi';

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
    vehicles_required: 0
  });
  const [openParticipants, setOpenParticipants] = useState({});
  
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
  
  // Currency formatter helper
  const formatCurrency = (amount) => {
    return `$${(parseFloat(amount) || 0).toFixed(2)}`;
  };
  
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
      }
    } catch (err) {
      console.error('Error fetching vehicle placeholders:', err);
      // Don't show toast for initial fetch
    }
  };

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
          accessibility_features: '',
          venue_type: '',
          is_active: true
        });
        toast.success('New venue created');
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
        // Reset form and refresh slots
        setNewSlot({
          slot_type: 'activity',
          start_time: '09:00',
          end_time: '15:00',
          label: ''
        });
        fetchSlots(ruleId);
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
        
        // Refresh requirements after adding participant
        fetchRequirements(ruleId);

        // Prime billing list for this participant
        fetchParticipantBilling(newParticipant.id);
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
  
  // Day of week options
  const dayOptions = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 7, label: 'Sunday' }
  ];
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
  
  return (
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
      
      {/* Program Details */}
      <div className="glass-card mb-4">
        <div className="card-header">
          <h3><FiCalendar /> Program Details</h3>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="ruleName">Program Name</label>
              <input
                type="text"
                id="ruleName"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="form-control"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="ruleDescription">Description & shift notes</label>
              <textarea
                id="ruleDescription"
                value={ruleDescription}
                onChange={(e) => setRuleDescription(e.target.value)}
                className="form-control"
                rows="2"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="anchorDate">Initial Start Date</label>
              <input
                type="date"
                id="anchorDate"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                className="form-control"
              />
            </div>

            {(recurrencePattern === 'weekly' || recurrencePattern === 'fortnightly') && (
              <div className="form-group">
                <label htmlFor="dayOfWeek">Day of Week</label>
                <select
                  id="dayOfWeek"
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                  className="form-control"
                >
                  {dayOptions.map(day => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="recurrencePattern">Repeat Pattern</label>
              <select
                id="recurrencePattern"
                value={recurrencePattern}
                onChange={(e) => setRecurrencePattern(e.target.value)}
                className="form-control"
              >
                {patternOptions.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="venueId">Venue</label>
              {!showNewVenueForm ? (
                <div className="input-group">
                  <select
                    id="venueId"
                    value={venueId}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setShowNewVenueForm(true);
                      } else {
                        setVenueId(e.target.value);
                      }
                    }}
                    className="form-control"
                  >
                    <option value="">Select Venue</option>
                    {venues.map(venue => (
                      <option key={venue.id} value={venue.id}>{venue.name}</option>
                    ))}
                    <option value="__new__">+ New venue</option>
                  </select>
                </div>
              ) : (
                <div className="new-venue-form">
                  <div className="form-group">
                    <label>Venue Name *</label>
                    <input
                      type="text"
                      value={newVenue.name}
                      onChange={(e) => setNewVenue({...newVenue, name: e.target.value})}
                      className="form-control"
                      placeholder="Enter venue name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Address *</label>
                    <input
                      type="text"
                      value={newVenue.address}
                      onChange={(e) => setNewVenue({...newVenue, address: e.target.value})}
                      className="form-control"
                      placeholder="Enter address"
                    />
                  </div>
                  <div className="form-group">
                    <label>Postcode</label>
                    <input
                      type="text"
                      value={newVenue.postcode}
                      onChange={(e) => setNewVenue({...newVenue, postcode: e.target.value})}
                      className="form-control"
                      placeholder="Enter postcode"
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact Phone</label>
                    <input
                      type="text"
                      value={newVenue.contact_phone}
                      onChange={(e) => setNewVenue({...newVenue, contact_phone: e.target.value})}
                      className="form-control"
                      placeholder="Enter contact phone"
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact Email</label>
                    <input
                      type="email"
                      value={newVenue.contact_email}
                      onChange={(e) => setNewVenue({...newVenue, contact_email: e.target.value})}
                      className="form-control"
                      placeholder="Enter contact email"
                    />
                  </div>
                  <div className="form-group">
                    <label>Capacity</label>
                    <input
                      type="number"
                      value={newVenue.capacity}
                      onChange={(e) => setNewVenue({...newVenue, capacity: e.target.value})}
                      className="form-control"
                      placeholder="Enter capacity"
                    />
                  </div>
                  <div className="form-group">
                    <label>Accessibility Features</label>
                    <input
                      type="text"
                      value={newVenue.accessibility_features}
                      onChange={(e) => setNewVenue({...newVenue, accessibility_features: e.target.value})}
                      className="form-control"
                      placeholder="Enter accessibility features"
                    />
                  </div>
                  <div className="form-group">
                    <label>Venue Type</label>
                    <input
                      type="text"
                      value={newVenue.venue_type}
                      onChange={(e) => setNewVenue({...newVenue, venue_type: e.target.value})}
                      className="form-control"
                      placeholder="Enter venue type"
                    />
                  </div>
                  <div className="form-group checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={newVenue.is_active}
                        onChange={(e) => setNewVenue({...newVenue, is_active: e.target.checked})}
                      />{' '}
                      Active
                    </label>
                  </div>
                  <div className="form-actions">
                    <button 
                      className="btn btn-secondary"
                      onClick={() => setShowNewVenueForm(false)}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button 
                      className="btn btn-primary"
                      onClick={createVenue}
                      disabled={saving || !newVenue.name.trim() || !newVenue.address.trim()}
                    >
                      <FiSave /> Save Venue
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group checkbox-group">
              <label>
                {/* (auto-assign staff checkbox removed) */}
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label>
                {/* (auto-assign vehicles checkbox removed) */}
              </label>
            </div>
          </div>
          
        </div>
      </div>
      
      {/* Time Slots */}
      <div className="glass-card mb-4">
        <div className="card-header">
          <h3><FiClock /> Time Slots</h3>
        </div>
        <div className="card-body">
          {/* Add new slot form */}
          <div className="add-slot-form">
            <h4>Add Time Slot</h4>
            <div className="form-row">
              <div className="form-group">
                <label>Start</label>
                <input
                  type="time"
                  value={newSlot.start_time}
                  onChange={(e) => setNewSlot({...newSlot, start_time: e.target.value})}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>End</label>
                <input
                  type="time"
                  value={newSlot.end_time}
                  onChange={(e) => setNewSlot({...newSlot, end_time: e.target.value})}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select
                  value={newSlot.slot_type}
                  onChange={(e) => setNewSlot({...newSlot, slot_type: e.target.value})}
                  className="form-control"
                >
                  {slotTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Label (optional)</label>
                <input
                  type="text"
                  value={newSlot.label}
                  onChange={(e) => setNewSlot({...newSlot, label: e.target.value})}
                  className="form-control"
                  placeholder="e.g., Morning pickup"
                />
              </div>
              <div className="form-group">
                <label>&nbsp;</label>
                <button
                  className="btn btn-primary form-control"
                  onClick={addSlot}
                  disabled={saving || !newSlot.start_time || !newSlot.end_time}
                >
                  <FiPlusCircle /> Add Row
                </button>
              </div>
            </div>
          </div>
          
          {/* Slots table */}
          <div className="slots-table-container">
            <h4>Time Slots</h4>
            {slots.length === 0 ? (
              <p className="muted">No time slots added yet</p>
            ) : (
              <table className="slots-table">
                <thead>
                  <tr>
                    <th>Start</th>
                    <th>End</th>
                    <th>Type</th>
                    <th>Label</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.sort((a, b) => a.seq - b.seq).map((slot) => (
                    <tr key={slot.id}>
                      <td>{formatTime(slot.start_time)}</td>
                      <td>{formatTime(slot.end_time)}</td>
                      <td>{slot.slot_type}</td>
                      <td>{slot.label || '-'}</td>
                      <td className="actions-cell">
                        <button
                          className="btn btn-icon btn-danger"
                          onClick={() => deleteSlot(slot.id)}
                          disabled={saving}
                          title="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Shift length display */}
          {shiftLength && (
            <div className="shift-length">
              <strong>Shift Length:</strong> {formatTime(shiftLength.start)} to {formatTime(shiftLength.end)}
            </div>
          )}
        </div>
      </div>
      
      {/* Participants */}
      <div className="glass-card mb-4">
        <div className="card-header">
          <h3><FiUsers /> Participants</h3>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label htmlFor="participantSelect">Add Participant</label>
            <div className="input-group">
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
                          className="btn btn-sm btn-outline-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleParticipantOpen(participant.id);
                          }}
                          title="Add billing line"
                        >
                          + Line
                        </button>
                        {openParticipants[participant.id] ? <FiChevronDown /> : <FiChevronRight />}
                      </div>
                    </div>
                    
                    {openParticipants[participant.id] && (
                      <>
                        {/* Billing Lines mini-form */}
                        <div className="billing-form">
                          <h5>Billing Lines</h5>
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
                            <div className="form-group">
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
                                className="form-control"
                                min="0.5"
                                step="0.5"
                                placeholder="e.g., 3.5"
                              />
                            </div>
                            <div className="form-group">
                              <label>&nbsp;</label>
                              <button
                                className="btn btn-primary form-control"
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
                                <div>{line.code ? `${line.code} — ${line.description || ''}` : line.billing_code_id}</div>
                                <div>{line.hours}</div>
                                <div>{formatCurrency(line.amount || (line.unit_price * line.hours))}</div>
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
      
      {/* Requirements */}
      <div className="glass-card mb-4">
        <div className="card-header">
          <h3><FiList /> Requirements</h3>
          <button 
            className="btn btn-icon" 
            onClick={() => fetchRequirements(ruleId)} 
            title="Refresh Requirements"
          >
            <FiRefreshCw />
          </button>
        </div>
        <div className="card-body">
          <div className="requirements-grid">
            <div className="requirement-item">
              <strong>Participants:</strong> {requirements.participant_count}
            </div>
            <div className="requirement-item">
              <strong>WPU Total:</strong> {requirements.wpu_total}
            </div>
            <div className="requirement-item">
              <strong>Staff Required:</strong> {requirements.staff_required}
            </div>
            <div className="requirement-item">
              <strong>Vehicles Required:</strong> {requirements.vehicles_required}
            </div>
          </div>
        </div>
      </div>
      
      {/* Staff & Vehicles */}
      <div className="glass-card mb-4">
        <div className="card-header">
          <h3><FiUsers /> Staff & Vehicles</h3>
        </div>
        <div className="card-body">
          {/* Staff Placeholders */}
          <div className="section-container">
            <h4>Staff Placeholders</h4>
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
                      <button
                        className="btn btn-icon btn-danger"
                        onClick={() => deleteStaffPlaceholder(placeholder.id)}
                        disabled={saving}
                        title="Remove"
                      >
                        <FiX />
                      </button>
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
              
              <div className="placeholder-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => addStaffPlaceholder('auto')}
                  disabled={saving}
                >
                  <FiPlusCircle /> Add staff slot
                </button>
              </div>
            </div>
          </div>
          
          {/* Vehicle Placeholders */}
          <div className="section-container">
            <h4>Vehicle Placeholders</h4>
            <div className="placeholders-list">
              {vehiclePlaceholders.length === 0 && requirements.vehicles_required === 0 ? (
                <p className="muted">No vehicles required yet</p>
              ) : (
                <div className="placeholder-grid">
                  {/* Display existing placeholders first */}
                  {vehiclePlaceholders.map(placeholder => (
                    <div key={placeholder.id} className="placeholder-item">
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
                        className="btn btn-icon btn-danger"
                        onClick={() => deleteVehiclePlaceholder(placeholder.id)}
                        disabled={saving}
                        title="Remove"
                      >
                        <FiX />
                      </button>
                    </div>
                  ))}
                  
                  {/* Add auto placeholders up to vehicles_required */}
                  {Array.from({ length: Math.max(0, requirements.vehicles_required - vehiclePlaceholders.length) }).map((_, index) => (
                    <div key={`auto-${index}`} className="placeholder-item">
                      <select
                        defaultValue="auto"
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value !== 'auto') {
                            addVehiclePlaceholder('manual', value);
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
              
              <div className="placeholder-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => addVehiclePlaceholder()}
                  disabled={saving}
                >
                  <FiPlusCircle /> Add vehicle
                </button>
              </div>
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
          <p>
          When you are ready to finalize this program, click the button below.
            This will:
          </p>
          <ul>
            <li>Set the program to active status</li>
            <li>Generate instances for all applicable dates in the window</li>
            <li>Create dashboard cards for each time slot</li>
          </ul>
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
  );
};

export default ProgramTemplateWizard;
