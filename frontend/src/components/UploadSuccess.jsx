const UploadSuccess = ({ summary }) => {
  if (!summary) {
    return null;
  }

  const imported = summary.imported_records || {};
  const totalImported = Object.values(imported).reduce((acc, value) => acc + Number(value || 0), 0);

  return (
    <div className="card">
      <p className="section-title small">Bulk Upload Complete</p>
      <p className="section-subtitle">Entire platform rebuilt from uploaded datasets.</p>
      <div className="chip-row">
        <span className="chip green">Imported: {totalImported}</span>
        <span className="chip blue">Manual preserved: {summary.manual_records_preserved || 0}</span>
        <span className="chip amber">Duplicates skipped: {summary.duplicates_skipped || 0}</span>
        <span className="chip neutral">Errors: {summary.errors || 0}</span>
      </div>
      <div className="assignment-list wide">
        <div className="assignment-item"><p className="assignment-name">Employees</p><span>{imported.employees || 0}</span></div>
        <div className="assignment-item"><p className="assignment-name">Projects</p><span>{imported.projects || 0}</span></div>
        <div className="assignment-item"><p className="assignment-name">Tools</p><span>{imported.tools || 0}</span></div>
        <div className="assignment-item"><p className="assignment-name">History</p><span>{imported.history || 0}</span></div>
      </div>
    </div>
  );
};

export default UploadSuccess;
