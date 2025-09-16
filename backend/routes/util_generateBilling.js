/**
 * Billing Generator Utility
 * 
 * Generates payment_diamonds entries from rules_program_participants and their
 * associated billing lines in rules_program_participant_billing.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Ensure payment_diamonds has required columns (idempotent)
 * @param {Object} pool - Database connection pool
 * @returns {Promise<void>}
 */
const ensurePaymentDiamondsColumns = async (pool) => {
  try {
    // Add program_id column if it doesn't exist
    await pool.query(`
      ALTER TABLE payment_diamonds 
      ADD COLUMN IF NOT EXISTS program_id UUID NULL
    `);
    
    // Add hours column if it doesn't exist
    await pool.query(`
      ALTER TABLE payment_diamonds 
      ADD COLUMN IF NOT EXISTS hours NUMERIC(6,2) NULL
    `);
    
    console.log('[BILLING] Ensured payment_diamonds has program_id and hours columns');
  } catch (err) {
    // Ignore errors if columns already exist or other issues
    console.error('[BILLING] Note: payment_diamonds column check:', err.message);
  }
};

/**
 * Generate billing entries from rules and participants
 * @param {Object} options - Generation options
 * @param {string} [options.ruleId] - Optional specific rule ID to process
 * @param {string} options.dateFrom - Start date in YYYY-MM-DD format
 * @param {string} options.dateTo - End date in YYYY-MM-DD format
 * @param {Object} pool - Database connection pool
 * @returns {Promise<Object>} - Summary of the generation operation
 */
