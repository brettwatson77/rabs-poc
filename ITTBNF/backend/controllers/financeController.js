// backend/controllers/financeController.js
const financeService = require('../services/financeService');

/**
 * Generate a CSV file for bulk billing (agency-managed)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateBillingCsv = async (req, res) => {
  try {
    // Extract startDate and endDate from query parameters
    const { startDate, endDate } = req.query;
    
    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: startDate and endDate are required'
      });
    }
    
    // Call the service to generate the CSV data
    const csvData = await financeService.generateBillingCsv(startDate, endDate);
    
    // Set headers for CSV file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="agency_billing_${startDate}_to_${endDate}.csv"`);
    
    // Send the CSV data
    res.status(200).send(csvData);
  } catch (error) {
    console.error('Error generating billing CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating billing CSV',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Generate a CSV file for individual invoices (plan-managed)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateInvoicesCsv = async (req, res) => {
  try {
    // Extract startDate and endDate from query parameters
    const { startDate, endDate } = req.query;
    
    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: startDate and endDate are required'
      });
    }
    
    // Call the service to generate the CSV data
    const csvData = await financeService.generateInvoicesCsv(startDate, endDate);
    
    // Set headers for CSV file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="participant_invoices_${startDate}_to_${endDate}.csv"`);
    
    // Send the CSV data
    res.status(200).send(csvData);
  } catch (error) {
    console.error('Error generating invoices CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating invoices CSV',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  generateBillingCsv,
  generateInvoicesCsv
};
