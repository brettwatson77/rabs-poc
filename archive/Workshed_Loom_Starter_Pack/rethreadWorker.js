/**
 * rethreadWorker.js — minimal worker to process loom_rethread_queue
 * Requires: npm i pg dayjs
 */
import pg from 'pg';
import dayjs from 'dayjs';

const cfg = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'rabspocdb',
  windowDays: Number(process.env.LOOM_WINDOW_DAYS || 28),
};

const pool = new pg.Pool(cfg);

async function nextJob(client) {
  const { rows } = await client.query(
    `UPDATE loom_rethread_queue
     SET picked_at = now(), status = 'processing'
     WHERE id = (
       SELECT id FROM loom_rethread_queue
       WHERE status = 'queued'
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING *`
  );
  return rows[0] || null;
}

function* datesBetween(from, to) {
  let d = dayjs(from);
  const end = dayjs(to);
  while (!d.isAfter(end, 'day')) {
    yield d.format('YYYY-MM-DD');
    d = d.add(1, 'day');
  }
}

async function eligibleTemplates(client, dateStr) {
  // match by day_of_week and week_in_cycle
  const d = dayjs(dateStr);
  const dow = (d.day() + 6) % 7; // map Sun(0) to 6 if Monday=0 convention
  const weekInCycle = Math.floor((d.week() % 2) === 0 ? 2 : 1); // simple heuristic; replace with your own cycle anchor
  const { rows } = await client.query(
    `SELECT * FROM program_templates
     WHERE status='active' AND day_of_week=$1 AND week_in_cycle=$2`,
    [dow, weekInCycle]
  );
  return rows;
}

async function upsertInstance(client, template, dateStr) {
  const { rows } = await client.query(
    `INSERT INTO loom_instances (template_id, date, status, instance_staff_required, instance_vehicles_required)
     SELECT $1, $2::date, 'planned', r.staff_required, r.vehicles_required
     FROM program_template_requirements r WHERE r.template_id=$1
     ON CONFLICT (template_id, date) DO UPDATE
       SET updated_at=now()
     RETURNING id`,
    [template.id, dateStr]
  );
  return rows[0].id;
}

async function copySlots(client, instanceId, templateId, dateStr) {
  // delete existing slots then copy from template slots
  await client.query(`DELETE FROM loom_instance_slots WHERE instance_id=$1`, [instanceId]);
  await client.query(
    `INSERT INTO loom_instance_slots (instance_id, seq, slot_type, start_time, end_time, route_run_number)
     SELECT $1, s.seq, s.slot_type,
            (date $2 + s.start_time)::timestamptz,
            (date $2 + s.end_time)::timestamptz,
            s.route_run_number
     FROM program_template_slots s
     WHERE s.template_id=$3`,
    [instanceId, dateStr, templateId]
  );
}

async function applyIntents(client, instanceId, templateId, dateStr) {
  // MVP placeholder: implement removal of participants or time/venue overrides as needed.
  // For now we just acknowledge intents exist.
  await client.query(`SELECT 1 FROM calendar_intents WHERE date=$1 AND (template_id IS NULL OR template_id=$2)`, [dateStr, templateId]);
}

async function processJob(job) {
  const client = await pool.connect();
  try {
    const dateFrom = job.date_from || dayjs().format('YYYY-MM-DD');
    const dateTo = job.date_to || dayjs(dateFrom).add(cfg.windowDays-1, 'day').format('YYYY-MM-DD');
    for (const d of datesBetween(dateFrom, dateTo)) {
      const templates = job.template_id ?
        (await client.query(`SELECT * FROM program_templates WHERE id=$1 AND status='active'`, [job.template_id])).rows :
        await eligibleTemplates(client, d);
      for (const t of templates) {
        const instanceId = await upsertInstance(client, t, d);
        await copySlots(client, instanceId, t.id, d);
        await applyIntents(client, instanceId, t.id, d);
      }
    }
    await client.query(`UPDATE loom_rethread_queue SET status='done' WHERE id=$1`, [job.id]);
    console.log(`[worker] job ${job.id} done (${dateFrom}..${dateTo})`);
  } catch (err) {
    console.error(`[worker] job ${job.id} error`, err);
    await client.query(`UPDATE loom_rethread_queue SET status='error', error=$2 WHERE id=$1`, [job.id, String(err)]);
  } finally {
    client.release();
  }
}

async function main() {
  console.log(`[worker] starting with window=${cfg.windowDays} days`);
  while (true) {
    const client = await pool.connect();
    try {
      const job = await nextJob(client);
      client.release();
      if (job) {
        await processJob(job);
      } else {
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e) {
      client.release();
      console.error(`[worker] loop error`, e);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
