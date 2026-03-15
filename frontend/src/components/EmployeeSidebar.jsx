import { useEffect, useRef, useState } from 'react';

const EmployeeSidebar = ({ activeView, onSelect, unreadCount }) => {
  const previousUnread = useRef(unreadCount || 0);
  const [ringBell, setRingBell] = useState(false);

  useEffect(() => {
    if ((unreadCount || 0) > previousUnread.current) {
      setRingBell(true);
      const timer = window.setTimeout(() => setRingBell(false), 360);
      previousUnread.current = unreadCount || 0;
      return () => window.clearTimeout(timer);
    }
    previousUnread.current = unreadCount || 0;
    return undefined;
  }, [unreadCount]);

  const items = [
    { id: 'home', label: 'Home' },
    { id: 'tasks', label: 'My Tasks' },
    { id: 'tracker', label: 'Daily Tracker' },
    { id: 'team', label: 'My Team' },
    { id: 'chat', label: 'Query & Leave' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'performance', label: 'My Performance' },
    { id: 'profile', label: 'My Profile' },
  ];

  return (
    <aside className="employee-sidebar">
      <p className="eyebrow">Employee Portal</p>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={activeView === item.id ? 'employee-nav-item active' : 'employee-nav-item'}
          onClick={() => onSelect(item.id)}
        >
          {item.id === 'notifications' ? <span className={ringBell ? 'notification-bell ring' : 'notification-bell'}>🔔</span> : null}
          {item.label}
          {item.id === 'notifications' && unreadCount > 0 ? <span className="chip amber notification-badge-pop">{unreadCount}</span> : null}
        </button>
      ))}
    </aside>
  );
};

export default EmployeeSidebar;
