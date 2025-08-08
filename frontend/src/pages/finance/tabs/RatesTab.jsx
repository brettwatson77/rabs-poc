import React from 'react';
import { FiSearch, FiEdit2, FiRefreshCw } from 'react-icons/fi';

export default function RatesTab({
  ratesData,
  ratesLoading,
  searchQuery,
  setSearchQuery,
  onRefetch,
  onEditRate,
}) {
  const filteredRates = () => {
    const list = ratesData?.data || [];
    return list.filter((r) => {
      const text = `${r.code} ${r.description} ${r.support_category}`.toLowerCase();
      return text.includes((searchQuery || '').toLowerCase());
    });
  };

  return (
    <div className="tab-content">
      <div className="control-row">
        <div className="search-container">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search rates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="btn btn-icon" onClick={onRefetch} title="Refresh Rates">
          <FiRefreshCw />
        </button>
      </div>

      <div className="rates-table-container">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRates().map((r) => (
              <tr key={r.id}>
                <td>{r.code}</td>
                <td>{r.description}</td>
                <td>{r.support_category}</td>
                <td>${parseFloat(r.amount).toFixed(2)}</td>
                <td>{r.is_active ? 'Yes' : 'No'}</td>
                <td>
                  <button className="btn btn-icon" onClick={() => onEditRate(r)} title="Edit rate">
                    <FiEdit2 />
                  </button>
                </td>
              </tr>
            ))}
            {filteredRates().length === 0 && !ratesLoading && (
              <tr>
                <td colSpan="6" className="no-results">No rates found</td>
              </tr>
            )}
          </tbody>
        </table>
        {ratesLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Loading rates...</p>
          </div>
        )}
      </div>
    </div>
  );
}
