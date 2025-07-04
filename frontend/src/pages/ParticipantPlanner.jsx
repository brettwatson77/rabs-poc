import React, { useState, useEffect } from 'react';
import { getParticipants, getParticipantEnrollments, updateParticipantEnrollments } from '../api/api';
import { useAppContext } from '../context/AppContext';
import '../styles/CrudPage.css'; // Using shared styles

// Map numeric day_of_week (0–6) to human-readable strings
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ParticipantPlanner = () => {
  const { simulatedDate } = useAppContext();
  const [participants, setParticipants] = useState([]);
  const [selectedParticipant, setSelectedParticipant] = useState('');
  
  // Holds the current, active enrollments from the DB
  const [enrollments, setEnrollments] = useState([]);
  const [availablePrograms, setAvailablePrograms] = useState([]);
  
  // Holds changes that have been staged but not yet saved
  const [pendingChanges, setPendingChanges] = useState({});
  // Holds the value of each date picker input
  const [dateInputs, setDateInputs] = useState({});
  
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch all participants on component mount
  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const data = await getParticipants();
        setParticipants(data);
      } catch (err) {
        setError('Failed to fetch participants.');
      } finally {
        setLoadingParticipants(false);
      }
    };
    fetchParticipants();
  }, []);

  // Fetch enrollments when a participant is selected
  useEffect(() => {
    if (!selectedParticipant) {
      setEnrollments([]);
      setAvailablePrograms([]);
      setPendingChanges({});
      return;
    }

    const fetchEnrollments = async () => {
      setLoadingEnrollments(true);
      setError(null);
      setSuccessMessage('');
      setPendingChanges({}); // Clear pending changes on participant switch
      try {
        const data = await getParticipantEnrollments(selectedParticipant);
        setEnrollments(data.enrollments);
        setAvailablePrograms(data.availablePrograms);
        // Initialize date inputs for all available programs
        const initialDates = data.availablePrograms.reduce((acc, prog) => {
          acc[prog.id] = new Date().toISOString().split('T')[0];
          return acc;
        }, {});
        setDateInputs(initialDates);
      } catch (err) {
        setError('Failed to fetch enrollment data.');
      } finally {
        setLoadingEnrollments(false);
      }
    };
    fetchEnrollments();
  }, [selectedParticipant]);

  /* ------------------------------------------------------------------
   * Refresh enrollments when the simulated date advances.  This ensures
   * the UI reflects any pending changes that were auto-processed by the
   * backend recalculation engine once their effective date is reached.
   * ---------------------------------------------------------------- */
  useEffect(() => {
    if (!selectedParticipant) return; // nothing to refresh

    const refreshEnrollments = async () => {
      setLoadingEnrollments(true);
      setError(null);
      try {
        const data = await getParticipantEnrollments(selectedParticipant);
        setEnrollments(data.enrollments);
        setAvailablePrograms(data.availablePrograms);
      } catch (err) {
        setError('Failed to refresh enrollment data.');
      } finally {
        setLoadingEnrollments(false);
      }
    };

    refreshEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulatedDate]);

  const handleDateChange = (programId, date) => {
    setDateInputs(prev => ({ ...prev, [programId]: date }));
  };

  const handleScheduleChange = (programId) => {
    const isCurrentlyEnrolled = enrollments.some(e => e.program_id === programId);
    const effectiveDate = dateInputs[programId];

    if (!effectiveDate) {
      alert('Please select an effective date for the change.');
      return;
    }

    setPendingChanges(prev => ({
      ...prev,
      [programId]: {
        action: isCurrentlyEnrolled ? 'remove' : 'add',
        effectiveDate: effectiveDate,
      }
    }));
  };
  
  const cancelPendingChange = (programId) => {
      setPendingChanges(prev => {
          const newChanges = {...prev};
          delete newChanges[programId];
          return newChanges;
      });
  };

  const handleSave = async () => {
    if (!selectedParticipant || Object.keys(pendingChanges).length === 0) return;
    
    setError(null);
    setSuccessMessage('');
    try {
      // The backend will need to be updated to handle this new payload format
      const result = await updateParticipantEnrollments(selectedParticipant, pendingChanges);
      setSuccessMessage(result.message || 'Changes saved successfully!');
      setPendingChanges({}); // Clear pending changes after save
      // Refetch data to show the new state
      const data = await getParticipantEnrollments(selectedParticipant);
      setEnrollments(data.enrollments);
    } catch (err) {
      setError('Failed to save enrollments.');
    }
  };

  const getProgramStyle = (pendingChange) => {
    if (!pendingChange) return {};
    if (pendingChange.action === 'add') return { color: 'green', fontWeight: 'bold' };
    if (pendingChange.action === 'remove') return { color: 'red', fontWeight: 'bold' };
    return {};
  };

  return (
    <div className="crud-page-container">
      <h1>Participant Planner</h1>

      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="participant-select" style={{ marginRight: '10px' }}>Select Participant:</label>
        <select 
          id="participant-select"
          value={selectedParticipant}
          onChange={(e) => setSelectedParticipant(e.target.value)}
          disabled={loadingParticipants}
        >
          <option value="">--Please choose a participant--</option>
          {participants.map(p => (
            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
          ))}
        </select>
      </div>

      {loadingParticipants && <p>Loading participants...</p>}
      
      {selectedParticipant && (
        <div>
          <h2>Enrollments for {participants.find(p => p.id == selectedParticipant)?.first_name}</h2>
          {loadingEnrollments && <p>Loading enrollments...</p>}
          
          {!loadingEnrollments && availablePrograms.length > 0 && (
            <div style={{ textAlign: 'left' }}>
              {availablePrograms.map(program => {
                const isEnrolled = enrollments.some(e => e.program_id === program.id);
                const pendingChange = pendingChanges[program.id];
                const isChecked = (isEnrolled && !pendingChange) || (isEnrolled && pendingChange?.action === 'add') || (!isEnrolled && pendingChange?.action === 'add');
                
                return (
                  <div key={program.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <input 
                      type="checkbox"
                      id={`program-${program.id}`}
                      checked={isChecked}
                      onChange={() => handleScheduleChange(program.id)}
                      disabled={!!pendingChange}
                    />
                    <label htmlFor={`program-${program.id}`} style={getProgramStyle(pendingChange)}>
                      {program.name} ({DAY_NAMES[program.day_of_week]})
                    </label>
                    <input 
                      type="date"
                      value={dateInputs[program.id] || ''}
                      onChange={(e) => handleDateChange(program.id, e.target.value)}
                      disabled={!!pendingChange}
                    />
                    {pendingChange && (
                        <>
                            <span style={getProgramStyle(pendingChange)}>
                                (Pending {pendingChange.action} on {pendingChange.effectiveDate})
                            </span>
                            <button onClick={() => cancelPendingChange(program.id)} style={{fontSize: '0.8em', padding: '2px 5px'}}>Cancel</button>
                        </>
                    )}
                  </div>
                );
              })}
              <button onClick={handleSave} style={{ marginTop: '20px' }} disabled={Object.keys(pendingChanges).length === 0}>
                Save Pending Changes
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="error-message">{error}</p>}
      {successMessage && <p style={{ color: 'green', marginTop: '20px' }}>{successMessage}</p>}
    </div>
  );
};

export default ParticipantPlanner;
