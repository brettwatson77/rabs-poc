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
  FiMapPin,
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiList
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
  const [startTime, setStartTime] = useState('09:30');
  const [endTime, setEndTime] = useState('15:00');
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
  
  // Create draft rule on component mount
  useEffect(() => {
    const createDraftRule = async () => {
      try {
        setLoading(true);
        const response = await axios.post(`${API_URL}/api/v1/templates/rules`);
        if (response.data.success && response.data.data) {
          setRuleId(response.data.data.id);
          // After getting rule ID, fetch participants and venues
          fetchParticipants();
          fetchVenues();
          // Start polling requirements
          fetchRequirements(response.data.data.id);
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
        day_of_week: parseInt(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        venue_id: venueId
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
  
  // Add default slots
  const addDefaultSlots = async () => {
    if (!ruleId) return;
    
    try {
      setSaving(true);
      const slots = [
        {
          seq: 1,
          slot_type: 'pickup',
          start_time: '08:30',
          end_time: '09:30',
          label: 'Pickup',
          route_run_number: 1
        },
        {
          seq: 2,
          slot_type: 'activity',
          start_time: startTime,
          end_time: endTime,
          label: ruleName
        },
        {
          seq: 3,
          slot_type: 'dropoff',
          start_time: '15:00',
          end_time: '16:30',
          label: 'Dropoff',
          route_run_number: 1
        }
      ];
      
      const response = await axios.post(`${API_URL}/api/v1/templates/rules/${ruleId}/slots`, {
        slots
      });
      
      if (response.data.success) {
        toast.success('Default slots added');
      } else {
        throw new Error('Failed to add slots');
      }
    } catch (err) {
      console.error('Error adding slots:', err);
      toast.error('Failed to add default slots');
    } finally {
      setSaving(false);
    }
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
        setAddedParticipantIds([...addedParticipantIds, selectedParticipantId]);
        setSelectedParticipantId('');
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
  
  // Finalize program and trigger syncRethread
  const finalizeProgram = async () => {
    if (!ruleId) return;
    
    try {
      setSaving(true);
      const response = await axios.post(`${API_URL}/api/v1/templates/rules/${ruleId}/finalize`);
      
      if (response.data.success) {
        const summary = response.data.data;
        toast.success(
          <div>
            <strong>Program finalized!</strong>
            <div>Dates processed: {summary.datesProcessed}</div>
            <div>Rules touched: {summary.rulesTouched}</div>
            <div>Instances created: {summary.instancesUpserted}</div>
            <div>Cards written: {summary.cardsWritten}</div>
          </div>
        );
        
        // Navigate to dashboard after short delay
        setTimeout(() => {
          navigate('/');
        }, 3000);
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
  
  // Get participant name by ID
  const getParticipantName = (id) => {
    const participant = participants.find(p => p.id === id);
    return participant ? `${participant.first_name} ${participant.last_name}` : 'Unknown';
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
              <label htmlFor="ruleDescription">Description</label>
              <textarea
                id="ruleDescription"
                value={ruleDescription}
                onChange={(e) => setRuleDescription(e.target.value)}
                className="form-control"
                rows="2"
              />
            </div>
            
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
            
            <div className="form-group">
              <label htmlFor="startTime">Start Time</label>
              <input
                type="time"
                id="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="form-control"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="endTime">End Time</label>
              <input
                type="time"
                id="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="form-control"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="venueId">Venue</label>
              <select
                id="venueId"
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className="form-control"
              >
                <option value="">Select Venue</option>
                {venues.map(venue => (
                  <option key={venue.id} value={venue.id}>{venue.name}</option>
                ))}
              </select>
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
          <p>
            Add default time slots for this program. This will create:
          </p>
          <ul>
            <li>Pickup: 8:30 AM - 9:30 AM</li>
            <li>Activity: {startTime} - {endTime}</li>
            <li>Dropoff: 3:00 PM - 4:30 PM</li>
          </ul>
          <div className="form-actions">
            <button 
              className="btn btn-primary"
              onClick={addDefaultSlots}
              disabled={saving}
            >
              <FiPlusCircle /> Add Default Slots
            </button>
          </div>
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
          
          <h4>Added Participants ({addedParticipantIds.length})</h4>
          {addedParticipantIds.length === 0 ? (
            <p className="muted">No participants added yet</p>
          ) : (
            <ul className="participant-list">
              {addedParticipantIds.map(id => (
                <li key={id} className="participant-item">
                  {getParticipantName(id)}
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
            When you're ready to finalize this program, click the button below.
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
