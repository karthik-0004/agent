const PriorityBadge = ({ priority }) => {
  const level = priority || 'Low';
  const tone = level === 'High' ? 'high' : level === 'Medium' ? 'medium' : 'low';
  const label = level === 'High' ? '🔴 High' : level === 'Medium' ? '🟡 Medium' : '🟢 Low';
  return <span className={`priority-pill ${tone}`}>{label}</span>;
};

const Orchestrator = ({
  description,
  onDescriptionChange,
  onRun,
  onReshuffle,
  loading,
  projects,
  teamSize,
  onTeamSizeChange,
  plan,
  assignedTeam,
  teamConfirmed,
  onConfirmTeam,
  onSendAssignments,
  sendingEmails,
  emailToast,
  error,
}) => {
  const projectName = plan?.project_name || '-';
  const priority = plan?.priority || 'Medium';
  const deadline = plan?.deadline_days || '-';

  return (
    <div className="view-stack">
      <div className="card">
        <div className="section-header">
          <div>
            <p className="section-title">🎯 Mission Control</p>
            <p className="section-subtitle">Describe your mission or project.</p>
          </div>
          <button type="button" className="primary-button" onClick={onRun} disabled={loading || !description.trim()}>
            {loading ? 'Finding Team...' : '🚀 Find My Team'}
          </button>
        </div>

        <textarea
          className="description-input large"
          placeholder="Describe your mission or project..."
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
        />

        <div className="chip-row">
          {projects.slice(0, 8).map((project) => (
            <button
              key={project.project_id || project.project_name}
              type="button"
              className="preset-chip"
              onClick={() => onDescriptionChange(project.description)}
            >
              {project.project_name}
            </button>
          ))}
        </div>

        <div className="team-size-selector">
          <span className="dataset-meta">Team Size</span>
          <div className="chip-row dense">
            {[1, 2, 3, 4, 5].map((size) => (
              <button
                key={size}
                type="button"
                className={teamSize === size ? 'preset-chip active-chip' : 'preset-chip'}
                onClick={() => onTeamSizeChange(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? <div className="error-box">{error}</div> : null}

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Project</span>
          <strong className="stat-value">{projectName}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Priority</span>
          <strong className="stat-value"><PriorityBadge priority={priority} /></strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Team Size</span>
          <strong className="stat-value">{assignedTeam.length || 0}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Deadline</span>
          <strong className="stat-value">{deadline} days</strong>
        </div>
      </div>

      <div className="card">
        <div className="section-header compact">
          <div>
            <p className="section-title">👥 Suggested Team — {assignedTeam.length} Members</p>
            <p className="section-subtitle">Karthik is pinned first by rule.</p>
          </div>
        </div>

        <div className="suggested-team-list">
          {assignedTeam.length ? (
            assignedTeam.map((member, index) => (
              <div key={member.name} className="suggested-team-row">
                <div>
                  <p className="employee-name">
                    {index === 0 && member.name === 'G. Karthikeyan' ? '★ ' : ''}
                    {member.name}
                  </p>
                  <p className="employee-role">{member.role}</p>
                </div>
                <div className="suggested-team-meta">
                  <span className="rating-badge">{member.performance_rating || 7}/10</span>
                  <span className="dataset-meta">📧 {member.email}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-state">No team yet. Click Find My Team.</p>
          )}
        </div>

        {assignedTeam.length ? (
          <div className="card-actions">
            <button type="button" className="secondary-button" onClick={onReshuffle}>
              ↺ Reshuffle Team
            </button>
            <button type="button" className="primary-button" onClick={onConfirmTeam}>
              ✅ Confirm OK
            </button>
          </div>
        ) : null}
      </div>

      {teamConfirmed ? (
        <div className="card">
          <div className="section-header compact">
            <div>
              <p className="section-title">✅ Team Confirmed!</p>
              <p className="section-subtitle">Assignment emails will be sent to:</p>
            </div>
          </div>
          <p className="dataset-meta">Project: {projectName}</p>
          <div className="chip-row dense">
            {assignedTeam.map((member) => (
              <span key={member.email} className="chip neutral">📧 {member.email}</span>
            ))}
          </div>

          <div className="card-actions">
            <button type="button" className="primary-button" onClick={onSendAssignments} disabled={sendingEmails}>
              {sendingEmails ? 'Sending emails...' : '📧 Send Assignment Emails'}
            </button>
          </div>

          {emailToast ? (
            <div className={emailToast.type === 'success' ? 'toast-success' : 'toast-fail'}>
              {emailToast.message}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default Orchestrator;
