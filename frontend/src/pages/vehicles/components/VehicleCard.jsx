import React from 'react';
import { FiDroplet, FiUsers, FiHash, FiTool, FiFileText, FiShield } from 'react-icons/fi';

const VehicleCard = ({ 
  vehicle, 
  onClick, 
  getStatusBadge, 
  formatStatus, 
  needsMaintenanceSoon, 
  isExpiringDocument, 
  isVehicleAvailable,
  selected = false 
}) => {
  if (!vehicle) return null;
  
  const fuelTypeClass = vehicle.fuel_type ? `fuel-${vehicle.fuel_type.toLowerCase()}` : '';
  
  return (
    <div 
      className={`vehicle-card glass-card ${fuelTypeClass} ${selected ? 'selected' : ''}`}
      onClick={() => onClick(vehicle)}
    >
      <div className="vehicle-header">
        <div className="vehicle-registration">
          {vehicle.registration}
        </div>
        <div className="vehicle-badges">
          <span className={`badge ${getStatusBadge(vehicle.status)}`}>
            {formatStatus(vehicle.status)}
          </span>
          {/* fuel type chip */}
          <span className="badge fuel-tag">
            {vehicle.fuel_type}
          </span>
        </div>
      </div>
      
      <div className="vehicle-info">
        <h3 className="vehicle-name">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </h3>
        <div className="vehicle-details">
          <div className="detail-item">
            <FiDroplet className="detail-icon" />
            <span>{vehicle.fuel_type}</span>
          </div>
          <div className="detail-item">
            <FiUsers className="detail-icon" />
            <span>{vehicle.capacity} seats</span>
          </div>
          <div className="detail-item">
            <FiHash className="detail-icon" />
            <span>{vehicle.odometer?.toLocaleString() || 0} km</span>
          </div>
        </div>
      </div>
      
      {/* Alert indicators */}
      <div className="vehicle-alerts">
        {needsMaintenanceSoon(vehicle) && (
          <div className="alert-indicator maintenance" title="Maintenance due soon">
            <FiTool />
          </div>
        )}
        {isExpiringDocument(vehicle.registration_expiry) && (
          <div className="alert-indicator registration" title="Registration expiring soon">
            <FiFileText />
          </div>
        )}
        {isExpiringDocument(vehicle.insurance?.expiry_date) && (
          <div className="alert-indicator insurance" title="Insurance expiring soon">
            <FiShield />
          </div>
        )}
      </div>
      
      <div className="vehicle-footer">
        <div className="vehicle-status">
          {isVehicleAvailable ? (
            isVehicleAvailable(vehicle) ? (
              <span className="available-status">Available</span>
            ) : (
              <span className="unavailable-status">Unavailable</span>
            )
          ) : null}
          <div className="vehicle-capacity">
            <span className="badge cap-chip">
              Pax {vehicle.capacity_participants ?? vehicle.capacity ?? 0}
            </span>
            <span className="badge cap-chip">
              Staff {vehicle.capacity_staff ?? 1}
            </span>
          </div>
        </div>
        
        {/* Compact meta icons bottom-right */}
        <div className="vehicle-meta-icons">
          <div className="meta-item" title={`Odometer: ${vehicle.odometer?.toLocaleString() || 0} km`}>
            <FiHash />
            <span>{vehicle.odometer?.toLocaleString() || 0} km</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleCard;
