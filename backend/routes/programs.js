// backend/routes/programs.js
const express = require('express');
const programController = require('../controllers/programController');

// Initialize router
const router = express.Router();

// Define routes
router.get('/', programController.getAllPrograms);
router.get('/:id', programController.getProgramById);
router.post('/', programController.createProgram);
router.put('/:id', programController.updateProgram);
router.delete('/:id', programController.deleteProgram);

// Export the router
module.exports = router;
