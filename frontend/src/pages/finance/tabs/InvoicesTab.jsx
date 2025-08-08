import React from 'react';
import MonthNavigation from '../components/MonthNavigation';

export default function InvoicesTab({ selectedMonth, onPrevMonth, onCurrentMonth, onNextMonth }) {
  return (
    <div className="tab-content">
      <MonthNavigation selectedMonth={selectedMonth} onPrev={onPrevMonth} onCurrent={onCurrentMonth} onNext={onNextMonth} />
      <div className="glass-card" style={{ marginTop: 16 }}>
        <h3>Invoices</h3>
        <p>Invoice generation and NDIS claiming coming soon.</p>
      </div>
    </div>
  );
}
