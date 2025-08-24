import express from 'express';
import { query } from '../db.js';
import { syncRethread } from '../services/syncRethread.js';

export const router = express.Router();

router.post('/exception', async (req, res, next) => {
  try {
    const { program_id, date, end_date=null, permanent=false, type='generic', metadata={} } = req.body || {};
    if (!date) return res.status(400).json({ error: 'date required' });

    // NOTE: rules_program_exceptions uses column name program_id (not rule_id) in your DB.
    const cols = ['date','permanent','type','metadata'];
    const params = [date, permanent, type, JSON.stringify(metadata)];
    let placeholders = ['$1','$2','$3','$4'];
    let i = 5;
    if (program_id) { cols.push('program_id'); params.push(program_id); placeholders.push(`$${i++}`); }
    if (end_date)  { cols.push('end_date');  params.push(end_date);  placeholders.push(`$${i++}`); }

    await query(`INSERT INTO rules_program_exceptions(${cols.join(',')}) VALUES (${placeholders.join(',')})`, params);

    const summary = await syncRethread({
      ruleId: program_id || null,
      dateFrom: date,
      dateTo: end_date || date,
      futureOnly: permanent
    });
    res.status(201).json({ ok:true, summary });
  } catch (e) { next(e); }
});
