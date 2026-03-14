const PriorityPill = ({ priority }) => {
  const tone = priority === 'High' ? 'high' : priority === 'Medium' ? 'medium' : 'low';
  const label = priority === 'High' ? '🔴 High' : priority === 'Medium' ? '🟡 Medium' : '🟢 Low';
  return <span className={`priority-pill ${tone}`}>{label}</span>;
};

const Sidebar = ({ activeView, onSelect, activeAssignments }) => {
  const sections = [
    {
      title: 'Agent',
      items: [
        { id: 'orchestrator', label: 'Orchestrator' },
        { id: 'task-board', label: 'Task Board' },
        { id: 'team-load', label: 'Team Load' },
        { id: 'past-projects', label: 'Past Projects' },
      ],
    },
    {
      title: 'Dataset',
      items: [
        { id: 'employees', label: 'Employees' },
        { id: 'projects', label: 'Projects' },
        { id: 'tools', label: 'Tools' },
      ],
    },
  ];

  const assigned = activeAssignments?.currently_assigned || [];
  const available = activeAssignments?.available || [];

  return (
    <aside className="sidebar">
      <div>
        <p className="eyebrow">Neurax</p>
        <h1 className="sidebar-title">Taskifier</h1>
      </div>
      {sections.map((section) => (
        <div key={section.title} className="sidebar-section">
          <p className="sidebar-section-title">{section.title}</p>
          <div className="sidebar-links">
            {section.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === activeView ? 'sidebar-link active' : 'sidebar-link'}
                onClick={() => onSelect(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="sidebar-section assignment-panel">
        <p className="sidebar-section-title">Active Assignments</p>
        <div className="assignment-list">
          {assigned.length ? (
            assigned.slice(0, 8).map((row) => (
              <div key={`${row.employee_name}-${row.task_name}`} className="assignment-item">
                <div>
                  <p className="assignment-name">{row.employee_name}</p>
                  <p className="assignment-task">{row.task_name}</p>
                </div>
                <div className="assignment-meta">
                  <PriorityPill priority={row.priority || 'Low'} />
                  <span className="assignment-deadline">{row.estimated_deadline_days}d</span>
                </div>
              </div>
            ))
          ) : (
            <p className="assignment-empty">No active assignments</p>
          )}
        </div>

        <p className="sidebar-section-title">Available</p>
        <div className="assignment-list compact">
          {available.length ? (
            available.slice(0, 8).map((row) => (
              <div key={row.employee_name} className="assignment-item small">
                <span className="assignment-name">{row.employee_name}</span>
                <span className="assignment-deadline">{row.current_workload_percent}%</span>
              </div>
            ))
          ) : (
            <p className="assignment-empty">No available employees</p>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
