import React from 'react';
import PropTypes from 'prop-types';
import MasterCard from './MasterCard';
import '../styles/TimelineColumn.css';

/**
 * TimelineColumn - Revolutionary timeline column component
 * Displays cards in Brett's 48-hour flow system with smooth animations
 * and flow rules indicators
 */
const TimelineColumn = ({ columnType, columnLabel, cards, onCardClick, isActive }) => {
  // Check if this column has the 48-hour horizon rule (Later column)
  const has48HourRule = columnType === 'later';
  
  // Get column header class based on type
  const getHeaderClass = () => {
    if (columnType === 'now') {
      return 'timeline-column-header now-column-header';
    }
    return 'timeline-column-header';
  };
  
  // Get column class based on type and active state
  const getColumnClass = () => {
    const baseClass = `timeline-column timeline-column-${columnType}`;
    return isActive ? `${baseClass} active` : baseClass;
  };
  
  // Check if a card has flow rules (will move to another column soon)
  const hasFlowRules = (card) => {
    // Cards in "Next" column that are starting within 2 hours
    if (columnType === 'next' && card.timeUntilStart && card.timeUntilStart <= 120) {
      return true;
    }
    
    // Cards in "Later" column that are moving to "Next" within 48 hours
    if (columnType === 'later' && card.timeUntilStart && card.timeUntilStart <= 2880) {
      return true;
    }
    
    return false;
  };
  
  // Format the time remaining for flow rule tooltips
  const formatTimeRemaining = (minutes) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };
  
  return (
    <div className={getColumnClass()}>
      {/* Column Header */}
      <div className={getHeaderClass()}>
        <h3>{columnLabel}</h3>
        
        {/* 48-Hour Horizon Indicator for Later column */}
        {has48HourRule && (
          <div className="timeline-horizon-indicator" title="Events beyond 48-hour horizon">
            <span className="horizon-icon">⏱</span>
            <span className="horizon-text">48h</span>
          </div>
        )}
      </div>
      
      {/* Column Content */}
      <div className="timeline-column-content">
        {cards && cards.length > 0 ? (
          cards.map((card, index) => (
            <div 
              key={card.id || index} 
              className={`timeline-card-container ${card.entering ? 'entering' : ''} ${card.exiting ? 'exiting' : ''}`}
            >
              {/* Flow Rule Indicator */}
              {hasFlowRules(card) && (
                <div 
                  className="flow-rule-indicator" 
                  title={`Moving ${columnType === 'next' ? 'to NOW' : 'to Next'} in ${formatTimeRemaining(card.timeUntilStart)}`}
                >
                  ⟳
                </div>
              )}
              
              {/* Card Component */}
              <MasterCard 
                card={card} 
                onClick={() => onCardClick(card)} 
                columnType={columnType}
              />
            </div>
          ))
        ) : (
          <div className="empty-column-message">
            No events {columnType === 'now' ? 'happening now' : 'in this timeframe'}
          </div>
        )}
      </div>
      
      {/* Drop Zone for future drag & drop functionality */}
      <div className="timeline-column-dropzone"></div>
    </div>
  );
};

TimelineColumn.propTypes = {
  columnType: PropTypes.oneOf(['earlier', 'before', 'now', 'next', 'later']).isRequired,
  columnLabel: PropTypes.string.isRequired,
  cards: PropTypes.array,
  onCardClick: PropTypes.func,
  isActive: PropTypes.bool
};

TimelineColumn.defaultProps = {
  cards: [],
  onCardClick: () => {},
  isActive: false
};

export default TimelineColumn;
