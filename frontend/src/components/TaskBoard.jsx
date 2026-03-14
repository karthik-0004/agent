import { useMemo, useState } from 'react';

const PriorityBadge = ({ priority }) => {
  const level = priority || 'Low';
  const tone = level === 'High' ? 'high' : level === 'Medium' ? 'medium' : 'low';
  const label = level === 'High' ? '🔴 High' : level === 'Medium' ? '🟡 Medium' : '🟢 Low';
  return <span className={`priority-pill ${tone}`}>{label}</span>;
};

const progressFromWorkload = (workload) => {
  const value = Math.max(10, Math.min(95, 100 - Number(workload || 0)));
  return value;
};

const TaskBoard = ({ buckets, priorityFilter, onFilterChange, onMarkComplete, onAddMember, onRemoveMember, notice }) => {
  const visibleBuckets = useMemo(() => {
    if (priorityFilter === 'All') {
      return buckets;
    }
    return buckets.filter((bucket) => bucket.priority === priorityFilter);
  }, [buckets, priorityFilter]);

  return (
    <div className="view-stack">
      <div className="section-header">
        <div>
          <p className="section-title">Task Board</p>
          <p className="section-subtitle">Projects grouped as clear delivery buckets.</p>
        </div>
        <div className="chip-row">
          {['All', 'High', 'Medium', 'Low'].map((item) => (
            <button
              key={item}
              type="button"
              className={priorityFilter === item ? 'preset-chip active-chip' : 'preset-chip'}
              onClick={() => onFilterChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="view-stack">
        {notice ? (
          <div className={notice.type === 'success' ? 'toast-success' : 'toast-fail'}>
            {notice.message}
          </div>
        ) : null}
        {visibleBuckets.length ? (
          visibleBuckets.map((bucket) => (
            <div key={bucket.id} className="card bucket-card hover-lift">
              <div className="bucket-header">
                <div>
                  <p className="bucket-title">🟢 Project: {bucket.project_name}</p>
                  <p className="dataset-meta">Deadline: {bucket.deadline_days} days</p>
                </div>
                <PriorityBadge priority={bucket.priority} />
              </div>

              <div className="bucket-lines">
                {bucket.team.map((member) => (
                  <div key={`${bucket.id}-${member.name}`} className="bucket-line">
                    <span>
                      {member.name}
                      <button
                        type="button"
                        className="mini-icon-button"
                        onClick={() => onRemoveMember(bucket, member)}
                      >
                        ✖️
                      </button>
                    </span>
                    <div className="bucket-progress-wrap">
                      <div className="bucket-progress-track">
                        <div
                          className="bucket-progress-fill"
                          style={{ width: `${progressFromWorkload(member.current_workload_percent)}%` }}
                        />
                      </div>
                      <span>{progressFromWorkload(member.current_workload_percent)}%</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card-actions">
                <button type="button" className="secondary-button" onClick={() => onAddMember(bucket)}>
                  ➕ Add Member
                </button>
                <button type="button" className="secondary-button" onClick={() => onMarkComplete(bucket.id)}>
                  ✅ Mark Complete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="card empty-state">No projects in this priority bucket.</div>
        )}
      </div>
    </div>
  );
};

export default TaskBoard;
