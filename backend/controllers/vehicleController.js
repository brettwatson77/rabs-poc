// backend/controllers/vehicleController.js
const vehicleService = require('../services/vehicleService');

// Get all vehicles
const getAllVehicles = async (req, res) => {
  try {
    const vehicles = await vehicleService.getAllVehicles();
    res.status(200).json({
      success: true,
      count: vehicles.length,
      data: vehicles
    });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vehicles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get a single vehicle by ID
const getVehicleById = async (req, res) => {
  try {
    const vehicle = await vehicleService.getVehicleById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: `Vehicle with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    console.error(`Error fetching vehicle with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create a new vehicle
const createVehicle = async (req, res) => {
  try {
    const newVehicle = await vehicleService.createVehicle(req.body);
    res.status(201).json({
      success: true,
      data: newVehicle
    });
  } catch (error) {
    console.error('Error creating vehicle:', error);
    
    // Handle validation errors
    if (error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle data',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update an existing vehicle
const updateVehicle = async (req, res) => {
  try {
    const updatedVehicle = await vehicleService.updateVehicle(req.params.id, req.body);
    
    if (!updatedVehicle) {
      return res.status(404).json({
        success: false,
        message: `Vehicle with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      data: updatedVehicle
    });
  } catch (error) {
    console.error(`Error updating vehicle with ID ${req.params.id}:`, error);
    
    // Handle validation errors
    if (error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle data',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete a vehicle
const deleteVehicle = async (req, res) => {
  try {
    const result = await vehicleService.deleteVehicle(req.params.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Vehicle with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Vehicle with ID ${req.params.id} deleted successfully`
    });
  } catch (error) {
    console.error(`Error deleting vehicle with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error deleting vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
};
