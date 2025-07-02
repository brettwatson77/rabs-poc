// backend/services/recalculationService.js
const db = require('../database');
// Fallback routing/nearest-neighbour engine
const { calculateRoute } = require('./routingService');

/**
 * Processes all pending enrollment changes up to a given simulated date.
 * @param {string} simulatedDate - The current simulated date in 'YYYY-MM-DD' format.
 * @returns {Promise<string[]>} A promise that resolves to an array of unique dates that were affected.
 */
const processPendingChanges = (simulatedDate) => {
    return new Promise((resolve, reject) => {
        const affectedDates = new Set();

        db.serialize(() => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) return reject(err);

                const query = `SELECT * FROM pending_enrollment_changes WHERE status = 'pending' AND effective_date <= ?`;

                db.all(query, [simulatedDate], (err, changes) => {
                    if (err) {
                        return db.run('ROLLBACK', () => reject(err));
                    }

                    if (changes.length === 0) {
                        return db.run('COMMIT', () => resolve([]));
                    }

                    let processedCount = 0;
                    const totalChanges = changes.length;

                    changes.forEach(change => {
                        const { id, participant_id, program_id, action, effective_date } = change;
                        affectedDates.add(effective_date); // Track date for recalculation

                        const processAction = (callback) => {
                            if (action === 'add') {
                                // Add a new enrollment starting from the effective date
                                const insertQuery = `INSERT INTO program_enrollments (participant_id, program_id, start_date) VALUES (?, ?, ?)`;
                                db.run(insertQuery, [participant_id, program_id, effective_date], callback);
                            } else if (action === 'remove') {
                                // End the current enrollment on the day before the effective date
                                const endDate = new Date(effective_date);
                                endDate.setDate(endDate.getDate() - 1);
                                const endDateString = endDate.toISOString().split('T')[0];

                                const updateQuery = `UPDATE program_enrollments SET end_date = ? WHERE participant_id = ? AND program_id = ? AND (end_date IS NULL OR end_date > ?)`;
                                db.run(updateQuery, [endDateString, participant_id, program_id, endDateString], callback);
                            } else {
                                callback(); // No action to take
                            }
                        };

                        processAction((err) => {
                            if (err) {
                                return db.run('ROLLBACK', () => reject(err));
                            }

                            // Mark the change as processed
                            db.run(`UPDATE pending_enrollment_changes SET status = 'processed' WHERE id = ?`, [id], (err) => {
                                if (err) {
                                    return db.run('ROLLBACK', () => reject(err));
                                }

                                processedCount++;
                                if (processedCount === totalChanges) {
                                    db.run('COMMIT', (err) => {
                                        if (err) return reject(err);
                                        resolve(Array.from(affectedDates));
                                    });
                                }
                            });
                        });
                    });
                });
            });
        });
    });
};

/**
 * Recalculates and re-assigns staff and vehicles for all program instances on a specific date.
 * @param {string} date - The date to recalculate resources for, in 'YYYY-MM-DD' format.
 * @returns {Promise<void>}
 */
