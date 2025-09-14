import React from 'react';
import { FiCalendar, FiPlus } from 'react-icons/fi';

const MaintenanceTab = ({
  vehicle,
  formatDate,
  formatCurrency,
  needsMaintenanceSoon,
  onAddMaintenance
}) => {
  if (!vehicle) return null;

  return (
    <div className="vehicle-maintenance">
      <div className="detail-section glass-card">
        <div className="section-header">
          <h4>Maintenance History</h4>
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => onAddMaintenance?.(vehicle)}
          >
            <FiPlus /> Add Record
          </button>
        </div>
        
        {vehicle.maintenance_records?.length > 0 ? (
          <div className="maintenance-timeline">
            {vehicle.maintenance_records
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map((record, index) => (
                <div key={index} className="maintenance-record">
                  <div className="record-header">
                    <div className="record-date">
                      <FiCalendar className="icon" />
                      <span>{formatDate(record.date)}</span>
                    </div>
                    <div className="record-type">
                      <span className={`badge ${record.type === 'service' ? 'badge-blue' : record.type === 'repair' ? 'badge-yellow' : 'badge-green'}`}>
                        {record.type}
                      </span>
                    </div>
                  </div>
                  
                  <div className="record-content">
                    <h5>{record.description}</h5>
                    <div className="record-details">
                      <div className="record-detail">
                        <div className="detail-label">Odometer</div>
                        <div className="detail-value">{record.odometer?.toLocaleString() || 0} km</div>
                      </div>
                      <div className="record-detail">
                        <div className="detail-label">Cost</div>
                        <div className="detail-value">{formatCurrency(record.cost)}</div>
                      </div>
                      <div className="record-detail">
                        <div className="detail-label">Performed By</div>
                        <div className="detail-value">{record.performed_by || 'N/A'}</div>
                      </div>
                    </div>
                    
                    {record.parts_replaced && (
                      <div className="parts-replaced">
                        <div className="detail-label">Parts Replaced</div>
                        <div className="detail-value">{record.parts_replaced}</div>
                      </div>
                    )}
                    
                    {record.notes && (
                      <div className="record-notes">
                        <div className="detail-label">Notes</div>
                        <div className="detail-value">{record.notes}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-muted">No maintenance records available for this vehicle.</p>
        )}
      </div>
      
      <div className="detail-section glass-card">
        <h4>Service Schedule</h4>
        <div className="service-schedule">
          <div className="schedule-item">
            <div className="schedule-header">
              <h5>Next Regular Service</h5>
              {needsMaintenanceSoon(vehicle) ? (
                <span className="badge badge-yellow">Due Soon</span>
              ) : (
                <span className="badge badge-green">On Track</span>
              )}
            </div>
            <div className="schedule-details">
              <div className="schedule-detail">
                <div className="detail-label">Due Date</div>
                <div className="detail-value">{formatDate(vehicle.next_service_date)}</div>
              </div>
              <div className="schedule-detail">
                <div className="detail-label">Due Odometer</div>
                <div className="detail-value">{vehicle.next_service_odometer?.toLocaleString() || 'N/A'} km</div>
              </div>
              <div className="schedule-detail">
                <div className="detail-label">Current Odometer</div>
                <div className="detail-value">{vehicle.odometer?.toLocaleString() || 0} km</div>
              </div>
              <div className="schedule-detail">
                <div className="detail-label">Remaining</div>
                <div className="detail-value">
                  {vehicle.next_service_odometer && vehicle.odometer
                    ? `${(vehicle.next_service_odometer - vehicle.odometer).toLocaleString()} km`
                    : 'N/A'}
                </div>
              </div>
            </div>
            
            <button 
              className="btn btn-primary"
              onClick={() => onAddMaintenance?.(vehicle)}
            >
              Schedule Service
            </button>
          </div>
          
          <div className="maintenance-recommendations">
            <h5>Recommended Maintenance</h5>
            <div className="recommendation-list">
              <div className="recommendation-item">
                <div className="recommendation-header">
                  <span>Oil Change</span>
                  <span className="badge badge-blue">Every 10,000 km</span>
                </div>
                <div className="recommendation-progress">
                  <div className="progress-bar" style={{ 
                    width: `${Math.min(100, 100 - ((vehicle.odometer % 10000) / 100))}%` 
                  }}></div>
                </div>
                <div className="recommendation-status">
                  {10000 - (vehicle.odometer % 10000)} km remaining
                </div>
              </div>
              
              <div className="recommendation-item">
                <div className="recommendation-header">
                  <span>Tire Rotation</span>
                  <span className="badge badge-blue">Every 15,000 km</span>
                </div>
                <div className="recommendation-progress">
                  <div className="progress-bar" style={{ 
                    width: `${Math.min(100, 100 - ((vehicle.odometer % 15000) / 150))}%` 
                  }}></div>
                </div>
                <div className="recommendation-status">
                  {15000 - (vehicle.odometer % 15000)} km remaining
                </div>
              </div>
              
              <div className="recommendation-item">
                <div className="recommendation-header">
                  <span>Brake Inspection</span>
                  <span className="badge badge-blue">Every 20,000 km</span>
                </div>
                <div className="recommendation-progress">
                  <div className="progress-bar" style={{ 
                    width: `${Math.min(100, 100 - ((vehicle.odometer % 20000) / 200))}%` 
                  }}></div>
                </div>
                <div className="recommendation-status">
                  {20000 - (vehicle.odometer % 20000)} km remaining
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceTab;
