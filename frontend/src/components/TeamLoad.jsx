const TeamLoad = ({ activeAssignments }) => {
  const assigned = activeAssignments?.currently_assigned || [];
  const available = activeAssignments?.available || [];

  const toneForWorkload = (value) => {
    const amount = Number(value || 0);
    if (amount > 75) {
      return 'linear-gradient(90deg, #dc2626, #ef4444)';
    }
    if (amount > 50) {
      return 'linear-gradient(90deg, #f59e0b, #fbbf24)';
    }
    return 'linear-gradient(90deg, #16a34a, #84cc16)';
  };

  return (
    <div className="view-stack">
      <div className="section-header">
        <div>
          <p className="section-title">Team Overview</p>
          <p className="section-subtitle">Live working area for assigned and available teammates.</p>
        </div>
      </div>

      <div className="team-overview-grid">
        <div className="card">
          <p className="section-title small">🔴 Currently Assigned</p>
          <div className="assignment-list wide">
            {assigned.length ? (
              assigned.map((row) => (
                <div key={`${row.employee_name}-${row.task_name}`} className="assignment-item">
                  <div>
                    <p className="assignment-name">{row.employee_name}</p>
                    <p className="assignment-task">{row.task_name}</p>
                  </div>
                  <span className="assignment-deadline">{row.estimated_deadline_days}d</span>
                </div>
              ))
            ) : (
              <p className="assignment-empty">No one assigned right now.</p>
            )}
          </div>
        </div>

        <div className="card">
          <p className="section-title small">🟢 Available</p>
          <div className="assignment-list wide">
            {available.length ? (
              available.map((row) => (
                <div key={row.employee_name} className="assignment-item">
                  <div>
                    <p className="assignment-name">{row.employee_name}</p>
                    <p className="assignment-task">{row.role}</p>
                    <div className="bucket-progress-track wide" style={{ marginTop: 8 }}>
                      <div
                        className="bucket-progress-fill"
                        style={{
                          '--fill-scale': Math.min(100, Math.max(0, Number(row.current_workload_percent || 0))) / 100,
                          '--fill-color': toneForWorkload(row.current_workload_percent),
                        }}
                      />
                    </div>
                  </div>
                  <span className="assignment-deadline">{row.current_workload_percent}%</span>
                </div>
              ))
            ) : (
              <p className="assignment-empty">No available teammates.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamLoad;
