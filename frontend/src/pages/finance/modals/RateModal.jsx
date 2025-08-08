import React from 'react';

export default function RateModal({ isOpen, onClose, newRate, setNewRate, onSubmit, isSaving }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Rate</h3>
          <button className="btn btn-icon" onClick={onClose}>×</button>
        </div>
        <form onSubmit={onSubmit} className="modal-body">
          <div className="form-grid">
            <label>
              Code
              <input value={newRate.code} onChange={(e) => setNewRate({ ...newRate, code: e.target.value })} required />
            </label>
            <label>
              Description
              <input value={newRate.description} onChange={(e) => setNewRate({ ...newRate, description: e.target.value })} />
            </label>
            <label>
              Amount
              <input type="number" step="0.01" min="0" value={newRate.amount} onChange={(e) => setNewRate({ ...newRate, amount: e.target.value })} required />
            </label>
            <label>
              Category
              <input value={newRate.support_category} onChange={(e) => setNewRate({ ...newRate, support_category: e.target.value })} />
            </label>
            <label>
              Effective Date
              <input type="date" value={newRate.effective_date} onChange={(e) => setNewRate({ ...newRate, effective_date: e.target.value })} />
            </label>
            <label>
              Active
              <input type="checkbox" checked={!!newRate.is_active} onChange={(e) => setNewRate({ ...newRate, is_active: e.target.checked })} />
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
