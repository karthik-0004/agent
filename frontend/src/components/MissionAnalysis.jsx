const MissionAnalysis = ({ analysis, onAdjust, onProceed, busy }) => {
  if (!analysis) {
    return null;
  }

  return (
    <div className="card">
      <div className="section-header compact">
        <div>
          <p className="section-title">Stage 1 — Mission Analysis</p>
          <p className="section-subtitle">Detected skills, roles, complexity, and top employee matches.</p>
        </div>
      </div>

      <div className="chip-row dense">
        {(analysis.required_skills || []).map((skill) => (
          <span key={`skill-${skill}`} className="chip blue">{skill}</span>
        ))}
      </div>

      <div className="chip-row dense">
        {(analysis.required_roles || []).map((role) => (
          <span key={`role-${role}`} className="chip neutral">{role}</span>
        ))}
        <span className="chip amber">Complexity: {analysis.complexity || 'Medium'}</span>
      </div>

      <div className="suggested-team-list">
        {(analysis.top_matches || []).slice(0, 6).map((row) => (
          <div key={`match-${row.name}`} className="suggested-team-row">
            <div>
              <p className="employee-name">{row.name}</p>
              <p className="employee-role">{row.role}</p>
            </div>
            <div className="suggested-team-meta">
              <span className="rating-badge">{row.match_percentage}% match</span>
              <span className="dataset-meta">{(row.matched_skills || []).slice(0, 4).join(', ')}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card-actions">
        <button type="button" className="secondary-button" onClick={onAdjust}>Adjust Team</button>
        <button type="button" className="primary-button" onClick={onProceed} disabled={busy}>
          {busy ? 'Building plan...' : 'Proceed with Suggested Plan'}
        </button>
      </div>
    </div>
  );
};

export default MissionAnalysis;
