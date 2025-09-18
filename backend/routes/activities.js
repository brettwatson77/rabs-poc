/**
 * Activities Router
 * 
 * Implements the Activities API for the RABS system.
 * This router handles activities schedules linked to programs of type 'program' or 'user_select_program'.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

/* ------------------------------------------------------------------ *
 * Helper to ensure activities table / trigger exist. Runs once per
 * process, subsequent calls return immediately.
 * ------------------------------------------------------------------ */
let _activitiesSchemaReady = false;
async function ensureActivitiesSchema(pool) {
  if (_activitiesSchemaReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id uuid PRIMARY KEY,
        program_id uuid NOT NULL REFERENCES rules_programs(id) ON DELETE CASCADE,
        activity_date date NOT NULL,
        name text NOT NULL,
        address text,
        activity_cost numeric(10,2) DEFAULT 0,
        food_budget numeric(10,2) DEFAULT 0,
        notes text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activities_program_date
      ON activities (program_id, activity_date);
    `);
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_activities_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_activities_timestamp'
        ) THEN
          CREATE TRIGGER update_activities_timestamp
          BEFORE UPDATE ON activities
          FOR EACH ROW
          EXECUTE FUNCTION update_activities_timestamp();
        END IF;
      END $$;
    `);
    _activitiesSchemaReady = true;
  } catch (e) {
    console.error('Error ensuring activities schema:', e.message);
    throw e;
  }
}

// GET /activities/programs - List programs eligible for activities
router.get('/programs', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    await ensureActivitiesSchema(pool);
  } catch {
    return res.status(500).json({ success: false, error: 'Schema init failed' });
  }
  
  try {
    const result = await pool.query(`
      SELECT id, name, description, active, day_of_week, start_time, end_time, 
             venue_id, program_type
      FROM rules_programs
      WHERE program_type IN ('program', 'user_select_program')
      ORDER BY name
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching eligible programs:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch eligible programs'
    });
  }
});

// GET /activities/:programId - List activities for a specific program
router.get('/:programId', async (req, res) => {
  const pool = req.app.locals.pool;
  const { programId } = req.params;
  try {
    await ensureActivitiesSchema(pool);
  } catch {
    return res.status(500).json({ success: false, error: 'Schema init failed' });
  }
  
  try {
    // First check if the program exists and is of the right type
    const programCheck = await pool.query(`
      SELECT id FROM rules_programs 
      WHERE id = $1 AND program_type IN ('program', 'user_select_program')
    `, [programId]);
    
    if (programCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Program not found or not eligible for activities'
      });
    }
    
    const result = await pool.query(`
      SELECT id, program_id, activity_date, name, address, 
             activity_cost, food_budget, notes, created_at, updated_at
      FROM activities
      WHERE program_id = $1
      ORDER BY activity_date DESC
    `, [programId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activities'
    });
  }
});

// POST /activities/:programId - Create a new activity
router.post('/:programId', async (req, res) => {
  const pool = req.app.locals.pool;
  const { programId } = req.params;
  const { activity_date, name, address, activity_cost, food_budget, notes } = req.body;
  try {
    await ensureActivitiesSchema(pool);
  } catch {
    return res.status(500).json({ success: false, error: 'Schema init failed' });
  }
  
  // Validate required fields
  if (!activity_date || !name) {
    return res.status(400).json({
      success: false,
      error: 'activity_date and name are required'
    });
  }
  
  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(activity_date)) {
    return res.status(400).json({
      success: false,
      error: 'activity_date must be in YYYY-MM-DD format'
    });
  }
  
  try {
    // Check if the program exists and is of the right type
    const programCheck = await pool.query(`
      SELECT id FROM rules_programs 
      WHERE id = $1 AND program_type IN ('program', 'user_select_program')
    `, [programId]);
    
    if (programCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Program not found or not eligible for activities'
      });
    }
    
    // Insert the new activity
    const result = await pool.query(`
      INSERT INTO activities (
        id, program_id, activity_date, name, address, 
        activity_cost, food_budget, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING *
    `, [
      uuidv4(),
      programId,
      activity_date,
      name,
      address || null,
      activity_cost || 0,
      food_budget || 0,
      notes || null
    ]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating activity:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create activity'
    });
  }
});

// PATCH /activities/:programId/:id - Update an existing activity
router.patch('/:programId/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { programId, id } = req.params;
  const { activity_date, name, address, activity_cost, food_budget, notes } = req.body;
  try {
    await ensureActivitiesSchema(pool);
  } catch {
    return res.status(500).json({ success: false, error: 'Schema init failed' });
  }
  
  // Check if there are any fields to update
  if (!activity_date && !name && address === undefined && 
      activity_cost === undefined && food_budget === undefined && notes === undefined) {
    return res.status(400).json({
      success: false,
      error: 'No fields to update'
    });
  }
  
  // Validate date format if provided
  if (activity_date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(activity_date)) {
      return res.status(400).json({
        success: false,
        error: 'activity_date must be in YYYY-MM-DD format'
      });
    }
  }
  
  try {
    // Check if the program exists and is of the right type
    const programCheck = await pool.query(`
      SELECT id FROM rules_programs 
      WHERE id = $1 AND program_type IN ('program', 'user_select_program')
    `, [programId]);
    
    if (programCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Program not found or not eligible for activities'
      });
    }
    
    // Check if the activity exists and belongs to the program
    const activityCheck = await pool.query(`
      SELECT id FROM activities 
      WHERE id = $1 AND program_id = $2
    `, [id, programId]);
    
    if (activityCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found for this program'
      });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [id, programId];
    let paramIndex = 3;
    
    if (activity_date) {
      updates.push(`activity_date = $${paramIndex++}`);
      values.push(activity_date);
    }
    
    if (name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(address);
    }
    
    if (activity_cost !== undefined) {
      updates.push(`activity_cost = $${paramIndex++}`);
      values.push(activity_cost);
    }
    
    if (food_budget !== undefined) {
      updates.push(`food_budget = $${paramIndex++}`);
      values.push(food_budget);
    }
    
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    
    const result = await pool.query(`
      UPDATE activities
      SET ${updates.join(', ')}
      WHERE id = $1 AND program_id = $2
      RETURNING *
    `, values);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating activity:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update activity'
    });
  }
});

// DELETE /activities/:programId/:id - Delete an activity
router.delete('/:programId/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  const { programId, id } = req.params;
  try {
    await ensureActivitiesSchema(pool);
  } catch {
    return res.status(500).json({ success: false, error: 'Schema init failed' });
  }
  
  try {
    // Check if the program exists and is of the right type
    const programCheck = await pool.query(`
      SELECT id FROM rules_programs 
      WHERE id = $1 AND program_type IN ('program', 'user_select_program')
    `, [programId]);
    
    if (programCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Program not found or not eligible for activities'
      });
    }
    
    // Delete the activity
    const result = await pool.query(`
      DELETE FROM activities
      WHERE id = $1 AND program_id = $2
      RETURNING id
    `, [id, programId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found for this program'
      });
    }
    
    res.json({
      success: true,
      data: { id, deleted: true }
    });
  } catch (err) {
    console.error('Error deleting activity:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete activity'
    });
  }
});

module.exports = router;
