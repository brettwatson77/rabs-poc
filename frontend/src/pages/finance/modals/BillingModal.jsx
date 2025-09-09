import React from 'react';
import { FiX } from 'react-icons/fi';

export default function BillingModal({
  isOpen,
  onClose,
  participantsData,
  programsData,
  codesData,
  selectedBilling,
  newBilling,
  setNewBilling,
  onSubmit,
  onDelete,
  calculateBillingAmount,
}) {
  if (!isOpen) return null;

  // Use unit price directly from state (set when selecting a rate option)
  const unitPrice = parseFloat(newBilling.unit_price) || 0;
  const total = calculateBillingAmount(
    unitPrice,
    parseFloat(newBilling.hours || 0),
    parseFloat(newBilling.quantity || 1)
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{selectedBilling ? 'Edit Billing Entry' : 'New Billing Entry'}</h3>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
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
              <select
                value={newBilling.selected_rate_option_id || ''}
                onChange={(e) => {
                  const optionId = e.target.value;
                  const selectedCode = codesData?.data?.find(
                    (c) => (c.option_id || `${c.id}-${c.ratio}`) === optionId
                  );
                  if (selectedCode) {
                    setNewBilling({
                      ...newBilling,
                      selected_rate_option_id: optionId,
                      rate_code: selectedCode.code,
                      unit_price: selectedCode.rate_cents / 100,
                    });
                  } else {
                    setNewBilling({
                      ...newBilling,
                      selected_rate_option_id: '',
                      rate_code: '',
                      unit_price: 0,
                    });
                  }
                }}
                required
              >
                <option value="">Select rate</option>
                {codesData?.data?.map((c) => (
                  <option
                    key={c.option_id || `${c.id}-${c.ratio}`}
                    value={c.option_id || `${c.id}-${c.ratio}`}
                  >
                    {`${c.code} — ${c.label.split(' — ')[1]} ($${(c.rate_cents/100).toFixed(2)})`}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Quantity
              <input
                type="number"
                step="1"
                min="1"
                value={newBilling.quantity}
                onChange={(e) => setNewBilling({ ...newBilling, quantity: e.target.value })}
                required
              />
            </label>

            <label className="full-width">
              Notes
              <textarea value={newBilling.notes} onChange={(e) => setNewBilling({ ...newBilling, notes: e.target.value })} />
            </label>

            <div className="summary">
              <div>Rate Amount: ${unitPrice.toFixed(2)}</div>
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
