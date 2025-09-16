import express from 'express';
import { query, tx } from '../db.js';
import { syncRethread } from '../services/syncRethread.js';

export const router = express.Router();

const RULE_FIELDS = new Set(['name','venue_id','day_of_week','week_in_cycle','start_time','end_time','pickup_runs','dropoff_runs','status']);

router.post('/rules', async (req, res, next) => {
  try {
    const fields = req.body || {};
    const cols = ['status'];
    const vals = ['draft'];
    const params = [];
    let i = 1;
    for (const k of Object.keys(fields)) {
      if (RULE_FIELDS.has(k)) { cols.push(k); vals.push(`$${i++}`); params.push(fields[k]); }
    }
    const sql = `INSERT INTO rules_programs(${cols.join(',')}) VALUES (${vals.join(',')}) RETURNING id, status`;
    const { rows } = await query(sql, params);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.patch('/rules/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const fields = req.body || {};
    const sets = [];
    const params = [];
    let i = 1;
    for (const [k,v] of Object.entries(fields)) {
      if (RULE_FIELDS.has(k)) { sets.push(`${k} = $${i++}`); params.push(v); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields' });
    params.push(id);
    const { rows } = await query(`UPDATE rules_programs SET ${sets.join(', ')}, updated_at=now() WHERE id=$${i} RETURNING id, status`, params);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.post('/rules/:id/slots', async (req, res, next) => {
  try {
    const id = req.params.id;
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const values = [];
    const params = [];
    let i = 1;
    for (const it of items) {
      values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
      params.push(id, it.seq, it.slot_type, it.start_time, it.end_time, it.route_run_number || null);
    }
    await query(
      `INSERT INTO rules_program_slots(rule_id, seq, slot_type, start_time, end_time, route_run_number)
       VALUES ${values.join(',')}`, params
    );
    res.status(201).json({ inserted: items.length });
  } catch (e) { next(e); }
});

router.post('/rules/:id/participants', async (req, res, next) => {
  try {
    const id = req.params.id;
    const { participant_id } = req.body || {};
    if (!participant_id) return res.status(400).json({ error: 'participant_id required' });
    const { rows } = await query(
      `INSERT INTO rules_program_participants(rule_id, participant_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id`,
      [id, participant_id]
    );
    res.status(201).json({ id: rows[0]?.id });
  } catch (e) { next(e); }
});

router.post('/rules/:id/participants/:rppId/billing', async (req, res, next) => {
  try {
    const { id, rppId } = req.params;
    const { billing_code_id, hours } = req.body || {};
    if (!billing_code_id || hours == null) return res.status(400).json({ error: 'billing_code_id and hours required' });
    await query(
      `INSERT INTO rules_program_participant_billing(rule_participant_id, billing_code_id, hours) VALUES ($1,$2,$3)`,
      [rppId, billing_code_id, hours]
    );
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/rules/:id/requirements', async (req, res, next) => {
  try {
    const id = req.params.id;
    let { rows } = await query(`SELECT * FROM rules_program_requirements WHERE rule_id=$1`, [id]);
    if (!rows.length) {
      await query(`SELECT recompute_rule_requirements($1)`, [id]);
      rows = (await query(`SELECT * FROM rules_program_requirements WHERE rule_id=$1`, [id])).rows;
    }
    const r = rows[0] || { participant_count: 0, wpu_total: 0, staff_required: 0, vehicles_required: 0 };
    res.json({ participant_count: r.participant_count, wpu_total: Number(r.wpu_total||0), staff_required: r.staff_required, vehicles_required: r.vehicles_required });
  } catch (e) { next(e); }
});

router.post('/rules/:id/finalize', async (req, res, next) => {
  try {
    const id = req.params.id;
    const { windowDays=14, dateFrom=null, dateTo=null } = req.body || {};
    await query(`UPDATE rules_programs SET status='active', updated_at=now() WHERE id=$1`, [id]);
    const summary = await syncRethread({ ruleId:id, windowDays, dateFrom, dateTo, futureOnly:true });
    res.json({ ok: true, summary });
  } catch (e) { next(e); }
});
