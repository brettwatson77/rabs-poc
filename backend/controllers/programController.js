// backend/controllers/programController.js
const programService = require('../services/programService');

// Get all programs
const getAllPrograms = async (req, res) => {
  try {
    const programs = await programService.getAllPrograms();
    res.status(200).json({
      success: true,
      count: programs.length,
      data: programs
    });
  } catch (error) {
    console.error('Error fetching programs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching programs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get a single program by ID
const getProgramById = async (req, res) => {
  try {
    const program = await programService.getProgramById(req.params.id);
    
    if (!program) {
      return res.status(404).json({
        success: false,
        message: `Program with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      data: program
    });
  } catch (error) {
    console.error(`Error fetching program with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error fetching program',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create a new program
const createProgram = async (req, res) => {
  try {
    const newProgram = await programService.createProgram(req.body);
    res.status(201).json({
      success: true,
      data: newProgram
    });
  } catch (error) {
    console.error('Error creating program:', error);
    
    // Handle validation errors
    if (error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid program data',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating program',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update an existing program
const updateProgram = async (req, res) => {
  try {
    const updatedProgram = await programService.updateProgram(req.params.id, req.body);
    
    if (!updatedProgram) {
      return res.status(404).json({
        success: false,
        message: `Program with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      data: updatedProgram
    });
  } catch (error) {
    console.error(`Error updating program with ID ${req.params.id}:`, error);
    
    // Handle validation errors
    if (error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid program data',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating program',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete a program
const deleteProgram = async (req, res) => {
  try {
    const result = await programService.deleteProgram(req.params.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Program with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Program with ID ${req.params.id} deleted successfully`
    });
  } catch (error) {
    console.error(`Error deleting program with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error deleting program',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram
};
