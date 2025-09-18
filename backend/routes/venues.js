/**
 * Venues API Routes
 * 
 * Endpoints for venue management:
 * - GET /venues - List all venues
 * - GET /venues/:id - Get single venue
 * - POST /venues - Create venue
 * - PUT /venues/:id - Update venue
 * - DELETE /venues/:id - Delete venue
 */

const express = require('express');
const router = express.Router();

// GET /venues - List all venues
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    // Ensure all required columns exist
    await pool.query(`
      ALTER TABLE venues
        ADD COLUMN IF NOT EXISTS include_in_transport boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS contact_phone text,
        ADD COLUMN IF NOT EXISTS contact_email text,
        ADD COLUMN IF NOT EXISTS accessibility_features text,
        ADD COLUMN IF NOT EXISTS venue_type text,
        ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true
    `);
    
    // Restore rich field selection expected by Filing Cabinet UI
    const query = `
      SELECT
        id,
        name,
        address,
        suburb,
        state,
        postcode,
        contact_phone,
        contact_email,
        capacity,
        facilities,
        features,
        COALESCE(include_in_transport,false) AS include_in_transport,
        COALESCE(is_active, active, true) AS is_active,
        created_at,
        updated_at,
        location_lat,
        location_lng,
        status
      FROM venues
    ORDER BY name ASC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('Error fetching venues:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch venues',
      message: error.message
    });
  }
});

// GET /venues/:id - Get single venue
router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    await pool.query(`
      ALTER TABLE venues
        ADD COLUMN IF NOT EXISTS include_in_transport boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS contact_phone text,
        ADD COLUMN IF NOT EXISTS contact_email text,
        ADD COLUMN IF NOT EXISTS accessibility_features text,
        ADD COLUMN IF NOT EXISTS venue_type text,
        ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true
    `);
    
    const query = `
      SELECT
        id,
        name,
        address,
        suburb,
        state,
        postcode,
        contact_phone,
        contact_email,
        capacity,
        facilities,
        features,
        COALESCE(include_in_transport,false) AS include_in_transport,
        COALESCE(is_active, active, true) AS is_active,
        created_at,
        updated_at,
        location_lat,
        location_lng,
        status
      FROM venues
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Venue not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching venue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch venue',
      message: error.message
    });
  }
});

// POST /venues - Create venue
router.post('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    // Ensure all required columns exist
    await pool.query(`
      ALTER TABLE venues
        ADD COLUMN IF NOT EXISTS include_in_transport boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS contact_phone text,
        ADD COLUMN IF NOT EXISTS contact_email text,
        ADD COLUMN IF NOT EXISTS accessibility_features text,
        ADD COLUMN IF NOT EXISTS venue_type text,
        ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true
    `);
    
    const {
      name,
      address,
      postcode,
      contact_phone,
      contact_email,
      capacity,
      facilities,
      features,
      accessibility_features,
      venue_type,
      is_active,
      include_in_transport
    } = req.body;
    
    // Validate required fields
    if (!name || !address) {
      return res.status(400).json({
        success: false,
        error: 'Name and address are required fields'
      });
    }
    
    const query = `
      INSERT INTO venues (
        name, address, postcode, contact_phone, contact_email,
        capacity, facilities, features, accessibility_features,
        venue_type, include_in_transport, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, name, address, postcode, contact_phone, contact_email,
                capacity, accessibility_features, venue_type,
                COALESCE(include_in_transport,false) AS include_in_transport,
                is_active
    `;
    
    const values = [
      name,
      address,
      postcode || null,
      contact_phone || null,
      contact_email || null,
      capacity || null,
      facilities || '{}',
      features || '{}',
      accessibility_features || null,
      venue_type || null,
      include_in_transport !== undefined ? include_in_transport : false,
      is_active !== undefined ? is_active : true
    ];
    
    const result = await pool.query(query, values);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Venue created successfully'
    });
  } catch (error) {
    console.error('Error creating venue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create venue',
      message: error.message
    });
  }
});

