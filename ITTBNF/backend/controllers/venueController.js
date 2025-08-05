// backend/controllers/venueController.js
const venueService = require('../services/venueService');

// Get all venues
const getAllVenues = async (req, res) => {
  try {
    const venues = await venueService.getAllVenues();
    res.status(200).json({
      success: true,
      count: venues.length,
      data: venues
    });
  } catch (error) {
    console.error('Error fetching venues:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching venues',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get a single venue by ID
const getVenueById = async (req, res) => {
  try {
    const venue = await venueService.getVenueById(req.params.id);
    
    if (!venue) {
      return res.status(404).json({
        success: false,
        message: `Venue with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      data: venue
    });
  } catch (error) {
    console.error(`Error fetching venue with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error fetching venue',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create a new venue
const createVenue = async (req, res) => {
  try {
    const newVenue = await venueService.createVenue(req.body);
    res.status(201).json({
      success: true,
      data: newVenue
    });
  } catch (error) {
    console.error('Error creating venue:', error);
    
    // Handle validation errors
    if (error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid venue data',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating venue',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update an existing venue
const updateVenue = async (req, res) => {
  try {
    const updatedVenue = await venueService.updateVenue(req.params.id, req.body);
    
    if (!updatedVenue) {
      return res.status(404).json({
        success: false,
        message: `Venue with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      data: updatedVenue
    });
  } catch (error) {
    console.error(`Error updating venue with ID ${req.params.id}:`, error);
    
    // Handle validation errors
    if (error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid venue data',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating venue',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete a venue
const deleteVenue = async (req, res) => {
  try {
    const result = await venueService.deleteVenue(req.params.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Venue with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Venue with ID ${req.params.id} deleted successfully`
    });
  } catch (error) {
    console.error(`Error deleting venue with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error deleting venue',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllVenues,
  getVenueById,
  createVenue,
  updateVenue,
  deleteVenue
};
