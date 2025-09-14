import React from 'react';
import VehicleCard from './VehicleCard';

const VehiclesGrid = ({
  vehicles = [],
  selectedVehicle,
  onSelect,
  getStatusBadge,
  formatStatus,
  needsMaintenanceSoon,
  isExpiringDocument,
  isVehicleAvailable,
  className = ''
}) => {
  return (
    <div className={`vehicles-grid ${className}`}>
      {vehicles.map(vehicle => (
        <VehicleCard
          key={vehicle.id}
          vehicle={vehicle}
          onClick={onSelect}
          getStatusBadge={getStatusBadge}
          formatStatus={formatStatus}
          needsMaintenanceSoon={needsMaintenanceSoon}
          isExpiringDocument={isExpiringDocument}
          isVehicleAvailable={isVehicleAvailable}
          selected={selectedVehicle?.id === vehicle.id}
        />
      ))}
    </div>
  );
};

export default VehiclesGrid;
