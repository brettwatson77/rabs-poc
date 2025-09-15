import React from 'react';
import { FiSave } from 'react-icons/fi';

/**
 * Modal component for creating a new participant
 * 
 * @param {Object} props Component props
 * @param {boolean} props.isOpen Whether the modal is visible
 * @param {Function} props.onClose Function to call when closing the modal
 * @param {Object} props.participantForm Form data object
 * @param {Function} props.setParticipantForm Function to update form data
 * @param {Function} props.onSubmit Function to call when submitting the form
 * @param {boolean} props.isSubmitting Whether the form is currently submitting
 */
const CreateParticipantModal = ({
  isOpen,
  onClose,
  participantForm,
  setParticipantForm,
  onSubmit,
  isSubmitting
}) => {
  if (!isOpen) return null;

  // Helper function to get supervision color based on multiplier value
  const getSupervisionColor = (multiplier) => {
    if (multiplier <= 1.0) return '#9e9e9e';
    if (multiplier <= 1.5) return '#4caf50';
    if (multiplier <= 2.0) return '#ff9800';
    return '#e53935';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Participant</h3>
        </div>
        
        <div className="modal-body">
          <form className="participant-form" onSubmit={onSubmit}>
            <div className="form-section">
              <h4>Personal Information</h4>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="first-name">First Name</label>
                  <input
                    id="first-name"
                    type="text"
                    value={participantForm.first_name}
                    onChange={(e) => setParticipantForm({...participantForm, first_name: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="last-name">Last Name</label>
                  <input
                    id="last-name"
                    type="text"
                    value={participantForm.last_name}
                    onChange={(e) => setParticipantForm({...participantForm, last_name: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ndis-number">NDIS Number</label>
                  <input
                    id="ndis-number"
                    type="text"
                    value={participantForm.ndis_number}
                    onChange={(e) => setParticipantForm({...participantForm, ndis_number: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="date-of-birth">Date of Birth</label>
                  <input
                    id="date-of-birth"
                    type="date"
                    value={participantForm.date_of_birth}
                    onChange={(e) => setParticipantForm({...participantForm, date_of_birth: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="gender">Gender</label>
                  <select
                    id="gender"
                    value={participantForm.gender}
                    onChange={(e) => setParticipantForm({...participantForm, gender: e.target.value})}
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="phone">Phone</label>
                  <input
                    id="phone"
                    type="tel"
                    value={participantForm.phone}
                    onChange={(e) => setParticipantForm({...participantForm, phone: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* -------------------- EMAILS -------------------- */}
            <div className="form-section">
              <h4>Emails</h4>

              {/* Primary Email */}
              <div className="form-group">
                <label htmlFor="create-email">Primary Email</label>
                <input
                  id="create-email"
                  type="email"
                  value={participantForm.email}
                  onChange={(e) => setParticipantForm({...participantForm, email: e.target.value})}
                />
              </div>

              {/* Secondary Email */}
              <div className="form-group">
                <label htmlFor="create-secondary-email">Secondary Email</label>
                <input
                  id="create-secondary-email"
                  type="email"
                  value={participantForm.secondary_email || ''}
                  onChange={(e) =>
                    setParticipantForm({
                      ...participantForm,
                      secondary_email: e.target.value,
                    })
                  }
                />

                <div className="checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={participantForm.secondary_email_include_comms || false}
                      onChange={(e) =>
                        setParticipantForm({
                          ...participantForm,
                          secondary_email_include_comms: e.target.checked,
                        })
                      }
                    />{' '}
                    Include in communications / newsletters
                  </label>
                  <label style={{ marginLeft: 16 }}>
                    <input
                      type="checkbox"
                      checked={participantForm.secondary_email_include_billing || false}
                      onChange={(e) =>
                        setParticipantForm({
                          ...participantForm,
                          secondary_email_include_billing: e.target.checked,
                        })
                      }
                    />{' '}
                    Include in billing communications
                  </label>
                </div>
              </div>

              {/* Invoices Email */}
              <div className="form-group">
                <label htmlFor="create-invoices-email">
                  Invoices Email{' '}
                  <small style={{ fontWeight: 400 }}>
                    (required for plan/self managed or fee-for-service)
                  </small>
                </label>
                <input
                  id="create-invoices-email"
                  type="email"
                  value={participantForm.invoices_email || ''}
                  onChange={(e) =>
                    setParticipantForm({
                      ...participantForm,
                      invoices_email: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            
            <div className="form-section">
              <h4>Address</h4>
              <div className="form-group">
                <label htmlFor="address">Street Address</label>
                <input
                  id="address"
                  type="text"
                  value={participantForm.address}
                  onChange={(e) => setParticipantForm({...participantForm, address: e.target.value})}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="suburb">Suburb</label>
                  <input
                    id="suburb"
                    type="text"
                    value={participantForm.suburb}
                    onChange={(e) => setParticipantForm({...participantForm, suburb: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="state">State</label>
                  <select
                    id="state"
                    value={participantForm.state}
                    onChange={(e) => setParticipantForm({...participantForm, state: e.target.value})}
                  >
                    <option value="NSW">NSW</option>
                    <option value="VIC">VIC</option>
                    <option value="QLD">QLD</option>
                    <option value="SA">SA</option>
                    <option value="WA">WA</option>
                    <option value="TAS">TAS</option>
                    <option value="NT">NT</option>
                    <option value="ACT">ACT</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="postcode">Postcode</label>
                  <input
                    id="postcode"
                    type="text"
                    value={participantForm.postcode}
                    onChange={(e) => setParticipantForm({...participantForm, postcode: e.target.value})}
                  />
                </div>
              </div>

              {/* -------- Secondary Address -------- */}
              <h5 style={{ marginTop: 12 }}>Secondary Address (optional)</h5>
              <div className="form-group">
                <label htmlFor="create-sec-address-line1">Street Address</label>
                <input
                  id="create-sec-address-line1"
                  type="text"
                  value={participantForm.secondary_address_line1 || ''}
                  onChange={(e) =>
                    setParticipantForm({
                      ...participantForm,
                      secondary_address_line1: e.target.value,
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="create-sec-address-line2">Address Line 2</label>
                <input
                  id="create-sec-address-line2"
                  type="text"
                  value={participantForm.secondary_address_line2 || ''}
                  onChange={(e) =>
                    setParticipantForm({
                      ...participantForm,
                      secondary_address_line2: e.target.value,
                    })
                  }
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="create-sec-suburb">Suburb</label>
                  <input
                    id="create-sec-suburb"
                    type="text"
                    value={participantForm.secondary_address_suburb || ''}
                    onChange={(e) =>
                      setParticipantForm({
                        ...participantForm,
                        secondary_address_suburb: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="create-sec-state">State</label>
                  <select
                    id="create-sec-state"
                    value={participantForm.secondary_address_state || 'NSW'}
                    onChange={(e) =>
                      setParticipantForm({
                        ...participantForm,
                        secondary_address_state: e.target.value,
                      })
                    }
                  >
                    <option value="NSW">NSW</option>
                    <option value="VIC">VIC</option>
                    <option value="QLD">QLD</option>
                    <option value="SA">SA</option>
                    <option value="WA">WA</option>
                    <option value="TAS">TAS</option>
                    <option value="NT">NT</option>
                    <option value="ACT">ACT</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="create-sec-postcode">Postcode</label>
                  <input
                    id="create-sec-postcode"
                    type="text"
                    value={participantForm.secondary_address_postcode || ''}
                    onChange={(e) =>
                      setParticipantForm({
                        ...participantForm,
                        secondary_address_postcode: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="create-sec-country">Country</label>
                <input
                  id="create-sec-country"
                  type="text"
                  value={participantForm.secondary_address_country || ''}
                  onChange={(e) =>
                    setParticipantForm({
                      ...participantForm,
                      secondary_address_country: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            
            <div className="form-section">
              <h4>Emergency Contact</h4>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="emergency-contact-name">Name</label>
                  <input
                    id="emergency-contact-name"
                    type="text"
                    value={participantForm.emergency_contact_name}
                    onChange={(e) => setParticipantForm({...participantForm, emergency_contact_name: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="emergency-contact-phone">Phone</label>
                  <input
                    id="emergency-contact-phone"
                    type="tel"
                    value={participantForm.emergency_contact_phone}
                    onChange={(e) => setParticipantForm({...participantForm, emergency_contact_phone: e.target.value})}
                  />
                </div>
                
                {/* SMS toggle inline with phone field */}
                <div className="form-group sms-inline">
                  <label htmlFor="create-emergency-sms">SMS</label>
                  <input
                    id="create-emergency-sms"
                    type="checkbox"
                    checked={participantForm.emergency_contact_phone_allow_sms || false}
                    onChange={(e) =>
                      setParticipantForm({
                        ...participantForm,
                        emergency_contact_phone_allow_sms: e.target.checked,
                      })
                    }
                  />
                </div>
              </div>

              {/* Relationship */}
              <div className="form-group">
                <label htmlFor="create-emergency-contact-relationship">
                  Relationship
                </label>
                <input
                  id="create-emergency-contact-relationship"
                  type="text"
                  value={participantForm.emergency_contact_relationship || ''}
                  onChange={(e) =>
                    setParticipantForm({
                      ...participantForm,
                      emergency_contact_relationship: e.target.value,
                    })
                  }
                />
              </div>

              {/* Contact Email + toggles */}
              <div className="form-group">
                <label htmlFor="create-emergency-contact-email">Email</label>
                <input
                  id="create-emergency-contact-email"
                  type="email"
                  value={participantForm.emergency_contact_email || ''}
                  onChange={(e) =>
                    setParticipantForm({
                      ...participantForm,
                      emergency_contact_email: e.target.value,
                    })
                  }
                />
                <div className="checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={participantForm.emergency_contact_email_include_comms || false}
                      onChange={(e) =>
                        setParticipantForm({
                          ...participantForm,
                          emergency_contact_email_include_comms: e.target.checked,
                        })
                      }
                    />{' '}
                    Include in communications / newsletters
                  </label>
                  <label style={{ marginLeft: 16 }}>
                    <input
                      type="checkbox"
                      checked={participantForm.emergency_contact_email_include_billing || false}
                      onChange={(e) =>
                        setParticipantForm({
                          ...participantForm,
                          emergency_contact_email_include_billing: e.target.checked,
                        })
                      }
                    />{' '}
                    Include in billing communications
                  </label>
                </div>
              </div>
            </div>
            
            <div className="form-section">
              <h4>Support Details</h4>
              
              {/* Supervision Multiplier Slider */}
              <div className="form-group">
                <label htmlFor="create-supervision-multiplier">Supervision Multiplier</label>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span>Current Value:</span>
                    <span style={{ 
                      fontWeight: 'bold', 
                      fontSize: '1.1em',
                      color: getSupervisionColor(parseFloat(participantForm.supervision_multiplier || 1.0))
                    }}>
                      {parseFloat(participantForm.supervision_multiplier || 1.0).toFixed(2)}×
                    </span>
                  </div>
                  
                  <input
                    id="create-supervision-multiplier"
                    type="range"
                    min="1"
                    max="2"
                    step="0.25"
                    value={participantForm.supervision_multiplier || 1.0}
                    onChange={(e) => setParticipantForm({
                      ...participantForm, 
                      supervision_multiplier: parseFloat(e.target.value)
                    })}
                    style={{ width: '100%' }}
                  />
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    width: '100%',
                    fontSize: '0.85em',
                    color: '#666'
                  }}>
                    <span>1.0×</span>
                    <span>1.25×</span>
                    <span>1.5×</span>
                    <span>1.75×</span>
                    <span>2.0×</span>
                  </div>
                </div>
              </div>
              
              <div className="form-row">
                {/* Plan Management Type */}
                <div className="form-group">
                  <label htmlFor="create-plan-management">Plan Management</label>
                  <select
                    id="create-plan-management"
                    value={participantForm.plan_management_type}
                    onChange={(e) => setParticipantForm({...participantForm, plan_management_type: e.target.value})}
                  >
                    <option value="agency_managed">Agency Managed</option>
                    <option value="plan_managed">Plan Managed</option>
                    <option value="self_managed">Self Managed</option>
                    <option value="self_funded">Self Funded (Fee-for-service)</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    value={participantForm.status}
                    onChange={(e) => setParticipantForm({...participantForm, status: e.target.value})}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  value={participantForm.notes}
                  onChange={(e) => setParticipantForm({...participantForm, notes: e.target.value})}
                  rows="3"
                ></textarea>
              </div>
            </div>
            
            <div className="form-actions">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <FiSave /> Create Participant
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateParticipantModal;