// PUT /venues/:id - Update venue
router.put('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    await pool.query(`
      ALTER TABLE venues
        ADD COLUMN IF NOT EXISTS include_in_transport boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS contact_phone text,
        ADD COLUMN IF NOT EXISTS contact_email text,
        ADD COLUMN IF NOT EXISTS accessibility_features text,
        ADD COLUMN IF NOT EXISTS venue_type text,
        ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true
    `);
    
    const {
      name,
      address,
      suburb,
      state,
      postcode,
      contact_phone,
      contact_email,
      capacity,
      accessibility_features,
      venue_type,
      is_active,
      include_in_transport,
      notes
    } = req.body;
    
    // Check if venue exists
    const checkResult = await pool.query('SELECT id FROM venues WHERE id = $1', [id]);
    if (checkResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Venue not found'
      });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(address);
    }
    
    if (suburb !== undefined) {
      updates.push(`suburb = $${paramIndex++}`);
      values.push(suburb);
    }
    
    if (state !== undefined) {
      updates.push(`state = $${paramIndex++}`);
      values.push(state);
    }
    
    if (postcode !== undefined) {
      updates.push(`postcode = $${paramIndex++}`);
      values.push(postcode);
    }
    
    if (contact_phone !== undefined) {
      updates.push(`contact_phone = $${paramIndex++}`);
      values.push(contact_phone);
    }
    
    if (contact_email !== undefined) {
      updates.push(`contact_email = $${paramIndex++}`);
      values.push(contact_email);
    }
    
    if (capacity !== undefined) {
      updates.push(`capacity = $${paramIndex++}`);
      values.push(capacity);
    }

    // ------------------------------------------------------------------
    // NEW: Facilities (text[]) + Features (jsonb)
    // ------------------------------------------------------------------
    if (req.body.facilities !== undefined) {
      updates.push(`facilities = $${paramIndex++}`);
      values.push(req.body.facilities);
    }

    if (req.body.features !== undefined) {
      updates.push(`features = $${paramIndex++}`);
      values.push(req.body.features);
    }
    
    if (accessibility_features !== undefined) {
      updates.push(`accessibility_features = $${paramIndex++}`);
      values.push(accessibility_features);
    }
    
    if (venue_type !== undefined) {
      updates.push(`venue_type = $${paramIndex++}`);
      values.push(venue_type);
    }
    
    if (include_in_transport !== undefined) {
      updates.push(`include_in_transport = $${paramIndex++}`);
      values.push(include_in_transport);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }
    
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    
    // If no fields to update
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    const query = `
      UPDATE venues
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, address, suburb, state, postcode, contact_phone,
                contact_email, capacity, facilities, features,
                accessibility_features, venue_type,
                COALESCE(include_in_transport,false) AS include_in_transport,
                COALESCE(is_active, true) AS is_active,
                status, location_lat, location_lng,
                created_at, updated_at
    `;
    
    values.push(id);
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Venue updated successfully'
    });
  } catch (error) {
    console.error('Error updating venue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update venue',
      message: error.message
    });
  }
});

// DELETE /venues/:id - Delete venue
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;
    
    // Check if venue exists
    const checkResult = await pool.query('SELECT id FROM venues WHERE id = $1', [id]);
    if (checkResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Venue not found'
      });
    }
    
    // Check if venue is in use by any programs
    const programsResult = await pool.query('SELECT COUNT(*) FROM programs WHERE venue_id = $1', [id]);
    if (parseInt(programsResult.rows[0].count) > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete venue that is in use by programs',
        message: 'This venue is associated with one or more programs. Remove these associations first.'
      });
    }
    
    const query = 'DELETE FROM venues WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    
    res.json({
      success: true,
      data: { id: result.rows[0].id },
      message: 'Venue deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting venue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete venue',
      message: error.message
    });
  }
});

module.exports = router;
