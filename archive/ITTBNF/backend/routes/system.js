// backend/routes/system.js
const express = require('express');
const { runSeed } = require('../../database/seed');

// Initialize router
const router = express.Router();

/**
 * @route   POST /api/v1/system/reset
 * @desc    Resets the entire database and re-runs the seed script.
 * @access  Public (for POC purposes)
 */
router.post('/reset', async (req, res) => {
  console.log('Received request to reset system data...');
  try {
    // The runSeed function now handles deleting the old DB and creating a new one
    await runSeed();
    res.status(200).json({
      success: true,
      message: 'System reset and re-seeded successfully.',
    });
  } catch (error) {
    console.error('Failed to reset system data:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while resetting the system data.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Export the router
module.exports = router;
