/**
 * API Routes Index
 * 
 * Main router that combines all route modules
 * Following the API-IS-KING principle from MASTER_SPEC.md
 */

const express = require('express');
const router = express.Router();

// Import route modules
const participantRoutes = require('./participants');
const staffRoutes = require('./staff');
const programRoutes = require('./programs');
const masterScheduleRoutes = require('./master-schedule');
const dashboardRoutes = require('./dashboard');
const vehicleRoutes = require('./vehicles');
const venueRoutes = require('./venues');
const loomRoutes = require('./loom');
const intentionRoutes = require('./intentions');
const financeRoutes = require('./finance');
const settingsRoutes = require('./settings');
const systemRoutes = require('./system');
const changesRoutes = require('./changes');

// Mount routes at their respective paths
router.use('/participants', participantRoutes);
router.use('/staff', staffRoutes);
router.use('/programs', programRoutes);
router.use('/master-schedule', masterScheduleRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/venues', venueRoutes);
router.use('/loom', loomRoutes);
router.use('/intentions', intentionRoutes);
router.use('/finance', financeRoutes);
router.use('/settings', settingsRoutes);
router.use('/system', systemRoutes);
router.use('/changes', changesRoutes);

// Root API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'RABS API v1',
    documentation: '/api/v1/docs',
    version: '3.0.0',
    endpoints: [
      '/participants',
      '/staff',
      '/programs',
      '/master-schedule',
      '/dashboard',
      '/vehicles',
      '/venues',
      '/loom',
      '/intentions',
      '/finance',
      '/changes',
      '/settings',
      '/system'
    ]
  });
});

module.exports = router;
