import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from '../api/api';
import '../styles/CrudPage.css';
import '../styles/Vehicles.css';

const Vehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [formData, setFormData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  // ---------- Maintenance / blackout state ----------------
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [blackouts, setBlackouts] = useState([]);
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [blackoutForm, setBlackoutForm] = useState({
    start_time: '',
    end_time: '',
    reason: 'Scheduled Maintenance',
    notes: ''
  });

  const initialFormState = {
    name: '',
    capacity: 10,
    wheelchair_capacity: 0,
    registration: '',
    make: '',
    model: '',
    year: null,
    active: true,
    notes: '',
    location_lat: null,
    location_lng: null
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVehicles();
      setVehicles(data);
    } catch (err) {
      setError('Failed to fetch vehicles. Please ensure the backend is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClick = () => {
    setFormData(initialFormState);
    setEditMode(false);
    setIsFormVisible(true);
  };

  const handleEditClick = (vehicle) => {
    setFormData({ ...vehicle });
    setEditMode(true);
    setIsFormVisible(true);
  };

  const handleDeleteClick = async (id) => {
    if (window.confirm('Are you sure you want to delete this vehicle?')) {
      try {
        await deleteVehicle(id);
        fetchVehicles();
      } catch (err) {
        setError('Failed to delete vehicle.');
        console.error(err);
      }
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  /* ----------------------------------------------------------
   * Vehicle blackout / maintenance helpers
   * -------------------------------------------------------- */
  const fetchVehicleBlackouts = async (vehicleId) => {
    try {
      const res = await axios.get(`/api/v1/availability/vehicles/${vehicleId}/blackouts`);
      setBlackouts(res.data.blackouts || []);
    } catch (err) {
      console.error('Failed to fetch blackouts', err);
      setBlackouts([]);
    }
  };

  const createBlackout = async () => {
    if (!selectedVehicle) return;
    try {
      await axios.post(
        `/api/v1/availability/vehicles/${selectedVehicle.id}/blackouts`,
        blackoutForm
      );
      await fetchVehicleBlackouts(selectedVehicle.id);
      // reset form
      setBlackoutForm({
        start_time: '',
        end_time: '',
        reason: 'Scheduled Maintenance',
        notes: ''
      });
    } catch (err) {
      console.error('Failed to create blackout', err);
    }
  };

  const deleteBlackout = async (id) => {
    if (!window.confirm('Delete this maintenance entry?')) return;
    try {
      await axios.delete(`/api/v1/availability/blackouts/${id}`);
      setBlackouts(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error('Failed to delete blackout', err);
    }
  };

  /* ----------------------------------------------------------
   * Utility: upcoming maintenance flag (< 14 days)
   * -------------------------------------------------------- */
  const hasUpcomingMaintenance = (vehicle) => {
    const upcoming = blackouts.find(
      b =>
        b.start_time &&
        new Date(b.start_time) - new Date() < 14 * 24 * 60 * 60 * 1000
    );
    return upcoming;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (editMode) {
        await updateVehicle(formData.id, formData);
      } else {
        await createVehicle(formData);
      }
      fetchVehicles();
      setIsFormVisible(false);
      setFormData(null);
    } catch (err) {
      setError('Failed to save vehicle. Please check the form data.');
      console.error(err);
    }
  };

  const handleCancelClick = () => {
    setIsFormVisible(false);
    setFormData(null);
    setError(null);
  };

  /* ----------------------------------------------------------
   * UI Helper Utilities
   * -------------------------------------------------------- */
  const typeIcon = (type) => {
    // Determine icon based on make/model/wheelchair capacity
    if (type === 'Bus' || (type && type.toLowerCase().includes('bus'))) {
      return '🚌';
    } else if (type === 'Van' || (type && type.toLowerCase().includes('van'))) {
      return '🚐';
    } else if (type === 'WAV' || (type && type.includes('wheelchair'))) {
      return '♿️🚐';
    } else {
      return '🚗';
    }
  };

  const getVehicleType = (vehicle) => {
    if (vehicle.wheelchair_capacity > 0) {
      return 'WAV';
    } else if (vehicle.capacity >= 12) {
      return 'Bus';
    } else if (vehicle.capacity >= 7) {
      return 'Van';
    } else {
      return 'Car';
    }
  };

  const getStatusDisplay = (active) => {
    return active ? 'Available' : 'Out of Service';
  };

  const statusColour = (active) => {
    return active ? '#4caf50' : '#e53935';
  };

  /* ----------------------------------------------------------
   * Filter + search vehicles
   * -------------------------------------------------------- */
  const filteredVehicles = vehicles
    .filter((v) => {
      const term = search.toLowerCase();
      const matchesSearch =
        term === '' ||
        (v.name && v.name.toLowerCase().includes(term)) ||
        (v.registration && v.registration.toLowerCase().includes(term)) ||
        (v.id && v.id.toLowerCase().includes(term));

      // Derive type from capacity and wheelchair_capacity
      const vehicleType = getVehicleType(v);
      const matchesType =
        filterType === 'all' || vehicleType === filterType;

      // Map active boolean to status string for filtering
      const statusStr = getStatusDisplay(v.active);
      const matchesStatus =
        filterStatus === 'all' || statusStr === filterStatus;

      return matchesSearch && matchesType && matchesStatus;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return (
    <>
      <div className="crud-page-container">
        {/* ---------- Universal Header Pattern ---------------- */}
        <div className="vehicles-header">
          {/* Left – title & subtitle */}
          <div className="vehicles-title">
            <h1>Fleet Management</h1>
            <p className="vehicles-subtitle">
              Manage vehicles, maintenance schedules, and capacity planning
            </p>
          </div>

          {/* Right – search & primary action */}
          <div className="vehicles-actions">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search by name, rego, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input"
              />
            </div>

            {!isFormVisible && (
              <button onClick={handleAddClick} className="add-button">
                Add New Vehicle
              </button>
            )}
          </div>
        </div>

        {error && <p className="error-message">{error}</p>}
        {!isFormVisible && (
          <>
            <div className="vehicle-control-bar">
              <div className="vehicle-filters">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Types</option>
                  <option value="Bus">Bus</option>
                  <option value="Van">Van</option>
                  <option value="Car">Car</option>
                  <option value="WAV">Wheelchair Accessible</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Statuses</option>
                  <option value="Available">Available</option>
                  <option value="Out of Service">Out of Service</option>
                </select>
              </div>
            </div>

            {loading ? (
              <p>Loading vehicles...</p>
            ) : (
              <div className="vehicle-card-grid">
                {filteredVehicles.map((v) => {
                  const vehicleType = getVehicleType(v);
                  const statusStr = getStatusDisplay(v.active);
                  
                  return (
                    <div className="vehicle-card" key={v.id}>
                      <div className="vehicle-card-header">
                        <div className="vehicle-icon">{typeIcon(vehicleType)}</div>
                        <h3>
                          {v.name}{' '}
                          <span className="vehicle-id">({v.id})</span>
                        </h3>
                        {!v.active && <span title="Out of Service">🔧</span>}
                        {v.active && hasUpcomingMaintenance(v) && (
                          <span title="Upcoming maintenance">⚠️</span>
                        )}
                        <span
                          className="status-chip"
                          style={{ backgroundColor: statusColour(v.active) }}
                        >
                          {statusStr}
                        </span>
                      </div>

                      <div className="capacity-section">
                        <div className="capacity-bar-bg">
                          <div
                            className="capacity-bar-fg"
                            style={{
                              width: `${(v.capacity / 15) * 100}%`,
                            }}
                          ></div>
                        </div>
                        <small>
                          {v.capacity} seats{' '}
                          {v.wheelchair_capacity > 0 && (
                            <span className="wheelchair-flag" title="Wheelchair Accessible">
                              ♿ ({v.wheelchair_capacity})
                            </span>
                          )}
                        </small>
                      </div>

                      <div className="vehicle-info">
                        <div>
                          <strong>Rego:</strong>{' '}
                          {v.registration || 'N/A'}
                        </div>
                        <div>
                          <strong>Make/Model:</strong> {v.make} {v.model} {v.year || ''}
                        </div>
                      </div>

                      <div className="vehicle-card-actions">
                        <button
                          className="edit-button"
                          onClick={() => handleEditClick(v)}
                        >
                          Edit
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => handleDeleteClick(v.id)}
                        >
                          Delete
                        </button>
                        <button
                          className="maint-button"
                          onClick={() => {
                            setSelectedVehicle(v);
                            setShowMaintModal(true);
                            fetchVehicleBlackouts(v.id);
                          }}
                        >
                          Schedule&nbsp;Maintenance
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {isFormVisible && formData && (
          <div className="form-container">
            <h2>{editMode ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="form-grid">
                {/* ID is auto-generated by the database – no manual entry */}
                <div className="form-field">
                  <label>Name</label>
                  <input type="text" name="name" value={formData.name || ''} onChange={handleFormChange} required />
                </div>
                <div className="form-field">
                  <label>Registration</label>
                  <input type="text" name="registration" value={formData.registration || ''} onChange={handleFormChange} />
                </div>
                <div className="form-field">
                  <label>Capacity (incl. driver)</label>
                  <input type="number" name="capacity" value={formData.capacity} onChange={handleFormChange} required min="1" />
                </div>
                <div className="form-field">
                  <label>Wheelchair Capacity</label>
                  <input type="number" name="wheelchair_capacity" value={formData.wheelchair_capacity || 0} onChange={handleFormChange} min="0" />
                </div>
                <div className="form-field">
                  <label>Make</label>
                  <input type="text" name="make" value={formData.make || ''} onChange={handleFormChange} />
                </div>
                <div className="form-field">
                  <label>Model</label>
                  <input type="text" name="model" value={formData.model || ''} onChange={handleFormChange} />
                </div>
                <div className="form-field">
                  <label>Year</label>
                  <input type="number" name="year" value={formData.year || ''} onChange={handleFormChange} min="1990" max="2030" />
                </div>
                <div className="form-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="active"
                      checked={formData.active}
                      onChange={handleFormChange}
                    />
                    Vehicle Active
                  </label>
                </div>
                <div className="form-field full-width">
                  <label>Notes</label>
                  <textarea name="notes" value={formData.notes || ''} onChange={handleFormChange}></textarea>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="save-button">Save Vehicle</button>
                <button type="button" onClick={handleCancelClick} className="cancel-button">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading && <p>Loading vehicles...</p>}
      </div>

      {!loading && !isFormVisible && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Registration</th>
                <th>Capacity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{v.name}</td>
                  <td>{v.registration || 'N/A'}</td>
                  <td>{v.capacity}</td>
                  <td className="actions-cell">
                    <button onClick={() => handleEditClick(v)} className="edit-button">Edit</button>
                    <button onClick={() => handleDeleteClick(v.id)} className="delete-button">Delete</button>
                    <button
                      onClick={() => {
                        setSelectedVehicle(v);
                        setShowMaintModal(true);
                        fetchVehicleBlackouts(v.id);
                      }}
                      className="maint-button"
                    >
                      Maint
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- Maintenance Modal ---------------- */}
      {showMaintModal && selectedVehicle && (
        <div className="modal-overlay">
          <div className="modal maintenance-modal">
            <h2>
              Schedule Maintenance – {selectedVehicle.name} ({selectedVehicle.id})
            </h2>

            {/* Existing blackouts list */}
            <h4>Existing / Upcoming</h4>
            {blackouts.length === 0 ? (
              <p>No maintenance entries.</p>
            ) : (
              <ul className="blackout-list">
                {blackouts.map((b) => (
                  <li key={b.id}>
                    <strong>
                      {new Date(b.start_time).toLocaleDateString()} →
                      {new Date(b.end_time).toLocaleDateString()}
                    </strong>{' '}
                    ({b.reason})
                    <button onClick={() => deleteBlackout(b.id)} className="delete-button small">
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* New blackout form */}
            <h4>New Maintenance Window</h4>
            <div className="form-inline">
              <input
                type="datetime-local"
                value={blackoutForm.start_time}
                onChange={(e) =>
                  setBlackoutForm((p) => ({ ...p, start_time: e.target.value }))
                }
              />
              <span>to</span>
              <input
                type="datetime-local"
                value={blackoutForm.end_time}
                onChange={(e) =>
                  setBlackoutForm((p) => ({ ...p, end_time: e.target.value }))
                }
              />
            </div>
            <div className="form-field">
              <label>Reason</label>
              <select
                value={blackoutForm.reason}
                onChange={(e) =>
                  setBlackoutForm((p) => ({ ...p, reason: e.target.value }))
                }
              >
                <option>Scheduled Maintenance</option>
                <option>Repairs</option>
                <option>Out of Service</option>
                <option>Annual Service</option>
              </select>
            </div>
            <div className="form-field">
              <label>Notes</label>
              <textarea
                value={blackoutForm.notes}
                onChange={(e) =>
                  setBlackoutForm((p) => ({ ...p, notes: e.target.value }))
                }
              ></textarea>
            </div>

            <div className="modal-actions">
              <button className="save-button" onClick={createBlackout}>
                Save Maintenance
              </button>
              <button
                className="cancel-button"
                onClick={() => {
                  setShowMaintModal(false);
                  setSelectedVehicle(null);
                  setBlackouts([]);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Vehicles;
