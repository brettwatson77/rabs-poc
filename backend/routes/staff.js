// backend/routes/staff.js
const express = require('express');
const staffController = require('../controllers/staffController');

// Initialize router
const router = express.Router();

// Define routes
router.get('/', staffController.getAllStaff);
router.get('/:id', staffController.getStaffById);
router.post('/', staffController.createStaff);
router.put('/:id', staffController.updateStaff);
router.delete('/:id', staffController.deleteStaff);

// Export the router
module.exports = router;
