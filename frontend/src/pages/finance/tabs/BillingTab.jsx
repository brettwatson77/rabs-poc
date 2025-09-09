import React from 'react';
import { format, parseISO } from 'date-fns';
import { FiSearch, FiPlusCircle, FiDownload, FiRefreshCw, FiEdit2, FiTrash2 } from 'react-icons/fi';

export default function BillingTab({
  billingData,
  billingLoading,
  searchQuery,
  setSearchQuery,
  participantsData,
  programsData,
  filterOptions,
  setFilterOptions,
  dateRange,
  setDateRange,
  managementFilter,
  setManagementFilter,
  onRefetch,
  onOpenNewBilling,
  onOpenBulkNew,
  onOpenExport,
  onEditBilling,
  onDeleteBilling,
}) {
  const filteredBillingData = () => {
    if (!billingData || !billingData.data) return [];
    return billingData.data.filter((billing) => {
      const participantName = billing.participant_name || '';
      const programTitle = billing.program_title || '';
      const rateCode = billing.rate_code || '';
      return (
        participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        programTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rateCode.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  };

  return (
    <div className="tab-content">
      {/* -------------------------------------------------------------------
           Unified toolbar: Search + Filters + Action buttons
         -------------------------------------------------------------------*/}
      <div className="toolbar glass-panel">
        {/* Search */}
        <div className="search-container">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search billing entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Filters (middle, wrap as needed) */}
        <div className="filters-inline">
            {/* Participant */}
            <div className="filter-group">
              <label htmlFor="participant-filter">Participant</label>
              <select
                id="participant-filter"
                value={filterOptions.participant}
                onChange={(e) =>
                  setFilterOptions({ ...filterOptions, participant: e.target.value })
                }
              >
                <option value="all">All Participants</option>
                {participantsData?.data?.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.first_name} {participant.last_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Program */}
            <div className="filter-group">
              <label htmlFor="program-filter">Program</label>
              <select
                id="program-filter"
                value={filterOptions.program}
                onChange={(e) =>
                  setFilterOptions({ ...filterOptions, program: e.target.value })
                }
              >
                <option value="all">All Programs</option>
                {programsData?.data?.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="filter-group">
              <label htmlFor="status-filter">Status</label>
              <select
                id="status-filter"
                value={filterOptions.status}
                onChange={(e) =>
                  setFilterOptions({ ...filterOptions, status: e.target.value })
                }
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="billed">Billed</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Management */}
            <div className="filter-group">
              <label htmlFor="management-filter">Management</label>
              <select
                id="management-filter"
                value={managementFilter}
                onChange={(e) => setManagementFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="agency_managed">Agency Managed</option>
                <option value="plan_managed">Plan Managed</option>
                <option value="self_managed">Self Managed</option>
                <option value="self_funded">Self Funded (Fee-for-service)</option>
              </select>
            </div>

            {/* Date range */}
            <div className="filter-group">
              <label>Start</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>
            <div className="filter-group">
              <label>End</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
        </div>

        {/* Action buttons (right aligned) */}
        <div className="actions">
          <button className="create-btn glass-button" onClick={onOpenNewBilling}>
            <FiPlusCircle /> New
          </button>
          <button className="create-btn glass-button" onClick={onOpenBulkNew}>
            <FiPlusCircle /> Bulk&nbsp;New
          </button>
          <button className="nav-button" onClick={onOpenExport}>
            <FiDownload /> Export
          </button>
          <button className="nav-button" onClick={onRefetch} title="Refresh Billing Data">
            <FiRefreshCw />
          </button>
        </div>
      </div>

      <div className="billing-table-container">
        <table className="billing-table glass-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Participant</th>
              <th>Program</th>
              <th>Hours</th>
              <th>Quantity</th>
              <th>Rate Code</th>
              <th>Unit Price</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBillingData().map((billing) => (
              <tr key={billing.id}>
                <td>{format(parseISO(billing.date), 'MMM d, yyyy')}</td>
                <td>{billing.participant_name}</td>
                <td>{billing.program_name || billing.program_title || ''}</td>
                <td>{billing.hours}</td>
                <td>{billing.quantity ?? 1}</td>
                <td>{billing.rate_code}</td>
                <td>${Number.isFinite(parseFloat(billing.unit_price)) ? parseFloat(billing.unit_price).toFixed(2) : '0.00'}</td>
                <td className="amount">${Number.isFinite(parseFloat(billing.total_amount)) ? parseFloat(billing.total_amount).toFixed(2) : '0.00'}</td>
                <td>
                  <span className={`status-badge ${billing.status}`}>
                    {billing.status}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="btn btn-icon" onClick={() => onEditBilling(billing)} title="Edit Billing">
                      <FiEdit2 />
                    </button>
                    <button className="btn btn-icon" onClick={() => onDeleteBilling(billing)} title="Delete Billing">
                      <FiTrash2 />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredBillingData().length === 0 && !billingLoading && (
              <tr>
                <td colSpan="11" className="no-results">
                  No billing entries found matching your search criteria
                </td>
              </tr>
            )}
          </tbody>
          {billingData?.summary && (
            <tfoot>
              <tr>
                <td colSpan="3" className="summary-label">Total</td>
                <td>{parseFloat(billingData.summary.total_hours).toFixed(2)}</td>
                <td colSpan="3"></td>
                <td className="amount">${parseFloat(billingData.summary.total_amount).toFixed(2)}</td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          )}
        </table>
        {billingLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Loading billing data...</p>
          </div>
        )}
      </div>

      <div className="billing-summary glass-card">
        <h3>Billing Summary</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <div className="summary-label">Total Entries</div>
            <div className="summary-value">{billingData?.count || 0}</div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Total Hours</div>
            <div className="summary-value">
              {billingData?.summary ? parseFloat(billingData.summary.total_hours).toFixed(2) : 0.0}
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Total Amount</div>
            <div className="summary-value amount">
              ${billingData?.summary ? parseFloat(billingData.summary.total_amount).toFixed(2) : 0.0}
            </div>
          </div>
          <div className="summary-item">
            <div className="summary-label">Date Range</div>
            <div className="summary-value">
              {format(parseISO(dateRange.start), 'MMM d, yyyy')} – {format(parseISO(dateRange.end), 'MMM d, yyyy')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
