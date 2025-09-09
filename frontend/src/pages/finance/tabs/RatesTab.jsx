import React from 'react';
import { FiSearch, FiEdit2, FiRefreshCw, FiTrash2 } from 'react-icons/fi';

export default function RatesTab({
  ratesData,
  ratesLoading,
  searchQuery,
  setSearchQuery,
  onRefetch,
  onEditRate,
  onAddRate,
  onOpenImport,
  onDeleteRate,
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
              <th>Base&nbsp;/&nbsp;1:1</th>
              <th>Ratios</th>
              <th>Updated</th>
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
                <td className="text-right">
                  ${parseFloat(r?.base_rate || 0).toFixed(2)}
                </td>
                <td>
                  {(() => {
                    /* ------------------------------------------------------------------
                     *  Display logic:
                     *   • Single-rate codes => show “-”
                     *   • Group codes      => show ratios excluding 1:1
                     *   • If nothing left  => “-”
                     * ----------------------------------------------------------------*/
                    if (r?.single_rate) return '-';

                    const ratioChips = Array.isArray(r?.ratios)
                      ? r.ratios.filter((ra) => ra.ratio !== '1:1')
                      : [];

                    if (!ratioChips.length) return '-';

                    return (
                      <div className="chips-scroll">
                        {ratioChips.map((ra) => (
                          <span key={ra.ratio} className="chip">
                            {`${ra.ratio}=$${parseFloat(ra.rate).toFixed(2)}`}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </td>
                <td className="text-sm muted">
                  {r?.updated_at ? new Date(r.updated_at).toLocaleString() : '-'}
                </td>
                <td>
                  <button
                    className="btn btn-secondary btn-icon"
                    onClick={() => r?.id && onEditRate(r)}
                    title="Edit rate"
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    className="btn btn-secondary btn-icon danger"
                    onClick={() => r?.id && onDeleteRate(r)}
                    title="Delete rate"
                  >
                    <FiTrash2 />
                  </button>
                </td>
              </tr>
            ))}
            {filteredRates().length === 0 && !ratesLoading && (
              <tr>
                <td colSpan="7" className="no-results">No rates found</td>
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
