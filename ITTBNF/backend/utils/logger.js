/**
 * logger.js - Simple console-based logger utility
 * 
 * Provides standard logging methods with timestamps and colored output
 * for consistent logging across the RABS-POC application.
 */

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m'
};

/**
 * Formats the current timestamp for log messages
 * @returns {string} Formatted timestamp [YYYY-MM-DD HH:MM:SS]
 */
const getTimestamp = () => {
  const now = new Date();
  return `[${now.toISOString().replace('T', ' ').split('.')[0]}]`;
};

/**
 * Logger utility with colored output and timestamps
 */
const logger = {
  /**
   * Log error message with red color
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    console.error(`${colors.brightRed}${getTimestamp()} ERROR:${colors.reset}`, ...args);
  },
  
  /**
   * Log warning message with yellow color
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    console.warn(`${colors.brightYellow}${getTimestamp()} WARN:${colors.reset}`, ...args);
  },
  
  /**
   * Log info message with green color
   * @param {...any} args - Arguments to log
   */
  info: (...args) => {
    console.info(`${colors.green}${getTimestamp()} INFO:${colors.reset}`, ...args);
  },
  
  /**
   * Log debug message with blue color
   * @param {...any} args - Arguments to log
   */
  debug: (...args) => {
    console.debug(`${colors.cyan}${getTimestamp()} DEBUG:${colors.reset}`, ...args);
  },
  
  /**
   * Log success message with bright green color
   * @param {...any} args - Arguments to log
   */
  success: (...args) => {
    console.log(`${colors.brightGreen}${getTimestamp()} SUCCESS:${colors.reset}`, ...args);
  },
  
  /**
   * Log plain message without color prefix
   * @param {...any} args - Arguments to log
   */
  log: (...args) => {
    console.log(`${getTimestamp()}`, ...args);
  }
};

module.exports = logger;
