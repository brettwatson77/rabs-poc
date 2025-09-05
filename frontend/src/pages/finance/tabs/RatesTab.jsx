import React from 'react';
import { FiSearch, FiEdit2, FiRefreshCw } from 'react-icons/fi';

export default function RatesTab({
  ratesData,
  ratesLoading,
  searchQuery,
  setSearchQuery,
  onRefetch,
  onEditRate,
  onAddRate,
  onOpenImport,
}) {
  // Return array of truthy rate rows that match current search term
  const filteredRates = () => {
    const list = Array.isArray(ratesData?.data)
      ? ratesData.data.filter(Boolean)
      : [];

    return list.filter((r) => {
      // Guard against null/undefined rate objects
      const text = `${r?.code ?? ''} ${r?.description ?? ''}`.toLowerCase();
      return text.includes((searchQuery || '').toLowerCase());
    });
  };

  return (
    <div className="tab-content">
      {/* Unified search / action bar */}
      <div className="search-filter-bar glass-panel">
        {/* Search */}
        <div className="search-container">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search rates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input responsive"
          />
        </div>

        {/* Spacer for potential future filters */}
        <div className="action-btn-group gap">
          <button
            className="btn btn-secondary"
            onClick={onAddRate}
            title="Add rate"
          >
            + Add Rate
          </button>
          <button
            className="btn btn-secondary"
            onClick={onOpenImport}
            title="Import CSV"
          >
            Import CSV
          </button>
        </div>

        {/* Refresh */}
        <button className="nav-button" onClick={onRefetch} title="Refresh Rates">
          <FiRefreshCw />
        </button>
      </div>

      <div className="rates-table-container table-scroll">
        <table className="glass-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th>Active</th>
              <th>Updated</th>
              <th>Base&nbsp;Rate</th>
              <th>Ratios</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRates().map((r, idx) => (
              <tr key={r?.id || r?.code || idx}>
                <td className="code-mono no-wrap ellipsis">{r?.code || '-'}</td>
                <td className="desc-wrap-2">{r?.description || '-'}</td>
                <td>
                  <span className={`pill ${r?.active ? 'pill-yes' : 'pill-no'}`}>
                    {r?.active ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="text-sm muted">
                  {r?.updated_at ? new Date(r.updated_at).toLocaleString() : '-'}
                </td>
                <td className="text-right">
                  ${parseFloat(r?.base_rate || 0).toFixed(2)}
                </td>
                <td>
                  {Array.isArray(r?.ratios) && r.ratios.length ? (
                    <div className="chips-scroll">
                      {r.ratios.map((ra) => (
                        <span key={ra.ratio} className="chip">
                          {`${ra.ratio}=$${parseFloat(ra.rate).toFixed(2)}`}
                        </span>
                      ))}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-icon lg"
                    onClick={() => r?.id && onEditRate(r)}
                    title="Edit rate"
                  >
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
