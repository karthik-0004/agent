const PIPELINE_STEPS = ['Analyze', 'Decompose', 'Match Team', 'Select Tools', 'Assign', 'Plan Ready'];

const PipelineBar = ({ activeStep = 0, loading = false }) => (
  <div className="card">
    <div className="section-header compact">
      <div>
        <p className="section-title">Pipeline</p>
        <p className="section-subtitle">Autonomous planning progression</p>
      </div>
      <span className={loading ? 'status-pill running' : 'status-pill idle'}>
        {loading ? 'Running' : 'Idle'}
      </span>
    </div>
    <div className="pipeline-grid">
      {PIPELINE_STEPS.map((step, index) => {
        const state = index < activeStep ? 'done' : index === activeStep && loading ? 'active' : 'idle';
        return (
          <div key={step} className={`pipeline-step ${state}`}>
            <span className="pipeline-index">0{index + 1}</span>
            <span>{step}</span>
          </div>
        );
      })}
    </div>
  </div>
);

export default PipelineBar;
