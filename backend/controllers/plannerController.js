// backend/controllers/plannerController.js
const { 
  getParticipantEnrollments: getParticipantEnrollmentsService, 
  getAllPrograms, 
  updateParticipantEnrollments: updateParticipantEnrollmentsService,
  getParticipantChangeHistory,
  getParticipantEnrollmentHistory: getParticipantEnrollmentHistoryService
} = require('../services/plannerService');

/**
 * Get all program enrollments for a specific participant
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getParticipantEnrollments = async (req, res) => {
  try {
    const participantId = req.params.participantId;
    
    // Validate participant ID
    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: 'Participant ID is required'
      });
    }
    
    // Get enrollments from service
    const enrollments = await getParticipantEnrollmentsService(participantId);
    
    // Get all available programs for selection
    const availablePrograms = await getAllPrograms();
    
    res.status(200).json({
      success: true,
      data: {
        enrollments,
        availablePrograms
      }
    });
  } catch (error) {
    console.error(`Error fetching enrollments for participant ${req.params.participantId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error fetching participant enrollments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update program enrollments for a specific participant
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateParticipantEnrollments = async (req, res) => {
  try {
    const participantId = req.params.participantId;
    const { enrollments } = req.body;
    
    // Validate required data
    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: 'Participant ID is required'
      });
    }
    
    if (!enrollments || !Array.isArray(enrollments)) {
      return res.status(400).json({
        success: false,
        message: 'Enrollments must be provided as an array'
      });
    }
    
    // Update enrollments
    const result = await updateParticipantEnrollmentsService(participantId, enrollments);
    
    res.status(200).json({
      success: true,
      message: `Successfully updated enrollments for participant ${participantId}`,
      data: result
    });
  } catch (error) {
    console.error(`Error updating enrollments for participant ${req.params.participantId}:`, error);
    
    // Handle validation errors
    if (error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid enrollment data',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating participant enrollments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get the change history log for a participant
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getChangeHistory = async (req, res) => {
  try {
    const participantId = req.params.participantId;
    
    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: 'Participant ID is required'
      });
    }
    
    const history = await getParticipantChangeHistory(participantId);
    
    res.status(200).json({
      success: true,
      data: history
    });
    
  } catch (error) {
    console.error(`Error fetching change history for participant ${req.params.participantId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error fetching change history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get the enrollment-only change history for a participant
 * Shows only planner actions (add/remove) without attendance or cancellations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getParticipantEnrollmentHistory = async (req, res) => {
  try {
    const participantId = req.params.participantId;
    
    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: 'Participant ID is required'
      });
    }
    
    const history = await getParticipantEnrollmentHistoryService(participantId);
    
    res.status(200).json({
      success: true,
      data: history
    });
    
  } catch (error) {
    console.error(`Error fetching enrollment history for participant ${req.params.participantId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error fetching enrollment history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getParticipantEnrollments,
  updateParticipantEnrollments,
  getChangeHistory,
  getParticipantEnrollmentHistory
};
