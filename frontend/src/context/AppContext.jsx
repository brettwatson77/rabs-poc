import React, { createContext, useState, useContext, useEffect } from 'react';
import { processPendingChanges } from '../api/api'; // commit & recalc when date changes

// 1. Create the context
const AppContext = createContext();

// 2. Create the provider component
export const AppContextProvider = ({ children }) => {
    // State for the simulated date, initialized to today's date
    const [simulatedDate, setSimulatedDate] = useState(new Date());

    // The value that will be supplied to all consuming components
    const value = {
        simulatedDate,
        setSimulatedDate
    };

    /* ------------------------------------------------------------------
     * Trigger backend recalculation whenever the simulated date changes
     * ---------------------------------------------------------------- */
    useEffect(() => {
        // Convert Date object to YYYY-MM-DD for the API
        const isoStr = simulatedDate.toISOString().split('T')[0];
        // Fire-and-forget – frontend does not need the response here
        processPendingChanges(isoStr).catch((err) =>
            // eslint-disable-next-line no-console
            console.error('Recalculation error:', err)
        );
    }, [simulatedDate]);

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

// 3. Create a custom hook for easy consumption of the context
export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppContextProvider');
    }
    return context;
};
