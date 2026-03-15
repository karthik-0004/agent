import { useEffect, useMemo, useState } from 'react';
import {
  changeEmployeePassword,
  createDailyLog,
  getDailyLogs,
  getEmployeeChat,
  getEmployeeDashboardSummary,
  getEmployeeNotifications,
  getEmployeePerformance,
  getEmployeeProfile,
  getEmployeeTasks,
  getEmployeeTeam,
  markNotificationsRead,
  sendEmployeeChat,
  submitLeaveRequest,
  updateEmployeeAvailability,
  updateEmployeeProfile,
  updateEmployeeTaskProgress,
} from '../api/agentApi';
import DailyTracker from './DailyTracker';
import EmployeeSidebar from './EmployeeSidebar';
import MyPerformance from './MyPerformance';
import MyProfile from './MyProfile';
import MyTasks from './MyTasks';
import MyTeam from './MyTeam';
import Notifications from './Notifications';
import QueryChat from './QueryChat';

const EmployeeDashboard = ({ employee, onLogout }) => {
  const [activeView, setActiveView] = useState('home');
  const [summary, setSummary] = useState({});
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState({ logs: [], weekly_summary: {} });
  const [team, setTeam] = useState({ members: [], project_deadline_days: 0 });
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState({ unread_count: 0, items: [] });
  const [performance, setPerformance] = useState({});
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  const loadAll = async () => {
    try {
      const [summaryData, taskData, logsData, teamData, chatData, notificationData, performanceData, profileData] = await Promise.all([
        getEmployeeDashboardSummary(),
        getEmployeeTasks('all'),
        getDailyLogs(),
        getEmployeeTeam(),
        getEmployeeChat(),
        getEmployeeNotifications(),
        getEmployeePerformance(),
        getEmployeeProfile(),
      ]);
      setSummary(summaryData || {});
      setTasks(taskData || []);
      setLogs(logsData || { logs: [], weekly_summary: {} });
      setTeam(teamData || { members: [], project_deadline_days: 0 });
      setMessages(chatData || []);
      setNotifications(notificationData || { unread_count: 0, items: [] });
      setPerformance(performanceData || {});
      setProfile(profileData || null);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => {
    loadAll();
    const timer = window.setInterval(loadAll, 10000);
    return () => window.clearInterval(timer);
  }, []);

  const urgentBanner = useMemo(() => {
    if (summary.urgent_status === 'overdue') {
      return <div className="error-box">Urgent: You have overdue tasks. Please update immediately.</div>;
    }
    if (summary.urgent_status === 'due_tomorrow') {
      return <div className="card warning-card">Heads up: One or more tasks are due tomorrow.</div>;
    }
    return null;
  }, [summary]);

  const renderView = () => {
    if (activeView === 'home') {
      return (
        <div className="view-stack">
          {urgentBanner}
          <div className="stats-row">
            <div className="stat-card"><span className="stat-label">Active Tasks</span><strong className="stat-value">{summary.active_tasks || 0}</strong></div>
            <div className="stat-card"><span className="stat-label">Team Members</span><strong className="stat-value">{summary.team_members || 0}</strong></div>
            <div className="stat-card"><span className="stat-label">Deadline Remaining</span><strong className="stat-value">{summary.deadline_days || 0} days</strong></div>
          </div>
          <div className="card">
            <p className="section-title">{summary.greeting || `Welcome, ${employee.full_name}`}</p>
            <p className="section-subtitle">{summary.motivation || 'You are doing great. Keep the momentum.'}</p>
          </div>
        </div>
      );
    }
    if (activeView === 'tasks') {
      return <MyTasks tasks={tasks} onUpdate={async (task, progress, complete) => { await updateEmployeeTaskProgress({ project_id: task.project_id, task_name: task.task_name, progress_percent: progress, mark_complete: complete }); await loadAll(); }} />;
    }
    if (activeView === 'tracker') {
      return <DailyTracker logs={logs.logs} weeklySummary={logs.weekly_summary} onCreate={async (payload) => { await createDailyLog(payload); await loadAll(); }} />;
    }
    if (activeView === 'team') {
      return <MyTeam team={team} />;
    }
    if (activeView === 'chat') {
      return <QueryChat messages={messages} onSendMessage={async (payload) => { await sendEmployeeChat(payload); await loadAll(); }} onSendLeave={async (payload) => { await submitLeaveRequest(payload); await loadAll(); }} />;
    }
    if (activeView === 'notifications') {
      return <Notifications data={notifications} onMarkRead={async (payload) => { await markNotificationsRead(payload); await loadAll(); }} />;
    }
    if (activeView === 'performance') {
      return <MyPerformance stats={performance} />;
    }
    if (activeView === 'profile') {
      return <MyProfile profile={profile} onUpdateProfile={async (payload) => { await updateEmployeeProfile(payload); await loadAll(); }} onChangePassword={async (payload) => { await changeEmployeePassword(payload); }} onUpdateAvailability={async (payload) => { await updateEmployeeAvailability(payload); await loadAll(); }} />;
    }
    return null;
  };

  return (
    <div className="app-shell employee-shell">
      <EmployeeSidebar activeView={activeView} onSelect={setActiveView} unreadCount={notifications.unread_count || 0} />
      <main className="main-panel">
        <div className="topbar">
          <div>
            <p className="eyebrow">Employee Workspace</p>
            <h2 className="page-title">{activeView.replace('-', ' ')}</h2>
          </div>
          <div className="topbar-meta">
            <button type="button" className="secondary-button" onClick={() => {
              localStorage.removeItem('neuraxEmployeeToken');
              localStorage.removeItem('neuraxEmployeeProfile');
              onLogout();
            }}>Logout</button>
          </div>
        </div>
        {error ? <div className="error-box">{error}</div> : null}
        {renderView()}
      </main>
    </div>
  );
};

export default EmployeeDashboard;
