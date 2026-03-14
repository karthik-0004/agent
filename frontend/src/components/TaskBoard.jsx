import { useMemo, useState } from 'react';

const PriorityBadge = ({ priority }) => {
  const level = priority || 'Low';
  const tone = level === 'High' ? 'high' : level === 'Medium' ? 'medium' : 'low';
  const label = level === 'High' ? '🔴 High' : level === 'Medium' ? '🟡 Medium' : '🟢 Low';
  return <span className={`priority-pill ${tone}`}>{label}</span>;
};

const TaskBoard = ({ plan, completedTaskNames, onMarkComplete, loading }) => {
  const [priorityFilter, setPriorityFilter] = useState('All');
  const tasks = plan?.tasks || [];

  const visibleTasks = useMemo(() => {
    if (priorityFilter === 'All') {
      return tasks;
    }
    return tasks.filter((task) => (task.priority || 'Low') === priorityFilter);
  }, [tasks, priorityFilter]);

  if (!plan) {
    return <div className="card empty-state">Run the agent to generate a task board.</div>;
  }

  return (
    <div className="view-stack">
      <div className="section-header">
        <div>
          <p className="section-title">Task Board</p>
          <p className="section-subtitle">Mark tasks complete to trigger autonomous replanning.</p>
        </div>
        <div className="chip-row">
          {['All', 'High', 'Medium', 'Low'].map((item) => (
            <button
              key={item}
              type="button"
              className={priorityFilter === item ? 'preset-chip active-chip' : 'preset-chip'}
              onClick={() => setPriorityFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="task-board-grid">
        {visibleTasks.map((task) => {
          const isCompleted = completedTaskNames.includes(task.name);
          return (
            <div key={task.name} className="card task-card">
              <div className="task-card-header">
                <div>
                  <strong>{task.name}</strong>
                  <p className="task-description">{task.description}</p>
                </div>
                <div className="task-card-status">
                  <PriorityBadge priority={task.priority} />
                  <span className="chip amber">{task.duration} days</span>
                </div>
              </div>
              <div className="task-meta-block">
                <div className="chip-row dense">
                  {(task.assignees || []).map((assignee) => (
                    <span key={assignee} className="chip blue">
                      {assignee}
                    </span>
                  ))}
                </div>
                <div className="chip-row dense">
                  {(task.tools || []).map((tool) => (
                    <span key={tool} className="chip green">
                      {tool}
                    </span>
                  ))}
                </div>
                <div className="tool-recommendation-card">
                  <p className="tool-rec-title">Top 3 Tool Recommendations</p>
                  {(task.tool_recommendations || []).slice(0, 3).map((recommendation) => (
                    <div key={`${task.name}-${recommendation.name}`} className="tool-rec-item">
                      <div>
                        <strong>{recommendation.name}</strong>
                        <p className="dataset-meta">{recommendation.category}</p>
                      </div>
                      <p className="dataset-meta">{recommendation.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => onMarkComplete(task)}
                disabled={loading || isCompleted}
              >
                {isCompleted ? 'Completed' : loading ? 'Replanning...' : 'Mark Complete'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TaskBoard;
