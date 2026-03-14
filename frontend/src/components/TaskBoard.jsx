const TaskBoard = ({ plan, completedTaskNames, onMarkComplete, loading }) => {
  const tasks = plan?.tasks || [];

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
      </div>
      <div className="task-board-grid">
        {tasks.map((task) => {
          const isCompleted = completedTaskNames.includes(task.name);
          return (
            <div key={task.name} className="card task-card">
              <div className="task-card-header">
                <div>
                  <strong>{task.name}</strong>
                  <p className="task-description">{task.description}</p>
                </div>
                <span className="chip amber">{task.duration} days</span>
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
