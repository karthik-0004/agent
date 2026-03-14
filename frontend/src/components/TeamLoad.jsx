const getLoadTone = (value) => {
  if (value >= 75) {
    return 'danger';
  }
  if (value >= 50) {
    return 'warning';
  }
  return 'safe';
};

const computeRating = (employee) => {
  const skills = String(employee.skills || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const workload = Number(employee.current_workload_percent || 0);
  const capacity = Math.max(0, 100 - workload);
  const score = Math.round((skills.length * 1.2) + (capacity * 0.08));
  return Math.max(1, Math.min(10, score));
};

const TeamLoad = ({ employees, workloadUpdate, assignmentCounts }) => {
  if (!employees.length) {
    return <div className="card empty-state">No employee data available.</div>;
  }

  return (
    <div className="team-grid">
      {employees.map((employee) => {
        const updatedLoad = workloadUpdate?.[employee.name] ?? employee.current_workload_percent;
        const tone = getLoadTone(updatedLoad);
        const assignedCount = assignmentCounts?.[employee.name] || 0;
        const rating = computeRating(employee);
        const riskFlag = Boolean(employee.deadline_risk);

        return (
          <div key={employee.employee_id} className="card employee-card">
            <div className="section-header compact">
              <div>
                <p className="employee-name">{employee.name}</p>
                <p className="employee-role">{employee.role}</p>
              </div>
              <div className="team-load-badges">
                <span className="rating-badge">{rating}★</span>
                <span className={`load-badge ${tone}`}>{updatedLoad}%</span>
              </div>
            </div>
            <div className="chip-row dense">
              {String(employee.skills)
                .split(',')
                .map((skill) => skill.trim())
                .filter(Boolean)
                .map((skill) => (
                  <span key={skill} className="chip neutral">
                    {skill}
                  </span>
                ))}
            </div>
            <div className="progress-track">
              <div className={`progress-fill ${tone}`} style={{ width: `${updatedLoad}%` }} />
            </div>
            <div className="employee-footer">
              <span>Current workload</span>
              <span>
                {assignedCount ? `+${assignedCount} tasks assigned` : 'No new tasks assigned'}
                {riskFlag ? '  ⚠ deadline risk' : ''}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TeamLoad;
