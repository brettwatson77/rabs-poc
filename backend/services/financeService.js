// backend/services/financeService.js
const { getDbConnection } = require('../database');

/**
 * Generate a CSV string from an array of objects
 * @param {Array} data - Array of objects to convert to CSV
 * @param {Array} headers - Array of header objects with 'id' and 'title' properties
 * @returns {string} CSV formatted string
 */
const generateCsvFromData = (data, headers) => {
  // Create the header row
  const headerRow = headers.map(header => `"${header.title}"`).join(',');
  
  // Create the data rows
  const dataRows = data.map(row => {
    return headers.map(header => {
      const value = row[header.id];
      // Wrap strings in quotes and handle null/undefined values
      return value === null || value === undefined 
        ? '' 
        : typeof value === 'string' 
          ? `"${value.replace(/"/g, '""')}"` 
          : value;
    }).join(',');
  });
  
  // Combine header and data rows
  return [headerRow, ...dataRows].join('\n');
};

/**
 * Generate a CSV for bulk billing (agency-managed participants)
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<string>} CSV formatted string
 */
const generateBillingCsv = async (startDate, endDate) => {
  let db;
  try {
    db = await getDbConnection();
    // 1. Retrieve provider settings
    const settingsRows = await new Promise((resolve, reject) =>
      db.all(
      `SELECT key, value FROM settings WHERE key IN ('ndis_registration_number','abn')`,
      [],
      (err, rows) => (err ? reject(err) : resolve(rows))
    ));

    const settings = settingsRows.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    const registrationNumber = settings['ndis_registration_number'] || '';
    const abn = settings['abn'] || '';

    // 2. Main live-calculation query for unbilled items
    const query = `
          WITH date_range_instances AS (
            SELECT id, program_id, date, start_time, end_time
            FROM program_instances
            WHERE date BETWEEN ? AND ?
          ),
          base_attendances AS (
            SELECT p.id AS participant_id, p.ndis_number, p.is_plan_managed, dri.id AS program_instance_id, dri.program_id, dri.date, dri.start_time, dri.end_time
            FROM program_enrollments pe
            JOIN participants p ON pe.participant_id = p.id
            JOIN date_range_instances dri ON pe.program_id = dri.program_id
            WHERE pe.start_date <= dri.date AND (pe.end_date IS NULL OR pe.end_date >= dri.date)
          ),
          added_attendances AS (
            SELECT p.id AS participant_id, p.ndis_number, p.is_plan_managed, dri.id AS program_instance_id, dri.program_id, dri.date, dri.start_time, dri.end_time
            FROM pending_enrollment_changes pec
            JOIN participants p ON pec.participant_id = p.id
            JOIN date_range_instances dri ON pec.program_id = dri.program_id
            WHERE pec.action = 'add' AND pec.effective_date <= dri.date
          ),
          removed_attendances AS (
            SELECT pec.participant_id, dri.id AS program_instance_id
            FROM pending_enrollment_changes pec
            JOIN date_range_instances dri ON pec.program_id = dri.program_id
            WHERE pec.action = 'remove' AND pec.effective_date <= dri.date
          ),
          final_attendances AS (
            SELECT * FROM base_attendances
            UNION
            SELECT * FROM added_attendances
          )
          SELECT DISTINCT
              fa.participant_id,
              fa.program_instance_id,
              fa.ndis_number,
              fa.date AS activity_date,
              fa.start_time,
              fa.end_time,
              rli.id AS line_item_id,
              rli.support_number,
              rli.unit_price,
              rli.gst_code,
              rli.in_kind_funding_program,
              rli.claim_type,
              COALESCE(att.status, 'confirmed') AS attendance_status
          FROM final_attendances fa
          JOIN rate_line_items rli ON fa.program_id = rli.program_id
          LEFT JOIN attendance att ON fa.participant_id = att.participant_id AND fa.program_instance_id = att.program_instance_id
          /*  === Prevent double-billing ===
             An item is “unbilled” if there is **no** matching row in billing_records
             for the same participant, program instance and line-item combination.
             We do this with a LEFT JOIN and filter for NULL on the joined record.
          */
          LEFT JOIN billing_records br
                 ON  br.participant_id      = fa.participant_id
                AND br.program_instance_id = fa.program_instance_id
                AND br.line_item_id        = rli.id
                AND br.status              = 'billed'          -- only treat BILLED rows as “already billed”
          WHERE
              fa.is_plan_managed = 0
              AND NOT EXISTS (
                  SELECT 1 FROM removed_attendances ra
                  WHERE ra.participant_id = fa.participant_id AND ra.program_instance_id = fa.program_instance_id
              )
              /* only keep rows that have **no** billing record yet */
              AND br.id IS NULL
          ORDER BY fa.date, fa.start_time, fa.participant_id;
        `;

    const rows = await new Promise((resolve, reject) =>
      db.all(query, [startDate, endDate], (err, r) => (err ? reject(err) : resolve(r)))
    );

    // --- De-duplicate rows by composite key to avoid UNIQUE violations when inserting ---
    const seenKeys = new Set();
    const uniqueRows = rows.filter(r => {
      const key = `${r.participant_id}-${r.program_instance_id}-${r.line_item_id}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    // Debug – show the actual SQL & params we just executed
    console.log('[generateBillingCsv] Executed SQL:', query);
    console.log('[generateBillingCsv] Params:', [startDate, endDate]);

    console.log('Billing query returned', rows.length, 'unbilled items (', uniqueRows.length, 'after de-dup)');

          // 3. Map DB rows to NDIS bulk upload structure
          const headers = [
            { id: 'RegistrationNumber',      title: 'RegistrationNumber' },
            { id: 'NDISNumber',              title: 'NDISNumber' },
            { id: 'SupportsDeliveredFrom',   title: 'SupportsDeliveredFrom' },
            { id: 'SupportsDeliveredTo',     title: 'SupportsDeliveredTo' },
            { id: 'SupportNumber',           title: 'SupportNumber' },
            { id: 'ClaimReference',          title: 'ClaimReference' },
            { id: 'Quantity',                title: 'Quantity' },
            { id: 'Hours',                   title: 'Hours' },
            { id: 'UnitPrice',               title: 'UnitPrice' },
            { id: 'GSTCode',                 title: 'GSTCode' },
            { id: 'AuthorisedBy',            title: 'AuthorisedBy' },
            { id: 'ParticipantApproved',     title: 'ParticipantApproved' },
            { id: 'InKindFundingProgram',    title: 'InKindFundingProgram' },
            { id: 'ClaimType',               title: 'ClaimType' },
            { id: 'CancellationReason',      title: 'CancellationReason' },
            { id: 'ABN',                     title: 'ABN of Support Provider' }
          ];

          const recordsToInsert = [];
          const mapped = uniqueRows.map(r => {
            const start = new Date(`${r.activity_date}T${r.start_time}:00`);
            const end   = new Date(`${r.activity_date}T${r.end_time}:00`);
            const hours = ((end - start) / 3600000).toFixed(2);

            // Prepare record for insertion into billing_records
            recordsToInsert.push({
              participant_id: r.participant_id,
              program_instance_id: r.program_instance_id,
              line_item_id: r.line_item_id,
              amount: r.unit_price,
              status: 'billed',
              notes: `Billed on ${new Date().toISOString().split('T')[0]}`
            });

            return {
              RegistrationNumber:  registrationNumber,
              NDISNumber:          r.ndis_number || '',
              SupportsDeliveredFrom: r.activity_date,
              SupportsDeliveredTo:   r.activity_date,
              SupportNumber:       r.support_number,
              ClaimReference:      `PI${r.program_instance_id}-LI${r.line_item_id}`,
              Quantity:            0.0,
              Hours:               hours,
              UnitPrice:           r.unit_price.toFixed(2),
              GSTCode:             r.gst_code,
              AuthorisedBy:        '',
              ParticipantApproved: '',
              InKindFundingProgram: r.in_kind_funding_program || '',
              ClaimType:           r.claim_type,
              CancellationReason:  ['cancelled','no-show'].includes(r.attendance_status) ? 'C10' : '',
              ABN:                 abn
            };
          });

    const csvData = generateCsvFromData(mapped, headers);

    // 4. Insert records into billing_records to mark them as billed
    if (recordsToInsert.length > 0) {
      const placeholders = recordsToInsert.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
      const values = recordsToInsert.flatMap(rec => [
        rec.participant_id,
        rec.program_instance_id,
        rec.line_item_id,
        rec.amount,
        rec.status,
        rec.notes,
      ]);

      await new Promise((resolve, reject) =>
        db.run(
          `INSERT INTO billing_records (participant_id, program_instance_id, line_item_id, amount, status, notes) VALUES ${placeholders}`,
          values,
          (err) => (err ? reject(err) : resolve())
        )
      );
      console.log(`Successfully marked ${recordsToInsert.length} items as billed.`);
    }

    return csvData;
  } finally {
    if (db) db.close();
  }
};

/**
 * Generate a CSV for individual invoices (plan-managed participants)
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<string>} CSV formatted string
 */
const generateInvoicesCsv = async (startDate, endDate) => {
  let db;
  try {
    db = await getDbConnection();
    // Live-calculation query for unbilled invoice items
    const query = `
      WITH date_range_instances AS (
        SELECT pi.id, pi.program_id, pi.date, pi.start_time, pi.end_time, p.name AS program_name, v.name AS venue_name
        FROM program_instances pi
        JOIN programs p ON pi.program_id = p.id
        JOIN venues v ON pi.venue_id = v.id
        WHERE pi.date BETWEEN ? AND ?
      ),
      base_attendances AS (
        SELECT p.id AS participant_id, p.first_name, p.last_name, p.is_plan_managed, dri.id AS program_instance_id, dri.program_id, dri.date, dri.start_time, dri.end_time, dri.program_name, dri.venue_name
        FROM program_enrollments pe
        JOIN participants p ON pe.participant_id = p.id
        JOIN date_range_instances dri ON pe.program_id = dri.program_id
        WHERE pe.start_date <= dri.date AND (pe.end_date IS NULL OR pe.end_date >= dri.date)
      ),
      added_attendances AS (
        SELECT p.id AS participant_id, p.first_name, p.last_name, p.is_plan_managed, dri.id AS program_instance_id, dri.program_id, dri.date, dri.start_time, dri.end_time, dri.program_name, dri.venue_name
        FROM pending_enrollment_changes pec
        JOIN participants p ON pec.participant_id = p.id
        JOIN date_range_instances dri ON pec.program_id = dri.program_id
        WHERE pec.action = 'add' AND pec.effective_date <= dri.date
      ),
      removed_attendances AS (
        SELECT pec.participant_id, dri.id AS program_instance_id
        FROM pending_enrollment_changes pec
        JOIN date_range_instances dri ON pec.program_id = dri.program_id
        WHERE pec.action = 'remove' AND pec.effective_date <= dri.date
      ),
      final_attendances AS (
        SELECT * FROM base_attendances
        UNION
        SELECT * FROM added_attendances
      )
      SELECT DISTINCT
          fa.participant_id,
          fa.first_name,
          fa.last_name,
          fa.program_instance_id,
          fa.date AS activity_date,
          fa.program_name,
          fa.start_time,
          fa.end_time,
          fa.venue_name,
          rli.id AS line_item_id,
          rli.unit_price AS amount,
          rli.support_number,
          rli.description AS line_item_description,
          COALESCE(att.status, 'confirmed') AS attendance_status,
          COALESCE(att.notes, '') AS notes
      FROM final_attendances fa
      JOIN rate_line_items rli ON fa.program_id = rli.program_id
      LEFT JOIN attendance att ON fa.participant_id = att.participant_id AND fa.program_instance_id = att.program_instance_id
      /* join to billing_records so we can exclude already-billed items */
      LEFT JOIN billing_records br
             ON  br.participant_id      = fa.participant_id
            AND br.program_instance_id = fa.program_instance_id
            AND br.line_item_id        = rli.id
      WHERE
          fa.is_plan_managed = 1
          AND NOT EXISTS (
              SELECT 1 FROM removed_attendances ra
              WHERE ra.participant_id = fa.participant_id AND ra.program_instance_id = fa.program_instance_id
          )
          /* only keep rows that have **no** billing record yet */
          AND br.id IS NULL
      ORDER BY fa.participant_id, fa.date, fa.start_time;
    `;
    
    const rows = await new Promise((resolve, reject) =>
      db.all(query, [startDate, endDate], (err, r) => (err ? reject(err) : resolve(r)))
    );

    console.log('Invoices query returned', rows.length, 'unbilled items');
      
      const recordsToInsert = [];
      
      // Group by participant
      const participantGroups = {};
      rows.forEach(row => {
        const participantId = row.participant_id;
        if (!participantGroups[participantId]) {
          participantGroups[participantId] = {
            participant_id: participantId,
            first_name: row.first_name,
            last_name: row.last_name,
            invoice_date: new Date().toISOString().split('T')[0],
            total_amount: 0,
            items: []
          };
        }
        
        participantGroups[participantId].items.push(row);
        participantGroups[participantId].total_amount += row.amount;
        
        recordsToInsert.push({
          participant_id: row.participant_id,
          program_instance_id: row.program_instance_id,
          line_item_id: row.line_item_id,
          amount: row.amount,
          status: 'billed',
          notes: `Billed on ${new Date().toISOString().split('T')[0]}`
        });
      });
      
      // Flatten the data for CSV
      const csvRows = [];
      Object.values(participantGroups).forEach(group => {
        csvRows.push({
          record_type: 'INVOICE',
          participant_id: group.participant_id,
          first_name: group.first_name,
          last_name: group.last_name,
          invoice_date: group.invoice_date,
          total_amount: group.total_amount.toFixed(2),
          item_count: group.items.length
        });
        
        group.items.forEach(item => {
          csvRows.push({
            record_type: 'LINE_ITEM',
            participant_id: group.participant_id,
            first_name: group.first_name,
            last_name: group.last_name,
            activity_date: item.activity_date,
            program_name: item.program_name,
            start_time: item.start_time,
            end_time: item.end_time,
            venue_name: item.venue_name,
            support_number: item.support_number,
            line_item_description: item.line_item_description,
            amount: item.amount.toFixed(2),
            attendance_status: item.attendance_status,
            is_cancelled: ['cancelled','no-show'].includes(item.attendance_status) ? 'Yes' : 'No',
            notes: item.notes
          });
        });
      });
      
      const headers = [
        { id: 'record_type', title: 'Record Type' },
        { id: 'participant_id', title: 'Participant ID' },
        { id: 'first_name', title: 'First Name' },
        { id: 'last_name', title: 'Last Name' },
        { id: 'invoice_date', title: 'Invoice Date' },
        { id: 'total_amount', title: 'Total Amount' },
        { id: 'item_count', title: 'Item Count' },
        { id: 'activity_date', title: 'Activity Date' },
        { id: 'program_name', title: 'Program' },
        { id: 'start_time', title: 'Start Time' },
        { id: 'end_time', title: 'End Time' },
        { id: 'venue_name', title: 'Venue' },
        { id: 'support_number', title: 'Support Number' },
        { id: 'line_item_description', title: 'Description' },
        { id: 'amount', title: 'Amount' },
        { id: 'attendance_status', title: 'Status' },
        { id: 'is_cancelled', title: 'Late Cancellation' },
        { id: 'notes', title: 'Notes' }
      ];
      
    const csvData = generateCsvFromData(csvRows, headers);

    // Mark these records as billed
    if (recordsToInsert.length > 0) {
      const placeholders = recordsToInsert.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
      const values = recordsToInsert.flatMap(rec => [
        rec.participant_id,
        rec.program_instance_id,
        rec.line_item_id,
        rec.amount,
        rec.status,
        rec.notes,
      ]);

      await new Promise((resolve, reject) =>
        db.run(
          `INSERT INTO billing_records (participant_id, program_instance_id, line_item_id, amount, status, notes) VALUES ${placeholders}`,
          values,
          (err) => (err ? reject(err) : resolve())
        )
      );
      console.log(`Successfully marked ${recordsToInsert.length} items as billed.`);
    }

    return csvData;
  } finally {
    if (db) db.close();
  }
};

module.exports = {
  generateBillingCsv,
  generateInvoicesCsv
};
