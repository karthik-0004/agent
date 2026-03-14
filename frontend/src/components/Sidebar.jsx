const Sidebar = ({ activeView, onSelect }) => {
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
    </aside>
  );
};

export default Sidebar;
