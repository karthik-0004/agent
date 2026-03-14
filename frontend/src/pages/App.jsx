import { useEffect, useMemo, useState } from 'react';
import {
  createEmployee,
  deleteEmployee,
  getEmployees,
  getHistory,
  getProjects,
  getTools,
  runAgent,
  sendAssignments,
  updateEmployee,
} from '../api/agentApi';
import EmployeeDirectory from '../components/EmployeeDirectory';
import Orchestrator from '../components/Orchestrator';
import Sidebar from '../components/Sidebar';
import TaskBoard from '../components/TaskBoard';
import TeamLoad from '../components/TeamLoad';

const splitValues = (value) =>
  String(value || '')
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);

const buildProjectTeam = (project, employees) => {
  if (!employees.length) {
    return [];
  }
  const seed = String(project.project_id || project.project_name || '').length;
  const count = Math.min(5, Math.max(1, (seed % 5) + 1));
  const start = seed % employees.length;
  const picked = [];
  for (let index = 0; index < count; index += 1) {
    picked.push(employees[(start + index) % employees.length]);
  }
  return picked.map((employee, index) => ({
    name: employee.name,
    role: employee.role,
    progress: Math.max(10, Math.min(95, 35 + ((index + 1) * 13))),
  }));
};

const EmployeeForm = ({ initialValues, onSubmit, onCancel, busy }) => {
  const [form, setForm] = useState(
    initialValues || {
      name: '',
      email: '',
      role: '',
      location: '',
      skills: '',
      current_workload_percent: 0,
    }
  );

  const updateField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  return (
    <div className="card">
      <div className="section-header compact">
        <div>
          <p className="section-title">Employee Management</p>
          <p className="section-subtitle">Add or update employee records.</p>
        </div>
      </div>

      <div className="form-grid">
        <input className="search-input" placeholder="Name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
        <input className="search-input" placeholder="Email" value={form.email || ''} onChange={(event) => updateField('email', event.target.value)} />
        <input className="search-input" placeholder="Role" value={form.role} onChange={(event) => updateField('role', event.target.value)} />
        <input className="search-input" placeholder="Location" value={form.location} onChange={(event) => updateField('location', event.target.value)} />
        <input className="search-input" placeholder="Skills (semicolon separated)" value={form.skills} onChange={(event) => updateField('skills', event.target.value)} />
        <input
          className="search-input"
          type="number"
          min="0"
          max="100"
          placeholder="Workload %"
          value={form.current_workload_percent}
          onChange={(event) => updateField('current_workload_percent', Number(event.target.value || 0))}
        />
      </div>

      <div className="card-actions">
        <button
          type="button"
          className="primary-button"
          disabled={busy || !form.name.trim() || !form.role.trim()}
          onClick={() => onSubmit(form)}
        >
          {busy ? 'Saving...' : 'Save Employee'}
        </button>
        {onCancel ? (
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
};

const ToolsCatalog = ({ tools }) => {
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(tools.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return tools.slice(start, start + pageSize);
  }, [tools, safePage]);

  return (
    <div className="view-stack">
      <div className="section-header">
        <div>
          <p className="section-title">Tools</p>
          <p className="section-subtitle">Loaded from dataset and ready for recommendations.</p>
        </div>
      </div>

      <div className="dataset-grid">
        {pageSlice.map((tool) => (
          <div key={tool.tool_id || tool.name} className="card dataset-card hover-lift">
            <div className="section-header compact">
              <p className="section-title small">{tool.name}</p>
              <span className="chip neutral">{tool.category}</span>
            </div>
            <p className="dataset-meta">Purpose: {tool.purpose_keywords || 'N/A'}</p>
            <div className="chip-row dense">
              {splitValues(tool.supported_skills).slice(0, 8).map((skill) => (
                <span key={`${tool.name}-${skill}`} className="chip green">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pagination-controls">
        <button type="button" className="secondary-button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
          Previous
        </button>
        <span className="page-label">Page {safePage} / {totalPages}</span>
        <button type="button" className="secondary-button" disabled={safePage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
          Next
        </button>
      </div>
    </div>
  );
};

const ExpandableProjectCard = ({ project, badge, dotTone, children }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card dataset-card hover-lift">
      <button type="button" className="expandable-header" onClick={() => setExpanded((value) => !value)}>
        <div>
          <p className="section-title small">{project.project_name}</p>
          <p className="section-subtitle">{project.description || project.summary || ''}</p>
        </div>
        <div className="chip-row dense">
          <span className={`status-dot ${dotTone}`} />
          <span className="chip neutral">{badge}</span>
        </div>
      </button>
      {expanded ? <div className="expandable-content">{children}</div> : null}
    </div>
  );
};

const App = () => {
  const [activeView, setActiveView] = useState('mission-control');
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [history, setHistory] = useState([]);
  const [tools, setTools] = useState([]);
  const [description, setDescription] = useState('');
  const [teamSize, setTeamSize] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState(null);
  const [assignedTeam, setAssignedTeam] = useState([]);
  const [activeAssignments, setActiveAssignments] = useState({ currently_assigned: [], available: [] });
  const [buckets, setBuckets] = useState([]);
  const [completedBuckets, setCompletedBuckets] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [reshuffleToken, setReshuffleToken] = useState(0);
  const [teamConfirmed, setTeamConfirmed] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailToast, setEmailToast] = useState(null);

  const assignedNames = useMemo(() => {
    const names = new Set();
    (activeAssignments.currently_assigned || []).forEach((row) => names.add(row.employee_name));
    return names;
  }, [activeAssignments]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [employeeData, projectData, historyData, toolData] = await Promise.all([
          getEmployees(),
          getProjects(),
          getHistory(),
          getTools(),
        ]);
        setEmployees(employeeData);
        setProjects(projectData);
        setHistory(historyData);
        setTools(toolData);
        setDescription(projectData[0]?.description || '');
        setActiveAssignments({
          currently_assigned: [],
          available: employeeData.map((employee) => ({
            employee_name: employee.name,
            role: employee.role,
            current_workload_percent: employee.current_workload_percent,
          })),
        });
      } catch (requestError) {
        setError(requestError.message);
      }
    };

    fetchData();
  }, []);

  const handleRunPlan = async () => {
    setLoading(true);
    setError('');
    setTeamConfirmed(false);
    setEmailToast(null);
    try {
      const response = await runAgent(description, teamSize, reshuffleToken);
      setPlan(response);
      const team = (response.assigned_team || []).slice(0, teamSize);
      setAssignedTeam(team);
      setActiveAssignments(response.active_assignments || { currently_assigned: [], available: [] });
      setBuckets([
        {
          id: `${Date.now()}`,
          project_name: response.project_name,
          priority: response.priority,
          deadline_days: response.deadline_days,
          team,
          tasks: response.tasks || [],
        },
      ]);
      setActiveView('mission-control');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReshuffleTeam = async () => {
    const nextToken = reshuffleToken + 1;
    setReshuffleToken(nextToken);
    setLoading(true);
    setError('');
    setTeamConfirmed(false);
    setEmailToast(null);
    try {
      const response = await runAgent(description, teamSize, nextToken);
      const team = (response.assigned_team || []).slice(0, teamSize);
      setPlan(response);
      setAssignedTeam(team);
      setActiveAssignments(response.active_assignments || { currently_assigned: [], available: [] });
      setBuckets([
        {
          id: `${Date.now()}`,
          project_name: response.project_name,
          priority: response.priority,
          deadline_days: response.deadline_days,
          team,
          tasks: response.tasks || [],
        },
      ]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTeam = () => {
    setTeamConfirmed(true);
    setEmailToast(null);
  };

  const handleSendAssignments = async () => {
    if (!plan || !assignedTeam.length) {
      return;
    }
    setSendingEmails(true);
    setEmailToast(null);
    try {
      const deadlineDate = new Date(Date.now() + Number(plan.deadline_days || 1) * 86400000)
        .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const response = await sendAssignments({
        project_name: plan.project_name,
        priority: plan.priority,
        deadline_days: plan.deadline_days,
        deadline_date: deadlineDate,
        tasks: (plan.tasks || []).map((task) => ({
          name: task.name,
          description: task.description,
          duration: task.duration,
        })),
        team: assignedTeam.map((member) => ({
          name: member.name,
          email: member.email,
          role: member.role,
        })),
      });

      if (response.failed > 0) {
        const failedRecord = (response.results || []).find((row) => row.status === 'failed');
        const backendError = String(failedRecord?.error || '').toLowerCase();
        let message = `❌ Failed to reach ${failedRecord?.email || 'a recipient'} — check SMTP`;
        if (backendError.includes('535') || backendError.includes('badcredentials')) {
          message = `❌ Gmail rejected login for ${failedRecord?.email || 'recipient'} — use a 16-char App Password`;
        }
        setEmailToast({
          type: 'error',
          message,
        });
      } else {
        setEmailToast({
          type: 'success',
          message: `✅ Assignment emails sent to ${response.sent} team members!`,
        });
      }
    } catch (requestError) {
      setEmailToast({
        type: 'error',
        message: `❌ ${requestError.message}`,
      });
    } finally {
      setSendingEmails(false);
    }
  };

  const handleMarkBucketComplete = (bucketId) => {
    setBuckets((previous) => {
      const target = previous.find((bucket) => bucket.id === bucketId);
      if (target) {
        setCompletedBuckets((completed) => [
          {
            project_name: target.project_name,
            summary: `${target.project_name} completed with ${target.team.length} team members.`,
            team_members: target.team.map((member) => member.name).join(';'),
            tools_used: target.tasks.flatMap((task) => task.tools || []).slice(0, 6).join(';'),
            outcome: 'Successful',
          },
          ...completed,
        ]);
      }
      return previous.filter((bucket) => bucket.id !== bucketId);
    });
  };

  const handleSaveEmployee = async (payload) => {
    setSavingEmployee(true);
    setError('');
    try {
      if (editingEmployee?.employee_id) {
        await updateEmployee(editingEmployee.employee_id, payload);
      } else {
        await createEmployee(payload);
      }
      const refreshed = await getEmployees();
      setEmployees(refreshed);
      setEditingEmployee(null);
      setActiveView('employees');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingEmployee(false);
    }
  };

  const handleDeleteEmployee = async (employee) => {
    const confirmed = window.confirm(`Delete ${employee.name}?`);
    if (!confirmed) {
      return;
    }
    try {
      await deleteEmployee(employee.employee_id);
      const refreshed = await getEmployees();
      setEmployees(refreshed);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const ongoingProjects = useMemo(
    () => projects.filter((project) => String(project.status || '').toLowerCase() !== 'completed'),
    [projects]
  );

  const pastProjects = useMemo(() => [...completedBuckets, ...history], [completedBuckets, history]);

  const renderContent = () => {
    if (activeView === 'mission-control') {
      return (
        <Orchestrator
          description={description}
          onDescriptionChange={setDescription}
          onRun={handleRunPlan}
          onReshuffle={handleReshuffleTeam}
          loading={loading}
          projects={projects}
          teamSize={teamSize}
          onTeamSizeChange={setTeamSize}
          plan={plan}
          assignedTeam={assignedTeam}
          teamConfirmed={teamConfirmed}
          onConfirmTeam={handleConfirmTeam}
          onSendAssignments={handleSendAssignments}
          sendingEmails={sendingEmails}
          emailToast={emailToast}
          error={error}
        />
      );
    }

    if (activeView === 'task-board') {
      return (
        <TaskBoard
          buckets={buckets}
          priorityFilter={priorityFilter}
          onFilterChange={setPriorityFilter}
          onMarkComplete={handleMarkBucketComplete}
        />
      );
    }

    if (activeView === 'team-overview') {
      return <TeamLoad activeAssignments={activeAssignments} />;
    }

    if (activeView === 'employees') {
      return (
        <EmployeeDirectory
          employees={employees}
          assignedNames={assignedNames}
          onEdit={(employee) => {
            setEditingEmployee(employee);
            setActiveView('add-employee');
          }}
          onDelete={handleDeleteEmployee}
        />
      );
    }

    if (activeView === 'add-employee') {
      return (
        <EmployeeForm
          initialValues={editingEmployee || undefined}
          onSubmit={handleSaveEmployee}
          onCancel={editingEmployee ? () => {
            setEditingEmployee(null);
            setActiveView('employees');
          } : undefined}
          busy={savingEmployee}
        />
      );
    }

    if (activeView === 'projects') {
      return (
        <div className="view-stack">
          <div className="section-header">
            <div>
              <p className="section-title">Projects</p>
              <p className="section-subtitle">Ongoing projects with live team rosters.</p>
            </div>
          </div>
          <div className="dataset-grid">
            {ongoingProjects.map((project) => {
              const roster = buildProjectTeam(project, employees);
              return (
                <ExpandableProjectCard key={project.project_id || project.project_name} project={project} badge="Ongoing" dotTone="green">
                  <p className="dataset-meta">Deadline countdown: {project.deadline_days} days</p>
                  <div className="bucket-lines">
                    {roster.map((member) => (
                      <div key={`${project.project_id}-${member.name}`} className="bucket-line">
                        <span>{member.name}</span>
                        <div className="bucket-progress-wrap">
                          <div className="bucket-progress-track">
                            <div className="bucket-progress-fill" style={{ width: `${member.progress}%` }} />
                          </div>
                          <span>{member.progress}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ExpandableProjectCard>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeView === 'past-projects') {
      return (
        <div className="view-stack">
          <div className="section-header">
            <div>
              <p className="section-title">Past Projects</p>
              <p className="section-subtitle">Completed work with expandable team details.</p>
            </div>
          </div>
          <div className="dataset-grid">
            {pastProjects.map((project, index) => {
              const teamPool = splitValues(project.team_members);
              const fallbackTeam = buildProjectTeam({ project_id: `hist-${index}`, project_name: project.project_name }, employees)
                .map((member) => member.name);
              const members = (teamPool.length ? teamPool : fallbackTeam).slice(0, 5);
              return (
                <ExpandableProjectCard key={`${project.history_id || project.project_name}-${index}`} project={project} badge="Completed" dotTone="red">
                  <p className="dataset-meta">{project.summary || project.lessons_learned || 'Completed project.'}</p>
                  <div className="chip-row dense">
                    <span className="chip neutral">Outcome: {project.outcome || 'Successful'}</span>
                  </div>
                  <div className="chip-row dense">
                    {members.map((memberName, memberIndex) => {
                      const person = employees.find((employee) => employee.name === memberName);
                      return (
                        <span key={`${project.project_name}-${memberName}`} className="chip blue">
                          {memberName} {person ? `(${person.role})` : ''} - C{memberIndex + 1}
                        </span>
                      );
                    })}
                  </div>
                  <div className="chip-row dense">
                    {splitValues(project.tools_used).slice(0, 6).map((tool) => (
                      <span key={`${project.project_name}-${tool}`} className="chip green">
                        {tool}
                      </span>
                    ))}
                  </div>
                </ExpandableProjectCard>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeView === 'tools') {
      return <ToolsCatalog tools={tools} />;
    }

    return null;
  };

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onSelect={setActiveView} />
      <main className="main-panel">
        <div className="topbar">
          <div>
            <p className="eyebrow">Manager Workspace</p>
            <h2 className="page-title">{activeView.replace('-', ' ')}</h2>
          </div>
          <div className="topbar-meta">
            <span>{employees.length} employees</span>
            <span>{projects.length} projects</span>
            <span>{tools.length} tools</span>
          </div>
        </div>
        {error && activeView !== 'mission-control' ? <div className="error-box">{error}</div> : null}
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
