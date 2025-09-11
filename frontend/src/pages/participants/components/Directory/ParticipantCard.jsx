import React from 'react';
import { FiEdit2, FiTrash2, FiPhone, FiHome } from 'react-icons/fi';
import { FaWheelchair, FaBrain } from 'react-icons/fa';
import { BsEar } from 'react-icons/bs';
import { FiCoffee, FiHeart, FiBell, FiEye, FiMessageCircle } from 'react-icons/fi';
import {
  calculateAge,
  getStatusBadge,
  getSupportLevelBadge,
  getSupervisionColor
} from '../../helpers/participantsUtils';

// Support flag icon mapping
const SUPPORT_FLAG_ICONS = {
  has_wheelchair_access: <FaWheelchair />,
  has_dietary_requirements: <FiCoffee />,
  has_medical_requirements: <FiHeart />,
  has_behavioral_support: <FiBell />,
  has_visual_impairment: <FiEye />,
  has_hearing_impairment: <BsEar />,
  has_cognitive_support: <FaBrain />,
  has_communication_needs: <FiMessageCircle />
};

// Support flag labels
const SUPPORT_FLAG_LABELS = {
  has_wheelchair_access: 'Wheelchair Access',
  has_dietary_requirements: 'Dietary Requirements',
  has_medical_requirements: 'Medical Requirements',
  has_behavioral_support: 'Behavioral Support',
  has_visual_impairment: 'Visual Impairment',
  has_hearing_impairment: 'Hearing Impairment',
  has_cognitive_support: 'Cognitive Support',
  has_communication_needs: 'Communication Needs'
};

const ParticipantCard = ({ participant, selected, onClick, onEdit, onDelete }) => {
  // Calculate supervision multiplier color and width
  const rawMultiplier = participant.supervision_multiplier;
  let supervisionMultiplier = parseFloat(rawMultiplier);
  if (!Number.isFinite(supervisionMultiplier)) supervisionMultiplier = 1.0;
  // Clamp between 1.0 and 2.5
  supervisionMultiplier = Math.min(2.5, Math.max(1.0, supervisionMultiplier));

  const supervisionColor = getSupervisionColor(supervisionMultiplier);
  const supervisionWidth = Math.min(
    100,
    Math.max(0, (supervisionMultiplier / 2.5) * 100)
  );
  
  return (
    <div 
      className={`participant-card glass-card ${selected ? 'selected' : ''}`}
      onClick={() => onClick(participant)}
    >
      <div className="participant-header">
        <div className="participant-avatar">
          {participant.first_name?.[0]}{participant.last_name?.[0]}
        </div>
        <div className="participant-badges">
          <span className={`badge ${getStatusBadge(participant.status)}`}>
            {participant.status}
          </span>
          <span className={`badge ${getSupportLevelBadge(participant.support_level)}`}>
            {participant.support_level}
          </span>
        </div>
      </div>
      
      <div className="participant-info">
        <h3 className="participant-name">
          {participant.first_name} {participant.last_name}
        </h3>
        <p className="participant-ndis">
          <span>NDIS:</span> {participant.ndis_number || 'N/A'}
        </p>
        <p className="participant-age">
          <span>Age:</span> {calculateAge(participant.date_of_birth)}
        </p>
      </div>
      
      {/* Supervision Multiplier Indicator */}
      <div className="supervision-indicator">
        <div className="supervision-label">
          <span>Supervision:</span>
          <span style={{ color: supervisionColor }}>{supervisionMultiplier.toFixed(2)}×</span>
        </div>
        <div className="supervision-bar-bg">
          <div 
            className="supervision-bar-fg"
            style={{ 
              width: `${supervisionWidth}%`,
              backgroundColor: supervisionColor
            }}
          ></div>
        </div>
      </div>
      
      {/* Support Flags */}
      <div className="support-flags">
        {Object.entries(SUPPORT_FLAG_ICONS).map(([key, icon]) => (
          participant[key] && (
            <span 
              key={key} 
              className="support-flag-icon" 
              title={SUPPORT_FLAG_LABELS[key]}
            >
              {icon}
            </span>
          )
        ))}
      </div>
      
      <div className="participant-footer">
        <div className="participant-contact">
          {participant.phone && (
            <div className="contact-item phone">
              <FiPhone className="contact-icon" />
              <span>{participant.phone}</span>
            </div>
          )}
          {participant.address && (
            <div className="contact-item address">
              <FiHome className="contact-icon" />
              <span>
                {participant.address}
                {participant.suburb && `, ${participant.suburb}`}
                {participant.state && `, ${participant.state}`}
                {participant.postcode && ` ${participant.postcode}`}
              </span>
            </div>
          )}
        </div>
        
        <div className="participant-actions">
          <button 
            className="action-btn edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(participant);
            }}
            title="Edit"
          >
            <FiEdit2 />
          </button>
          <button 
            className="action-btn delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(participant);
            }}
            title="Delete"
          >
            <FiTrash2 />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParticipantCard;
