// backend/controllers/rateController.js
const rateService = require('../services/rateService');

// Get all rate line items
const getAllRateLineItems = async (req, res) => {
  try {
    const items = await rateService.getAllRateLineItems();
    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Error fetching rate line items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rate line items',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get a single rate line item by ID
const getRateLineItemById = async (req, res) => {
  try {
    const item = await rateService.getRateLineItemById(req.params.id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Rate line item with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error(`Error fetching rate line item with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rate line item',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create a new rate line item
const createRateLineItem = async (req, res) => {
  try {
    const newItem = await rateService.createRateLineItem(req.body);
    res.status(201).json({
      success: true,
      data: newItem
    });
  } catch (error) {
    console.error('Error creating rate line item:', error);
    
    if (error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rate line item data',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating rate line item',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update an existing rate line item
const updateRateLineItem = async (req, res) => {
  try {
    const updatedItem = await rateService.updateRateLineItem(req.params.id, req.body);
    
    if (!updatedItem) {
      return res.status(404).json({
        success: false,
        message: `Rate line item with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      data: updatedItem
    });
  } catch (error) {
    console.error(`Error updating rate line item with ID ${req.params.id}:`, error);
    
    if (error.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rate line item data',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating rate line item',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete a rate line item
const deleteRateLineItem = async (req, res) => {
  try {
    const result = await rateService.deleteRateLineItem(req.params.id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Rate line item with ID ${req.params.id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Rate line item with ID ${req.params.id} deleted successfully`
    });
  } catch (error) {
    console.error(`Error deleting rate line item with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error deleting rate line item',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllRateLineItems,
  getRateLineItemById,
  createRateLineItem,
  updateRateLineItem,
  deleteRateLineItem
};
