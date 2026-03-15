import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const useCountUp = (target, duration = 900) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const safeTarget = Number(target || 0);
    let rafId = 0;
    const start = performance.now();
    const tick = (time) => {
      const elapsed = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setValue(Math.round(safeTarget * eased));
      if (elapsed < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [target, duration]);

  return value;
};

const STATUS_COLORS = {
  Ongoing: '#16a34a',
  Completed: '#2563eb',
  Overdue: '#dc2626',
};

const workloadColor = (value) => {
  if (value >= 75) {
    return '#dc2626';
  }
  if (value >= 50) {
    return '#f59e0b';
  }
  return '#16a34a';
};

const healthToneClass = (health) => {
  const value = String(health || '').toLowerCase();
  if (value.includes('critical')) {
    return 'chip red';
  }
  if (value.includes('risk')) {
    return 'chip amber';
  }
  return 'chip green';
};

const medal = (index) => {
  if (index === 0) {
    return '🥇';
  }
  if (index === 1) {
    return '🥈';
  }
  if (index === 2) {
    return '🥉';
  }
  return `${index + 1}.`;
};

const AnalyticsDashboard = ({
  data,
  activities,
  loading,
  period,
  onPeriodChange,
  leaderboardSort,
  onLeaderboardSort,
  onViewFullTeam,
}) => {
  const topStats = data?.top_stats || {};
  const charts = data?.charts || {};
  const secondary = data?.secondary_stats || {};
  const leaderboard = data?.leaderboard || [];
  const projectHealth = data?.project_health || [];
  const [allowMotion, setAllowMotion] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setAllowMotion(!mediaQuery.matches);
  }, []);

  const totalProjects = useCountUp(topStats.total_projects || 0, 860);
  const ongoingProjects = useCountUp(topStats.ongoing_projects || 0, 900);
  const completedProjects = useCountUp(topStats.completed_projects || 0, 930);
  const overdueProjects = useCountUp(topStats.overdue_projects || 0, 960);
  const totalEmployees = useCountUp(secondary.total_employees || 0, 840);
  const availableNow = useCountUp(secondary.available_now || 0, 870);
  const toolsInUse = useCountUp(secondary.tools_in_use || 0, 900);
  const avgRating = useCountUp(secondary.avg_team_rating || 0, 920);

  if (loading) {
    return (
      <div className="view-stack">
        <div className="analytics-skeleton-row">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="card analytics-skeleton" />
          ))}
        </div>
        <div className="analytics-skeleton-grid">
          <div className="card analytics-skeleton tall" />
          <div className="card analytics-skeleton tall" />
        </div>
      </div>
    );
  }

  const totalFromDonut = (charts.status_distribution || []).reduce((sum, row) => sum + Number(row.value || 0), 0);

  return (
    <div className="view-stack">
      <div className="analytics-top-grid">
        <div className="card stat-hero">
          <p className="stat-label">Total Projects</p>
          <p className="hero-value">{totalProjects}</p>
        </div>
        <div className="card stat-hero">
          <p className="stat-label">Ongoing Projects</p>
          <p className="hero-value">{ongoingProjects}</p>
          <span className="chip green">🟢 Active</span>
        </div>
        <div className="card stat-hero">
          <p className="stat-label">Completed Projects</p>
          <p className="hero-value">{completedProjects}</p>
          <span className="chip blue">✅ Done</span>
        </div>
        <div className="card stat-hero">
          <p className="stat-label">Overdue Projects</p>
          <p className="hero-value">{overdueProjects}</p>
          <span className="chip red">🔴 Late</span>
        </div>
      </div>

      <div className="analytics-main-layout">
        <div className="analytics-left-stack">
          <div className="analytics-chart-grid">
            <div className="card chart-card donut-animate scroll-reveal">
              <div className="section-header compact">
                <p className="section-title">Project Status Distribution</p>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                    <Pie
                      data={charts.status_distribution || []}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={92}
                      paddingAngle={4}
                      cx="50%"
                      cy="46%"
                      isAnimationActive={allowMotion}
                      animationBegin={90}
                      animationDuration={740}
                    >
                      {(charts.status_distribution || []).map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#64748b'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="dataset-meta">Total: {totalFromDonut}</p>
            </div>

            <div className="card chart-card scroll-reveal">
              <div className="section-header compact">
                <p className="section-title">Team Utilization</p>
              </div>
              <div className="chart-wrap scroll-x">
                <ResponsiveContainer width={Math.max(700, (charts.team_utilization || []).length * 60)} height={260}>
                  <BarChart data={charts.team_utilization || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" interval={0} angle={-25} height={70} textAnchor="end" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="workload_percent" radius={[8, 8, 0, 0]} isAnimationActive={allowMotion} animationBegin={120} animationDuration={740}>
                      {(charts.team_utilization || []).map((row) => (
                        <Cell key={row.name} fill={workloadColor(Number(row.workload_percent || 0))} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card chart-card line-animate scroll-reveal">
              <div className="section-header compact">
                <p className="section-title">Task Completion Rate</p>
                <div className="chip-row dense">
                  <button type="button" className={period === '7d' ? 'preset-chip active-chip' : 'preset-chip'} onClick={() => onPeriodChange('7d')}>7d</button>
                  <button type="button" className={period === '30d' ? 'preset-chip active-chip' : 'preset-chip'} onClick={() => onPeriodChange('30d')}>30d</button>
                </div>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={charts.task_completion_trend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      isAnimationActive={allowMotion}
                      animationBegin={140}
                      animationDuration={860}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card chart-card scroll-reveal">
              <div className="section-header compact">
                <p className="section-title">Priority Breakdown</p>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={charts.priority_breakdown || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="high" stackId="a" fill="#dc2626" name="High" isAnimationActive={allowMotion} animationBegin={120} animationDuration={720} />
                    <Bar dataKey="medium" stackId="a" fill="#f59e0b" name="Medium" isAnimationActive={allowMotion} animationBegin={150} animationDuration={720} />
                    <Bar dataKey="low" stackId="a" fill="#16a34a" name="Low" isAnimationActive={allowMotion} animationBegin={180} animationDuration={720} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="analytics-top-grid compact">
            <div className="card stat-hero compact"><p className="stat-label">Total Employees</p><p className="hero-value small">{totalEmployees}</p></div>
            <div className="card stat-hero compact"><p className="stat-label">Available Right Now</p><p className="hero-value small">{availableNow}</p></div>
            <div className="card stat-hero compact"><p className="stat-label">Avg Team Rating</p><p className="hero-value small">{avgRating}/10</p></div>
            <div className="card stat-hero compact"><p className="stat-label">Tools In Use</p><p className="hero-value small">{toolsInUse}</p></div>
          </div>

          <div className="card">
            <div className="section-header compact">
              <p className="section-title">Employee Performance Leaderboard</p>
              <button type="button" className="secondary-button" onClick={onViewFullTeam}>View Full Team</button>
            </div>
            <div className="table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Employee</th>
                    <th><button type="button" className="sort-header" onClick={() => onLeaderboardSort('rating')}>Rating</button></th>
                    <th><button type="button" className="sort-header" onClick={() => onLeaderboardSort('projects')}>Projects</button></th>
                    <th><button type="button" className="sort-header" onClick={() => onLeaderboardSort('on_time')}>On Time</button></th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length ? leaderboard.map((row, index) => (
                    <tr key={row.name}>
                      <td>{medal(index)}</td>
                      <td>{index === 0 ? `⭐ ${row.name}` : row.name}</td>
                      <td>{row.rating}/10</td>
                      <td>{row.projects}</td>
                      <td>{row.on_time}%</td>
                      <td><span className={String(row.status).toLowerCase() === 'busy' ? 'chip red' : 'chip green'}>{String(row.status).toLowerCase() === 'busy' ? '🔴 Busy' : '🟢 Free'}</span></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="empty-state">No employee metrics yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <p className="section-title">Project Health Scorecard</p>
            <div className="view-stack">
              {projectHealth.length ? projectHealth.map((row) => (
                <div key={row.project_name} className="health-row">
                  <div>
                    <p className="employee-name">{row.project_name}</p>
                    <p className="dataset-meta">Team: {(row.team || []).join(', ') || 'No team'} · Deadline: {row.deadline_days} days</p>
                  </div>
                  <div className="health-right">
                    <div className="bucket-progress-track wide">
                      <div className="bucket-progress-fill" style={{ '--fill-scale': (row.progress || 0) / 100 }} />
                    </div>
                    <span>{row.progress || 0}%</span>
                    <span className={healthToneClass(row.health)}>{row.health}</span>
                  </div>
                </div>
              )) : <p className="empty-state">No projects yet - run your first mission!</p>}
            </div>
          </div>
        </div>

        <div className="analytics-right-panel card">
          <p className="section-title">Recent Activity</p>
          <div className="view-stack">
            {activities.length ? activities.map((item) => (
              <div key={item.id} className="activity-row">
                <p className="employee-name">{item.title}</p>
                <p className="dataset-meta">{item.detail} · {item.time_ago}</p>
              </div>
            )) : <p className="empty-state">No activity yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
