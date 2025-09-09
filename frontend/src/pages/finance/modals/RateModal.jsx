import React from 'react';
import { FiX } from 'react-icons/fi';

export default function RateModal({ 
  isOpen, 
  onClose, 
  onCancel,
  newRate, 
  setNewRate, 
  onSubmit, 
  isSaving,
  errors = {},
  isDirty = false,
  onKeyDown,
  onFieldBlur,
  focusField
}) {
  if (!isOpen) return null;

  // Check if there are any errors
  const hasErrors = Object.values(errors).some(error => !!error);

  // Convenience flags with sane defaults
  const isSingle = !!newRate.single_rate;
  const autoCalc = newRate.autoCalc !== false; // default ON

  // Format currency on blur
  const handleBlur = (e) => {
    const { name, value } = e.target;
    if (onFieldBlur) {
      onFieldBlur(name, value);
    }
  };

  // Handle numeric change (with optional auto-calc)
  const handleNumberChange = (name, value) => {
    // Always set the field first
    setNewRate(prev => ({ ...prev, [name]: value }));

    // Auto-derive ratios when changing base_rate
    if (name === 'base_rate' && !isSingle && autoCalc) {
      const base = parseFloat(value);
      if (!isNaN(base)) {
        const fix = (n) => (Math.round(n * 100) / 100).toFixed(2);
        setNewRate(prev => ({
          ...prev,
          ratio_1_2: fix(base / 2),
          ratio_1_3: fix(base / 3),
          ratio_1_4: fix(base / 4),
          ratio_1_5: fix(base / 5),
        }));
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel || onClose}>
      <div 
        className="modal" 
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="modal-header">
          <h3>Add / Edit Rate</h3>
          <button className="modal-close" onClick={onCancel || onClose}>
            <FiX />
          </button>
        </div>
        <form onSubmit={onSubmit} className="modal-body">
          {/* ----------------------------  Details  ---------------------------- */}
          <h4 className="section-title">Details</h4>
          <div className="form-grid">

            <label>
              Code
              <input 
                name="code"
                value={newRate.code} 
                onChange={(e) => setNewRate({ ...newRate, code: e.target.value })} 
                onBlur={handleBlur}
                required 
                autoFocus={focusField === 'code'}
              />
              {errors.code && <div className="field-error">{errors.code}</div>}
            </label>
            
            <label>
              Description
              <input 
                name="description"
                value={newRate.description} 
                onChange={(e) => setNewRate({ ...newRate, description: e.target.value })} 
                onBlur={handleBlur}
                autoFocus={focusField === 'description'}
              />
              {errors.description && <div className="field-error">{errors.description}</div>}
            </label>
            {/* Active toggle sits with details for quick access */}
            <label className="checkbox-inline">
              <input
                name="active"
                type="checkbox"
                checked={!!newRate.active}
                onChange={(e) => setNewRate({ ...newRate, active: e.target.checked })}
              />{' '}
              Active
            </label>

          </div> {/* end Details grid */}

          {/* ----------------------------  Options  ---------------------------- */}
          <h4 className="section-title">Options</h4>
          <div className="form-row checkbox-group">
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={isSingle}
                onChange={e => setNewRate({ ...newRate, single_rate: e.target.checked })}
              />{' '}
              Single rate (1:1 only)
            </label>
            {!isSingle && (
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={autoCalc}
                  onChange={e => setNewRate({ ...newRate, autoCalc: e.target.checked })}
                />{' '}
                Auto-calc from base
              </label>
            )}
          </div>
            {/* Auto-calc toggle visible only for group codes */}
          {/* ----------------------------  Pricing  ---------------------------- */}
          <h4 className="section-title">Pricing</h4>
          <div className="form-grid">
            <label className="full-width">
              Base&nbsp;/&nbsp;1:1
              <input
                name="base_rate"
                type="number"
                step="0.01"
                min="0"
                value={newRate.base_rate}
                onChange={(e) => handleNumberChange('base_rate', e.target.value)}
                onBlur={handleBlur}
                required
                autoFocus={focusField === 'base_rate'}
              />
              {errors.base_rate && <div className="field-error">{errors.base_rate}</div>}
            </label>
          </div>
            {/* Group ratio fields - only shown when single_rate is false */}
            {!isSingle && (
              <div className="form-grid ratio-grid">
              <label>
                  Ratio&nbsp;1:2
                  <input
                    name="ratio_1_2"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newRate.ratio_1_2}
                    onChange={(e) => handleNumberChange('ratio_1_2', e.target.value)}
                    onBlur={handleBlur}
                    autoFocus={focusField === 'ratio_1_2'}
                  />
                  {errors.ratio_1_2 && <div className="field-error">{errors.ratio_1_2}</div>}
                </label>
                
                <label>
                  Ratio&nbsp;1:3
                  <input
                    name="ratio_1_3"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newRate.ratio_1_3}
                    onChange={(e) => handleNumberChange('ratio_1_3', e.target.value)}
                    onBlur={handleBlur}
                    autoFocus={focusField === 'ratio_1_3'}
                  />
                  {errors.ratio_1_3 && <div className="field-error">{errors.ratio_1_3}</div>}
                </label>
                
                <label>
                  Ratio&nbsp;1:4
                  <input
                    name="ratio_1_4"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newRate.ratio_1_4}
                    onChange={(e) => handleNumberChange('ratio_1_4', e.target.value)}
                    onBlur={handleBlur}
                    autoFocus={focusField === 'ratio_1_4'}
                  />
                  {errors.ratio_1_4 && <div className="field-error">{errors.ratio_1_4}</div>}
                </label>
                
                <label>
                  Ratio&nbsp;1:5
                  <input
                    name="ratio_1_5"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newRate.ratio_1_5 || ''}
                    onChange={(e) => handleNumberChange('ratio_1_5', e.target.value)}
                    onBlur={handleBlur}
                    autoFocus={focusField === 'ratio_1_5'}
                  />
                  {errors.ratio_1_5 && <div className="field-error">{errors.ratio_1_5}</div>}
                </label>
            </div>
            )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel || onClose}>Cancel</button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isSaving || !isDirty || hasErrors}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
