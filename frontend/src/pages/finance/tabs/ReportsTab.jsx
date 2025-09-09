import React from 'react';
import { format } from 'date-fns';
import MonthNavigation from '../components/MonthNavigation';

export default function ReportsTab({
    selectedMonth,
  reportLoading,
  onPrevMonth,
  onCurrentMonth,
  onNextMonth,
  onRefetch,
}) {
  return (
    <div className="tab-content">
      <div className="control-row">
        <MonthNavigation
          selectedMonth={selectedMonth}
          onPrev={onPrevMonth}
          onCurrent={onCurrentMonth}
          onNext={onNextMonth}
        />
        <button className="btn" onClick={onRefetch}>Refresh</button>
      </div>

      <div className="report-container glass-card">
        <h3>Participant Summary - {format(selectedMonth, 'MMMM yyyy')}</h3>
        {reportLoading && <p>Loading report...</p>}
        {!reportLoading && (
          <div className="coming-soon">
            <p style={{ margin: 0 }}>
              Reports and visual analytics are coming soon. In the meantime you
              can refresh to check for updates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
