import { useState } from 'react';

const DailyTracker = ({ logs, weeklySummary, onCreate }) => {
  const [logText, setLogText] = useState('');
  const [hoursWorked, setHoursWorked] = useState(0);
  const [tasksTouched, setTasksTouched] = useState('');

  return (
    <div className="view-stack">
      <div className="card">
        <p className="section-title">Daily Tracker</p>
        <p className="section-subtitle">Log what you worked on today.</p>
        <textarea className="description-input" value={logText} onChange={(event) => setLogText(event.target.value)} placeholder="Describe today's progress..." />
        <div className="form-grid">
          <input className="search-input" type="number" min="0" step="0.5" value={hoursWorked} onChange={(event) => setHoursWorked(Number(event.target.value || 0))} placeholder="Hours worked" />
          <input className="search-input" value={tasksTouched} onChange={(event) => setTasksTouched(event.target.value)} placeholder="Tasks touched (comma separated)" />
        </div>
        <div className="card-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onCreate({
                log_text: logText,
                hours_worked: hoursWorked,
                tasks_touched: String(tasksTouched || '').split(',').map((item) => item.trim()).filter(Boolean),
              });
              setLogText('');
              setHoursWorked(0);
              setTasksTouched('');
            }}
          >
            Save Log
          </button>
        </div>
      </div>

      <div className="card">
        <p className="section-title small">Weekly Summary</p>
        <div className="chip-row dense">
          {Object.entries(weeklySummary || {}).map(([week, hours]) => (
            <span key={week} className="chip neutral">{week}: {Number(hours).toFixed(1)}h</span>
          ))}
        </div>
      </div>

      <div className="view-stack">
        {(logs || []).map((log) => (
          <div key={log.id} className="card">
            <p className="section-title small">{log.log_date}</p>
            <p className="dataset-meta">{log.log_text}</p>
            <p className="dataset-meta">Hours: {log.hours_worked}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailyTracker;
