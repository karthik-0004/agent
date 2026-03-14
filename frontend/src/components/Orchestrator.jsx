import PipelineBar from './PipelineBar';
import ThinkingLog from './ThinkingLog';

const StatCard = ({ label, value }) => (
  <div className="stat-card">
    <span className="stat-label">{label}</span>
    <strong className="stat-value">{value}</strong>
  </div>
);

const Orchestrator = ({
  description,
  onDescriptionChange,
  onRun,
  loading,
  pipelineStep,
  thinkingLog,
  plan,
  error,
  projects,
}) => {
  return (
    <div className="view-stack">
      <div className="card">
        <div className="section-header">
          <div>
            <p className="section-title">Mission Control</p>
            <p className="section-subtitle">Describe the initiative and let the agent decompose the work.</p>
          </div>
          <button type="button" className="primary-button" onClick={onRun} disabled={loading || !description.trim()}>
            {loading ? 'Running Agent...' : 'Run Agent'}
          </button>
        </div>
        <textarea
          className="description-input"
          placeholder="Describe the project scope, deadline, constraints, and priorities..."
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
        />
        <div className="chip-row">
          {projects.map((project) => (
            <button
              key={project.project_id}
              type="button"
              className="preset-chip"
              onClick={() => onDescriptionChange(project.description)}
            >
              {project.project_name}
            </button>
          ))}
        </div>
      </div>

      <PipelineBar activeStep={pipelineStep} loading={loading} />
      <ThinkingLog entries={thinkingLog} />

      {error ? <div className="error-box">{error}</div> : null}

      {plan ? (
        <div className="view-stack">
          <div className="stats-row">
            <StatCard label="Project" value={plan.project_name} />
            <StatCard label="Priority" value={plan.priority} />
            <StatCard label="Tasks" value={plan.tasks.length} />
            <StatCard
              label="Team Size"
              value={new Set(plan.tasks.flatMap((task) => task.assignees || [])).size}
            />
          </div>

          <div className="card">
            <div className="section-header compact">
              <div>
                <p className="section-title">Task Preview</p>
                <p className="section-subtitle">First three generated work items</p>
              </div>
            </div>
            <div className="task-preview-grid">
              {plan.tasks.slice(0, 3).map((task) => (
                <div key={task.name} className="task-preview-card">
                  <div className="task-card-header">
                    <strong>{task.name}</strong>
                    <span className="chip amber">{task.duration}d</span>
                  </div>
                  <p className="task-description">{task.description}</p>
                  <div className="chip-row dense">
                    {(task.assignees || []).map((assignee) => (
                      <span key={assignee} className="chip blue">
                        {assignee}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Orchestrator;
