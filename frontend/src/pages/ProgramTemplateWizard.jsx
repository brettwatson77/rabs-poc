import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
  FiEdit,
  FiArrowUp,
  FiArrowDown,
  FiLink
} from 'react-icons/fi';

// API base URL from environment
const API_URL = import.meta.env.VITE_API_URL || '';

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
  const [autoAssignStaff, setAutoAssignStaff] = useState(true);
  const [autoAssignVehicles, setAutoAssignVehicles] = useState(true);
  
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

  // State for new venue form
  const [showNewVenueForm, setShowNewVenueForm] = useState(false);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueAddress, setNewVenueAddress] = useState('');

  // State for time slots
  const [slots, setSlots] = useState([]);
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [newSlot, setNewSlot] = useState({
    slot_type: 'activity',
    start_time: '09:00',
    end_time: '15:00',
    route_run_number: '',
    label: ''
  });

  // State for billing
  const [billingCodes, setBillingCodes] = useState([]);
  const [participantBilling, setParticipantBilling] = useState({});
  const [addedParticipants, setAddedParticipants] = useState([]);
  
  // Create draft rule on component mount
  useEffect(() => {
    const createDraftRule = async () => {
      try {
        setLoading(true);
        const response = await axios.post(`${API_URL}/api/v1/templates/rules`);
        if (response.data.success && response.data.data) {
          const ruleId = response.data.data.id;
          setRuleId(ruleId);
          // After getting rule ID, fetch participants and venues
          fetchParticipants();
          fetchVenues();
          fetchBillingCodes();
          // Start polling requirements
          fetchRequirements(ruleId);
          // Fetch slots if any
          fetchSlots(ruleId);
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
      const response = await axios.get(`${API_URL}/api/v1/participants`);
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
      const response = await axios.get(`${API_URL}/api/v1/venues`);
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

  // Fetch billing codes
  const fetchBillingCodes = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/v1/finance/billing-codes`);
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
      const response = await axios.get(`${API_URL}/api/v1/templates/rules/${id}/slots`);
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
      const response = await axios.get(`${API_URL}/api/v1/templates/rules/${id}/requirements`);
      if (response.data.success && response.data.data) {
        setRequirements(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching requirements:', err);
      // Don't show toast for requirements errors as it's polled
    }
  };
  
  // Update rule properties
  const updateRule = async () => {
    if (!ruleId) return;
    
    try {
      setSaving(true);
      const response = await axios.patch(`${API_URL}/api/v1/templates/rules/${ruleId}`, {
        name: ruleName,
        description: ruleDescription,
        anchor_date: anchorDate,
        recurrence_pattern: recurrencePattern,
        day_of_week: parseInt(dayOfWeek),
        venue_id: venueId,
        auto_assign_staff: autoAssignStaff,
        auto_assign_vehicles: autoAssignVehicles
      });
      
      if (response.data.success) {
        toast.success('Program details updated');
        // Refresh requirements after update
        fetchRequirements(ruleId);
      } else {
        throw new Error('Failed to update rule');
      }
    } catch (err) {
      console.error('Error updating rule:', err);
      toast.error('Failed to update program details');
    } finally {
      setSaving(false);
    }
  };

  // Create new venue
  const createVenue = async () => {
    if (!newVenueName.trim()) {
      toast.error('Venue name is required');
      return;
    }

    try {
      setSaving(true);
      const response = await axios.post(`${API_URL}/api/v1/venues`, {
        name: newVenueName.trim(),
        address: newVenueAddress.trim() || null
      });

      if (response.data.success && response.data.data) {
        const newVenue = response.data.data;
        setVenues([...venues, newVenue]);
        setVenueId(newVenue.id);
        setShowNewVenueForm(false);
        setNewVenueName('');
        setNewVenueAddress('');
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
        seq,
        route_run_number: newSlot.route_run_number ? parseInt(newSlot.route_run_number) : null
      };
      
      const response = await axios.post(`${API_URL}/api/v1/templates/rules/${ruleId}/slots`, slotToAdd);
      
      if (response.data.success) {
        toast.success('Time slot added');
        // Reset form and refresh slots
        setNewSlot({
          slot_type: 'activity',
          start_time: '09:00',
          end_time: '15:00',
          route_run_number: '',
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
      const response = await axios.delete(`${API_URL}/api/v1/templates/rules/${ruleId}/slots/${slotId}`);
      
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

  // Update slot order (move up/down)
  const moveSlot = async (slotId, direction) => {
    const slotIndex = slots.findIndex(s => s.id === slotId);
    if (slotIndex === -1) return;
    
    // If moving up and already at top, or moving down and already at bottom, do nothing
    if ((direction === 'up' && slotIndex === 0) || 
        (direction === 'down' && slotIndex === slots.length - 1)) {
      return;
    }
    
    // Create a copy of slots and swap positions
    const newSlots = [...slots];
    const swapIndex = direction === 'up' ? slotIndex - 1 : slotIndex + 1;
    
    // Swap seq values
    const tempSeq = newSlots[slotIndex].seq;
    newSlots[slotIndex].seq = newSlots[swapIndex].seq;
    newSlots[swapIndex].seq = tempSeq;
    
    try {
      setSaving(true);
      
      // Delete both slots
      await axios.delete(`${API_URL}/api/v1/templates/rules/${ruleId}/slots/${newSlots[slotIndex].id}`);
      await axios.delete(`${API_URL}/api/v1/templates/rules/${ruleId}/slots/${newSlots[swapIndex].id}`);
      
      // Re-add both slots with updated seq values
      await axios.post(`${API_URL}/api/v1/templates/rules/${ruleId}/slots`, newSlots[slotIndex]);
      await axios.post(`${API_URL}/api/v1/templates/rules/${ruleId}/slots`, newSlots[swapIndex]);
      
      // Refresh slots
      fetchSlots(ruleId);
    } catch (err) {
      console.error('Error reordering slots:', err);
      toast.error('Failed to reorder time slots');
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
      const response = await axios.post(`${API_URL}/api/v1/templates/rules/${ruleId}/participants`, {
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
      const response = await axios.post(
        `${API_URL}/api/v1/templates/rules/${ruleId}/participants/${rppId}/billing`,
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
      const response = await axios.post(`${API_URL}/api/v1/templates/rules/${ruleId}/finalize`);
      
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

  // Get billing code description
  const getBillingCodeDescription = (code) => {
    const billingCode = billingCodes.find(bc => bc.code === code);
    return billingCode ? billingCode.description : '';
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
                      value={newVenueName}
                      onChange={(e) => setNewVenueName(e.target.value)}
                      className="form-control"
                      placeholder="Enter venue name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Address (optional)</label>
                    <input
                      type="text"
                      value={newVenueAddress}
                      onChange={(e) => setNewVenueAddress(e.target.value)}
                      className="form-control"
                      placeholder="Enter address"
                    />
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
                      disabled={saving || !newVenueName.trim()}
                    >
                      <FiSave /> Save Venue
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={autoAssignStaff}
                  onChange={(e) => setAutoAssignStaff(e.target.checked)}
                />{' '}
                Auto-assign staff on finalize
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={autoAssignVehicles}
                  onChange={(e) => setAutoAssignVehicles(e.target.checked)}
                />{' '}
                Auto-assign vehicles on finalize
              </label>
            </div>
          </div>
          
          <div className="form-actions">
            <button 
              className="btn btn-primary"
              onClick={updateRule}
              disabled={saving}
            >
              <FiSave /> Save Details
            </button>
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
                <label>Run # (optional)</label>
                <input
                  type="number"
                  value={newSlot.route_run_number}
                  onChange={(e) => setNewSlot({...newSlot, route_run_number: e.target.value})}
                  className="form-control"
                  min="1"
                />
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
                    <th>Type</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Run #</th>
                    <th>Label</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.sort((a, b) => a.seq - b.seq).map((slot) => (
                    <tr key={slot.id}>
                      <td>{slot.slot_type}</td>
                      <td>{formatTime(slot.start_time)}</td>
                      <td>{formatTime(slot.end_time)}</td>
                      <td>{slot.route_run_number || '-'}</td>
                      <td>{slot.label || '-'}</td>
                      <td className="actions-cell">
                        <button
                          className="btn btn-icon"
                          onClick={() => moveSlot(slot.id, 'up')}
                          disabled={saving}
                          title="Move up"
                        >
                          <FiArrowUp />
                        </button>
                        <button
                          className="btn btn-icon"
                          onClick={() => moveSlot(slot.id, 'down')}
                          disabled={saving}
                          title="Move down"
                        >
                          <FiArrowDown />
                        </button>
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
            <ul className="participant-list">
              {addedParticipants.map(participant => (
                <li key={participant.id} className="participant-item">
                  <div className="participant-name">{participant.name}</div>
                  
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
                            <option key={code.id} value={code.code}>
                              {code.code} - {code.description}
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
                </li>
              ))}
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
