import React from 'react';
import '../styles/Modal.css';

/**
 * A reusable modal component.
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is currently open.
 * @param {Function} props.onClose - Function to call when the modal should be closed.
 * @param {React.ReactNode} props.children - The content to display inside the modal.
 */
const Modal = ({ isOpen, onClose, children }) => {
  // If the modal is not open, render nothing.
  if (!isOpen) {
    return null;
  }

  // Stop propagation on the modal content itself to prevent clicks inside from closing it.
  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  return (
    // The modal-overlay covers the entire screen and listens for clicks to close.
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={handleContentClick}>
        {/* An explicit close button */}
        <button className="modal-close-button" onClick={onClose}>
          &times;
        </button>
        {children}
      </div>
    </div>
  );
};

export default Modal;
