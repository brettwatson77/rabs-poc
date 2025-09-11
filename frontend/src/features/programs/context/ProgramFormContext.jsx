import React, { createContext, useContext } from 'react';

const ProgramFormContext = createContext(null);

export const ProgramFormProvider = ({ value, children }) => {
  return (
    <ProgramFormContext.Provider value={value}>
      {children}
    </ProgramFormContext.Provider>
  );
};

export const useProgramForm = () => {
  const ctx = useContext(ProgramFormContext);
  return ctx;
};

export default ProgramFormContext;
