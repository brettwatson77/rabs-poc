import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import { query } from '../db.js';
dayjs.extend(isoWeek);

function dow1to7(d) { // Monday=1..Sunday=7
  const n = d.isoWeekday ? d.isoWeekday() : ((d.day()+6)%7)+1;
  return n;
}
function weekInCycleFor(d) { // simple parity on ISO week
  const w = d.isoWeek ? d.isoWeek() : d.isoWeekNumber?.() || 1;
  return (w % 2) ? 1 : 2;
}

export async function syncRethread({ ruleId=null, dateFrom=null, dateTo=null, windowDays=14, futureOnly=false }) {
  const today = dayjs().startOf('day');
  let start = dateFrom ? dayjs(dateFrom) : today.add(1, 'day');
  let end   = dateTo   ? dayjs(dateTo)   : start.add(windowDays-1, 'day');
  if (futureOnly && start.isBefore(today.add(1, 'day'))) start = today.add(1, 'day');

  let datesProcessed = 0, rulesTouched = 0, instancesUpserted = 0, cardsWritten = 0;

  for (let d = start; !d.isAfter(end, 'day'); d = d.add(1,'day')) {
    datesProcessed++;
    let rules;
    if (ruleId) {
      const { rows } = await query(`SELECT * FROM rules_programs WHERE id=$1`, [ruleId]);
      rules = rows;
    } else {
      const dow = dow1to7(d);
      const cyc = weekInCycleFor(d);
      const { rows } = await query(
        `SELECT * FROM rules_programs WHERE status='active' AND day_of_week=$1 AND week_in_cycle=$2`,
        [dow, cyc]
      );
      rules = rows;
    }
    rulesTouched += rules.length;

    for (const r of rules) {
      // Upsert loom_instances
      const up = await query(
        `WITH existing AS (
           SELECT id FROM loom_instances WHERE source_rule_id=$1 AND instance_date=$2::date
         ), upd AS (
           UPDATE loom_instances
              SET start_time=$3, end_time=$4, venue_id=$5, updated_at=now()
            WHERE id IN (SELECT id FROM existing)
            RETURNING id
         )
         INSERT INTO loom_instances (id, source_rule_id, instance_date, start_time, end_time, venue_id, transport_required, staffing_ratio, is_overridden, quality_audit_flag, projected_at, updated_at)
         SELECT gen_random_uuid(), $1, $2::date, $3, $4, $5, true, '1:4', false, false, now(), now()
         WHERE NOT EXISTS (SELECT 1 FROM existing)
         RETURNING id`,
        [r.id, d.format('YYYY-MM-DD'), r.start_time, r.end_time, r.venue_id]
      );
      const instanceId = up.rows[0]?.id || (await query(
        `SELECT id FROM loom_instances WHERE source_rule_id=$1 AND instance_date=$2::date`,
        [r.id, d.format('YYYY-MM-DD')]
      )).rows[0]?.id;
      if (!instanceId) continue;
      instancesUpserted++;

      // Rebuild event_card_map from rules_program_slots
      await query(`DELETE FROM event_card_map WHERE loom_instance_id=$1`, [instanceId]);
      const ins = await query(
        `INSERT INTO event_card_map
           (id, loom_instance_id, card_type, card_order, display_title, display_subtitle,
            display_time_start, display_time_end, card_color, card_icon, created_at)
         SELECT gen_random_uuid(), $1, s.slot_type, s.seq,
                COALESCE(s.label, initcap(s.slot_type)),
                to_char((date $2 + s.start_time),'HH24:MI') || '–' || to_char((date $2 + s.end_time),'HH24:MI'),
                (date $2 + s.start_time)::timestamptz, (date $2 + s.end_time)::timestamptz,
                CASE s.slot_type WHEN 'pickup' THEN 'blue' WHEN 'dropoff' THEN 'purple' WHEN 'meal' THEN 'amber' ELSE 'green' END,
                s.slot_type, now()
         FROM rules_program_slots s
         WHERE s.rule_id=$3
         ORDER BY s.seq
         RETURNING id`,
        [instanceId, d.format('YYYY-MM-DD'), r.id]
      );
      cardsWritten += ins.rowCount || 0;
    }
  }
  return { datesProcessed, rulesTouched, instancesUpserted, cardsWritten };
}
