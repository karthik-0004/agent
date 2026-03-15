const splitSkills = (value) =>
  String(value || '')
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);

const computeRating = (employee) => {
  const explicit = Number(employee.rating || 0);
  if (explicit > 0) {
    return Math.max(1, Math.min(10, Math.round(explicit)));
  }
  const skillCount = splitSkills(employee.skills).length;
  const workload = Number(employee.current_workload_percent || 0);
  const capacity = Math.max(0, 100 - workload);
  return Math.max(1, Math.min(10, Math.round((skillCount * 1.2) + (capacity * 0.08))));
};

const sourceBadge = (employee) => {
  if (employee.is_outreach) {
    return <span className="chip orange">Outreach</span>;
  }
  if (String(employee.source).toLowerCase() === 'manual') {
    return <span className="chip neutral">Manual</span>;
  }
  if (String(employee.source).toLowerCase() === 'imported') {
    return <span className="chip blue">Imported</span>;
  }
  return null;
};

const EmployeeCard = ({ employee, isAssigned, onEdit, onDelete, style }) => {
  const rating = computeRating(employee);
  const skills = splitSkills(employee.skills).slice(0, 8);
  const statusClass = isAssigned ? 'status-assigned' : 'status-available';

  return (
    <div className={`card dataset-card employee-card hover-lift ${statusClass}`} style={style}>
      <div className="section-header compact">
        <div>
          <p className="section-title small">{employee.is_outreach ? '🌐 ' : ''}{employee.name}</p>
          <p className="section-subtitle">{employee.role}</p>
          <p className="dataset-meta" title={employee.email || 'N/A'}>
            📧 {employee.email || 'N/A'}
          </p>
        </div>
        <span className="rating-badge" style={{ '--rating-scale': rating / 10 }}>{rating}/10</span>
      </div>

      <div className="chip-row dense">
        {sourceBadge(employee)}
        {employee.is_outreach ? <span className="status-pill assigned">Temporary</span> : null}
        <span className={isAssigned ? 'status-pill assigned' : 'status-pill available'}>
          {isAssigned ? `🔴 Assigned${employee.current_project ? ` — ${employee.current_project}` : ''}` : '🟢 Available'}
        </span>
      </div>

      <p className="dataset-meta">Location: {employee.location || 'N/A'}</p>
      <p className="dataset-meta">Workload: {employee.current_workload_percent}%</p>
      {employee.is_outreach ? <p className="dataset-meta">⚠️ Temporary · Auto-removes on completion</p> : null}

      <div className="chip-row dense">
        {skills.map((skill) => (
          <span key={`${employee.name}-${skill}`} className="chip neutral entering">
            {skill}
          </span>
        ))}
      </div>

      <div className="card-actions">
        {!employee.is_outreach ? (
          <button type="button" className="secondary-button" onClick={() => onEdit(employee)}>
            ✏️ Edit
          </button>
        ) : null}
        {!employee.is_outreach ? (
          <button type="button" className="secondary-button danger" onClick={() => onDelete(employee)}>
            🗑️ Delete
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default EmployeeCard;
