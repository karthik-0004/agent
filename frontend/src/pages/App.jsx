import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getEmployees,
  getHistory,
  getProjects,
  getTools,
  replanAgent,
  runAgent,
} from '../api/agentApi';
import Orchestrator from '../components/Orchestrator';
import Sidebar from '../components/Sidebar';
import TaskBoard from '../components/TaskBoard';
import TeamLoad from '../components/TeamLoad';
import IntroScreen from '../components/IntroScreen';
import EmployeeDirectory from '../components/EmployeeDirectory';

const pipelineMessages = [
  'Analyzing request language, priority, and deadline.',
  'Decomposing the initiative into executable tasks.',
  'Scoring employees by skill overlap and available capacity.',
  'Selecting supporting tools from the Neurax toolchain.',
  'Assigning the most suitable team members to each task.',
  'Finalizing the plan package for review.',
];

const DatasetSection = ({ title, subtitle, items, renderItem }) => (
  <div className="view-stack">
    <div className="section-header">
      <div>
        <p className="section-title">{title}</p>
        <p className="section-subtitle">{subtitle}</p>
      </div>
    </div>
    <div className="dataset-grid">{items.map(renderItem)}</div>
  </div>
);

const App = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [workspaceVisible, setWorkspaceVisible] = useState(false);
  const [activeView, setActiveView] = useState('orchestrator');
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tools, setTools] = useState([]);
  const [history, setHistory] = useState([]);
  const [projectDescription, setProjectDescription] = useState('');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [thinkingLog, setThinkingLog] = useState([]);
  const [error, setError] = useState('');
  const [completedTasks, setCompletedTasks] = useState([]);
  const [activeAssignments, setActiveAssignments] = useState({ currently_assigned: [], available: [] });
  const pipelineTimer = useRef(null);

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const [employeeData, projectData, toolData, historyData] = await Promise.all([
          getEmployees(),
          getProjects(),
          getTools(),
          getHistory(),
        ]);
        setEmployees(employeeData);
        setProjects(projectData);
        setTools(toolData);
        setHistory(historyData);
        if (projectData[0]?.description) {
          setProjectDescription(projectData[0].description);
        }
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

    fetchDatasets();
    const timer = window.setTimeout(() => setWorkspaceVisible(true), 120);

    return () => {
      window.clearInterval(pipelineTimer.current);
      window.clearTimeout(timer);
    };
  }, []);

  const workloadUpdate = plan?.employee_workload_update || {};
  const assignmentCounts = plan?.assignment_counts || {};
  const employeeMatchMap = useMemo(() => {
    const map = new Map();
    (plan?.employee_matches || []).forEach((row) => map.set(row.name, row));
    return map;
  }, [plan]);
  const enrichedEmployees = useMemo(
    () =>
      employees.map((employee) => {
        const match = employeeMatchMap.get(employee.name);
        return {
          ...employee,
          performance_rating: match?.performance_rating,
          deadline_risk: Boolean(match?.deadline_risk),
        };
      }),
    [employees, employeeMatchMap]
  );
  const completedTaskNames = useMemo(() => completedTasks.map((task) => task.name), [completedTasks]);

  const startPipeline = (prefix) => {
    window.clearInterval(pipelineTimer.current);
    setPipelineStep(0);
    setThinkingLog([`${prefix}: request accepted.`]);
    let currentStep = 0;
    pipelineTimer.current = window.setInterval(() => {
      setPipelineStep((previous) => (previous < pipelineMessages.length - 1 ? previous + 1 : previous));
      setThinkingLog((previous) => {
        if (currentStep >= pipelineMessages.length) {
          return previous;
        }
        const nextEntry = `${prefix}: ${pipelineMessages[currentStep]}`;
        currentStep += 1;
        return previous.includes(nextEntry) ? previous : [...previous, nextEntry];
      });
      if (currentStep >= pipelineMessages.length) {
        window.clearInterval(pipelineTimer.current);
      }
    }, 500);
  };

  const stopPipeline = (finalEntries = []) => {
    window.clearInterval(pipelineTimer.current);
    setPipelineStep(pipelineMessages.length - 1);
    if (finalEntries.length) {
      setThinkingLog((previous) => [...previous, ...finalEntries]);
    }
  };

  const handleRunAgent = async () => {
    setLoading(true);
    setError('');
    setCompletedTasks([]);
    startPipeline('Run');

    try {
      const response = await runAgent(projectDescription);
      setPlan(response);
      setActiveAssignments(response.active_assignments || { currently_assigned: [], available: [] });
      stopPipeline([
        `Run: priority resolved as ${response.priority}.`,
        `Run: generated ${response.tasks.length} tasks for ${response.project_name}.`,
        `Run: ${response.reasoning}`,
        ...(response.alerts || []).map((message) => `Run alert: ${message}`),
      ]);
      setActiveView('orchestrator');
    } catch (requestError) {
      stopPipeline([`Run failed: ${requestError.message}`]);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async (task) => {
    const updatedCompletedTasks = [...completedTasks, task];
    setCompletedTasks(updatedCompletedTasks);

    const remainingTasks = (plan?.tasks || []).filter((item) => item.name !== task.name);
    if (!remainingTasks.length) {
      setPlan((previousPlan) => ({
        ...previousPlan,
        tasks: [],
      }));
      return;
    }

    const remainingDescription = [
      `Continue project ${plan?.project_name || 'initiative'} with the remaining scope.`,
      ...remainingTasks.map(
        (item) => `Task: ${item.name}. Description: ${item.description}. Duration: ${item.duration} days.`
      ),
    ].join(' ');

    setLoading(true);
    setError('');
    startPipeline('Replan');

    try {
      const response = await replanAgent(updatedCompletedTasks, remainingDescription);
      setPlan(response);
      setActiveAssignments(response.active_assignments || { currently_assigned: [], available: [] });
      stopPipeline([
        `Replan: completed task ${task.name} recorded.`,
        `Replan: replanned ${response.tasks.length} remaining tasks.`,
        `Replan: ${response.reasoning}`,
        ...(response.alerts || []).map((message) => `Replan alert: ${message}`),
      ]);
      setActiveView('task-board');
    } catch (requestError) {
      stopPipeline([`Replan failed: ${requestError.message}`]);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'orchestrator':
        return (
          <Orchestrator
            description={projectDescription}
            onDescriptionChange={setProjectDescription}
            onRun={handleRunAgent}
            loading={loading}
            pipelineStep={pipelineStep}
            thinkingLog={thinkingLog}
            plan={plan}
            error={error}
            projects={projects}
          />
        );
      case 'task-board':
        return (
          <TaskBoard
            plan={plan}
            completedTaskNames={completedTaskNames}
            onMarkComplete={handleMarkComplete}
            loading={loading}
          />
        );
      case 'team-load':
        return (
          <div className="view-stack">
            <div className="section-header">
              <div>
                <p className="section-title">Team Load</p>
                <p className="section-subtitle">Capacity and assignment pressure across the team.</p>
              </div>
            </div>
            <TeamLoad
              employees={enrichedEmployees}
              workloadUpdate={workloadUpdate}
              assignmentCounts={assignmentCounts}
            />
          </div>
        );
      case 'past-projects':
        return (
          <DatasetSection
            title="Past Projects"
            subtitle="Historical delivery context used by the agent"
            items={history}
            renderItem={(item) => (
              <div key={item.history_id} className="card dataset-card">
                <div className="section-header compact">
                  <div>
                    <p className="section-title small">{item.project_name}</p>
                    <p className="section-subtitle">Outcome: {item.outcome}</p>
                  </div>
                </div>
                <p className="task-description">{item.summary}</p>
                <div className="chip-row dense">
                  {String(item.key_skills)
                    .split(',')
                    .map((skill) => skill.trim())
                    .filter(Boolean)
                    .map((skill) => (
                      <span key={skill} className="chip blue">{skill}</span>
                    ))}
                </div>
                <div className="chip-row dense">
                  {String(item.tools_used)
                    .split(',')
                    .map((tool) => tool.trim())
                    .filter(Boolean)
                    .map((tool) => (
                      <span key={tool} className="chip green">{tool}</span>
                    ))}
                </div>
              </div>
            )}
          />
        );
      case 'employees':
        return <EmployeeDirectory employees={enrichedEmployees} />;
      case 'projects':
        return (
          <DatasetSection
            title="Projects"
            subtitle="Preset project briefs from the backend"
            items={projects}
            renderItem={(item) => (
              <div key={item.project_id} className="card dataset-card">
                <div className="section-header compact">
                  <div>
                    <p className="section-title small">{item.project_name}</p>
                    <p className="section-subtitle">Priority: {item.priority}</p>
                  </div>
                  <span className="chip amber">{item.deadline_days}d</span>
                </div>
                <p className="task-description">{item.description}</p>
                <div className="chip-row dense">
                  {String(item.required_skills)
                    .split(',')
                    .map((skill) => skill.trim())
                    .filter(Boolean)
                    .map((skill) => (
                      <span key={skill} className="chip blue">{skill}</span>
                    ))}
                </div>
              </div>
            )}
          />
        );
      case 'tools':
        return (
          <DatasetSection
            title="Tools"
            subtitle="Relevant tools available for planning"
            items={tools}
            renderItem={(item) => (
              <div key={item.tool_id} className="card dataset-card">
                <p className="section-title small">{item.name}</p>
                <p className="section-subtitle">{item.category}</p>
                <p className="dataset-meta">Purpose: {item.purpose_keywords}</p>
                <div className="chip-row dense">
                  {String(item.supported_skills)
                    .split(',')
                    .map((skill) => skill.trim())
                    .filter(Boolean)
                    .map((skill) => (
                      <span key={skill} className="chip green">{skill}</span>
                    ))}
                </div>
              </div>
            )}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {showIntro ? <IntroScreen onEnter={() => setShowIntro(false)} /> : null}
      <div className={workspaceVisible && !showIntro ? 'workspace-transition visible' : 'workspace-transition'}>
        <div className="app-shell">
          <Sidebar activeView={activeView} onSelect={setActiveView} activeAssignments={activeAssignments} />
          <main className="main-panel">
            <div className="topbar">
              <div>
                <p className="eyebrow">Operational Workspace</p>
                <h2 className="page-title">{activeView.replace('-', ' ')}</h2>
              </div>
              <div className="topbar-meta">
                <span>{employees.length} employees</span>
                <span>{projects.length} projects</span>
                <span>{tools.length} tools</span>
              </div>
            </div>
            {renderContent()}
          </main>
        </div>
      </div>
    </>
  );
};

export default App;
