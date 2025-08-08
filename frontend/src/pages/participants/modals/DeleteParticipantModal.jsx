import React from 'react';
import { FiXCircle, FiTrash2, FiAlertCircle } from 'react-icons/fi';

/**
 * Modal component for confirming participant deletion
 * 
 * @param {Object} props Component props
 * @param {boolean} props.isOpen Whether the modal is visible
 * @param {Function} props.onClose Function to call when closing the modal
 * @param {Function} props.onConfirm Function to call when confirming deletion
 * @param {boolean} props.isSubmitting Whether the deletion is in progress
 * @param {Object} props.selectedParticipant The participant to be deleted
 */
const DeleteParticipantModal = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  selectedParticipant
}) => {
  if (!isOpen || !selectedParticipant) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Delete Participant</h3>
          <button className="modal-close" onClick={onClose}>
            <FiXCircle />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="delete-confirmation">
            <FiAlertCircle className="delete-icon" />
            <p>
              Are you sure you want to delete {selectedParticipant.first_name} {selectedParticipant.last_name}?
              This action cannot be undone.
            </p>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="loading-spinner-small"></div>
                Deleting...
              </>
            ) : (
              <>
                <FiTrash2 /> Delete Participant
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteParticipantModal;
