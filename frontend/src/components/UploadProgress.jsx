const STEP_LABELS = [
  'File detected',
  'Format identified',
  'Columns mapped',
  'Skills parsed',
  'Missing fields generated',
  'Saving to database',
  'Rebuilding cache',
  'Rebuilding AI prompt',
  'Syncing platform',
];

const UploadProgress = ({ active, status }) => {
  if (!active) {
    return null;
  }

  const percent = status?.percent || 0;
  const completedSteps = Math.min(STEP_LABELS.length, Math.floor((percent / 100) * STEP_LABELS.length));

  return (
    <div className="card">
      <p className="section-title small">Bulk Upload in Progress</p>
      <div className="progress-track">
        <div className="progress-fill safe" style={{ '--progress-scale': percent / 100 }} />
      </div>
      <p className="dataset-meta">{percent}% complete</p>
      <div className="assignment-list">
        {STEP_LABELS.map((label, index) => {
          const done = index < completedSteps;
          return (
            <div key={label} className="assignment-item small">
              <p className="assignment-name">{done ? '✅' : '⏳'} {label}</p>
              <span className="assignment-deadline">{done ? 'done' : 'pending'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UploadProgress;
