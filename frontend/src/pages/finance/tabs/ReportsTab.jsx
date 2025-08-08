import React from 'react';
import { format } from 'date-fns';
import MonthNavigation from '../components/MonthNavigation';

export default function ReportsTab({
    selectedMonth,
  reportData,
  reportLoading,
  reportError,
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
        {reportError && <p className="error">Error loading report</p>}
        {!reportLoading && !reportError && (
          <pre className="report-json">
            {JSON.stringify(reportData, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
