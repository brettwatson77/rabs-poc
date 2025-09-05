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

  // Format currency on blur
  const handleBlur = (e) => {
    const { name, value } = e.target;
    if (onFieldBlur) {
      onFieldBlur(name, value);
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
            <label>
              Base&nbsp;Rate
              <input
                name="base_rate"
                type="number"
                step="0.01"
                min="0"
                value={newRate.base_rate}
                onChange={(e) =>
                  setNewRate({ ...newRate, base_rate: e.target.value })
                }
                onBlur={handleBlur}
                required
                autoFocus={focusField === 'base_rate'}
              />
              {errors.base_rate && <div className="field-error">{errors.base_rate}</div>}
            </label>
            <label>
              Ratio&nbsp;1:1
              <input
                name="ratio_1_1"
                type="number"
                step="0.01"
                min="0"
                value={newRate.ratio_1_1}
                onChange={(e) =>
                  setNewRate({ ...newRate, ratio_1_1: e.target.value })
                }
                onBlur={handleBlur}
                autoFocus={focusField === 'ratio_1_1'}
              />
              {errors.ratio_1_1 && <div className="field-error">{errors.ratio_1_1}</div>}
            </label>
            <label>
              Ratio&nbsp;1:2
              <input
                name="ratio_1_2"
                type="number"
                step="0.01"
                min="0"
                value={newRate.ratio_1_2}
                onChange={(e) =>
                  setNewRate({ ...newRate, ratio_1_2: e.target.value })
                }
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
                onChange={(e) =>
                  setNewRate({ ...newRate, ratio_1_3: e.target.value })
                }
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
                onChange={(e) =>
                  setNewRate({ ...newRate, ratio_1_4: e.target.value })
                }
                onBlur={handleBlur}
                autoFocus={focusField === 'ratio_1_4'}
              />
              {errors.ratio_1_4 && <div className="field-error">{errors.ratio_1_4}</div>}
            </label>
            <label className="checkbox-inline">
              <input
                name="active"
                type="checkbox"
                checked={!!newRate.active}
                onChange={(e) =>
                  setNewRate({ ...newRate, active: e.target.checked })
                }
              />{' '}
              Active
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onCancel || onClose}>Cancel</button>
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
