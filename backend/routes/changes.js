/**
 * Changes Routes
 * 
 * History component - Change logs and audit trails
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'rabspocdb',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * ---------------------------------------------------------------------------
 * GET /api/v1/changes/participant/:id/changes
 * ---------------------------------------------------------------------------
 * Returns change history for a specific participant, ordered by most recent first
 */
router.get('/participant/:id/changes', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        id,
        change_date,
        change_type,
        description,
        billing_impact,
        billing_status
       FROM change_log
       WHERE participant_id = $1
       ORDER BY change_date DESC`,
      [id]
    );
    
    // Map database fields to client-expected shape
    const changes = result.rows.map(row => ({
      id: row.id,
      date: row.change_date,
      type: row.change_type,
      message: row.description,
      details: extractDetails(row.description),
      changedBy: extractChangedBy(row.description) || 'System',
      reason: extractReason(row.description) || 'System generated',
      billingImpact: row.billing_impact || false,
      billingStatus: row.billing_status || 'NA'
    }));
    
    res.json({
      success: true,
      changes
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper function to extract details from description text
 * This is a simple implementation that could be enhanced with more sophisticated parsing
 */
function extractDetails(description) {
  if (!description) return '';
  
  // Try to extract details that follow "Details:" or after a colon
  const detailsMatch = description.match(/(?:Details:|:)\s*(.+?)(?:\.|$)/i);
  return detailsMatch ? detailsMatch[1].trim() : '';
}

/**
 * Helper function to extract who made the change from description text
 */
function extractChangedBy(description) {
  if (!description) return null;
  
  // Try to extract name that follows "by" or "By"
  const byMatch = description.match(/(?:by|By)\s+([A-Za-z\s]+?)(?:\.|\son|$)/);
  return byMatch ? byMatch[1].trim() : null;
}

/**
 * Helper function to extract reason from description text
 */
function extractReason(description) {
  if (!description) return null;
  
  // Try to extract reason that follows "because", "due to", or "reason:"
  const reasonMatch = description.match(/(?:because|due to|reason:)\s+(.+?)(?:\.|$)/i);
  return reasonMatch ? reasonMatch[1].trim() : null;
}

module.exports = router;
