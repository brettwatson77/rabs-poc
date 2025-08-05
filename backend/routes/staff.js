// backend/routes/staff.js
const express = require('express');
const staffController = require('../controllers/staffController');

// Initialize router
const router = express.Router();

// Simple UUID-v4 validator middleware to stop bad IDs (e.g. "with-schads")
const validateUUIDParam = (req, res, next) => {
  const { id } = req.params;
  // UUID v4 regex taken from utils/validators.js
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      error: `Invalid staff ID '${id}'. Expected a UUID.`,
    });
  }
  next();
};

// Define routes
router.get('/', staffController.getAllStaff);
// Return all staff with SCHADS level metadata (must come before '/:id')
router.get('/with-schads', staffController.getStaffWithSchads);
router.get('/:id', validateUUIDParam, staffController.getStaffById);
router.post('/', staffController.createStaff);
router.put('/:id', validateUUIDParam, staffController.updateStaff);
// Allow partial updates via HTTP PATCH as well
router.patch('/:id', validateUUIDParam, staffController.updateStaff);
router.delete('/:id', validateUUIDParam, staffController.deleteStaff);

// Export the router
module.exports = router;
