import { useEffect, useRef, useState } from 'react';

const Sidebar = ({ activeView, onSelect }) => {
  const itemRefs = useRef({});
  const [indicatorY, setIndicatorY] = useState(0);
  const [indicatorVisible, setIndicatorVisible] = useState(0);

  const groups = [
    {
      title: 'Workspace',
      items: [
        { id: 'analytics', icon: '📊', label: 'Analytics' },
        { id: 'mission-control', icon: '🎯', label: 'Mission Control' },
        { id: 'task-board', icon: '🧩', label: 'Task Board' },
        { id: 'team-overview', icon: '👥', label: 'Team Overview' },
      ],
    },
    {
      title: 'People',
      items: [
        { id: 'employees', icon: '🧠', label: 'Employees' },
        { id: 'add-employee', icon: '➕', label: 'Add Employee' },
      ],
    },
    {
      title: 'History',
      items: [
        { id: 'projects', icon: '📁', label: 'Projects' },
        { id: 'past-projects', icon: '🗂️', label: 'Past Projects' },
        { id: 'tools', icon: '🛠️', label: 'Tools' },
        { id: 'dataset-manager', icon: '🧱', label: 'Bulk Dataset Manager' },
      ],
    },
  ];

  useEffect(() => {
    const activeItem = itemRefs.current[activeView];
    const links = activeItem?.closest('.sidebar-links');
    if (!activeItem || !links) {
      setIndicatorVisible(0);
      return;
    }
    const linksRect = links.getBoundingClientRect();
    const activeRect = activeItem.getBoundingClientRect();
    setIndicatorY(Math.max(0, activeRect.top - linksRect.top + 6));
    setIndicatorVisible(1);
  }, [activeView]);

  return (
    <aside className="sidebar">
      <div>
        <p className="eyebrow">Neurax</p>
        <h1 className="sidebar-title">Taskifier</h1>
      </div>

      {groups.map((group) => (
        <div key={group.title} className="sidebar-section">
          <p className="sidebar-section-title">{group.title}</p>
          <div className="sidebar-links" style={{ '--indicator-y': `${indicatorY}px`, '--indicator-opacity': indicatorVisible }}>
            {group.items.some((item) => item.id === activeView) ? <span className="sidebar-active-indicator" aria-hidden="true" /> : null}
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === activeView ? 'sidebar-link active' : 'sidebar-link'}
                onClick={() => onSelect(item.id)}
                ref={(node) => {
                  itemRefs.current[item.id] = node;
                }}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                <span className="sidebar-link-label">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
};

export default Sidebar;
