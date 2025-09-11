import React from 'react';
import { FiClock, FiPlusCircle, FiTrash2 } from 'react-icons/fi';
import { useProgramForm } from '../context/ProgramFormContext';

const TimeSlotsEditor = (props) => {
  const ctx = useProgramForm();
  const {
    slots = [],
    newSlot = {},
    setNewSlot,
    addSlot,
    deleteSlot,
    formatTime = (s) => s,
    shiftLength = null,
    slotTypeOptions = [],
    saving = false,
  } = { ...(ctx || {}), ...props };

  return (
    <div className="glass-card mb-4">
      <div className="card-header">
        <h3><FiClock /> Time Slots</h3>
      </div>
      <div className="card-body">
        <div className="add-slot-form">
          <div className="form-row">
            <div className="form-group">
              <label>Start</label>
              <input
                type="time"
                value={newSlot.start_time || ''}
                onChange={(e) => setNewSlot && setNewSlot({ ...(newSlot || {}), start_time: e.target.value })}
                className="form-control"
              />
            </div>
            <div className="form-group">
              <label>End</label>
              <input
                type="time"
                value={newSlot.end_time || ''}
                onChange={(e) => setNewSlot && setNewSlot({ ...(newSlot || {}), end_time: e.target.value })}
                className="form-control"
              />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select
                value={newSlot.slot_type || ''}
                onChange={(e) => setNewSlot && setNewSlot({ ...(newSlot || {}), slot_type: e.target.value })}
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
                value={newSlot.label || ''}
                onChange={(e) => setNewSlot && setNewSlot({ ...(newSlot || {}), label: e.target.value })}
                className="form-control"
                placeholder="e.g., Morning pickup"
              />
            </div>
            <div className="form-group">
              <label>&nbsp;</label>
              <button
                className="btn btn-primary"
                onClick={addSlot}
                disabled={saving || !newSlot.start_time || !newSlot.end_time}
              >
                <FiPlusCircle /> Add Row
              </button>
            </div>
          </div>
        </div>

        <div className="slots-table-container">
          <h4>Schedule</h4>
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
                    <td>{slot.slot_type.charAt(0).toUpperCase() + slot.slot_type.slice(1)}</td>
                    <td>{slot.label || '-'}</td>
                    <td className="actions-cell">
                      <button
                        className="btn btn-icon btn-danger"
                        onClick={() => deleteSlot && deleteSlot(slot.id)}
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

        {shiftLength && (
          <div className="shift-length">
            <strong>Shift Length:</strong> {formatTime(shiftLength.start)} to {formatTime(shiftLength.end)}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeSlotsEditor;
