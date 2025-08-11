import React from 'react';
import { FiX, FiSave } from 'react-icons/fi';

/**
 * Modal component for editing an existing participant
 * 
 * @param {Object} props Component props
 * @param {boolean} props.isOpen Whether the modal is visible
 * @param {Function} props.onClose Function to call when closing the modal
 * @param {Object} props.participantForm Form data object
 * @param {Function} props.setParticipantForm Function to update form data
 * @param {Function} props.onSubmit Function to call when submitting the form
 * @param {boolean} props.isSubmitting Whether the form is currently submitting
 */
const EditParticipantModal = ({
  isOpen,
  onClose,
  participantForm,
  setParticipantForm,
  onSubmit,
  isSubmitting
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Participant</h3>
          <button className="modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>
        
        <div className="modal-body">
          <form className="participant-form" onSubmit={onSubmit}>
            <div className="form-section">
              <h4>Personal Information</h4>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-first-name">First Name</label>
                  <input
                    id="edit-first-name"
                    type="text"
                    value={participantForm.first_name}
                    onChange={(e) => setParticipantForm({...participantForm, first_name: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-last-name">Last Name</label>
                  <input
                    id="edit-last-name"
                    type="text"
                    value={participantForm.last_name}
                    onChange={(e) => setParticipantForm({...participantForm, last_name: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-ndis-number">NDIS Number</label>
                  <input
                    id="edit-ndis-number"
                    type="text"
                    value={participantForm.ndis_number}
                    onChange={(e) => setParticipantForm({...participantForm, ndis_number: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-date-of-birth">Date of Birth</label>
                  <input
                    id="edit-date-of-birth"
                    type="date"
                    value={participantForm.date_of_birth}
                    onChange={(e) => setParticipantForm({...participantForm, date_of_birth: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-gender">Gender</label>
                  <select
                    id="edit-gender"
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
                  <label htmlFor="edit-phone">Phone</label>
                  <input
                    id="edit-phone"
                    type="tel"
                    value={participantForm.phone}
                    onChange={(e) => setParticipantForm({...participantForm, phone: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-email">Email</label>
                <input
                  id="edit-email"
                  type="email"
                  value={participantForm.email}
                  onChange={(e) => setParticipantForm({...participantForm, email: e.target.value})}
                />
              </div>
            </div>
            
            <div className="form-section">
              <h4>Address</h4>
              <div className="form-group">
                <label htmlFor="edit-address">Street Address</label>
                <input
                  id="edit-address"
                  type="text"
                  value={participantForm.address}
                  onChange={(e) => setParticipantForm({...participantForm, address: e.target.value})}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-suburb">Suburb</label>
                  <input
                    id="edit-suburb"
                    type="text"
                    value={participantForm.suburb}
                    onChange={(e) => setParticipantForm({...participantForm, suburb: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-state">State</label>
                  <select
                    id="edit-state"
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
                  <label htmlFor="edit-postcode">Postcode</label>
                  <input
                    id="edit-postcode"
                    type="text"
                    value={participantForm.postcode}
                    onChange={(e) => setParticipantForm({...participantForm, postcode: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            <div className="form-section">
              <h4>Emergency Contact</h4>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-emergency-contact-name">Name</label>
                  <input
                    id="edit-emergency-contact-name"
                    type="text"
                    value={participantForm.emergency_contact_name}
                    onChange={(e) => setParticipantForm({...participantForm, emergency_contact_name: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-emergency-contact-phone">Phone</label>
                  <input
                    id="edit-emergency-contact-phone"
                    type="tel"
                    value={participantForm.emergency_contact_phone}
                    onChange={(e) => setParticipantForm({...participantForm, emergency_contact_phone: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            <div className="form-section">
              <h4>Support Details</h4>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-support-level">Support Level</label>
                  <select
                    id="edit-support-level"
                    value={participantForm.support_level}
                    onChange={(e) => setParticipantForm({...participantForm, support_level: e.target.value})}
                  >
                    <option value="standard">Standard</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-status">Status</label>
                  <select
                    id="edit-status"
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
                <label htmlFor="edit-notes">Notes</label>
                <textarea
                  id="edit-notes"
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
                    Saving...
                  </>
                ) : (
                  <>
                    <FiSave /> Save Changes
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

export default EditParticipantModal;
