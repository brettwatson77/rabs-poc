import React from 'react';
import { useAppContext } from '../context/AppContext';

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

    const handleDateChange = (e) => {
        const newDate = new Date(`${e.target.value}T00:00:00`);
        setSimulatedDate(newDate);
    };

    const dateString = simulatedDate.toISOString().split('T')[0];

    return (
        <header style={headerStyles}>
            <h1 style={titleStyles}>RABS-POC Dashboard</h1>
            
            {/* JSX from DateSlider component is now here */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label htmlFor="date-slider" style={{ fontWeight: 'bold', color: '#2d3748' }}>
                    Simulated Date:
                </label>
                <input
                    type="date"
                    id="date-slider"
                    value={dateString}
                    onChange={handleDateChange}
                    style={{
                        padding: '5px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        backgroundColor: '#fff',
                        color: '#333'
                    }}
                />
            </div>
        </header>
    );
};

export default Header;
