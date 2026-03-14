import { useMemo, useState } from 'react';

const PAGE_SIZE = 18;

const computeRating = (employee) => {
  const skills = String(employee.skills || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const workload = Number(employee.current_workload_percent || 0);
  const capacity = Math.max(0, 100 - workload);
  const score = Math.round((skills.length * 1.2) + (capacity * 0.08));
  return Math.max(1, Math.min(10, score));
};

const EmployeeDirectory = ({ employees }) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(employees.length / PAGE_SIZE));

  const pagedEmployees = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return employees.slice(start, start + PAGE_SIZE);
  }, [employees, page]);

  return (
    <div className="view-stack">
      <div className="section-header">
        <div>
          <p className="section-title">Employees</p>
          <p className="section-subtitle">Full workforce directory with deterministic performance ratings.</p>
        </div>
        <div className="pagination-controls">
          <button type="button" className="secondary-button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
            Previous
          </button>
          <span className="page-label">Page {page} / {totalPages}</span>
          <button type="button" className="secondary-button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages}>
            Next
          </button>
        </div>
      </div>

      <div className="employee-directory-grid">
        {pagedEmployees.map((employee) => {
          const rating = computeRating(employee);
          return (
            <div key={employee.employee_id || employee.name} className="card dataset-card hover-lift">
              <div className="section-header compact">
                <div>
                  <p className="section-title small">{employee.name}</p>
                  <p className="section-subtitle">{employee.role}</p>
                </div>
                <span className="rating-badge">{rating}★</span>
              </div>
              <p className="dataset-meta">Location: {employee.location || 'N/A'}</p>
              <p className="dataset-meta">Workload: {employee.current_workload_percent}%</p>
              <div className="chip-row dense">
                {String(employee.skills)
                  .split(',')
                  .map((skill) => skill.trim())
                  .filter(Boolean)
                  .slice(0, 8)
                  .map((skill) => (
                    <span key={`${employee.name}-${skill}`} className="chip neutral">{skill}</span>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmployeeDirectory;
