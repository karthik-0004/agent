const MyPerformance = ({ stats }) => {
  return (
    <div className="view-stack">
      <div className="stats-row">
        <div className="stat-card"><span className="stat-label">Projects Completed</span><strong className="stat-value">{stats.total_projects_completed || 0}</strong></div>
        <div className="stat-card"><span className="stat-label">On-time Rate</span><strong className="stat-value">{stats.on_time_completion_rate || 0}%</strong></div>
        <div className="stat-card"><span className="stat-label">Average Rating</span><strong className="stat-value">{stats.average_rating || 0}</strong></div>
        <div className="stat-card"><span className="stat-label">Hours Logged</span><strong className="stat-value">{stats.total_hours_logged || 0}</strong></div>
      </div>

      <div className="card">
        <p className="section-title">Achievements</p>
        <div className="chip-row dense">
          {(stats.badges || []).map((badge) => <span key={badge} className="chip green">{badge}</span>)}
          {!(stats.badges || []).length ? <span className="dataset-meta">No badges yet. Keep going.</span> : null}
        </div>
      </div>
    </div>
  );
};

export default MyPerformance;
