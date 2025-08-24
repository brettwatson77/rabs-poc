import express from 'express';
import { query } from '../db.js';

export const router = express.Router();

router.get('/loom/instances', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });
    const { rows } = await query(
      `SELECT * FROM loom_instances WHERE instance_date BETWEEN $1::date AND $2::date ORDER BY instance_date`,
      [startDate, endDate]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/dashboard/cards', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    const { rows } = await query(
      `SELECT c.* FROM event_card_map c
         JOIN loom_instances i ON i.id = c.loom_instance_id
       WHERE i.instance_date = $1::date
       ORDER BY c.card_order`,
      [date]
    );
    res.json(rows);
  } catch (e) { next(e); }
});
