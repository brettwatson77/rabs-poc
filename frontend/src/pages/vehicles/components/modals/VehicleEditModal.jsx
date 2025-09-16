import React from 'react';
import { FiSave } from 'react-icons/fi';

/**
 * Modal component for editing an existing vehicle
 * 
 * @param {Object} props Component props
 * @param {boolean} props.isOpen Whether the modal is visible
 * @param {Function} props.onClose Function to call when closing the modal
 * @param {Object} props.vehicleForm Form data object
 * @param {Function} props.setVehicleForm Function to update form data
 * @param {Function} props.onSubmit Function to call when submitting the form
 * @param {boolean} props.isSubmitting Whether the form is currently submitting
 */
const VehicleEditModal = ({
  isOpen,
  onClose,
  vehicleForm,
  setVehicleForm,
  onSubmit,
  isSubmitting
}) => {
  // Early return if modal is not open
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Vehicle</h3>
        </div>
        
        <div className="modal-body">
          {/* Static tab bar for consistency */}
          <div className="page-tabs" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className="tab-button active"
            >
              General
            </button>
          </div>

          <form className="vehicle-form" onSubmit={onSubmit}>
            {/* Vehicle Information Section */}
            <div className="form-section">
              <h4>Vehicle Information</h4>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="registration">Registration*</label>
                  <input
                    id="registration"
                    type="text"
                    value={vehicleForm.registration || ''}
                    onChange={(e) => setVehicleForm({...vehicleForm, registration: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="make">Make</label>
                  <input
                    id="make"
                    type="text"
                    value={vehicleForm.make || ''}
                    onChange={(e) => setVehicleForm({...vehicleForm, make: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="model">Model</label>
                  <input
                    id="model"
                    type="text"
                    value={vehicleForm.model || ''}
                    onChange={(e) => setVehicleForm({...vehicleForm, model: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="year">Year</label>
                  <input
                    id="year"
                    type="number"
                    value={vehicleForm.year || ''}
                    onChange={(e) => setVehicleForm({...vehicleForm, year: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="fuel-type">Fuel Type</label>
                  <input
                    id="fuel-type"
                    type="text"
                    value={vehicleForm.fuel_type || ''}
                    onChange={(e) => setVehicleForm({...vehicleForm, fuel_type: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    value={vehicleForm.status || 'active'}
                    onChange={(e) => setVehicleForm({...vehicleForm, status: e.target.value})}
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="out_of_service">Out of Service</option>
                    <option value="reserved">Reserved</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Capacity Section */}
            <div className="form-section">
              <h4>Capacity</h4>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="capacity">Passenger Capacity</label>
                  <input
                    id="capacity"
                    type="number"
                    min="0"
                    value={vehicleForm.capacity || ''}
                    onChange={(e) => setVehicleForm({...vehicleForm, capacity: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="wheelchair-capacity">Wheelchair Capacity</label>
                  <input
                    id="wheelchair-capacity"
                    type="number"
                    min="0"
                    value={vehicleForm.wheelchair_capacity || ''}
                    onChange={(e) => setVehicleForm({...vehicleForm, wheelchair_capacity: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={vehicleForm.wheelchair_accessible || false}
                    onChange={(e) => setVehicleForm({...vehicleForm, wheelchair_accessible: e.target.checked})}
                  />
                  <span className="checkbox-label">Wheelchair Accessible</span>
                </label>
              </div>
            </div>
            
            {/* Base Address Section */}
            <div className="form-section">
              <h4>Base Address</h4>
              <div className="form-group">
                <label htmlFor="base-address">Street Address</label>
                <input
                  id="base-address"
                  type="text"
                  value={vehicleForm.base_address || ''}
                  onChange={(e) => setVehicleForm({...vehicleForm, base_address: e.target.value})}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="base-suburb">Suburb</label>
                  <input
                    id="base-suburb"
                    type="text"
                    value={vehicleForm.base_suburb || ''}
                    onChange={(e) => setVehicleForm({...vehicleForm, base_suburb: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="base-state">State</label>
                  <select
                    id="base-state"
                    value={vehicleForm.base_state || 'NSW'}
                    onChange={(e) => setVehicleForm({...vehicleForm, base_state: e.target.value})}
                  >
                    <option value="NSW">NSW</option>
                    <option value="VIC">VIC</option>
                    <option value="QLD">QLD</option>
                    <option value="SA">SA</option>
                    <option value="WA">WA</option>
                    <option value="TAS">TAS</option>
                    <option value="NT">NT</option>
                    <option value="ACT">ACT</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="base-postcode">Postcode</label>
                  <input
                    id="base-postcode"
                    type="text"
                    value={vehicleForm.base_postcode || ''}
                    onChange={(e) => setVehicleForm({...vehicleForm, base_postcode: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            {/* Notes Section */}
            <div className="form-section">
              <h4>Notes</h4>
              <div className="form-group">
                <label htmlFor="notes">Additional Information</label>
                <textarea
                  id="notes"
                  rows="3"
                  value={vehicleForm.notes || ''}
                  onChange={(e) => setVehicleForm({...vehicleForm, notes: e.target.value})}
                ></textarea>
              </div>
            </div>
            
            {/* Form Actions */}
            <div className="form-actions">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <FiSave /> Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VehicleEditModal;
