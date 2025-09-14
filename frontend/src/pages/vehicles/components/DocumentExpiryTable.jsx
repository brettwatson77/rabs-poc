import React from 'react';
import { FiCheckCircle, FiEdit2 } from 'react-icons/fi';

const DocumentExpiryTable = ({
  vehicles = [],
  vehiclesLoading = false,
  isExpiringDocument,
  formatDate
}) => {
  // Filter vehicles with expiring documents
  const expiringVehicles = vehicles
    .filter(vehicle => 
      isExpiringDocument(vehicle.registration_expiry) || 
      isExpiringDocument(vehicle.insurance?.expiry_date)
    )
    .sort((a, b) => {
      const regDateA = a.registration_expiry ? new Date(a.registration_expiry) : new Date(9999, 0, 1);
      const regDateB = b.registration_expiry ? new Date(b.registration_expiry) : new Date(9999, 0, 1);
      const insDateA = a.insurance?.expiry_date ? new Date(a.insurance.expiry_date) : new Date(9999, 0, 1);
      const insDateB = b.insurance?.expiry_date ? new Date(b.insurance.expiry_date) : new Date(9999, 0, 1);
      
      const earliestA = regDateA < insDateA ? regDateA : insDateA;
      const earliestB = regDateB < insDateB ? regDateB : insDateB;
      
      return earliestA - earliestB;
    });

  return (
    <div className="document-expiry glass-card">
      <h4>Document Expiry Tracking</h4>
      
      {vehiclesLoading ? (
        <div className="loading-container">
          <div className="loading-spinner-small"></div>
          <p>Loading document data...</p>
        </div>
      ) : (
        <div className="document-expiry-table">
          <table className="expiry-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Registration Number</th>
                <th>Registration Expiry</th>
                <th>Insurance Provider</th>
                <th>Insurance Expiry</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {expiringVehicles.map(vehicle => (
                <tr key={vehicle.id}>
                  <td>
                    <div className="vehicle-name-cell">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </div>
                  </td>
                  <td>{vehicle.registration}</td>
                  <td>
                    {formatDate(vehicle.registration_expiry)}
                    {isExpiringDocument(vehicle.registration_expiry) && (
                      <span className="badge badge-yellow">Expiring Soon</span>
                    )}
                  </td>
                  <td>{vehicle.insurance?.provider || 'N/A'}</td>
                  <td>
                    {formatDate(vehicle.insurance?.expiry_date)}
                    {isExpiringDocument(vehicle.insurance?.expiry_date) && (
                      <span className="badge badge-yellow">Expiring Soon</span>
                    )}
                  </td>
                  <td>
                    <button 
                      className="btn btn-sm"
                    >
                      <FiEdit2 /> Update
                    </button>
                  </td>
                </tr>
              ))}
              
              {expiringVehicles.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center">
                    <div className="empty-state-small">
                      <FiCheckCircle className="success-icon" />
                      <p>No documents expiring soon.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DocumentExpiryTable;
