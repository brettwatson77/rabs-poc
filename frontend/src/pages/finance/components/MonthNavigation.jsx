import React from 'react';
import { format } from 'date-fns';

export default function MonthNavigation({ selectedMonth, onPrev, onCurrent, onNext }) {
  return (
    <div className="month-nav">
      <button className="btn" onClick={onPrev}>&lt;</button>
      <span className="month-label">{format(selectedMonth, 'MMMM yyyy')}</span>
      <button className="btn" onClick={onNext}>&gt;</button>
      <button className="btn" onClick={onCurrent}>Current Month</button>
    </div>
  );
}
