import React from 'react';
import { FiSearch, FiTool, FiCheckCircle, FiAlertCircle, FiFileText } from 'react-icons/fi';

const MaintenanceDashboard = ({
  vehicles = [],
  vehiclesLoading = false,
  needsMaintenanceSoon,
  formatDate,
  formatCurrency,
  searchTerm = '',
  onSearchChange
}) => {
  // Filter vehicles that need maintenance soon and sort by next_service_date
  const upcomingMaintenance = vehicles
    .filter(vehicle => needsMaintenanceSoon(vehicle))
    .sort((a, b) => {
      const dateA = a.next_service_date ? new Date(a.next_service_date) : new Date(9999, 0, 1);
      const dateB = b.next_service_date ? new Date(b.next_service_date) : new Date(9999, 0, 1);
      return dateA - dateB;
    });

  // Flatten maintenance records from all vehicles, filter by search term, and sort by date
  const maintenanceHistory = vehicles
    .flatMap(vehicle => 
      (vehicle.maintenance_records || []).map(record => ({
        vehicle,
        record
      }))
    )
    .filter(item => 
      item.record.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vehicle.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vehicle.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vehicle.registration?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => new Date(b.record.date) - new Date(a.record.date))
    .slice(0, 20);

  return (
    <div className="maintenance-tab">
      <div className="maintenance-header glass-panel">
        <h3>Fleet Maintenance</h3>
        <p>Track and manage vehicle maintenance, services, and repairs.</p>
        
        <div className="search-container">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search maintenance records..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>
      </div>
      
      <div className="maintenance-summary glass-card">
        <div className="summary-item">
          <div className="summary-icon">
            <FiTool />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {vehicles.reduce((count, vehicle) => {
                return count + (vehicle.maintenance_records?.length || 0);
              }, 0) || 0}
            </div>
            <div className="summary-label">Total Records</div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon">
            <FiAlertCircle />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {upcomingMaintenance.length}
            </div>
            <div className="summary-label">Due Soon</div>
          </div>
        </div>
        
        <div className="summary-item">
          <div className="summary-icon">
            <FiFileText />
          </div>
          <div className="summary-content">
            <div className="summary-value">
              {vehicles.reduce((count, vehicle) => {
                const thisYearRecords = vehicle.maintenance_records?.filter(record => {
                  if (!record.date) return false;
                  const recordYear = new Date(record.date).getFullYear();
                  const currentYear = new Date().getFullYear();
                  return recordYear === currentYear;
                }) || [];
                return count + thisYearRecords.length;
              }, 0) || 0}
            </div>
            <div className="summary-label">Records This Year</div>
          </div>
        </div>
      </div>
      
      {/* Upcoming Maintenance Section */}
      <div className="upcoming-maintenance glass-card">
        <h4>Upcoming Maintenance</h4>
        
        {vehiclesLoading ? (
          <div className="loading-container">
            <div className="loading-spinner-small"></div>
            <p>Loading maintenance data...</p>
          </div>
        ) : (
          <div className="maintenance-schedule-table">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Registration</th>
                  <th>Service Type</th>
                  <th>Due Date</th>
                  <th>Due Odometer</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {upcomingMaintenance.map(vehicle => (
                  <tr key={vehicle.id}>
                    <td>
                      <div className="vehicle-name-cell">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </div>
                    </td>
                    <td>{vehicle.registration}</td>
                    <td>Regular Service</td>
                    <td>{formatDate(vehicle.next_service_date)}</td>
                    <td>{vehicle.next_service_odometer?.toLocaleString() || 'N/A'} km</td>
                    <td>
                      {vehicle.next_service_date && new Date(vehicle.next_service_date) < new Date() ? (
                        <span className="badge badge-red">Overdue</span>
                      ) : (
                        <span className="badge badge-yellow">Due Soon</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn btn-sm">
                          <FiTool /> Service
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                
                {upcomingMaintenance.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center">
                      <div className="empty-state-small">
                        <FiCheckCircle className="success-icon" />
                        <p>No upcoming maintenance needed.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Maintenance History Section */}
      <div className="maintenance-history glass-card">
        <h4>Maintenance History</h4>
        
        {vehiclesLoading ? (
          <div className="loading-container">
            <div className="loading-spinner-small"></div>
            <p>Loading maintenance history...</p>
          </div>
        ) : (
          <div className="maintenance-history-table">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Vehicle</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Odometer</th>
                  <th>Cost</th>
                  <th>Performed By</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceHistory.map((item, index) => (
                  <tr key={index}>
                    <td>{formatDate(item.record.date)}</td>
                    <td>
                      <div className="vehicle-name-cell">
                        <span className="vehicle-model">{item.vehicle.year} {item.vehicle.make} {item.vehicle.model}</span>
                        <span className="vehicle-registration">{item.vehicle.registration}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${item.record.type === 'service' ? 'badge-blue' : item.record.type === 'repair' ? 'badge-yellow' : 'badge-green'}`}>
                        {item.record.type}
                      </span>
                    </td>
                    <td>{item.record.description}</td>
                    <td>{item.record.odometer?.toLocaleString() || 0} km</td>
                    <td>{formatCurrency(item.record.cost)}</td>
                    <td>{item.record.performed_by || 'N/A'}</td>
                  </tr>
                ))}
                
                {maintenanceHistory.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center">
                      <div className="empty-state-small">
                        <FiFileText className="empty-icon" />
                        <p>No maintenance records found.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MaintenanceDashboard;
