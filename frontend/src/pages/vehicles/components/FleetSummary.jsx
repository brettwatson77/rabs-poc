import React from 'react';
import { FiTruck, FiCheckCircle, FiAlertCircle, FiDollarSign } from 'react-icons/fi';

const FleetSummary = ({ vehicles = [] }) => {
  // Format currency utility function
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '$0.00';
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  // Calculate total fleet value
  const calculateFleetValue = () => {
    return vehicles.reduce((total, vehicle) => {
      return total + (vehicle.purchase_price || 0);
    }, 0);
  };

  // Count active vehicles
  const activeVehiclesCount = vehicles.filter(v => v.status === 'active').length || 0;
  
  // Count maintenance vehicles
  const maintenanceVehiclesCount = vehicles.filter(v => v.status === 'maintenance').length || 0;
  
  return (
    <div className="fleet-summary glass-panel">
      <div className="summary-item">
        <div className="summary-icon">
          <FiTruck />
        </div>
        <div className="summary-content">
          <div className="summary-value">
            {vehicles.length || 0}
          </div>
          <div className="summary-label">Total Vehicles</div>
        </div>
      </div>
      
      <div className="summary-item">
        <div className="summary-icon">
          <FiCheckCircle />
        </div>
        <div className="summary-content">
          <div className="summary-value">
            {activeVehiclesCount}
          </div>
          <div className="summary-label">Active Vehicles</div>
        </div>
      </div>
      
      <div className="summary-item">
        <div className="summary-icon">
          <FiAlertCircle />
        </div>
        <div className="summary-content">
          <div className="summary-value">
            {maintenanceVehiclesCount}
          </div>
          <div className="summary-label">In Maintenance</div>
        </div>
      </div>
      
      <div className="summary-item">
        <div className="summary-icon">
          <FiDollarSign />
        </div>
        <div className="summary-content">
          <div className="summary-value">
            {formatCurrency(calculateFleetValue())}
          </div>
          <div className="summary-label">Fleet Value</div>
        </div>
      </div>
    </div>
  );
};

export default FleetSummary;
