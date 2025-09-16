import React from 'react';
import { useAppContext } from '../context/AppContext';
import { resetSystemData } from '../api/api';

const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: '#edf2f7',
    borderBottom: '1px solid #e2e8f0',
};

const titleStyles = {
    margin: 0,
    fontSize: '1.5rem',
    color: '#2d3748',
};

const Header = () => {
    // Logic from DateSlider component is now here
    const { simulatedDate, setSimulatedDate } = useAppContext();

    // --- datetime-local picker handler ---
    const handleDateTimeChange = (e) => {
        const value = e.target.value; // "YYYY-MM-DDTHH:MM"
        if (!value) return;

        // Manual parse to avoid timezone / locale edge-cases
        const [dPart, tPart] = value.split('T');
        if (!dPart || !tPart) return;

        const [yyyy, mm, dd] = dPart.split('-').map(Number);
        const [hh, min]      = tPart.split(':').map(Number);

        // month is zero-based in JS Date
        const parsed = new Date(yyyy, mm - 1, dd, hh, min, 0, 0);
        parsed.setSeconds(0, 0); // just to be explicit
        setSimulatedDate(parsed);
    };

    /* ---------------------------------------------------------------
     * Format simulated date in LOCAL time for the <datetime-local> input
     * Chrome/Edge expect "YYYY-MM-DDTHH:mm" in the user's locale, not UTC.
     * Using ISO string (UTC) caused an apparent “drift” when typing.
     * ------------------------------------------------------------- */
    const pad = (n) => String(n).padStart(2, '0');
    const year    = simulatedDate.getFullYear();
    const month   = pad(simulatedDate.getMonth() + 1); // getMonth() is zero-based
    const day     = pad(simulatedDate.getDate());
    const hours   = pad(simulatedDate.getHours());
    const minutes = pad(simulatedDate.getMinutes());
    const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`;

    // Handler for resetting all data (POC convenience button)
    const handleReset = async () => {
        // eslint-disable-next-line no-alert
        if (window.confirm('This will wipe all current data and restore the original seed data. Continue?')) {
            try {
                await resetSystemData();
                // Hard-reload the page so all React state is cleared
                window.location.reload();
            } catch (err) {
                // eslint-disable-next-line no-alert
                alert('Failed to reset system data.  See console for details.');
                // eslint-disable-next-line no-console
                console.error(err);
            }
        }
    };

    return (
        <header style={headerStyles}>
            <h1 style={titleStyles}>RABS-POC Dashboard</h1>
            
            {/* JSX from DateSlider component is now here */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label htmlFor="datetime-picker" style={{ fontWeight: 'bold', color: '#2d3748' }}>
                    Simulated Date &amp; Time:
                </label>
                <input
                    type="datetime-local"
                    id="datetime-picker"
                    value={dateTimeString}
                    onChange={handleDateTimeChange}
                    style={{
                        padding: '5px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        backgroundColor: '#fff',
                        color: '#333'
                    }}
                />
                {/* Reset button (POC helper) */}
                <button
                    type="button"
                    onClick={handleReset}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: '#e53e3e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Reset System Data
                </button>

                {/* Jump-to-now button */}
                <button
                    type="button"
                    onClick={() => setSimulatedDate(new Date())}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: '#2b6cb0',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginLeft: '6px'
                    }}
                >
                    Now
                </button>
            </div>
        </header>
    );
};

export default Header;
