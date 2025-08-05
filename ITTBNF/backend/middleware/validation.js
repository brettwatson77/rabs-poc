/**
 * validation.js - Request Validation Middleware
 * 
 * Provides Express middleware functions for validating request parameters:
 * - validateUUID: Validates UUID parameters
 * - validateDateRange: Validates date range parameters
 * - validateRequiredFields: Validates required fields in request body
 * - validateNumeric: Validates numeric parameters
 * - validateEnum: Validates parameters against allowed values
 * 
 * Uses express-validator for parameter validation and returns
 * standardized error responses when validation fails.
 */

const { param, query, body, validationResult } = require('express-validator');
const { isValidUUID } = require('../utils/validators');

/**
 * Middleware to validate UUID parameters
 * 
 * @param {string} paramName - Name of the parameter to validate
 * @returns {Function} Express middleware function
 */
const validateUUID = (paramName) => {
  return [
    param(paramName)
      .exists()
      .withMessage(`${paramName} is required`)
      .custom((value) => {
        if (!isValidUUID(value)) {
          throw new Error(`${paramName} must be a valid UUID`);
        }
        return true;
      }),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      next();
    }
  ];
};

/**
 * Middleware to validate date range parameters
 * 
 * @param {string} startDateParam - Name of the start date parameter
 * @param {string} endDateParam - Name of the end date parameter
 * @param {boolean} allowSameDay - Whether start and end dates can be the same
 * @returns {Function} Express middleware function
 */
const validateDateRange = (startDateParam = 'start_date', endDateParam = 'end_date', allowSameDay = true) => {
  return [
    query(startDateParam)
      .exists()
      .withMessage(`${startDateParam} is required`)
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage(`${startDateParam} must be in YYYY-MM-DD format`)
      .custom((value) => {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error(`${startDateParam} is not a valid date`);
        }
        return true;
      }),
    query(endDateParam)
      .exists()
      .withMessage(`${endDateParam} is required`)
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage(`${endDateParam} must be in YYYY-MM-DD format`)
      .custom((value, { req }) => {
        const endDate = new Date(value);
        if (isNaN(endDate.getTime())) {
          throw new Error(`${endDateParam} is not a valid date`);
        }
        
        const startDate = new Date(req.query[startDateParam]);
        if (allowSameDay) {
          if (endDate < startDate) {
            throw new Error(`${endDateParam} must be on or after ${startDateParam}`);
          }
        } else {
          if (endDate <= startDate) {
            throw new Error(`${endDateParam} must be after ${startDateParam}`);
          }
        }
        return true;
      }),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      next();
    }
  ];
};

/**
 * Middleware to validate required fields in request body
 * 
 * @param {Array} fields - Array of field names to validate
 * @returns {Function} Express middleware function
 */
const validateRequiredFields = (fields) => {
  return [
    ...fields.map(field => 
      body(field)
        .exists()
        .withMessage(`${field} is required`)
        .notEmpty()
        .withMessage(`${field} cannot be empty`)
    ),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      next();
    }
  ];
};

/**
 * Middleware to validate numeric parameters
 * 
 * @param {string} paramName - Name of the parameter to validate
 * @param {string} location - Where to look for the param ('body', 'query', 'params')
 * @param {Object} options - Validation options (min, max, isInteger)
 * @returns {Function} Express middleware function
 */
const validateNumeric = (paramName, location = 'body', options = {}) => {
  const { min, max, isInteger = false } = options;
  
  let validator;
  switch (location) {
    case 'query':
      validator = query(paramName);
      break;
    case 'params':
      validator = param(paramName);
      break;
    default:
      validator = body(paramName);
  }
  
  return [
    validator
      .exists()
      .withMessage(`${paramName} is required`)
      .isNumeric()
      .withMessage(`${paramName} must be a number`)
      .custom((value) => {
        const num = parseFloat(value);
        
        if (isInteger && !Number.isInteger(num)) {
          throw new Error(`${paramName} must be an integer`);
        }
        
        if (min !== undefined && num < min) {
          throw new Error(`${paramName} must be at least ${min}`);
        }
        
        if (max !== undefined && num > max) {
          throw new Error(`${paramName} must be at most ${max}`);
        }
        
        return true;
      }),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      next();
    }
  ];
};

/**
 * Middleware to validate enum parameters (values from a predefined set)
 * 
 * @param {string} paramName - Name of the parameter to validate
 * @param {Array} allowedValues - Array of allowed values
 * @param {string} location - Where to look for the param ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
const validateEnum = (paramName, allowedValues, location = 'body') => {
  let validator;
  switch (location) {
    case 'query':
      validator = query(paramName);
      break;
    case 'params':
      validator = param(paramName);
      break;
    default:
      validator = body(paramName);
  }
  
  return [
    validator
      .exists()
      .withMessage(`${paramName} is required`)
      .custom((value) => {
        if (!allowedValues.includes(value)) {
          throw new Error(`${paramName} must be one of: ${allowedValues.join(', ')}`);
        }
        return true;
      }),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      next();
    }
  ];
};

/**
 * Middleware to validate a date parameter
 * 
 * @param {string} paramName - Name of the parameter to validate
 * @param {string} location - Where to look for the param ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
const validateDate = (paramName, location = 'body') => {
  let validator;
  switch (location) {
    case 'query':
      validator = query(paramName);
      break;
    case 'params':
      validator = param(paramName);
      break;
    default:
      validator = body(paramName);
  }
  
  return [
    validator
      .exists()
      .withMessage(`${paramName} is required`)
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage(`${paramName} must be in YYYY-MM-DD format`)
      .custom((value) => {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error(`${paramName} is not a valid date`);
        }
        return true;
      }),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      next();
    }
  ];
};

/**
 * Middleware to validate a time parameter
 * 
 * @param {string} paramName - Name of the parameter to validate
 * @param {string} location - Where to look for the param ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
const validateTime = (paramName, location = 'body') => {
  let validator;
  switch (location) {
    case 'query':
      validator = query(paramName);
      break;
    case 'params':
      validator = param(paramName);
      break;
    default:
      validator = body(paramName);
  }
  
  return [
    validator
      .exists()
      .withMessage(`${paramName} is required`)
      .matches(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/)
      .withMessage(`${paramName} must be in HH:MM or HH:MM:SS format`),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      next();
    }
  ];
};

module.exports = {
  validateUUID,
  validateDateRange,
  validateRequiredFields,
  validateNumeric,
  validateEnum,
  validateDate,
  validateTime
};
