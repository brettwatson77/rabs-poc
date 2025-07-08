// backend/routes/staffAssignments.js
const express = require('express');
const router = express.Router();
const staffAssignmentController = require('../controllers/staffAssignmentController');

/**
 * @route GET /api/staff-assignments/available
 * @description Get available staff for a specific program instance date and time
 * @params programInstanceId, date, startTime, endTime
 * @returns {Array} List of available staff members
 */
router.get('/available', staffAssignmentController.getAvailableStaff);

/**
 * @route GET /api/staff-assignments/:programInstanceId
 * @description Get current staff assignments for a program instance
 * @params programInstanceId
 * @returns {Array} List of assigned staff members
 */
router.get('/:programInstanceId', staffAssignmentController.getStaffAssignments);

/**
 * @route PUT /api/staff-assignments/:programInstanceId/single
 * @description Update staff assignment for a single program instance
 * @params programInstanceId, oldStaffId, newStaffId, role
 * @returns {Object} Updated staff assignment
 */
router.put('/:programInstanceId/single', staffAssignmentController.updateSingleStaffAssignment);

/**
 * @route PUT /api/staff-assignments/:programId/recurring
 * @description Update staff assignment for all future instances of a program
 * @params programId, oldStaffId, newStaffId, role, startDate
 * @returns {Object} Result of the recurring update operation
 */
router.put('/:programId/recurring', staffAssignmentController.updateRecurringStaffAssignment);

/**
 * @route POST /api/staff-assignments/:programInstanceId
 * @description Add a new staff assignment to a program instance
 * @params programInstanceId, staffId, role
 * @returns {Object} New staff assignment
 */
router.post('/:programInstanceId', staffAssignmentController.addStaffAssignment);

/**
 * @route DELETE /api/staff-assignments/:assignmentId
 * @description Remove a staff assignment
 * @params assignmentId
 * @returns {Object} Result of the delete operation
 */
router.delete('/:assignmentId', staffAssignmentController.removeStaffAssignment);

/**
 * @route GET /api/staff-assignments/hours/:staffId
 * @description Get allocated hours for a staff member in the current fortnight
 * @params staffId
 * @returns {Object} Hours information including contracted, allocated, and remaining hours
 */
router.get('/hours/:staffId', staffAssignmentController.getStaffHours);

module.exports = router;
