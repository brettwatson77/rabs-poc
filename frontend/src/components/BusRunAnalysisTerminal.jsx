import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import '../styles/BusRunAnalysisTerminal.css';

/**
 * BusRunAnalysisTerminal - A terminal-style component that displays the bus run analysis
 * in real-time with typing animations and color-coded messages.
 */
const BusRunAnalysisTerminal = ({ 
  messages = [], 
  isAnalyzing = false, 
  isComplete = false,
  onClose = () => {},
  title = "RABS Bus Run Analysis & Optimisation"
}) => {
  const [visibleMessages, setVisibleMessages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const terminalRef = useRef(null);

  // Auto-scroll to bottom when messages are added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [visibleMessages]);

  // Typing animation effect
  useEffect(() => {
    if (currentIndex >= messages.length) return;
    
    const currentMessage = messages[currentIndex];
    if (!currentMessage) return;
    
    // If we've typed the full message
    if (currentCharIndex >= currentMessage.text.length) {
      // Small delay before starting the next message
      const timer = setTimeout(() => {
        setCurrentIndex(prevIndex => prevIndex + 1);
        setCurrentCharIndex(0);
      }, 50);
      return () => clearTimeout(timer);
    }
    
    // Typing speed varies based on message type
    let typingSpeed = 10; // Default speed
    
    // Adjust speed based on message type
    switch (currentMessage.type) {
      case 'header':
        typingSpeed = 30;
        break;
      case 'result':
        typingSpeed = 20;
        break;
      case 'analysis':
        typingSpeed = 5;
        break;
      default:
        typingSpeed = 15;
    }
    
    // Type the next character
    const timer = setTimeout(() => {
      setCurrentCharIndex(prevCharIndex => prevCharIndex + 1);
    }, typingSpeed);
    
    return () => clearTimeout(timer);
  }, [currentIndex, currentCharIndex, messages]);

  // Add characters to visible messages
  useEffect(() => {
    if (currentIndex >= messages.length) return;
    
    const currentMessage = messages[currentIndex];
    if (!currentMessage) return;
    
    // Create a partial message with characters typed so far
    const partialMessage = {
      ...currentMessage,
      text: currentMessage.text.substring(0, currentCharIndex)
    };
    
    // Update visible messages
    setVisibleMessages(prevMessages => {
      // If this is a new message, add it
      if (prevMessages.length <= currentIndex) {
        return [...prevMessages, partialMessage];
      }
      
      // Otherwise update the current message
      return prevMessages.map((msg, idx) => 
        idx === currentIndex ? partialMessage : msg
      );
    });
  }, [currentCharIndex, currentIndex, messages]);

  // Immediately show all messages when complete
  useEffect(() => {
    if (isComplete && messages.length > 0) {
      setVisibleMessages(messages);
      setCurrentIndex(messages.length);
      setCurrentCharIndex(0);
    }
  }, [isComplete, messages]);

  // Helper to get CSS class based on message type
  const getMessageClass = (type) => {
    switch (type) {
      case 'header':
        return 'terminal-header';
      case 'info':
        return 'terminal-info';
      case 'analysis':
        return 'terminal-analysis';
      case 'route':
        return 'terminal-route';
      case 'score':
        return 'terminal-score';
      case 'result':
        return 'terminal-result';
      case 'error':
        return 'terminal-error';
      default:
        return 'terminal-default';
    }
  };

  // Render a spinner for loading state
  const renderSpinner = () => {
    if (!isAnalyzing || currentIndex >= messages.length) return null;
    
    return <div className="terminal-spinner">⟳</div>;
  };

  // Toggle terminal minimize/maximize
  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <div className={`terminal-container ${isMinimized ? 'minimized' : ''}`}>
      <div className="terminal-header-bar">
        <div className="terminal-title">{title}</div>
        <div className="terminal-controls">
          <button 
            className="terminal-button minimize" 
            onClick={toggleMinimize}
          >
            {isMinimized ? '□' : '_'}
          </button>
          <button 
            className="terminal-button close" 
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>
      
      {!isMinimized && (
        <div className="terminal-content" ref={terminalRef}>
          {visibleMessages.map((message, index) => (
            <div 
              key={index} 
              className={`terminal-line ${getMessageClass(message.type)}`}
            >
              {message.prefix && (
                <span className="terminal-prefix">{message.prefix}</span>
              )}
              {message.text}
            </div>
          ))}
          
          {renderSpinner()}
          
          {isComplete && (
            <div className="terminal-complete">
              <span className="terminal-prompt">$ </span>
              <span className="terminal-cursor">_</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

BusRunAnalysisTerminal.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      text: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['header', 'info', 'analysis', 'route', 'score', 'result', 'error', 'default']),
      prefix: PropTypes.string
    })
  ),
  isAnalyzing: PropTypes.bool,
  isComplete: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.string
};

export default BusRunAnalysisTerminal;
