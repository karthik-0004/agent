import { useEffect, useMemo, useState } from 'react';
import {
  addEmployee,
  addOutreachEmployee,
  addTaskBoardMember,
  completeTaskBoardProject,
  createTaskBoardProject,
  deleteEmployee,
  getActivities,
  getAnalytics,
  getEmployeeStatuses,
  getEmployees,
  getHistory,
  getProjects,
  getTaskBoard,
  getTools,
  removeTaskBoardMember,
  runCustomMission,
  runAgent,
  sendAssignments,
  updateEmployee,
} from '../api/agentApi';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import DatasetManager from '../components/DatasetManager';
import EmployeeDirectory from '../components/EmployeeDirectory';
import Orchestrator from '../components/Orchestrator';
import OutreachForm from '../components/OutreachForm';
import Sidebar from '../components/Sidebar';
import TaskBoard from '../components/TaskBoard';
import TeamLoad from '../components/TeamLoad';

const splitValues = (value) =>
  String(value || '')
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);

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
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }
    const saved = window.localStorage.getItem('neurax-theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [activeView, setActiveView] = useState('analytics');
  const [employees, setEmployees] = useState([]);
  const [employeeStatuses, setEmployeeStatuses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [history, setHistory] = useState([]);
  const [tools, setTools] = useState([]);
  const [description, setDescription] = useState('');
  const [teamSize, setTeamSize] = useState(3);
  const [deadlineDays, setDeadlineDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState(null);
  const [assignedTeam, setAssignedTeam] = useState([]);
  const [teamConflicts, setTeamConflicts] = useState([]);
  const [conflictsResolved, setConflictsResolved] = useState(false);
  const [activeAssignments, setActiveAssignments] = useState({ currently_assigned: [], available: [] });
  const [taskBoardProjects, setTaskBoardProjects] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [reshuffleToken, setReshuffleToken] = useState(0);
  const [teamConfirmed, setTeamConfirmed] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailToast, setEmailToast] = useState(null);
  const [addMemberTarget, setAddMemberTarget] = useState(null);
  const [addMemberMode, setAddMemberMode] = useState('chooser');
  const [addingOutreach, setAddingOutreach] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedAddMember, setSelectedAddMember] = useState(null);
  const [taskBoardNotice, setTaskBoardNotice] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsActivities, setAnalyticsActivities] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('7d');
  const [leaderboardSort, setLeaderboardSort] = useState('rating');
  const [customMissionAnalysis, setCustomMissionAnalysis] = useState(null);

  const loadCoreData = async () => {
    const [employeeData, statusData, projectData, historyData, toolData, taskboardData] = await Promise.all([
      getEmployees(),
      getEmployeeStatuses(),
      getProjects(),
      getHistory(),
      getTools(),
      getTaskBoard(),
    ]);
    setEmployees(employeeData);
    setEmployeeStatuses(statusData);
    setProjects(projectData);
    setHistory(historyData);
    setTools(toolData);
    setTaskBoardProjects(taskboardData);
    if (!description) {
      setDescription(projectData[0]?.description || projectData[0]?.project_name || '');
    }
  };

  const loadEmployeesOnly = async () => {
    const [employeeData, statusData] = await Promise.all([getEmployees(), getEmployeeStatuses()]);
    setEmployees(employeeData);
    setEmployeeStatuses(statusData);
  };

  const loadAnalyticsData = async (period = analyticsPeriod) => {
    setAnalyticsLoading(true);
    try {
      const [data, acts] = await Promise.all([getAnalytics(period), getActivities()]);
      setAnalyticsData(data);
      setAnalyticsActivities(acts);
    } catch {
      // silently fail so dashboard shows empty state
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('neurax-theme', theme);
  }, [theme]);

  useEffect(() => {
    loadCoreData().catch((requestError) => setError(requestError.message));
    loadAnalyticsData();
  }, []);

  useEffect(() => {
    const handleBulkSync = () => {
      loadCoreData().catch((requestError) => setError(requestError.message));
      loadAnalyticsData();
    };
    window.addEventListener('neurax:bulk-sync-complete', handleBulkSync);
    return () => window.removeEventListener('neurax:bulk-sync-complete', handleBulkSync);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      return;
    }

    const targets = document.querySelectorAll('.main-panel .card, .main-panel .section-header, .main-panel .chart-card');
    targets.forEach((node) => {
      node.classList.add('scroll-reveal');
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -20% 0px',
      }
    );

    targets.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [activeView, employees.length, projects.length, taskBoardProjects.length, analyticsPeriod]);

  useEffect(() => {
    const assigned = (taskBoardProjects || [])
      .filter((project) => project.status === 'ongoing')
      .flatMap((project) =>
        (project.team || []).map((member) => ({
          employee_name: member.name,
          task_name: project.project_name,
          priority: project.priority,
          estimated_deadline_days: project.deadline_days,
        }))
      );

    const assignedNames = new Set(assigned.map((row) => row.employee_name));
    const available = employees
      .filter((employee) => !assignedNames.has(employee.name))
      .map((employee) => ({
        employee_name: employee.name,
        role: employee.role,
        current_workload_percent: employee.current_workload_percent,
      }));

    setActiveAssignments({ currently_assigned: assigned, available });
  }, [taskBoardProjects, employees]);

  const assignedNames = useMemo(() => {
    const names = new Set();
    employeeStatuses
      .filter((row) => String(row.status).toLowerCase() === 'assigned')
      .forEach((row) => names.add(row.name));
    return names;
  }, [employeeStatuses]);

  const ongoingBuckets = useMemo(
    () => taskBoardProjects.filter((project) => String(project.status).toLowerCase() === 'ongoing'),
    [taskBoardProjects]
  );

  const completedBuckets = useMemo(
    () => taskBoardProjects.filter((project) => String(project.status).toLowerCase() === 'completed'),
    [taskBoardProjects]
  );

  const addMemberOptions = useMemo(() => {
    if (!addMemberTarget) {
      return [];
    }
    const assignedNames = new Set((addMemberTarget.team || []).map((member) => member.name));
    const query = memberSearch.trim().toLowerCase();
    return employees
      .filter((employee) => !employee.is_outreach)
      .filter((employee) => !assignedNames.has(employee.name))
      .filter((employee) => {
        if (!query) {
          return true;
        }
        const haystack = [employee.name, employee.role, employee.email].join(' ').toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 30);
  }, [addMemberTarget, employees, memberSearch]);

  const sortedLeaderboard = useMemo(() => {
    const rows = analyticsData?.leaderboard || [];
    return [...rows].sort((a, b) => {
      if (leaderboardSort === 'projects') return b.projects - a.projects;
      if (leaderboardSort === 'on_time') return b.on_time - a.on_time;
      return b.rating - a.rating;
    });
  }, [analyticsData, leaderboardSort]);

  const handlePeriodChange = (period) => {
    setAnalyticsPeriod(period);
    loadAnalyticsData(period);
  };

  const handleLeaderboardSort = (col) => setLeaderboardSort(col);

  const handleCustomMissionAnalyze = async (payload) => {
    setLoading(true);
    setError('');
    setTeamConfirmed(false);
    setEmailToast(null);
    try {
      const response = await runCustomMission({
        action: 'analyze',
        ...payload,
      });
      setCustomMissionAnalysis(response.analysis || null);
      setPlan(null);
      setAssignedTeam([]);
      setTeamConflicts([]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomMissionPlan = async (payload) => {
    setLoading(true);
    setError('');
    setTeamConfirmed(false);
    setEmailToast(null);
    try {
      const response = await runCustomMission({
        action: 'plan',
        ...payload,
      });
      const planned = response.plan || null;
      setPlan(planned);
      setAssignedTeam((planned?.assigned_team || []).slice(0, payload.team_size || teamSize));
      setTeamConflicts(planned?.team_conflicts || []);
      setConflictsResolved((planned?.team_conflicts || []).length === 0);
      if (response.saved_project) {
        await loadCoreData();
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetCustomMissionAnalysis = () => {
    setCustomMissionAnalysis(null);
  };

  const handleRunPlan = async (avoidConflicts = false, tokenOverride = null) => {
    setLoading(true);
    setError('');
    setTeamConfirmed(false);
    setEmailToast(null);
    try {
      const token = tokenOverride === null ? reshuffleToken : tokenOverride;
      const response = await runAgent(description, teamSize, deadlineDays, token, avoidConflicts);
      setPlan(response);
      setCustomMissionAnalysis(null);
      setAssignedTeam((response.assigned_team || []).slice(0, teamSize));
      setTeamConflicts(response.team_conflicts || []);
      setConflictsResolved((response.team_conflicts || []).length === 0 || avoidConflicts);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReshuffleTeam = async () => {
    const nextToken = reshuffleToken + 1;
    setReshuffleToken(nextToken);
    setTeamConflicts([]);
    setConflictsResolved(false);
    setLoading(true);
    setError('');
    try {
      const response = await runAgent(description, teamSize, deadlineDays, nextToken, false);
      setPlan(response);
      setCustomMissionAnalysis(null);
      setAssignedTeam((response.assigned_team || []).slice(0, teamSize));
      setTeamConflicts(response.team_conflicts || []);
      setConflictsResolved((response.team_conflicts || []).length === 0);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFindOthers = async () => {
    const nextToken = reshuffleToken + 1;
    setReshuffleToken(nextToken);
    await handleRunPlan(true, nextToken);
  };

  const handleAcceptConflicts = () => {
    setConflictsResolved(true);
  };

  const handleConfirmTeam = async () => {
    if (!plan || !assignedTeam.length) {
      return;
    }

    try {
      const deadlineDate = new Date(Date.now() + Number(plan.deadline_days || 1) * 86400000)
        .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      await createTaskBoardProject({
        project_name: plan.project_name,
        priority: plan.priority,
        deadline_days: plan.deadline_days,
        deadline_date: deadlineDate,
        tasks: plan.tasks || [],
        team: assignedTeam,
        status: 'ongoing',
      });
      setTeamConfirmed(true);
      await loadCoreData();
    } catch (requestError) {
      setError(requestError.message);
    }
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
          email: String(member.name || '').toLowerCase().includes('akshaya')
            ? 'aksh.ayanuthalapati.0523@gmail.com'
            : member.email,
          role: member.role,
        })),
      });

      if (response.failed > 0) {
        const failedRecord = (response.results || []).find((row) => row.status === 'failed');
        setEmailToast({
          type: 'error',
          message: `❌ Failed to reach ${failedRecord?.email || 'a recipient'} — check SMTP`,
        });
      } else {
        setEmailToast({
          type: 'success',
          message: `✅ Assignment emails sent to ${response.sent} team members!`,
        });
      }
    } catch (requestError) {
      setEmailToast({ type: 'error', message: `❌ ${requestError.message}` });
    } finally {
      setSendingEmails(false);
    }
  };

  const handleAddMember = (bucket) => {
    setAddMemberTarget(bucket);
    setAddMemberMode('chooser');
    setMemberSearch('');
    setSelectedAddMember(null);
    setTaskBoardNotice(null);
  };

  const handleConfirmAddMember = async () => {
    if (!addMemberTarget || !selectedAddMember) {
      return;
    }

    try {
      await addTaskBoardMember(addMemberTarget.id, {
        employee_id: selectedAddMember.employee_id,
        name: selectedAddMember.name,
        email: selectedAddMember.email,
        role: selectedAddMember.role,
        current_workload_percent: selectedAddMember.current_workload_percent,
        source: selectedAddMember.source || 'imported',
        is_outreach: false,
      });

      const sendResult = await sendAssignments({
        project_name: addMemberTarget.project_name,
        priority: addMemberTarget.priority,
        deadline_days: addMemberTarget.deadline_days,
        deadline_date: addMemberTarget.deadline_date,
        tasks: (addMemberTarget.tasks || []).map((task) => ({
          name: task.name,
          description: task.description,
          duration: task.duration,
        })),
        team: [
          {
            name: selectedAddMember.name,
            email: selectedAddMember.email,
            role: selectedAddMember.role,
          },
        ],
      });

      if (sendResult.failed > 0) {
        const failed = (sendResult.results || [])[0];
        setTaskBoardNotice({
          type: 'error',
          message: `Member added, but email failed for ${failed?.email || selectedAddMember.email}.`,
        });
      } else {
        setTaskBoardNotice({
          type: 'success',
          message: `Added ${selectedAddMember.name} and emailed ${selectedAddMember.email}.`,
        });
      }

      setAddMemberTarget(null);
      setAddMemberMode('chooser');
      setSelectedAddMember(null);
      setMemberSearch('');
      await loadCoreData();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleAddOutreachMember = async (form) => {
    if (!addMemberTarget) {
      return;
    }

    setAddingOutreach(true);
    try {
      const response = await addOutreachEmployee({
        ...form,
        project_id: addMemberTarget.id,
      });

      const outreach = response?.employee;
      if (outreach?.email) {
        setTaskBoardNotice({
          type: 'success',
          message: `Outreach expert ${outreach.name} added and notified via email.`,
        });
      }

      setAddMemberTarget(null);
      setAddMemberMode('chooser');
      setSelectedAddMember(null);
      setMemberSearch('');
      await loadCoreData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAddingOutreach(false);
    }
  };

  const handleRemoveMember = async (bucket, member) => {
    await removeTaskBoardMember(bucket.id, { name: member.name });
    await loadCoreData();
  };

  const handleMarkBucketComplete = async (bucketId) => {
    await completeTaskBoardProject(bucketId);
    await loadCoreData();
  };

  const handleSaveEmployee = async (payload) => {
    setSavingEmployee(true);
    setError('');
    try {
      if (editingEmployee?.employee_id) {
        await updateEmployee(editingEmployee.employee_id, payload);
      } else {
        await addEmployee(payload);
      }
      await loadEmployeesOnly();
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
      await loadCoreData();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const renderContent = () => {
    if (activeView === 'analytics') {
      return (
        <AnalyticsDashboard
          data={{ ...analyticsData, leaderboard: sortedLeaderboard }}
          activities={analyticsActivities}
          loading={analyticsLoading}
          period={analyticsPeriod}
          onPeriodChange={handlePeriodChange}
          leaderboardSort={leaderboardSort}
          onLeaderboardSort={handleLeaderboardSort}
          onViewFullTeam={() => setActiveView('team-overview')}
        />
      );
    }

    if (activeView === 'mission-control') {
      return (
        <Orchestrator
          description={description}
          onDescriptionChange={setDescription}
          onRun={() => handleRunPlan(false)}
          onReshuffle={handleReshuffleTeam}
          loading={loading}
          projects={projects}
          teamSize={teamSize}
          onTeamSizeChange={setTeamSize}
          deadlineDays={deadlineDays}
          onDeadlineDaysChange={(value) => setDeadlineDays(Math.max(1, Math.min(365, value || 1)))}
          plan={plan}
          assignedTeam={assignedTeam}
          teamConflicts={teamConflicts}
          conflictsResolved={conflictsResolved}
          onAcceptConflicts={handleAcceptConflicts}
          onFindOthers={handleFindOthers}
          teamConfirmed={teamConfirmed}
          onConfirmTeam={handleConfirmTeam}
          onSendAssignments={handleSendAssignments}
          sendingEmails={sendingEmails}
          emailToast={emailToast}
          error={error}
          onRunCustomAnalyze={handleCustomMissionAnalyze}
          onRunCustomPlan={handleCustomMissionPlan}
          customMissionAnalysis={customMissionAnalysis}
          onResetCustomMissionAnalysis={handleResetCustomMissionAnalysis}
        />
      );
    }

    if (activeView === 'task-board') {
      return (
        <TaskBoard
          buckets={ongoingBuckets}
          priorityFilter={priorityFilter}
          onFilterChange={setPriorityFilter}
          onMarkComplete={handleMarkBucketComplete}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
          notice={taskBoardNotice}
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
            {ongoingBuckets.map((project) => (
              <ExpandableProjectCard key={project.id} project={project} badge="Ongoing" dotTone="green">
                <p className="dataset-meta">Deadline countdown: {project.deadline_days} days</p>
                <div className="bucket-lines">
                  {(project.team || []).map((member) => (
                    <div key={`${project.id}-${member.name}`} className="bucket-line">
                      <span>{member.name}</span>
                      <span>{member.current_workload_percent || 0}%</span>
                    </div>
                  ))}
                </div>
              </ExpandableProjectCard>
            ))}
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
            {[...completedBuckets, ...history].map((project, index) => {
              const teamMembers = Array.isArray(project.team) && project.team.length
                ? project.team.slice(0, 5).map((member) => ({
                  label: `${member.is_outreach ? '🌐 ' : ''}${member.name}${member.is_outreach ? ' (Outreach)' : ''}`,
                }))
                : splitValues(project.team_members || '').slice(0, 5).map((name) => ({ label: name }));
              return (
                <ExpandableProjectCard key={`${project.id || project.history_id || project.project_name}-${index}`} project={project} badge="Completed" dotTone="red">
                  <p className="dataset-meta">{project.summary || project.lessons_learned || 'Completed project.'}</p>
                  <div className="chip-row dense">
                    <span className="chip neutral">Outcome: {project.outcome || 'Successful'}</span>
                  </div>
                  <div className="chip-row dense">
                    {teamMembers.map((member, memberIndex) => (
                      <span key={`${project.project_name}-${member.label}-${memberIndex}`} className="chip blue">
                        {member.label} - C{memberIndex + 1}
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

    if (activeView === 'dataset-manager') {
      return (
        <DatasetManager
          stats={{
            employees: employees.filter((employee) => !employee.is_outreach).length,
            projects: projects.length,
            tools: tools.length,
          }}
        />
      );
    }

    return null;
  };

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onSelect={setActiveView} />
      <main className="main-panel">
        <div className="topbar page-enter">
          <div>
            <p className="eyebrow">Manager Workspace</p>
            <h2 className="page-title page-title-animate">{activeView.replace('-', ' ')}</h2>
          </div>
          <div className="topbar-meta">
            <div className="ui-live-indicator" aria-label="Animated interface status">
              <span className="ui-live-dot" />
              <span className="ui-live-track">
                <span className="ui-live-wave" />
              </span>
              <span className="ui-live-label">Interface Live</span>
            </div>
            <span>{employees.filter((employee) => !employee.is_outreach).length} employees</span>
            <span>{projects.length} projects</span>
            <span>{tools.length} tools</span>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme((value) => (value === 'light' ? 'dark' : 'light'))}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              <span className={theme === 'light' ? 'theme-toggle-icon sun' : 'theme-toggle-icon moon'}>
                {theme === 'light' ? '☀️' : '🌙'}
              </span>
              <span>{theme === 'light' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
        {error && activeView !== 'mission-control' ? <div className="error-box">{error}</div> : null}
        <div key={activeView} className="page-enter row-cascade">
          {renderContent()}
        </div>

        {addMemberTarget ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal-card">
              <div className="section-header compact">
                <div>
                  <p className="section-title">Add Member to Project</p>
                  <p className="section-subtitle">{addMemberTarget.project_name}</p>
                </div>
              </div>

              {addMemberMode === 'chooser' ? (
                <div className="member-mode-grid">
                  <button type="button" className="member-mode-card" onClick={() => setAddMemberMode('team')}>
                    <p className="section-title small">👥 From Team</p>
                    <p className="dataset-meta">Add someone already in the company employee list.</p>
                  </button>
                  <button type="button" className="member-mode-card" onClick={() => setAddMemberMode('outreach')}>
                    <p className="section-title small">🌐 Outreach Expert</p>
                    <p className="dataset-meta">Bring in an outside freelancer temporarily.</p>
                  </button>
                </div>
              ) : null}

              {addMemberMode === 'team' ? (
                <>
                  <input
                    className="search-input"
                    placeholder="Search by name, role, or email"
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                  />

                  <div className="modal-member-list">
                    {addMemberOptions.map((employee) => (
                      <button
                        key={employee.employee_id || employee.name}
                        type="button"
                        className={selectedAddMember?.name === employee.name ? 'modal-member-row active' : 'modal-member-row'}
                        onClick={() => setSelectedAddMember(employee)}
                      >
                        <div>
                          <p className="employee-name">{employee.name}</p>
                          <p className="employee-role">{employee.role}</p>
                        </div>
                        <span className="dataset-meta">{employee.email}</span>
                      </button>
                    ))}
                    {!addMemberOptions.length ? <p className="empty-state">No matching employee found.</p> : null}
                  </div>

                  <div className="card-actions">
                    <button type="button" className="primary-button" disabled={!selectedAddMember} onClick={handleConfirmAddMember}>
                      Add + Send Email
                    </button>
                    <button type="button" className="secondary-button" onClick={() => setAddMemberMode('chooser')}>
                      Back
                    </button>
                  </div>
                </>
              ) : null}

              {addMemberMode === 'outreach' ? (
                <OutreachForm
                  projectName={addMemberTarget.project_name}
                  onSubmit={handleAddOutreachMember}
                  onCancel={() => setAddMemberMode('chooser')}
                  busy={addingOutreach}
                />
              ) : null}

              <div className="card-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setAddMemberTarget(null);
                    setAddMemberMode('chooser');
                    setSelectedAddMember(null);
                    setMemberSearch('');
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};

export default App;
