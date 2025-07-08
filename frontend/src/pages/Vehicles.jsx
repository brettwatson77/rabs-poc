import React, { useState, useEffect } from 'react';
import { getVehicles, createVehicle, updateVehicle, deleteVehicle } from '../api/api';
import '../styles/CrudPage.css';

const Vehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [formData, setFormData] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const initialFormState = {
    id: '',
    description: '',
    seats: 10,
    registration: '',
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
      [name]: value
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

  return (
    <>
      <div className="crud-page-container" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>Manage Vehicles</h1>
        {error && <p className="error-message">{error}</p>}
        {!isFormVisible && (
          <button onClick={handleAddClick} className="add-new-button">Add New Vehicle</button>
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
