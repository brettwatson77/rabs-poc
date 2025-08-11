import React from 'react';
import { FiX } from 'react-icons/fi';

export default function ExportModal({ isOpen, onClose, exportOptions, setExportOptions, participantsData, onSubmit, isExporting }) {
  if (!isOpen) return null;

  const toggleParticipant = (id) => {
    const set = new Set(exportOptions.participant_ids);
    if (set.has(id)) set.delete(id); else set.add(id);
    setExportOptions({ ...exportOptions, participant_ids: Array.from(set) });
  };

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
              Format
              <select value={exportOptions.format} onChange={(e) => setExportOptions({ ...exportOptions, format: e.target.value })}>
                <option value="csv">CSV</option>
                <option value="xlsx">Excel</option>
                <option value="json">JSON</option>
              </select>
            </label>
            <label>
              Start Date
              <input type="date" value={exportOptions.start_date} onChange={(e) => setExportOptions({ ...exportOptions, start_date: e.target.value })} />
            </label>
            <label>
              End Date
              <input type="date" value={exportOptions.end_date} onChange={(e) => setExportOptions({ ...exportOptions, end_date: e.target.value })} />
            </label>
            <label className="full-width">
              Include Details
              <input type="checkbox" checked={!!exportOptions.include_details} onChange={(e) => setExportOptions({ ...exportOptions, include_details: e.target.checked })} />
            </label>

            <div className="full-width">
              <div className="listbox">
                <div className="listbox-header">Participants</div>
                <div className="listbox-body">
                  {participantsData?.data?.map((p) => (
                    <label key={p.id} className="listbox-row">
                      <input type="checkbox" checked={exportOptions.participant_ids.includes(p.id)} onChange={() => toggleParticipant(p.id)} />
                      <span>{p.first_name} {p.last_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isExporting}>Export</button>
          </div>
        </form>
      </div>
    </div>
  );
}
