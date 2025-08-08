// backend/routes/finance.js
const express = require('express');
const financeController = require('../controllers/financeController');

// Initialize router
const router = express.Router();

// Define routes
router.get('/billing-csv', financeController.generateBillingCsv);
router.get('/invoices-csv', financeController.generateInvoicesCsv);

// Export the router
module.exports = router;
