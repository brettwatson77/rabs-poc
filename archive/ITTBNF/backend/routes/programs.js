/**
 * Program Routes
 * 
 * API routes for RABS program management.
 */

const express = require('express');
const programController = require('../controllers/programController');
const router = express.Router();

/**
 * @route   POST /api/v1/programs
 * @desc    Create a new program with time slots and participants
 * @access  Private
 */
router.post('/', programController.createProgram);

/**
 * @route   GET /api/v1/programs
 * @desc    Get all programs with optional filtering
 * @params  active - Filter by active status (true/false)
 * @params  windowStart - Filter programs active on or after this date
 * @params  windowEnd - Filter programs active on or before this date
 * @params  venue_id - Filter by venue
 * @access  Private
 */
router.get('/', programController.getPrograms);

/**
 * @route   GET /api/v1/programs/:id
 * @desc    Get a single program by ID with participants and time slots
 * @access  Private
 */
router.get('/:id', programController.getProgram);

/**
 * @route   PUT /api/v1/programs/:id
 * @desc    Update an existing program
 * @access  Private
 */
router.put('/:id', programController.updateProgram);

/**
 * @route   DELETE /api/v1/programs/:id
 * @desc    Delete a program
 * @access  Private
 */
router.delete('/:id', programController.deleteProgram);

/**
 * @route   POST /api/v1/programs/:id/generate
 * @desc    Force regenerate instances for a program within a date range
 * @body    windowStart - Start date (YYYY-MM-DD)
 * @body    windowEnd - End date (YYYY-MM-DD)
 * @access  Private
 */
router.post('/:id/generate', programController.regenerateInstances);

module.exports = router;
