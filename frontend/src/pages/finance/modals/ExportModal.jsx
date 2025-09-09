import React from 'react';
import { FiX } from 'react-icons/fi';

export default function ExportModal({
  isOpen,
  onClose,
  exportOptions,
  setExportOptions,
  onSubmit,
  isExporting,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Export Billing Data</h3>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <form onSubmit={onSubmit} className="modal-body">
          <div className="form-grid">
            <label>
              Start Date
              <input type="date" value={exportOptions.start_date} onChange={(e) => setExportOptions({ ...exportOptions, start_date: e.target.value })} />
            </label>
            <label>
              End Date
              <input type="date" value={exportOptions.end_date} onChange={(e) => setExportOptions({ ...exportOptions, end_date: e.target.value })} />
            </label>
            <label>
              Type
              <select
                value={exportOptions.type || 'both'}
                onChange={(e) => setExportOptions({ ...exportOptions, type: e.target.value })}
              >
                <option value="bulk">Bulk Upload</option>
                <option value="invoices">Invoices</option>
                <option value="both">Both</option>
              </select>
            </label>

            <label>
              Format
              <select
                value={exportOptions.format}
                onChange={(e) => setExportOptions({ ...exportOptions, format: e.target.value })}
              >
                <option value="csv">CSV</option>
                <option value="xlsx">Excel</option>
                <option value="json">JSON</option>
              </select>
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isExporting}>Export</button>
          </div>
        </form>
      </div>
    </div>
  );
}
