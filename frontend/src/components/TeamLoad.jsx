const TeamLoad = ({ activeAssignments }) => {
  const assigned = activeAssignments?.currently_assigned || [];
  const available = activeAssignments?.available || [];

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
