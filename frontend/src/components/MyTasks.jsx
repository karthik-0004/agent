import { useMemo, useState } from 'react';

const MyTasks = ({ tasks, onUpdate }) => {
  const [filter, setFilter] = useState('all');

  const visible = useMemo(() => {
    if (filter === 'all') {
      return tasks;
    }
    return tasks.filter((task) => task.status === filter);
  }, [tasks, filter]);

  return (
    <div className="view-stack">
      <div className="section-header">
        <div>
          <p className="section-title">My Tasks</p>
          <p className="section-subtitle">Track progress and send live updates to your manager.</p>
        </div>
        <div className="chip-row dense">
          {['all', 'pending', 'in_progress', 'completed', 'overdue'].map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'preset-chip active-chip' : 'preset-chip'}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="view-stack">
        {visible.map((task) => (
          <div key={`${task.project_id}-${task.task_name}`} className={task.status === 'overdue' ? 'card warning-card' : 'card'}>
            <p className="section-title small">{task.task_name}</p>
            <p className="section-subtitle">{task.project_name}</p>
            <p className="dataset-meta">{task.description}</p>
            <div className="chip-row dense">
              <span className={task.status === 'overdue' ? 'chip amber' : 'chip neutral'}>{task.status}</span>
              <span className="chip blue">{task.priority}</span>
              <span className="chip neutral">Deadline: {task.sub_task_deadline_days}d</span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={task.progress_percent}
              onChange={(event) => onUpdate(task, Number(event.target.value), false)}
            />
            <div className="card-actions">
              <button type="button" className="secondary-button" onClick={() => onUpdate(task, task.progress_percent, false)}>
                Save Progress ({task.progress_percent}%)
              </button>
              <button type="button" className="primary-button" onClick={() => onUpdate(task, 100, true)}>
                Mark Complete
              </button>
            </div>
          </div>
        ))}
        {!visible.length ? <div className="card empty-state">No tasks in this filter yet.</div> : null}
      </div>
    </div>
  );
};

export default MyTasks;
