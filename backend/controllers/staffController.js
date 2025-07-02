// backend/controllers/staffController.js
const staffService = require('../services/staffService');

// Get all staff
const getAllStaff = async (req, res) => {
  try {
    const staff = await staffService.getAllStaff();
    res.status(200).json({
      success: true,
      count: staff.length,
      data: staff
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get a single staff member by ID
const getStaffById = async (req, res) => {
  try {
    const staff = await staffService.getStaffById(req.params.id);
    
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: `Staff with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      data: staff
    });
  } catch (error) {
    console.error(`Error fetching staff with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create a new staff member
const createStaff = async (req, res) => {
  try {
    const newStaff = await staffService.createStaff(req.body);
    res.status(201).json({
      success: true,
      data: newStaff
    });
  } catch (error) {
    console.error('Error creating staff:', error);
    
    // Handle validation errors
    if (error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff data',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating staff',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update an existing staff member
const updateStaff = async (req, res) => {
  try {
    const updatedStaff = await staffService.updateStaff(req.params.id, req.body);
    
    if (!updatedStaff) {
      return res.status(404).json({
        success: false,
        message: `Staff with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      data: updatedStaff
    });
  } catch (error) {
    console.error(`Error updating staff with ID ${req.params.id}:`, error);
    
    // Handle validation errors
    if (error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff data',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating staff',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete a staff member
const deleteStaff = async (req, res) => {
  try {
    const result = await staffService.deleteStaff(req.params.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Staff with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Staff with ID ${req.params.id} deleted successfully`
    });
  } catch (error) {
    console.error(`Error deleting staff with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error deleting staff',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff
};
