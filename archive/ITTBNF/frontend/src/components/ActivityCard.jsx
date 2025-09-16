import React from 'react';

/**
 * A reusable card component to display an activity (program or bus run) on the dashboard.
 * @param {object} props - The component props.
 * @param {object} props.activity - The activity data object.
 * @param {function} props.onClick - The function to call when the card is clicked.
 */
const ActivityCard = ({ activity, onClick }) => {
    // Use the vehicle's registration number for the title if it's a bus run, otherwise use the program name.
    const title = activity.type === 'bus_run' 
        ? `Bus Run - ${activity.vehicles[0]?.rego || `V${activity.vehicles[0]?.id}`}` 
        : activity.program_name;

    return (
        <div
            className={`activity-card ${activity.type === 'bus_run' ? 'bus-run' : ''}`}
            onClick={() => onClick(activity)}
            style={{ cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => e.key === 'Enter' && onClick(activity)}
        >
            <h4>{title}</h4>
            <p>{activity.start_time} - {activity.end_time}</p>
            <div className="card-summary">
                {/* For bus runs, participants are the passengers. For programs, they are all attendees. */}
                <span>👥 {activity.participants.length}</span>
                
                {/* Only show staff count for main program events, not individual bus runs */}
                {activity.type === 'program' && <span>🧑‍💼 {activity.staff.length}</span>}
                
                {/* For bus runs, this will always be 1. For programs, it's the total number of buses. */}
                <span>🚌 {activity.vehicles.length}</span>
            </div>
        </div>
    );
};

export default ActivityCard;