const recalculateResourcesForDate = (date) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Get all program instances for the given date
            const instances = await new Promise((res, rej) => {
                db.all(`SELECT * FROM program_instances WHERE date = ?`, [date], (err, rows) => err ? rej(err) : res(rows));
            });

            for (const instance of instances) {
                await new Promise((resolveInstance, rejectInstance) => {
                    db.serialize(async () => {
                        try {
                            db.run('BEGIN TRANSACTION');

                            // Clear existing assignments for this instance
                            await new Promise((res, rej) => db.run(`DELETE FROM staff_assignments WHERE program_instance_id = ?`, [instance.id], (err) => err ? rej(err) : res()));
                            await new Promise((res, rej) => db.run(`DELETE FROM vehicle_assignments WHERE program_instance_id = ?`, [instance.id], (err) => err ? rej(err) : res()));

                            // Get new list of confirmed participants
                            const participants = await new Promise((res, rej) => {
                                const query = `SELECT * FROM attendance WHERE program_instance_id = ? AND status = 'confirmed'`;
                                db.all(query, [instance.id], (err, rows) => err ? rej(err) : res(rows));
                            });

                            if (participants.length > 0) {
                                // Recalculate and assign staff
                                const requiredStaffCount = Math.ceil(participants.length / 4);
                                const program = await new Promise((res, rej) => db.get(`SELECT * FROM programs WHERE id = ?`, [instance.program_id], (err, row) => err ? rej(err) : res(row)));
                                
                                const availableStaff = await new Promise((res, rej) => {
                                    const staffQuery = `
                                        SELECT staff_id FROM staff_availability 
                                        WHERE day_of_week = ? AND start_time <= ? AND end_time >= ?`;
                                    db.all(staffQuery, [program.day_of_week, instance.start_time, instance.end_time], (err, rows) => err ? rej(err) : res(rows));
                                });
                                
                                const assignedStaffIds = availableStaff.slice(0, requiredStaffCount).map(s => s.staff_id);
                                for (const staffId of assignedStaffIds) {
                                    await new Promise((res, rej) => db.run(`INSERT INTO staff_assignments (staff_id, program_instance_id) VALUES (?, ?)`, [staffId, instance.id], (err) => err ? rej(err) : res()));
                                }

                                // Recalculate and assign vehicles (placeholder logic)
                                const participantsNeedingTransport = participants.filter(
                                    (p) => p.pickup_required || p.dropoff_required
                                );
                                const requiredVehicleCount = Math.ceil(participantsNeedingTransport.length / 4);
                                const availableVehicles = await new Promise((res, rej) => db.all(`SELECT id FROM vehicles`, [], (err, rows) => err ? rej(err) : res(rows)));
                                const assignedVehicleIds = availableVehicles.slice(0, requiredVehicleCount).map(v => v.id);

                                for (const vehicleId of assignedVehicleIds) {
                                    const vehicleAssignmentId = await new Promise((res, rej) =>
                                        db.run(
                                            `INSERT INTO vehicle_assignments (vehicle_id, program_instance_id) VALUES (?, ?)`,
                                            [vehicleId, instance.id],
                                            function (err) {
                                                if (err) return rej(err);
                                                return res(this.lastID);
                                            }
                                        )
                                    );

                                    /* -------------------------------------------------------
                                     * Build simple pickup route using nearest-neighbour
                                     * ---------------------------------------------------- */
                                    const venueInfo = await new Promise((res, rej) =>
                                        db.get(
                                            `SELECT latitude, longitude, address, suburb, postcode 
                                             FROM venues WHERE id = ?`,
                                            [instance.venue_id],
                                            (err, row) => (err ? rej(err) : res(row))
                                        )
                                    );

                                    // Simple round-robin split of participants across vehicles
                                    const vehicleIndex = assignedVehicleIds.indexOf(vehicleId);
                                    const vehicleParticipants = participantsNeedingTransport.filter(
                                        (_, idx) => idx % assignedVehicleIds.length === vehicleIndex
                                    );

                                    if (vehicleParticipants.length === 0) continue; // nothing to route

                                    const stops = [
                                        {
                                            latitude: venueInfo?.latitude,
                                            longitude: venueInfo?.longitude,
                                            meta: { venue: true }
                                        },
                                        ...vehicleParticipants.map((p) => ({
                                            latitude: p.latitude,
                                            longitude: p.longitude,
                                            meta: { participant_id: p.participant_id, address: p.address, suburb: p.suburb, postcode: p.postcode }
                                        }))
                                    ];

                                    const routeCalc = calculateRoute(stops);

                                    // Insert route header
                                    const routeId = await new Promise((res, rej) =>
                                        db.run(
                                            `INSERT INTO routes (vehicle_assignment_id, route_type, estimated_duration, estimated_distance)
                                             VALUES (?, 'pickup', ?, ?)`,
                                            [vehicleAssignmentId, routeCalc.totalDuration, routeCalc.totalDistance],
                                            function (err) {
                                                if (err) return rej(err);
                                                return res(this.lastID);
                                            }
                                        )
                                    );

                                    // Persist ordered stops
                                    for (let s = 0; s < routeCalc.orderedRoute.length; s++) {
                                        const stop = routeCalc.orderedRoute[s];
                                        if (stop.meta.venue) {
                                            await new Promise((res, rej) =>
                                                db.run(
                                                    `INSERT INTO route_stops (route_id, stop_order, venue_id, address, suburb, postcode)
                                                     VALUES (?, ?, ?, ?, ?, ?)`,
                                                    [
                                                        routeId,
                                                        s + 1,
                                                        instance.venue_id,
                                                        venueInfo.address,
                                                        venueInfo.suburb,
                                                        venueInfo.postcode
                                                    ],
                                                    (err) => (err ? rej(err) : res())
                                                )
                                            );
                                        } else {
                                            await new Promise((res, rej) =>
                                                db.run(
                                                    `INSERT INTO route_stops (route_id, stop_order, participant_id, address, suburb, postcode)
                                                     VALUES (?, ?, ?, ?, ?, ?)`,
                                                    [
                                                        routeId,
                                                        s + 1,
                                                        stop.meta.participant_id,
                                                        stop.meta.address,
                                                        stop.meta.suburb,
                                                        stop.meta.postcode
                                                    ],
                                                    (err) => (err ? rej(err) : res())
                                                )
                                            );
                                        }
                                    }
                                }
                            }
                            
                            db.run('COMMIT', resolveInstance);
                        } catch (error) {
                            db.run('ROLLBACK', () => rejectInstance(error));
                        }
                    });
                });
            }
            resolve();
        } catch (error) {
            reject(error);
        }
    });
};


/**
 * Main entry point function to trigger the entire recalculation process.
 * @param {string} simulatedDate - The current simulated date from the UI.
 * @returns {Promise<Object>} A summary of the actions taken.
 */
const triggerRecalculation = async (simulatedDate) => {
    console.log(`Triggering recalculation for date: ${simulatedDate}`);
    const affectedDates = await processPendingChanges(simulatedDate);

    if (affectedDates.length > 0) {
        console.log(`Enrollments changed. Recalculating resources for dates: ${affectedDates.join(', ')}`);
        for (const date of affectedDates) {
            await recalculateResourcesForDate(date);
        }
        return {
            message: 'Pending changes processed and resources recalculated.',
            recalculated_dates: affectedDates
        };
    } else {
        console.log('No pending enrollment changes to process.');
        return {
            message: 'No pending enrollment changes to process.',
            recalculated_dates: []
        };
    }
};

module.exports = {
    triggerRecalculation,
    processPendingChanges,
    recalculateResourcesForDate
};
