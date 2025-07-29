import React, { useState, useEffect } from 'react';
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

  const initialFormState = {
    id: '',
    description: '',
    seats: 10,
    registration: '',
    vehicle_type: 'Van', // Bus, Van, Car, WAV
    wheelchair_access: false,
    status: 'Available', // Available, In Use, Maintenance, Out of Service
    rego_expiry: '',
    insurance_expiry: '',
    notes: ''
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
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
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
    switch (type) {
      case 'Bus':
        return '🚌';
      case 'Van':
        return '🚐';
      case 'Car':
        return '🚗';
      case 'WAV':
        return '♿️🚐';
      default:
        return '🚙';
    }
  };

  const statusColour = (status) => {
    switch (status) {
      case 'Available':
        return '#4caf50';
      case 'In Use':
        return '#2196f3';
      case 'Maintenance':
        return '#ff9800';
      case 'Out of Service':
        return '#e53935';
      default:
        return '#9e9e9e';
    }
  };

  /* ----------------------------------------------------------
   * Filter + search vehicles
   * -------------------------------------------------------- */
  const filteredVehicles = vehicles
    .filter((v) => {
      const term = search.toLowerCase();
      const matchesSearch =
        term === '' ||
        v.description.toLowerCase().includes(term) ||
        v.registration?.toLowerCase().includes(term) ||
        v.id.toLowerCase().includes(term);

      const matchesType =
        filterType === 'all' || v.vehicle_type === filterType;

      const matchesStatus =
        filterStatus === 'all' || v.status === filterStatus;

      return matchesSearch && matchesType && matchesStatus;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return (
    <>
      <div className="crud-page-container">
        <h1>Fleet Management</h1>
        {error && <p className="error-message">{error}</p>}
        {!isFormVisible && (
          <>
            <div className="vehicle-control-bar">
              <button
                onClick={handleAddClick}
                className="add-new-button"
              >
                Add New Vehicle
              </button>

              <div className="vehicle-filters">
                <input
                  type="text"
                  placeholder="Search by ID, description, rego..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="vehicle-search"
                />

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
                  <option value="In Use">In Use</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Out of Service">Out of Service</option>
                </select>
              </div>
            </div>

            {loading ? (
              <p>Loading vehicles...</p>
            ) : (
              <div className="vehicle-card-grid">
                {filteredVehicles.map((v) => (
                  <div className="vehicle-card" key={v.id}>
                    <div className="vehicle-card-header">
                      <div className="vehicle-icon">{typeIcon(v.vehicle_type)}</div>
                      <h3>
                        {v.description}{' '}
                        <span className="vehicle-id">({v.id})</span>
                      </h3>
                      <span
                        className="status-chip"
                        style={{ backgroundColor: statusColour(v.status) }}
                      >
                        {v.status}
                      </span>
                    </div>

                    <div className="capacity-section">
                      <div className="capacity-bar-bg">
                        <div
                          className="capacity-bar-fg"
                          style={{
                            width: `${(v.seats / 15) * 100}%`,
                          }}
                        ></div>
                      </div>
                      <small>
                        {v.seats} seats{' '}
                        {v.wheelchair_access && (
                          <span className="wheelchair-flag" title="Wheelchair Accessible">
                            ♿
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
                        <strong>Type:</strong> {v.vehicle_type}
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {isFormVisible && formData && (
          <div className="form-container">
            <h2>{editMode ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Vehicle ID (e.g., V1, V5)</label>
                  <input type="text" name="id" value={formData.id} onChange={handleFormChange} required disabled={editMode} />
                </div>
                <div className="form-field">
                  <label>Description</label>
                  <input type="text" name="description" value={formData.description || ''} onChange={handleFormChange} required />
                </div>
                <div className="form-field">
                  <label>Registration</label>
                  <input type="text" name="registration" value={formData.registration || ''} onChange={handleFormChange} />
                </div>
                <div className="form-field">
                  <label>Seats (incl. driver)</label>
                  <input type="number" name="seats" value={formData.seats} onChange={handleFormChange} required min="1" />
                </div>
                <div className="form-field">
                  <label>Vehicle Type</label>
                  <select
                    name="vehicle_type"
                    value={formData.vehicle_type}
                    onChange={handleFormChange}
                  >
                    <option value="Bus">Bus</option>
                    <option value="Van">Van</option>
                    <option value="Car">Car</option>
                    <option value="WAV">Wheelchair Accessible Van</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="wheelchair_access"
                      checked={formData.wheelchair_access}
                      onChange={handleFormChange}
                    />
                    Wheelchair Accessible
                  </label>
                </div>
                <div className="form-field">
                  <label>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                  >
                    <option value="Available">Available</option>
                    <option value="In Use">In Use</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Out of Service">Out of Service</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Rego Expiry</label>
                  <input
                    type="date"
                    name="rego_expiry"
                    value={formData.rego_expiry || ''}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="form-field">
                  <label>Insurance Expiry</label>
                  <input
                    type="date"
                    name="insurance_expiry"
                    value={formData.insurance_expiry || ''}
                    onChange={handleFormChange}
                  />
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
                <th>Description</th>
                <th>Registration</th>
                <th>Seats</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{v.description}</td>
                  <td>{v.registration || 'N/A'}</td>
                  <td>{v.seats}</td>
                  <td className="actions-cell">
                    <button onClick={() => handleEditClick(v)} className="edit-button">Edit</button>
                    <button onClick={() => handleDeleteClick(v.id)} className="delete-button">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default Vehicles;
