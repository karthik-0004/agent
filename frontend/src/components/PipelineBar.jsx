const PIPELINE_STEPS = ['Analyze', 'Decompose', 'Match Team', 'Select Tools', 'Assign', 'Plan Ready'];

const PipelineBar = ({ activeStep = 0, loading = false }) => (
  <div className="card scroll-reveal">
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
            {state === 'done' ? (
              <svg className="pipeline-check" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8.5L6.5 12L13 5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </div>
        );
      })}
    </div>
    <div className="pipeline-energy" style={{ '--pipeline-progress': (loading ? activeStep + 1 : activeStep) / PIPELINE_STEPS.length }} />
  </div>
);

export default PipelineBar;
