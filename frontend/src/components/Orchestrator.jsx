import { useEffect, useMemo, useRef, useState } from 'react';
import MissionAnalysis from './MissionAnalysis';

const PriorityBadge = ({ priority }) => {
  const level = priority || 'Low';
  const tone = level === 'High' ? 'high' : level === 'Medium' ? 'medium' : 'low';
  const label = level === 'High' ? '🔴 High' : level === 'Medium' ? '🟡 Medium' : '🟢 Low';
  return <span className={`priority-pill ${tone}`}>{label}</span>;
};

const Orchestrator = ({
  description,
  onDescriptionChange,
  onRun,
  onReshuffle,
  loading,
  projects,
  teamSize,
  onTeamSizeChange,
  deadlineDays,
  onDeadlineDaysChange,
  plan,
  assignedTeam,
  teamConflicts,
  conflictsResolved,
  onAcceptConflicts,
  onFindOthers,
  teamConfirmed,
  onConfirmTeam,
  onSendAssignments,
  sendingEmails,
  emailToast,
  error,
  onRunCustomAnalyze,
  onRunCustomPlan,
  customMissionAnalysis,
  onResetCustomMissionAnalysis,
}) => {
  const [missionMode, setMissionMode] = useState('preset');
  const [newMissionTitle, setNewMissionTitle] = useState('');
  const [newMissionDescription, setNewMissionDescription] = useState('');
  const [projectQuery, setProjectQuery] = useState('');
  const [showProjectOptions, setShowProjectOptions] = useState(false);
  const projectDropdownRef = useRef(null);
  const projectName = plan?.project_name || '-';
  const priority = plan?.priority || 'Medium';
  const deadline = Number(plan?.deadline_days || deadlineDays || 1);
  const filteredProjects = useMemo(() => {
    const needle = projectQuery.trim().toLowerCase();
    if (!needle) {
      return projects;
    }
    return projects.filter((project) => {
      const haystack = [project.project_name, project.description, project.priority]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [projects, projectQuery]);

  const handleSelectProject = (project) => {
    setProjectQuery(project.project_name || '');
    onDescriptionChange(project.description || project.project_name || '');
    setShowProjectOptions(false);
  };

  const runMissionAnalysis = () => {
    onRunCustomAnalyze({
      mission_title: newMissionTitle,
      mission_description: newMissionDescription,
      team_size: teamSize,
      deadline_days: deadlineDays,
    });
  };

  const runMissionPlan = () => {
    const saveToDataset = window.confirm('Save this custom mission to project presets for future use?');
    onRunCustomPlan({
      mission_title: newMissionTitle,
      mission_description: newMissionDescription,
      team_size: teamSize,
      deadline_days: deadlineDays,
      save_to_dataset: saveToDataset,
      extracted: customMissionAnalysis,
    });
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!showProjectOptions) {
        return;
      }
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target)) {
        setShowProjectOptions(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showProjectOptions]);

  return (
    <div className="view-stack">
      <div className="card scroll-reveal">
        <div className="section-header">
          <div>
            <p className="section-title">🎯 Mission Control</p>
            <p className="section-subtitle">Describe your mission or project.</p>
          </div>
          {missionMode === 'preset' ? (
            <button type="button" className="primary-button primary-attention" onClick={onRun} disabled={loading || !description.trim()}>
              {loading ? 'Finding Team...' : '🚀 Find My Team'}
            </button>
          ) : (
            <button
              type="button"
              className="primary-button primary-attention"
              onClick={runMissionAnalysis}
              disabled={loading || !newMissionTitle.trim() || !newMissionDescription.trim()}
            >
              {loading ? 'Analysing...' : 'Analyse and Build Plan'}
            </button>
          )}
        </div>

        <div className="chip-row dense">
          <button
            type="button"
            className={missionMode === 'preset' ? 'preset-chip active-chip' : 'preset-chip'}
            onClick={() => setMissionMode('preset')}
          >
            Project Presets
          </button>
          <button
            type="button"
            className={missionMode === 'custom' ? 'preset-chip active-chip' : 'preset-chip'}
            onClick={() => setMissionMode('custom')}
          >
            Add New Mission
          </button>
        </div>

        {missionMode === 'preset' ? (
          <>
            <textarea
              className="description-input large"
              placeholder="Describe your mission or project..."
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />

            <div className="team-size-selector">
              <span className="dataset-meta">Project Presets</span>
              <div className="project-dropdown-wrap" ref={projectDropdownRef}>
                <input
                  className="search-input project-dropdown-input"
                  placeholder="Search all projects by name, priority, or description"
                  value={projectQuery}
                  onFocus={() => setShowProjectOptions(true)}
                  onChange={(event) => {
                    setProjectQuery(event.target.value);
                    setShowProjectOptions(true);
                  }}
                />

                {showProjectOptions ? (
                  <div className="project-dropdown-list" role="listbox">
                    {filteredProjects.length ? (
                      filteredProjects.map((project) => (
                        <button
                          key={project.project_id || project.project_name}
                          type="button"
                          className="project-dropdown-item"
                          onClick={() => handleSelectProject(project)}
                        >
                          <span className="project-dropdown-name">{project.project_name}</span>
                          <PriorityBadge priority={project.priority || 'Medium'} />
                        </button>
                      ))
                    ) : (
                      <p className="empty-state">No projects match your search.</p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <>
            <input
              className="search-input"
              placeholder="Mission Title"
              value={newMissionTitle}
              onChange={(event) => setNewMissionTitle(event.target.value)}
            />
            <textarea
              className="description-input large"
              placeholder="Describe goal, tech stack, constraints, and requirements in detail..."
              value={newMissionDescription}
              onChange={(event) => setNewMissionDescription(event.target.value)}
            />

            <MissionAnalysis
              analysis={customMissionAnalysis}
              onAdjust={onResetCustomMissionAnalysis}
              onProceed={runMissionPlan}
              busy={loading}
            />
          </>
        )}

        <div className="team-size-selector">
          <span className="dataset-meta">Team Size</span>
          <div className="chip-row dense">
            {[1, 2, 3, 4, 5].map((size) => (
              <button
                key={size}
                type="button"
                className={teamSize === size ? 'preset-chip active-chip' : 'preset-chip'}
                onClick={() => onTeamSizeChange(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="team-size-selector">
          <span className="dataset-meta">Deadline (days)</span>
          <div className="form-grid" style={{ gridTemplateColumns: '180px' }}>
            <input
              className="search-input"
              type="number"
              min="1"
              max="365"
              value={deadlineDays}
              onChange={(event) => onDeadlineDaysChange(Number(event.target.value || 1))}
            />
          </div>
        </div>
      </div>

      {error ? <div className="error-box">{error}</div> : null}

      <div className="stats-row row-cascade">
        <div className="stat-card">
          <span className="stat-label">Project</span>
          <strong className="stat-value">{projectName}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Priority</span>
          <strong className="stat-value"><PriorityBadge priority={priority} /></strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Team Size</span>
          <strong className="stat-value">{teamSize}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Deadline</span>
          <strong className="stat-value">{deadline} days</strong>
        </div>
      </div>

      <div className="card scroll-reveal">
        <div className="section-header compact">
          <div>
            <p className="section-title">👥 Suggested Team — {assignedTeam.length} Members</p>
            <p className="section-subtitle">Akshaya is pinned first by rule.</p>
          </div>
        </div>

        <div className="suggested-team-list">
          {assignedTeam.length ? (
            assignedTeam.map((member, index) => (
              <div key={member.name} className="suggested-team-row">
                <div>
                  <p className="employee-name">
                    {index === 0 && member.name === 'Akshaya Nuthalapati' ? '★ ' : ''}
                    {member.name}
                  </p>
                  <p className="employee-role">{member.role}</p>
                </div>
                <div className="suggested-team-meta">
                  <span className="rating-badge">{member.performance_rating || 7}/10</span>
                  <span className="dataset-meta">📧 {member.email}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-state">No team yet. Click Find My Team.</p>
          )}
        </div>

        {assignedTeam.length ? (
          <div className="card-actions">
            <button type="button" className="secondary-button" onClick={onReshuffle}>
              ↺ Reshuffle Team
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={onConfirmTeam}
              disabled={Boolean(teamConflicts.length) && !conflictsResolved}
            >
              ✅ Confirm OK
            </button>
          </div>
        ) : null}
      </div>

      {teamConflicts.length && !conflictsResolved ? (
        <div className="card warning-card scroll-reveal">
          <p className="section-title">⚠️ Conflict Detected</p>
          <p className="section-subtitle">The following members are already assigned to active projects:</p>
          <div className="chip-row dense">
            {teamConflicts.map((item) => (
              <span key={`${item.name}-${item.project_name}`} className="chip amber">
                {item.name} — {item.project_name}
              </span>
            ))}
          </div>
          <div className="card-actions">
            <button type="button" className="primary-button" onClick={onAcceptConflicts}>
              ✅ Yes, Add Them
            </button>
            <button type="button" className="secondary-button" onClick={onFindOthers}>
              🔄 Find Others
            </button>
          </div>
        </div>
      ) : null}

      {teamConfirmed ? (
        <div className="card scroll-reveal">
          <div className="section-header compact">
            <div>
              <p className="section-title">✅ Team Confirmed!</p>
              <p className="section-subtitle">Assignment emails will be sent to:</p>
            </div>
          </div>
          <p className="dataset-meta">Project: {projectName}</p>
          <div className="chip-row dense">
            {assignedTeam.map((member) => (
              <span key={member.email} className="chip neutral">📧 {member.email}</span>
            ))}
          </div>

          <div className="card-actions">
            <button type="button" className="primary-button" onClick={onSendAssignments} disabled={sendingEmails}>
              {sendingEmails ? 'Sending emails...' : '📧 Send Assignment Emails'}
            </button>
          </div>

          {emailToast ? (
            <div className={emailToast.type === 'success' ? 'toast-success' : 'toast-fail'}>
              {emailToast.message}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default Orchestrator;
