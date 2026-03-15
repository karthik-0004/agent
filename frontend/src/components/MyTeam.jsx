const MyTeam = ({ team }) => {
  return (
    <div className="view-stack">
      <div className="card">
        <p className="section-title">My Team</p>
        <p className="section-subtitle">Teammates in your active project(s).</p>
        <div className="chip-row dense">
          <span className="chip amber">Deadline countdown: {team.project_deadline_days || 0} days</span>
        </div>
      </div>

      <div className="dataset-grid">
        {(team.members || []).map((member) => (
          <div key={`${member.name}-${member.role}`} className="card dataset-card">
            <p className="section-title small">{member.name}</p>
            <p className="section-subtitle">{member.role}</p>
            <p className="dataset-meta">Progress: {member.progress_percent}%</p>
          </div>
        ))}
        {!(team.members || []).length ? <div className="card empty-state">No teammates yet for your active projects.</div> : null}
      </div>
    </div>
  );
};

export default MyTeam;
