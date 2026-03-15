const LandingPage = ({ onSelectRole }) => {
  return (
    <div className="portal-landing-shell">
      <div className="portal-landing-card row-cascade">
        <p className="eyebrow">Neurax Platform</p>
        <h1 className="page-title page-title-animate">Choose Your Workspace</h1>
        <p className="section-subtitle page-enter" style={{ '--row-index': 1 }}>Two portals, one platform. Select your role to continue.</p>

        <div className="portal-role-grid stagger-grid" style={{ '--row-index': 2 }}>
          <button type="button" className="portal-role-card" style={{ '--stagger-index': 0 }} onClick={() => onSelectRole('manager')}>
            <p className="section-title">🧭 Manager</p>
            <p className="dataset-meta">Full operations dashboard, planning, assignments, analytics.</p>
          </button>
          <button type="button" className="portal-role-card" style={{ '--stagger-index': 1 }} onClick={() => onSelectRole('employee')}>
            <p className="section-title">🙋 Employee</p>
            <p className="dataset-meta">Personal tasks, daily tracker, team sync, notifications.</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
