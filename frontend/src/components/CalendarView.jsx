import React, { useState } from 'react';
import '../styles/CalendarView.css';
import Modal from './Modal';

// Helper to format a date object into a 'YYYY-MM-DD' string
const toISOString = (date) => date.toISOString().split('T')[0];

const CalendarView = ({ scheduleData, weekDates }) => {
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    /* ------------------------------------------------------------------
     * Modal state for detailed instance view
     * ---------------------------------------------------------------- */
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);

    const handleEventClick = (instance) => {
        setSelectedEvent(instance);
        setIsModalOpen(true);
    };

    if (!scheduleData) {
        return <p>Loading schedule...</p>;
    }

    return (
        <>
        <div className="calendar-container">
            {/* Calendar Header */}
            <div className="calendar-header">
                {weekDates.map(date => (
                    <div key={date.toString()} className="day-header">
                        <strong>{DAY_NAMES[date.getDay()]}</strong>
                        <span className="date-number">{date.getDate()}</span>
                    </div>
                ))}
            </div>

            {/* Calendar Body */}
            <div className="calendar-body">
                {weekDates.map(date => {
                    // Filter and sort instances for the current day
                    const instancesForDay = scheduleData
                        .filter(instance => instance.date === toISOString(date))
                        .sort((a, b) => a.start_time.localeCompare(b.start_time));

                    return (
                        <div key={date.toString()} className="day-column">
                            {instancesForDay.length > 0 ? (
                                instancesForDay.map(instance => (
                                    <div
                                        key={instance.id}
                                        className={`event-card${instance.staffingStatus === 'understaffed' ? ' understaffed' : ''}`}
                                        onClick={() => handleEventClick(instance)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="event-title">{instance.program_name}</div>
                                        <div className="event-time">{instance.start_time} - {instance.end_time}</div>
                                        <div className="event-venue">{instance.venue_name}</div>
                                        <div className="event-details">
                                            <span>P: {instance.participants.length}</span>
                                            <span>S: {instance.staff.length} / {instance.requiredStaffCount}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-events"></div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* ------------------------------------------------------------------
         * Modal showing full event details
         * ---------------------------------------------------------------- */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
            {selectedEvent && (
                <>
                    <h2 style={{ marginTop: 0 }}>{selectedEvent.program_name}</h2>
                    <p>
                        <strong>Date:</strong> {selectedEvent.date}<br />
                        <strong>Time:</strong> {selectedEvent.start_time} - {selectedEvent.end_time}<br />
                        <strong>Venue:</strong> {selectedEvent.venue_name}
                    </p>

                    {/* Participants */}
                    <h3>Participants ({selectedEvent.participants.length})</h3>
                    <ul>
                        {selectedEvent.participants.map((p) => (
                            <li key={p.id}>
                                {p.first_name} {p.last_name} ({p.status})
                            </li>
                        ))}
                    </ul>

                    {/* Staff */}
                    <h3>
                        Staff ({selectedEvent.staff.length} / {selectedEvent.requiredStaffCount})
                    </h3>
                    <ul>
                        {selectedEvent.staff.map((s) => (
                            <li key={s.id}>
                                {s.first_name} {s.last_name} ({s.role})
                            </li>
                        ))}
                    </ul>

                    {/* Vehicles */}
                    {selectedEvent.vehicles && selectedEvent.vehicles.length > 0 && (
                        <>
                            <h3>Vehicles ({selectedEvent.vehicles.length})</h3>
                            <ul>
                                {selectedEvent.vehicles.map((v) => (
                                    <li key={v.id}>
                                        {v.description} – Driver:{' '}
                                        {v.driver_first_name ? v.driver_first_name : 'Unassigned'}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </>
            )}
        </Modal>
        </>
    );
};

export default CalendarView;