async function generateBilling(options = {}, pool) {
  // Validate pool parameter
  if (!pool) {
    throw new Error('generateBilling requires a database pool');
  }

  // Extract and validate options
  const { ruleId, dateFrom, dateTo } = options;
  
  if (!dateFrom || !dateTo) {
    throw new Error('dateFrom and dateTo are required');
  }

  // Initialize summary counters
  const summary = {
    instancesScanned: 0,
    linesCreated: 0,
    linesSkipped: 0,
    errors: 0
  };

  try {
    // Ensure payment_diamonds has required columns
    await ensurePaymentDiamondsColumns(pool);
    
    // Build query to get loom instances in date range
    let instanceQuery = `
      SELECT 
        li.id, 
        li.source_rule_id, 
        li.instance_date,
        rp.name as program_name
      FROM loom_instances li
      JOIN rules_programs rp ON li.source_rule_id = rp.id
      WHERE li.instance_date BETWEEN $1 AND $2
    `;
    
    const queryParams = [dateFrom, dateTo];
    
    // Add rule filter if provided
    if (ruleId) {
      instanceQuery += ` AND li.source_rule_id = $3`;
      queryParams.push(ruleId);
    }
    
    // Order by date for predictable processing
    instanceQuery += ` ORDER BY li.instance_date ASC`;
    
    // Get all instances in the date range
    const instancesResult = await pool.query(instanceQuery, queryParams);
    const instances = instancesResult.rows;
    
    // Process each instance
    for (const instance of instances) {
      summary.instancesScanned++;
      
      try {
        // Get all participants linked to this rule
        const participantsResult = await pool.query(`
          SELECT 
            rpp.id as rpp_id, 
            rpp.participant_id,
            p.first_name || ' ' || p.last_name AS participant_name,
            p.plan_management_type
          FROM rules_program_participants rpp
          JOIN participants p ON rpp.participant_id = p.id
          WHERE rpp.rule_id = $1
        `, [instance.source_rule_id]);
        
        const participants = participantsResult.rows;
        
        // For each participant, get their billing lines
        for (const participant of participants) {
          // Check for billing lines in the newer schema first
          const billingResult = await pool.query(`
            SELECT 
              rppb.id,
              rppb.billing_code_id,
              rppb.hours,
              rppb.ratio_label,
              rppb.unit_price,
              br.code as billing_code,
              br.description as billing_description
            FROM rules_program_participant_billing rppb
            LEFT JOIN billing_rates br ON rppb.billing_code_id = br.id
            WHERE rppb.rule_participant_id = $1
          `, [participant.rpp_id]);
          
          // If no results, try legacy schema with rpp_id
          let billingLines = billingResult.rows;
          if (billingLines.length === 0) {
            try {
              const legacyResult = await pool.query(`
                SELECT 
                  rppb.id,
                  rppb.billing_code,
                  rppb.hours,
                  '1:1' as ratio_label,
                  0 as unit_price
                FROM rules_program_participant_billing rppb
                WHERE rppb.rpp_id = $1
              `, [participant.rpp_id]);
              
              billingLines = legacyResult.rows;
            } catch (legacyErr) {
              // Ignore legacy schema errors - table might not exist or have different columns
              console.log('[BILLING] Note: Legacy billing schema check failed:', legacyErr.message);
            }
          }
          
          // Process each billing line
          for (const line of billingLines) {
            try {
              // Get or resolve billing code and unit price
              let billingCode = line.billing_code || '';
              let unitPrice = parseFloat(line.unit_price) || 0;
              
              // If we have a billing_code_id but no resolved code, try to get it directly
              if (line.billing_code_id && !billingCode) {
                try {
                  const codeResult = await pool.query(`
                    SELECT code, base_rate FROM billing_rates WHERE id = $1
                  `, [line.billing_code_id]);
                  
                  if (codeResult.rows.length > 0) {
                    billingCode = codeResult.rows[0].code;
                    // If no unit price set, use base rate
                    if (unitPrice === 0) {
                      unitPrice = parseFloat(codeResult.rows[0].base_rate) || 0;
                    }
                  }
                } catch (codeErr) {
                  console.error('[BILLING] Error resolving billing code:', codeErr.message);
                }
              }
              
              // Skip if no billing code
              if (!billingCode) {
                summary.linesSkipped++;
                continue;
              }
              
              // Check if identical line already exists
              const existingCheck = await pool.query(`
                SELECT id FROM payment_diamonds 
                WHERE participant_id = $1
                AND program_id = $2
                AND invoice_date = $3
                AND support_item_number = $4
                AND hours = $5
                AND unit_price = $6
              `, [
                participant.participant_id,
                instance.source_rule_id,
                instance.instance_date,
                billingCode,
                line.hours,
                unitPrice
              ]);
              
              if (existingCheck.rows.length > 0) {
                summary.linesSkipped++;
                continue;
              }
              
              // Calculate total amount
              const hours = parseFloat(line.hours) || 0;
              const quantity = 1; // Default quantity
              const totalAmount = Math.round((unitPrice * hours * quantity) * 100) / 100;
              
              // Insert payment diamond
              await pool.query(`
                INSERT INTO payment_diamonds (
                  id,
                  participant_id,
                  program_id,
                  support_item_number,
                  unit_price,
                  hours,
                  quantity,
                  total_amount,
                  gst_code,
                  status,
                  invoice_date,
                  history_shift_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              `, [
                uuidv4(),
                participant.participant_id,
                instance.source_rule_id,
                billingCode,
                unitPrice,
                hours,
                quantity,
                totalAmount,
                'FRE', // GST-free
                'pending',
                instance.instance_date,
                null // No history shift for generated entries
              ]);
              
              summary.linesCreated++;
              
            } catch (lineErr) {
              console.error('[BILLING] Error processing billing line:', lineErr.message);
              summary.errors++;
            }
          }
        }
      } catch (instanceErr) {
        console.error(`[BILLING] Error processing instance ${instance.id}:`, instanceErr.message);
        summary.errors++;
        // Continue with next instance despite error
      }
    }
    
    // Log generation summary
    console.log(`[BILLING] Generated ${summary.linesCreated} billing lines from ${summary.instancesScanned} instances (${summary.linesSkipped} skipped, ${summary.errors} errors)`);
    
    return summary;
  } catch (err) {
    console.error('[BILLING] Error in generateBilling:', err.message);
    throw err;
  }
}

module.exports = {
  generateBilling,
  ensurePaymentDiamondsColumns
};
