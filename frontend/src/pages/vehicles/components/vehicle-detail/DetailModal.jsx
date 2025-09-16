import React from 'react';
import { FiX, FiTruck, FiTool, FiCalendar, FiDollarSign } from 'react-icons/fi';

// Import tab components
import OverviewTab from './tabs/OverviewTab';
import MaintenanceTab from './tabs/MaintenanceTab';
import BookingsTab from './tabs/BookingsTab';
import CostsTab from './tabs/CostsTab';

const DetailModal = ({
  vehicle,
  onClose,
  selectedTab,
  setSelectedTab,
  vehicleForm,
  setVehicleForm,
  onUpdateOdometer,
  needsMaintenanceSoon,
  formatDate,
  formatCurrency,
  getStatusBadge,
  formatStatus,
  isExpiringDocument,
  getWeekDates,
  getBookingsForVehicleAndDate,
  bookingsData,
  bookingsLoading,
  currentWeekStart,
  format,
  addDays,
  getDriverName,
  onPrevWeek,
  onNextWeek,
  onAddMaintenance,
  onAddBooking,
  onEdit // optional edit handler
}) => {
  if (!vehicle) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content vehicle-detail-modal glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="vehicle-registration-display">{vehicle.registration}</div>
          {/* Inline detail tabs next to rego plate */}
          <div className="page-tabs vehicle-modal-tabs">
            <button
              className={`tab-button ${selectedTab === 'overview' ? 'active' : ''}`}
              onClick={() => setSelectedTab('overview')}
            >
              <FiTruck />
              <span>Overview</span>
            </button>
            <button
              className={`tab-button ${selectedTab === 'maintenance' ? 'active' : ''}`}
              onClick={() => setSelectedTab('maintenance')}
            >
              <FiTool />
              <span>Maintenance</span>
            </button>
            <button
              className={`tab-button ${selectedTab === 'bookings' ? 'active' : ''}`}
              onClick={() => setSelectedTab('bookings')}
            >
              <FiCalendar />
              <span>Bookings</span>
            </button>
            <button
              className={`tab-button ${selectedTab === 'costs' ? 'active' : ''}`}
              onClick={() => setSelectedTab('costs')}
            >
              <FiDollarSign />
              <span>Costs</span>
            </button>
          </div>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>
        
        <div className="vehicle-detail">
          <div className="detail-header">
            <div className="vehicle-banner">
              <div className="vehicle-title">
                <h2>{vehicle.year} {vehicle.make} {vehicle.model}</h2>
              </div>
              <div className="vehicle-status-badge">
                <span className={`badge ${getStatusBadge(vehicle.status)}`}>
                  {formatStatus(vehicle.status)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="detail-content">
            {selectedTab === 'overview' && (
              <OverviewTab
                vehicle={vehicle}
                vehicleForm={vehicleForm}
                setVehicleForm={setVehicleForm}
                onUpdateOdometer={onUpdateOdometer}
                needsMaintenanceSoon={needsMaintenanceSoon}
                formatDate={formatDate}
                formatCurrency={formatCurrency}
                getStatusBadge={getStatusBadge}
                formatStatus={formatStatus}
                isExpiringDocument={isExpiringDocument}
              />
            )}
            
            {selectedTab === 'maintenance' && (
              <MaintenanceTab
                vehicle={vehicle}
                formatDate={formatDate}
                formatCurrency={formatCurrency}
                needsMaintenanceSoon={needsMaintenanceSoon}
                onAddMaintenance={onAddMaintenance}
              />
            )}
            
            {selectedTab === 'bookings' && (
              <BookingsTab
                vehicle={vehicle}
                bookingsData={bookingsData}
                currentWeekStart={currentWeekStart}
                format={format}
                addDays={addDays}
                getWeekDates={getWeekDates}
                getBookingsForVehicleAndDate={getBookingsForVehicleAndDate}
                formatDate={formatDate}
                getDriverName={getDriverName}
                bookingsLoading={bookingsLoading}
                onPrevWeek={onPrevWeek}
                onNextWeek={onNextWeek}
                onAddBooking={onAddBooking}
              />
            )}
            
            {selectedTab === 'costs' && (
              <CostsTab
                vehicle={vehicle}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            )}
          </div>
        </div>

        {/* Modal footer actions */}
        <div className="modal-footer-actions">
          {onEdit && (
            <button
              className="btn btn-primary"
              onClick={() => onEdit(vehicle)}
            >
              Edit Vehicle
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailModal;
