import { useMemo, useState } from 'react';
import EmployeeCard from './EmployeeCard';

const PAGE_SIZE = 12;

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

      <div className="employee-directory-grid stagger-grid">
        {pageSlice.map((employee, index) => {
          const isAssigned = assignedNames.has(employee.name);

          return (
            <EmployeeCard
              key={employee.employee_id || employee.name}
              employee={employee}
              isAssigned={isAssigned}
              onEdit={onEdit}
              onDelete={onDelete}
              style={{ '--stagger-index': index }}
            />
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
