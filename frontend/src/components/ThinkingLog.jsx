const ThinkingLog = ({ entries }) => (
  <div className="card thinking-log-card">
    <div className="section-header compact">
      <div>
        <p className="section-title">Thinking Log</p>
        <p className="section-subtitle">Step-by-step planning trace</p>
      </div>
    </div>
    <div className="thinking-log">
      {entries.length ? (
        entries.map((entry, index) => (
          <div key={`${entry}-${index}`} className="thinking-entry">
            <span className="thinking-entry-index">[{String(index + 1).padStart(2, '0')}]</span>
            <span>{entry}</span>
          </div>
        ))
      ) : (
        <div className="thinking-entry muted">Awaiting agent execution.</div>
      )}
    </div>
  </div>
);

export default ThinkingLog;
