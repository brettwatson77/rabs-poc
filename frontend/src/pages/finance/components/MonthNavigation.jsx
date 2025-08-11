import React from 'react';
import { format } from 'date-fns';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';

export default function MonthNavigation({ selectedMonth, onPrev, onCurrent, onNext }) {
  return (
    <div className="month-nav">
      <button className="nav-button" onClick={onPrev}>
        <FiArrowLeft /> Prev
      </button>
      <span className="month-label">{format(selectedMonth, 'MMMM yyyy')}</span>
      <button className="nav-button" onClick={onNext}>
        Next <FiArrowRight />
      </button>
      <button className="nav-button" onClick={onCurrent}>
        Current Month
      </button>
    </div>
  );
}
