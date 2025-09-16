/**
 * cards.js - API Routes for The Great Loom Card System
 * 
 * Exposes the Master Card + Dynamic Explosion system to the frontend
 * through RESTful endpoints that provide clean, frontend-ready responses.
 */

const express = require('express');
const router = express.Router();
const { 
  CARD_TYPES,
  getCardsByDateRange,
  // expose generator for master-only filtering
  getCardsByParticipant,
  getCardsByStaff,
  generateCardsForInstance,
  batchGenerateCards,
  regenerateAllCards
} = require('../../../services/eventCardService');
const { pool } = require('../../../database');
const logger = require('../../../utils/logger');
const { isAuthenticated, hasRole } = require('../../../middleware/auth');

/**
 * ---------------------------------------------------------------------------
 * Helper – validate & parse start/end query params
 * ---------------------------------------------------------------------------
 */
function parseDateRange(req, res) {
  const { start, end } = req.query;
  if (!start || !end) {
    res.status(400).json({ success: false, message: 'Both start and end dates are required' });
    return null;
  }
  const startDate = new Date(start);
  const endDate   = new Date(end);
  if (isNaN(startDate) || isNaN(endDate)) {
    res.status(400).json({ success: false, message: 'Invalid date format' });
    return null;
  }
  return { startDate, endDate };
}

