const FRIENDLY_LABELS = {
  employees: {
    name: 'Full Name',
    role: 'Role',
    skills: 'Skills',
    current_workload_percent: 'Workload',
    experience_years: 'Experience',
    employee_id: 'Employee ID',
    email: 'Email',
    location: 'Location',
  },
  projects: {
    project_name: 'Project Name',
    description: 'Description',
    required_skills: 'Required Skills',
    deadline_days: 'Deadline',
    priority: 'Priority',
  },
  tools: {
    name: 'Tool Name',
    category: 'Category',
    purpose_keywords: 'Purpose',
    supported_skills: 'Supported Skills',
  },
  history: {
    project_name: 'Project Name',
    outcome: 'Outcome',
    tools_used: 'Skills/Tools',
    team_members: 'Team',
    duration_days: 'Duration',
  },
};

const prettyTitle = (value) =>
  String(value || '')
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');

const UploadPreview = ({ previews, onConfirm, onCancel, busy }) => {
  const entries = Object.entries(previews || {});

  if (!entries.length) {
    return null;
  }

  const [dataset, payload] = entries[0];
  const firstRows = (payload.preview || []).slice(0, 3);
  const rowKeys = firstRows.length ? Object.keys(firstRows[0]) : [];
  const mapped = payload.mapped_fields || [];
  const generated = payload.auto_generated_fields || [];
  const columns = Array.from(new Set([...mapped, ...generated]));
  const labels = FRIENDLY_LABELS[dataset] || {};

  return (
    <div className="card upload-preview-panel">
      <div className="section-header compact">
        <div>
          <p className="section-title small">🔍 Upload Preview</p>
          <p className="section-subtitle">{payload.file_name} — {payload.rows} rows detected</p>
        </div>
      </div>

      <div className="upload-preview-table-wrap">
        <table className="upload-preview-table">
          <thead>
            <tr>
              <th>Column</th>
              <th>Mapped To</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => {
              const isGenerated = generated.includes(column);
              return (
                <tr key={column}>
                  <td>{column}</td>
                  <td>{labels[column] || prettyTitle(column)}</td>
                  <td>
                    <span className={isGenerated ? 'chip amber' : 'chip green'}>
                      {isGenerated ? '⚠️ auto-generated' : '✅ mapped'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="dataset-meta">Skills separator: {payload.skills_separator || 'auto'}</p>

      <div className="upload-sample-table-wrap">
        <table className="upload-sample-table">
          <thead>
            <tr>
              {rowKeys.map((key) => (
                <th key={key}>{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {firstRows.map((row, index) => (
              <tr key={`${dataset}-row-${index}`}>
                {rowKeys.map((key) => (
                  <td key={`${dataset}-cell-${index}-${key}`}>{String(row[key] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="dataset-meta">Showing first {Math.min(firstRows.length, 3)} rows of {payload.rows}</p>

      <div className="card-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>❌ Cancel</button>
        <button type="button" className="primary-button" onClick={onConfirm} disabled={busy || !entries.length}>
          {busy ? 'Importing...' : '✅ Confirm & Import'}
        </button>
      </div>
    </div>
  );
};

export default UploadPreview;
