const Sidebar = ({ activeView, onSelect }) => {
  const groups = [
    {
      title: 'Workspace',
      items: [
        { id: 'mission-control', label: 'Mission Control' },
        { id: 'task-board', label: 'Task Board' },
        { id: 'team-overview', label: 'Team Overview' },
      ],
    },
    {
      title: 'People',
      items: [
        { id: 'employees', label: 'Employees' },
        { id: 'add-employee', label: '+ Add Employee' },
      ],
    },
    {
      title: 'History',
      items: [
        { id: 'projects', label: 'Projects' },
        { id: 'past-projects', label: 'Past Projects' },
        { id: 'tools', label: 'Tools' },
      ],
    },
  ];

  return (
    <aside className="sidebar">
      <div>
        <p className="eyebrow">Neurax</p>
        <h1 className="sidebar-title">Taskifier</h1>
      </div>

      {groups.map((group) => (
        <div key={group.title} className="sidebar-section">
          <p className="sidebar-section-title">{group.title}</p>
          <div className="sidebar-links">
            {group.items.map((item) => (
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
    </aside>
  );
};

export default Sidebar;
