import { useMemo, useState } from 'react';

const PAGE_SIZE = 12;

const splitSkills = (value) =>
  String(value || '')
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);

const computeRating = (employee) => {
  const explicit = Number(employee.rating || 0);
  if (explicit > 0) {
    return Math.max(1, Math.min(10, Math.round(explicit)));
  }
  const skillCount = splitSkills(employee.skills).length;
  const workload = Number(employee.current_workload_percent || 0);
  const capacity = Math.max(0, 100 - workload);
  return Math.max(1, Math.min(10, Math.round((skillCount * 1.2) + (capacity * 0.08))));
};

const EmployeeDirectory = ({ employees, assignedNames, onEdit, onDelete }) => {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return employees;
    }
    return employees.filter((employee) => {
      const haystack = [employee.name, employee.role, employee.skills].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [employees, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  return (
    <div className="view-stack">
      <div className="section-header">
        <div>
          <p className="section-title">Employees</p>
          <p className="section-subtitle">Find and manage your team quickly.</p>
        </div>
        <input
          className="search-input"
          placeholder="Search by name, role, or skill"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="employee-directory-grid">
        {pageSlice.map((employee) => {
          const rating = computeRating(employee);
          const skills = splitSkills(employee.skills).slice(0, 8);
          const isAssigned = assignedNames.has(employee.name);

          return (
            <div key={employee.employee_id || employee.name} className="card dataset-card hover-lift">
              <div className="section-header compact">
                <div>
                  <p className="section-title small">{employee.name}</p>
                  <p className="section-subtitle">{employee.role}</p>
                  <p className="dataset-meta" title={employee.email || 'N/A'}>
                    📧 {employee.email || 'N/A'}
                  </p>
                </div>
                <span className="rating-badge">{rating}/10</span>
              </div>

              <p className="dataset-meta">Location: {employee.location || 'N/A'}</p>
              <p className="dataset-meta">Workload: {employee.current_workload_percent}%</p>

              <div className="chip-row dense">
                <span className={isAssigned ? 'status-pill assigned' : 'status-pill available'}>
                  {isAssigned ? '🔴 Assigned' : '🟢 Available'}
                </span>
              </div>

              <div className="chip-row dense">
                {skills.map((skill) => (
                  <span key={`${employee.name}-${skill}`} className="chip neutral">
                    {skill}
                  </span>
                ))}
              </div>

              <div className="card-actions">
                <button type="button" className="secondary-button" onClick={() => onEdit(employee)}>
                  ✏️ Edit
                </button>
                <button type="button" className="secondary-button danger" onClick={() => onDelete(employee)}>
                  🗑️ Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pagination-controls">
        <button type="button" className="secondary-button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
          Previous
        </button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 8).map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={pageNumber === safePage ? 'preset-chip active-chip' : 'preset-chip'}
            onClick={() => setPage(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}
        <button type="button" className="secondary-button" disabled={safePage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
          Next
        </button>
      </div>
    </div>
  );
};

export default EmployeeDirectory;
