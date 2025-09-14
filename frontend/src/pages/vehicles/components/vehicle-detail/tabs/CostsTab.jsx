import React from 'react';

const CostsTab = ({ vehicle, formatCurrency, formatDate }) => {
  if (!vehicle) return null;

  // Calculate total maintenance costs
  const maintenanceTotal = vehicle.maintenance_records?.reduce(
    (total, record) => total + (record.cost || 0), 
    0
  ) || 0;

  // Calculate total cost of ownership
  const totalCostOfOwnership = 
    (vehicle.purchase_price || 0) + 
    maintenanceTotal + 
    (vehicle.insurance?.cost || 0);

  // Calculate cost per kilometer
  const costPerKm = vehicle.odometer && vehicle.odometer > 0
    ? totalCostOfOwnership / vehicle.odometer
    : 0;

  return (
    <div className="vehicle-costs">
      <div className="detail-section glass-card">
        <h4>Cost Summary</h4>
        <div className="cost-summary">
          <div className="cost-item">
            <div className="cost-label">Purchase Price</div>
            <div className="cost-value">{formatCurrency(vehicle.purchase_price)}</div>
          </div>
          <div className="cost-item">
            <div className="cost-label">Maintenance Total</div>
            <div className="cost-value">
              {formatCurrency(maintenanceTotal)}
            </div>
          </div>
          <div className="cost-item">
            <div className="cost-label">Insurance (Annual)</div>
            <div className="cost-value">{formatCurrency(vehicle.insurance?.cost)}</div>
          </div>
          <div className="cost-item total">
            <div className="cost-label">Total Cost of Ownership</div>
            <div className="cost-value">
              {formatCurrency(totalCostOfOwnership)}
            </div>
          </div>
        </div>
      </div>
      
      <div className="detail-section glass-card">
        <h4>Cost Per Kilometer</h4>
        <div className="cost-per-km">
          <div className="cost-calculation">
            <div className="calculation-formula">
              <span className="formula-label">Total Costs</span>
              <span className="formula-divider">/</span>
              <span className="formula-label">Total Kilometers</span>
              <span className="formula-equals">=</span>
              <span className="formula-label">Cost per KM</span>
            </div>
            <div className="calculation-values">
              <span className="formula-value">
                {formatCurrency(totalCostOfOwnership)}
              </span>
              <span className="formula-divider">/</span>
              <span className="formula-value">
                {vehicle.odometer?.toLocaleString() || 0} km
              </span>
              <span className="formula-equals">=</span>
              <span className="formula-value highlight">
                {formatCurrency(costPerKm)} / km
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="detail-section glass-card">
        <h4>Maintenance Cost Breakdown</h4>
        {vehicle.maintenance_records?.length > 0 ? (
          <div className="maintenance-costs">
            <div className="cost-table-container">
              <table className="cost-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicle.maintenance_records
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map((record, index) => (
                      <tr key={index}>
                        <td>{formatDate(record.date)}</td>
                        <td>
                          <span className={`badge ${record.type === 'service' ? 'badge-blue' : record.type === 'repair' ? 'badge-yellow' : 'badge-green'}`}>
                            {record.type}
                          </span>
                        </td>
                        <td>{record.description}</td>
                        <td className="cost-column">{formatCurrency(record.cost)}</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="3" className="total-label">Total Maintenance Costs</td>
                    <td className="total-value">
                      {formatCurrency(maintenanceTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-muted">No maintenance records available for cost analysis.</p>
        )}
      </div>
    </div>
  );
};

export default CostsTab;
