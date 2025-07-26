// backend/controllers/participantController.js
const participantService = require('../services/participantService');

// Get all participants
const getAllParticipants = async (req, res) => {
  try {
    const participants = await participantService.getAllParticipants();
    res.status(200).json({
      success: true,
      count: participants.length,
      data: participants
    });
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching participants',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get a single participant by ID
const getParticipantById = async (req, res) => {
  try {
    const participant = await participantService.getParticipantById(req.params.id);
    
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: `Participant with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      data: participant
    });
  } catch (error) {
    console.error(`Error fetching participant with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error fetching participant',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create a new participant
const createParticipant = async (req, res) => {
  try {
    const newParticipant = await participantService.createParticipant(req.body);
    res.status(201).json({
      success: true,
      data: newParticipant
    });
  } catch (error) {
    console.error('Error creating participant:', error);
    
    // Handle validation errors
    if (error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid participant data',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating participant',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update an existing participant
const updateParticipant = async (req, res) => {
  try {
    const updatedParticipant = await participantService.updateParticipant(req.params.id, req.body);
    
    if (!updatedParticipant) {
      return res.status(404).json({
        success: false,
        message: `Participant with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      data: updatedParticipant
    });
  } catch (error) {
    console.error(`Error updating participant with ID ${req.params.id}:`, error);
    
    // Handle validation errors
    if (error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid participant data',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating participant',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete a participant
const deleteParticipant = async (req, res) => {
  try {
    const result = await participantService.deleteParticipant(req.params.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Participant with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Participant with ID ${req.params.id} deleted successfully`
    });
  } catch (error) {
    console.error(`Error deleting participant with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error deleting participant',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllParticipants,
  getParticipantById,
  createParticipant,
  updateParticipant,
  deleteParticipant
};
