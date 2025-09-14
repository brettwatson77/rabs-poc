import React from 'react';
import { FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

const OverviewTab = ({
  vehicle,
  vehicleForm,
  setVehicleForm,
  onUpdateOdometer,
  needsMaintenanceSoon,
  formatDate,
  formatCurrency,
  isExpiringDocument
}) => {
  if (!vehicle) return null;

  return (
    <div className="vehicle-overview">
      <div className="detail-section glass-card">
        <h4>Vehicle Information</h4>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">Make</div>
            <div className="detail-value">{vehicle.make}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Model</div>
            <div className="detail-value">{vehicle.model}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Year</div>
            <div className="detail-value">{vehicle.year}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Registration</div>
            <div className="detail-value">{vehicle.registration}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">VIN</div>
            <div className="detail-value">{vehicle.vin || 'N/A'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Color</div>
            <div className="detail-value">{vehicle.color || 'N/A'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Fuel Type</div>
            <div className="detail-value">{vehicle.fuel_type}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Capacity</div>
            <div className="detail-value">{vehicle.capacity} seats</div>
          </div>
          {/* Added split capacity fields */}
          <div className="detail-item">
            <div className="detail-label">Participant Capacity</div>
            <div className="detail-value">
              {vehicle.capacity_participants ?? vehicle.capacity ?? 0}
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Staff Capacity</div>
            <div className="detail-value">
              {vehicle.capacity_staff ?? 1}
            </div>
          </div>
        </div>
      </div>
      
      <div className="detail-section glass-card">
        <h4>Odometer & Service</h4>
        <div className="odometer-section">
          <div className="odometer-display">
            <div className="odometer-value">
              {vehicle.odometer?.toLocaleString() || 0}
            </div>
            <div className="odometer-unit">kilometers</div>
          </div>
          <div className="odometer-update">
            <input 
              type="number"
              value={vehicleForm.odometer}
              onChange={(e) => setVehicleForm({...vehicleForm, odometer: parseInt(e.target.value) || 0})}
              className="odometer-input"
              min="0"
            />
            <button 
              className="btn btn-primary"
              onClick={() => onUpdateOdometer(vehicle.id, vehicleForm.odometer)}
            >
              Update Odometer
            </button>
          </div>
        </div>
        
        <div className="service-info">
          <div className="service-item">
            <div className="service-label">Next Service Date</div>
            <div className="service-value">
              {formatDate(vehicle.next_service_date)}
            </div>
          </div>
          <div className="service-item">
            <div className="service-label">Next Service Odometer</div>
            <div className="service-value">
              {vehicle.next_service_odometer?.toLocaleString() || 'N/A'} km
            </div>
          </div>
          <div className="service-item">
            <div className="service-label">Service Interval</div>
            <div className="service-value">
              Every {vehicle.service_interval_km?.toLocaleString() || 10000} km or {vehicle.service_interval_months || 6} months
            </div>
          </div>
        </div>
        
        {needsMaintenanceSoon(vehicle) && (
          <div className="maintenance-alert">
            <FiAlertCircle className="alert-icon" />
            <div className="alert-message">
              <strong>Service Due Soon!</strong> Schedule maintenance for this vehicle.
            </div>
            <button 
              className="btn btn-primary"
              onClick={() => {/* Handle maintenance scheduling */}}
            >
              Schedule Service
            </button>
          </div>
        )}
      </div>
      
      <div className="detail-section glass-card">
        <h4>Registration & Insurance</h4>
        <div className="document-grid">
          <div className="document-item">
            <div className="document-header">
              <h5>Registration</h5>
              {isExpiringDocument(vehicle.registration_expiry) ? (
                <span className="badge badge-yellow">Expiring Soon</span>
              ) : vehicle.registration_expiry && new Date(vehicle.registration_expiry) < new Date() ? (
                <span className="badge badge-red">Expired</span>
              ) : (
                <span className="badge badge-green">Valid</span>
              )}
            </div>
            <div className="document-details">
              <div className="document-detail">
                <div className="detail-label">Expiry Date</div>
                <div className="detail-value">{formatDate(vehicle.registration_expiry)}</div>
              </div>
            </div>
          </div>
          
          <div className="document-item">
            <div className="document-header">
              <h5>Insurance</h5>
              {isExpiringDocument(vehicle.insurance?.expiry_date) ? (
                <span className="badge badge-yellow">Expiring Soon</span>
              ) : vehicle.insurance?.expiry_date && new Date(vehicle.insurance.expiry_date) < new Date() ? (
                <span className="badge badge-red">Expired</span>
              ) : (
                <span className="badge badge-green">Valid</span>
              )}
            </div>
            <div className="document-details">
              <div className="document-detail">
                <div className="detail-label">Provider</div>
                <div className="detail-value">{vehicle.insurance?.provider || 'N/A'}</div>
              </div>
              <div className="document-detail">
                <div className="detail-label">Policy Number</div>
                <div className="detail-value">{vehicle.insurance?.policy_number || 'N/A'}</div>
              </div>
              <div className="document-detail">
                <div className="detail-label">Expiry Date</div>
                <div className="detail-value">{formatDate(vehicle.insurance?.expiry_date)}</div>
              </div>
              <div className="document-detail">
                <div className="detail-label">Cost</div>
                <div className="detail-value">{formatCurrency(vehicle.insurance?.cost)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="detail-section glass-card">
        <h4>Features & Notes</h4>
        <div className="features-list">
          {vehicle.features && vehicle.features.length > 0 ? (
            vehicle.features.map((feature, index) => (
              <div key={index} className="feature-tag">
                <FiCheckCircle className="feature-icon" />
                <span>{feature}</span>
              </div>
            ))
          ) : (
            <p className="text-muted">No features listed</p>
          )}
        </div>
        
        <div className="notes-section">
          <h5>Notes</h5>
          {vehicle.notes ? (
            <p>{vehicle.notes}</p>
          ) : (
            <p className="text-muted">No notes available for this vehicle.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