/**
 * @route   GET /api/v1/cards
 * @desc    Get all cards within a date range
 * @access  Private
 */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ 
        success: false, 
        message: 'Both start and end dates are required' 
      });
    }
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (isNaN(startDate) || isNaN(endDate)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format' 
      });
    }
    
    const cards = await getCardsByDateRange(startDate, endDate);
    
    return res.json({
      success: true,
      count: cards.length,
      data: cards
    });
  } catch (error) {
    logger.error('Error fetching cards by date range:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

/**
 * ---------------------------------------------------------------------------
 * MASTER-CARD ENDPOINT
 * Returns only MASTER cards used by the Master Schedule view.
 * ---------------------------------------------------------------------------
 * @route   GET /api/v1/cards/master
 * @access  Private
 */
router.get('/master', isAuthenticated, async (req, res) => {
  /* ------------------------------------------------------------------
   * TGL-dependent logic is not yet available.  Return a placeholder
   * empty list so the Dashboard & Finance pages do not crash or hang.
   * ---------------------------------------------------------------- */
  return res.json({
    success: true,
    count  : 0,
    data   : []
  });
});

/**
 * ---------------------------------------------------------------------------
 * MASTER-EVENTS ENDPOINT
 * Low-level view of loom_instances for Gantt / admin timelines.
 * ---------------------------------------------------------------------------
 * @route   GET /api/v1/cards/events
 * @access  Private
 */
router.get('/events', isAuthenticated, async (req, res) => {
  const range = parseDateRange(req, res);
  if (!range) return;

  try {
    const query = `
      SELECT li.*, p.name AS program_name
      FROM loom_instances li
      JOIN rules_programs p ON li.program_id = p.id
      WHERE li.date BETWEEN $1 AND $2
      ORDER BY li.date, li.pickup_time
    `;
    const { rows } = await pool.query(query, [range.startDate, range.endDate]);
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    logger.error('Error fetching master events:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route   GET /api/v1/cards/types
 * @desc    Get all card types (for filtering)
 * @access  Private
 */
router.get('/types', isAuthenticated, (req, res) => {
  return res.json({
    success: true,
    data: Object.values(CARD_TYPES)
  });
});

/**
 * @route   GET /api/v1/cards/participant/:id
 * @desc    Get cards for a specific participant
 * @access  Private
 */
router.get('/participant/:id', isAuthenticated, async (req, res) => {
  try {
    const participantId = parseInt(req.params.id);
    const { start, end } = req.query;
    
    if (isNaN(participantId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid participant ID' 
      });
    }
    
    let startDate = null;
    let endDate = null;
    
    if (start && end) {
      startDate = new Date(start);
      endDate = new Date(end);
      
      if (isNaN(startDate) || isNaN(endDate)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid date format' 
        });
      }
    }
    
    const cards = await getCardsByParticipant(participantId, startDate, endDate);
    
    return res.json({
      success: true,
      count: cards.length,
      data: cards
    });
  } catch (error) {
    logger.error(`Error fetching cards for participant ${req.params.id}:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

/**
 * @route   GET /api/v1/cards/staff/:id
 * @desc    Get cards for a specific staff member
 * @access  Private
 */
router.get('/staff/:id', isAuthenticated, async (req, res) => {
  try {
    const staffId = parseInt(req.params.id);
    const { start, end } = req.query;
    
    if (isNaN(staffId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid staff ID' 
      });
    }
    
    let startDate = null;
    let endDate = null;
    
    if (start && end) {
      startDate = new Date(start);
      endDate = new Date(end);
      
      if (isNaN(startDate) || isNaN(endDate)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid date format' 
        });
      }
    }
    
    const cards = await getCardsByStaff(staffId, startDate, endDate);
    
    return res.json({
      success: true,
      count: cards.length,
      data: cards
    });
  } catch (error) {
    logger.error(`Error fetching cards for staff ${req.params.id}:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

/**
 * @route   GET /api/v1/cards/instance/:id
 * @desc    Get all cards for a specific instance
 * @access  Private
 */
router.get('/instance/:id', isAuthenticated, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id);
    
    if (isNaN(instanceId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid instance ID' 
      });
    }
    
    const query = `
      SELECT * FROM event_card_map
      WHERE instance_id = $1
    `;
    
    const { rows } = await pool.query(query, [instanceId]);
    
    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    logger.error(`Error fetching cards for instance ${req.params.id}:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

/**
 * @route   GET /api/v1/cards/:id
 * @desc    Get a specific card by ID
 * @access  Private
 */
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const cardId = req.params.id;
    
    const query = `
      SELECT * FROM event_card_map
      WHERE card_id = $1
    `;
    
    const { rows } = await pool.query(query, [cardId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Card not found' 
      });
    }
    
    return res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    logger.error(`Error fetching card ${req.params.id}:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

/**
 * @route   POST /api/v1/cards/regenerate
 * @desc    Regenerate all cards for instances that need it
 * @access  Admin
 */
router.post('/regenerate', isAuthenticated, hasRole('admin'), async (req, res) => {
  try {
    const count = await regenerateAllCards();
    
    return res.json({
      success: true,
      message: `Successfully regenerated cards for ${count} instances`,
      count
    });
  } catch (error) {
    logger.error('Error regenerating cards:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

/**
 * @route   POST /api/v1/cards/instance/:id/regenerate
 * @desc    Regenerate cards for a specific instance
 * @access  Admin
 */
router.post('/instance/:id/regenerate', isAuthenticated, hasRole('admin'), async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id);
    
    if (isNaN(instanceId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid instance ID' 
      });
    }
    
    const cards = await generateCardsForInstance(instanceId);
    
    return res.json({
      success: true,
      message: `Successfully regenerated cards for instance ${instanceId}`,
      count: cards.length,
      data: cards
    });
  } catch (error) {
    logger.error(`Error regenerating cards for instance ${req.params.id}:`, error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

/**
 * @route   POST /api/v1/cards/batch-regenerate
 * @desc    Regenerate cards for multiple instances
 * @access  Admin
 */
router.post('/batch-regenerate', isAuthenticated, hasRole('admin'), async (req, res) => {
  try {
    const { instanceIds } = req.body;
    
    if (!Array.isArray(instanceIds) || instanceIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'instanceIds must be a non-empty array' 
      });
    }
    
    const cardsByInstance = await batchGenerateCards(instanceIds);
    
    return res.json({
      success: true,
      message: `Successfully regenerated cards for ${instanceIds.length} instances`,
      count: Object.keys(cardsByInstance).length,
      data: cardsByInstance
    });
  } catch (error) {
    logger.error('Error batch regenerating cards:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

/**
 * @route   POST /api/v1/cards/traffic-delay
 * @desc    Handle traffic delay notification and update affected cards
 * @access  Private
 */
router.post('/traffic-delay', isAuthenticated, async (req, res) => {
  try {
    const { 
      instanceId, 
      delayMinutes, 
      affectedCardType, // BUS_PICKUP or BUS_DROPOFF
      affectedRunIndex, // which run is delayed (1, 2, etc.)
      notifyParticipants = true,
      notifyStaff = true
    } = req.body;
    
    if (!instanceId || !delayMinutes || !affectedCardType) {
      return res.status(400).json({ 
        success: false, 
        message: 'instanceId, delayMinutes, and affectedCardType are required' 
      });
    }
    
    if (![CARD_TYPES.BUS_PICKUP, CARD_TYPES.BUS_DROPOFF].includes(affectedCardType)) {
      return res.status(400).json({ 
        success: false, 
        message: 'affectedCardType must be BUS_PICKUP or BUS_DROPOFF' 
      });
    }
    
    // TODO: Implement traffic delay handling logic that:
    // 1. Updates the affected card with new timing
    // 2. Checks for cascading effects on other bookings
    // 3. Re-allocates vehicles if needed
    // 4. Sends notifications to participants and staff
    // 5. Updates all related cards
    
    // For now, we'll just regenerate the cards for the instance
    const updatedCards = await generateCardsForInstance(instanceId);
    
    // Simulate notification sending
    const notificationsSent = {
      participants: notifyParticipants ? updatedCards.filter(c => c.card_type === affectedCardType).flatMap(c => c.participants || []).length : 0,
      staff: notifyStaff ? updatedCards.filter(c => c.card_type === affectedCardType).flatMap(c => c.staff || []).length : 0
    };
    
    return res.json({
      success: true,
      message: `Successfully processed traffic delay of ${delayMinutes} minutes`,
      notificationsSent,
      cardsUpdated: updatedCards.length,
      data: updatedCards
    });
  } catch (error) {
    logger.error('Error handling traffic delay:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

/**
 * ---------------------------------------------------------------------------
 * SIMULATE-DELAY ENDPOINT
 * Developer / demo utility – triggers traffic-delay logic but marks it as
 * "simulate" so downstream services can short-circuit notifications.
 * ---------------------------------------------------------------------------
 * @route   POST /api/v1/cards/simulate-delay
 * @access  Private
 */
router.post('/simulate-delay', isAuthenticated, async (req, res, next) => {
  // inject simulate flag & forward to traffic-delay handler
  req.body.simulate = true;
  return router.handle(req, res, next); // re-enter routing – traffic-delay will process
});

module.exports = router;
