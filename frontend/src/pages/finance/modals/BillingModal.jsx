import React from 'react';

export default function BillingModal({
  isOpen,
  onClose,
  participantsData,
  programsData,
  ratesData,  selectedBilling,
  newBilling,
  setNewBilling,
  onSubmit,
  onDelete,
  calculateBillingAmount,
}) {
  if (!isOpen) return null;

  const selectedRate = ratesData?.data?.find((r) => r.code === newBilling.rate_code);
  const rateAmount = selectedRate ? parseFloat(selectedRate.amount) : 0;
  const total = calculateBillingAmount(rateAmount, parseFloat(newBilling.hours || 0), parseFloat(newBilling.support_ratio || 1), parseFloat(newBilling.weekend_multiplier || 1));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{selectedBilling ? 'Edit Billing Entry' : 'New Billing Entry'}</h3>
          <button className="btn btn-icon" onClick={onClose}>×</button>
        </div>
        <form onSubmit={onSubmit} className="modal-body">
          <div className="form-grid">
            <label>
              Participant
              <select
                value={newBilling.participant_id}
                onChange={(e) => setNewBilling({ ...newBilling, participant_id: e.target.value })}
                required
              >
                <option value="">Select participant</option>
                {participantsData?.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Program
              <select
                value={newBilling.program_id}
                onChange={(e) => setNewBilling({ ...newBilling, program_id: e.target.value })}
                required
              >
                <option value="">Select program</option>
                {programsData?.data?.map((pr) => (
                  <option key={pr.id} value={pr.id}>{pr.title}</option>
                ))}
              </select>
            </label>

            <label>
              Date
              <input type="date" value={newBilling.date} onChange={(e) => setNewBilling({ ...newBilling, date: e.target.value })} required />
            </label>

            <label>
              Hours
              <input type="number" step="0.25" min="0" value={newBilling.hours} onChange={(e) => setNewBilling({ ...newBilling, hours: e.target.value })} required />
            </label>

            <label>
              Rate Code
              <select value={newBilling.rate_code} onChange={(e) => setNewBilling({ ...newBilling, rate_code: e.target.value })} required>
                <option value="">Select rate</option>
                {ratesData?.data?.map((r) => (
                  <option key={r.id} value={r.code}>{r.code} - ${parseFloat(r.amount).toFixed(2)}</option>
                ))}
              </select>
            </label>

            <label>
              Support Ratio
              <input type="number" step="0.25" min="0" value={newBilling.support_ratio} onChange={(e) => setNewBilling({ ...newBilling, support_ratio: e.target.value })} />
            </label>

            <label>
              Weekend Multiplier
              <input type="number" step="0.25" min="0" value={newBilling.weekend_multiplier} onChange={(e) => setNewBilling({ ...newBilling, weekend_multiplier: e.target.value })} />
            </label>

            <label className="full-width">
              Notes
              <textarea value={newBilling.notes} onChange={(e) => setNewBilling({ ...newBilling, notes: e.target.value })} />
            </label>

            <div className="summary">
              <div>Rate Amount: ${rateAmount.toFixed(2)}</div>
              <div>Total: ${Number.isFinite(total) ? total.toFixed(2) : '0.00'}</div>
            </div>
          </div>

          <div className="modal-footer">
            {selectedBilling && (
              <button type="button" className="btn btn-danger" onClick={onDelete}>
                Delete
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
