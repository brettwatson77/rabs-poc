// backend/services/financeService.js
const db = require('../database');

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
        ? '""' 
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
const generateBillingCsv = (startDate, endDate) => {
  return new Promise((resolve, reject) => {
    /* ------------------------------------------------------------------
     * 1. Retrieve provider RegistrationNumber & ABN from settings table
     * ------------------------------------------------------------------ */
    db.all(
      `SELECT key, value FROM settings WHERE key IN ('ndis_registration_number','abn')`,
      [],
      (err, settingsRows) => {
        if (err) {
          reject(err);
          return;
        }

        const settings = settingsRows.reduce((acc, s) => {
          acc[s.key] = s.value;
          return acc;
        }, {});

        const registrationNumber = settings['ndis_registration_number'] || '';
        const abn = settings['abn'] || '';

        /* ------------------------------------------------------------------
         * 2. Main billing query – join to rate_line_items (rli)
         * ------------------------------------------------------------------ */
        const query = `
          SELECT
            br.id               AS billing_id,
            p.ndis_number       AS ndis_number,
            p.first_name,
            p.last_name,
            pi.date             AS activity_date,
            pi.start_time,
            pi.end_time,
            rli.support_number,
            rli.unit_price,
            rli.gst_code,
            rli.in_kind_funding_program,
            rli.claim_type,
            a.status            AS attendance_status
          FROM billing_records br
          JOIN participants p       ON br.participant_id = p.id
          JOIN program_instances pi ON br.program_instance_id = pi.id
          JOIN rate_line_items rli  ON br.line_item_id = rli.id
          JOIN attendance a         ON a.participant_id = br.participant_id
                                    AND a.program_instance_id = br.program_instance_id
          WHERE p.is_plan_managed = 0
            AND pi.date BETWEEN ? AND ?
            AND br.status = 'unbilled'
          ORDER BY pi.date, pi.start_time, p.last_name, p.first_name
        `;
    
        db.all(query, [startDate, endDate], (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          // Debug: how many billing rows were returned
          console.log('Billing query returned', rows.length, 'rows');

          /* ----------------------------------------------------------------
           * 3. Map DB rows to NDIS bulk upload structure
           * ---------------------------------------------------------------- */
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

          const mapped = rows.map(r => {
            const start = new Date(`${r.activity_date}T${r.start_time}:00`);
            const end   = new Date(`${r.activity_date}T${r.end_time}:00`);
            const hours = ((end - start) / 3600000).toFixed(2);

            return {
              RegistrationNumber:  registrationNumber,
              NDISNumber:          r.ndis_number || '',
              SupportsDeliveredFrom: r.activity_date,
              SupportsDeliveredTo:   r.activity_date,
              SupportNumber:       r.support_number,
              ClaimReference:      r.billing_id,
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

          // Generate CSV
          const csvData = generateCsvFromData(mapped, headers);

          /* ----------------------------------------------------------------
           * 4. Mark billed records
           * ---------------------------------------------------------------- */
          if (rows.length > 0) {
            const billingIds = rows.map(row => row.billing_id);
            const placeholders = billingIds.map(() => '?').join(',');

            db.run(
              `UPDATE billing_records SET status = 'billed' WHERE id IN (${placeholders})`,
              billingIds,
              (err) => {
                if (err) {
                  console.error('Error updating billing status:', err);
                }
              }
            );
          }

          resolve(csvData);
        });
      }
    );
  });
};

/**
 * Generate a CSV for individual invoices (plan-managed participants)
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<string>} CSV formatted string
 */
const generateInvoicesCsv = (startDate, endDate) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT
        br.id AS billing_id,
        p.id AS participant_id,
        p.first_name,
        p.last_name,
        pi.date AS activity_date,
        prog.name AS program_name,
        pi.start_time,
        pi.end_time,
        v.name AS venue_name,
        br.amount,
        rli.support_number,
        rli.description AS line_item_description,
        a.status AS attendance_status,
        CASE
          WHEN a.status = 'cancelled' THEN 'Yes'
          ELSE 'No'
        END AS is_cancelled,
        br.notes
      FROM billing_records br
      JOIN participants p ON br.participant_id = p.id
      JOIN program_instances pi ON br.program_instance_id = pi.id
      JOIN programs prog ON pi.program_id = prog.id
      JOIN venues v ON pi.venue_id = v.id
      JOIN rate_line_items rli ON br.line_item_id = rli.id
      JOIN attendance a ON br.participant_id = a.participant_id AND br.program_instance_id = a.program_instance_id
      WHERE p.is_plan_managed = 1
        AND pi.date BETWEEN ? AND ?
        AND br.status = 'unbilled'
      ORDER BY p.id, p.last_name, p.first_name, pi.date, pi.start_time
    `;
    
    db.all(query, [startDate, endDate], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      // Debug: how many invoice rows were returned
      console.log('Invoices query returned', rows.length, 'rows');
      
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
      });
      
      // Flatten the data for CSV
      const csvRows = [];
      Object.values(participantGroups).forEach(group => {
        // Add invoice header row
        csvRows.push({
          record_type: 'INVOICE',
          participant_id: group.participant_id,
          first_name: group.first_name,
          last_name: group.last_name,
          invoice_date: group.invoice_date,
          total_amount: group.total_amount.toFixed(2),
          item_count: group.items.length
        });
        
        // Add line items
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
            is_cancelled: item.is_cancelled,
            notes: item.notes,
            billing_id: item.billing_id
          });
        });
      });
      
      // Define CSV headers
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
        { id: 'notes', title: 'Notes' },
        { id: 'billing_id', title: 'Billing ID' }
      ];
      
      // Generate CSV
      const csvData = generateCsvFromData(csvRows, headers);
      
      // Mark these records as billed
      if (rows.length > 0) {
        const billingIds = rows.map(row => row.billing_id);
        const placeholders = billingIds.map(() => '?').join(',');
        
        db.run(
          `UPDATE billing_records SET status = 'billed' WHERE id IN (${placeholders})`,
          billingIds,
          (err) => {
            if (err) {
              console.error('Error updating billing status:', err);
            }
          }
        );
      }
      
      resolve(csvData);
    });
  });
};

module.exports = {
  generateBillingCsv,
  generateInvoicesCsv
};
