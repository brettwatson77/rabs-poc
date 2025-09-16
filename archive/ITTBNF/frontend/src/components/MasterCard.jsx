import React, { useState } from 'react';
import PropTypes from 'prop-types';
import '../styles/MasterCard.css';

/**
 * MasterCard - Revolutionary event card component
 * Displays events with real-time P&L calculations, supervision multipliers,
 * SCHADS cost calculations, and 18% admin overhead visualization
 */
const MasterCard = ({ card, onClick, columnType }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  // Determine card styling based on type and status
  const getCardClass = () => {
    const baseClass = 'master-card';
    
    // Add specific styling for different card types
    if (card.type === 'MASTER') {
      return `${baseClass} master-card-program`;
    } else if (card.type === 'pickup') {
      return `${baseClass} master-card-pickup`;
    } else if (card.type === 'dropoff') {
      return `${baseClass} master-card-dropoff`;
    } else if (card.type === 'activity') {
      return `${baseClass} master-card-activity`;
    } else if (card.type === 'roster') {
      return `${baseClass} master-card-roster`;
    }
    
    return baseClass;
  };
  
  // Format currency values
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Format percentage values
  const formatPercent = (value) => {
    return `${Math.round(value)}%`;
  };
  
  // Calculate supervision load from participants
  const calculateSupervisionLoad = () => {
    if (!card.participants || card.participants.length === 0) {
      return { count: 0, load: 0, multiplier: 0 };
    }
    
    const count = card.participants.length;
    const load = card.participants.reduce(
      (sum, p) => sum + (parseFloat(p.supervision_multiplier) || 1.0),
      0
    );
    const multiplier = load / count;
    
    return { count, load, multiplier };
  };
  
  // Get supervision indicator class based on load
  const getSupervisionClass = () => {
    const { multiplier } = calculateSupervisionLoad();
    
    if (multiplier <= 1.0) return 'supervision-normal';
    if (multiplier <= 1.5) return 'supervision-elevated';
    if (multiplier <= 2.0) return 'supervision-high';
    return 'supervision-critical';
  };
  
  // Handle card click
  const handleCardClick = (e) => {
    e.stopPropagation();
    onClick(card);
  };
  
  // Toggle detailed view
  const toggleDetails = (e) => {
    e.stopPropagation();
    setShowDetails(!showDetails);
  };
  
  // Extract financial data
  const financials = card.financials || {
    revenue: 0,
    staffCosts: 0,
    rawProfitLoss: 0,
    adminCosts: 0,
    profitLoss: 0,
    profitMargin: 0
  };
  
  // Calculate supervision details
  const supervisionDetails = calculateSupervisionLoad();
  
  return (
    <div 
      className={`${getCardClass()} ${columnType}-column-card`}
      onClick={handleCardClick}
    >
      {/* Card Header */}
      <div className="master-card-header">
        <div className="master-card-title">
          <h4>{card.title || 'Untitled Event'}</h4>
          {card.type === 'MASTER' && (
            <span className="master-badge" title="Master Program Card">M</span>
          )}
        </div>
        <div className="master-card-time">
          {card.time || card.startTime}
          {card.endTime && ` - ${card.endTime}`}
        </div>
      </div>
      
      {/* Card Body */}
      <div className="master-card-body">
        {/* Participants Section */}
        <div className="master-card-participants">
          <div className="participant-count">
            <span className="count-number">{supervisionDetails.count}</span>
            <span className="count-label">participants</span>
          </div>
          
          {/* Supervision Multiplier Indicator */}
          {supervisionDetails.count > 0 && (
            <div className={`supervision-indicator ${getSupervisionClass()}`} title="Supervision Load">
              <div className="supervision-bar">
                <div 
                  className="supervision-fill" 
                  style={{ width: `${Math.min(100, supervisionDetails.multiplier * 50)}%` }}
                />
              </div>
              <div className="supervision-value">
                {supervisionDetails.load.toFixed(1)}
              </div>
            </div>
          )}
        </div>
        
        {/* Financial Summary Section - Only for MASTER cards */}
        {card.type === 'MASTER' && (
          <div className="master-card-financials">
            <div className="financial-row">
              <span className="financial-label">Revenue</span>
              <span className="financial-value revenue">{formatCurrency(financials.revenue)}</span>
            </div>
            
            <div className="financial-row">
              <span className="financial-label">Staff</span>
              <span className="financial-value cost">{formatCurrency(financials.staffCosts)}</span>
            </div>
            
            <div className="financial-row admin-row">
              <span className="financial-label">Admin</span>
              <span className="financial-value admin-cost">
                {formatCurrency(financials.adminCosts)}
                <span className="admin-percent" title="Brett's Primadonna Rate">18%</span>
              </span>
            </div>
            
            <div className="financial-row profit-row">
              <span className="financial-label">Profit</span>
              <span className={`financial-value ${financials.profitLoss >= 0 ? 'profit' : 'loss'}`}>
                {formatCurrency(financials.profitLoss)}
                <span className="profit-percent">{formatPercent(financials.profitMargin)}</span>
              </span>
            </div>
          </div>
        )}
        
        {/* Staff Assignment Section */}
        {card.staff && card.staff.length > 0 && (
          <div className="master-card-staff">
            {card.staff.map((staffMember, index) => (
              <div key={index} className="staff-badge" title={`${staffMember.name}: SCHADS Level ${staffMember.schadsLevel}`}>
                {staffMember.initials || staffMember.name.charAt(0)}
                <span className="schads-indicator">{staffMember.schadsLevel}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Vehicle Assignment (for pickup/dropoff) */}
        {(card.type === 'pickup' || card.type === 'dropoff') && card.vehicle && (
          <div className="master-card-vehicle">
            <span className="vehicle-icon">🚐</span>
            <span className="vehicle-name">{card.vehicle.description || card.vehicle.id}</span>
          </div>
        )}
      </div>
      
      {/* Card Footer */}
      <div className="master-card-footer">
        {/* Status Indicators */}
        <div className="master-card-status">
          {card.status && (
            <span className={`status-badge status-${card.status.toLowerCase()}`}>
              {card.status}
            </span>
          )}
          
          {/* Detail Toggle Button */}
          <button 
            className="detail-toggle" 
            onClick={toggleDetails}
            aria-label={showDetails ? "Hide details" : "Show details"}
          >
            {showDetails ? '▼' : '▶'}
          </button>
        </div>
      </div>
      
      {/* Expanded Details Panel */}
      {showDetails && (
        <div className="master-card-details">
          {/* Additional financial breakdown */}
          {card.type === 'MASTER' && (
            <div className="financial-details">
              <h5>Financial Breakdown</h5>
              <table className="financial-table">
                <tbody>
                  <tr>
                    <td>Revenue per participant:</td>
                    <td>{formatCurrency(financials.revenue / Math.max(1, supervisionDetails.count))}</td>
                  </tr>
                  <tr>
                    <td>Staff cost per hour:</td>
                    <td>{formatCurrency(financials.staffCosts / (card.durationHours || 1))}</td>
                  </tr>
                  <tr>
                    <td>Admin overhead (18%):</td>
                    <td>{formatCurrency(financials.adminCosts)}</td>
                  </tr>
                  <tr className="profit-detail">
                    <td>Profit margin:</td>
                    <td>{formatPercent(financials.profitMargin)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          
          {/* Supervision breakdown */}
          {supervisionDetails.count > 0 && (
            <div className="supervision-details">
              <h5>Supervision Breakdown</h5>
              <p>
                {supervisionDetails.count} participants with combined supervision load of {supervisionDetails.load.toFixed(1)}
                {supervisionDetails.multiplier > 1 && (
                  <span className="multiplier-note">
                    {' '}(avg multiplier: {supervisionDetails.multiplier.toFixed(2)}x)
                  </span>
                )}
              </p>
            </div>
          )}
          
          {/* Staff details with SCHADS */}
          {card.staff && card.staff.length > 0 && (
            <div className="staff-details">
              <h5>Staff Assignment</h5>
              <ul className="staff-list">
                {card.staff.map((staffMember, index) => (
                  <li key={index}>
                    <span className="staff-name">{staffMember.name}</span>
                    <span className="staff-schads">
                      SCHADS L{staffMember.schadsLevel} 
                      ({formatCurrency(staffMember.hourlyRate)}/hr)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

MasterCard.propTypes = {
  card: PropTypes.object.isRequired,
  onClick: PropTypes.func,
  columnType: PropTypes.string
};

MasterCard.defaultProps = {
  onClick: () => {},
  columnType: 'next'
};

export default MasterCard;
