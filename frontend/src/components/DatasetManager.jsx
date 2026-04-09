import { useEffect, useMemo, useState } from 'react';
import {
  confirmProjectBriefPdfAppend,
  confirmDatasetRebuild,
  forceDatasetReload,
  getDatasetStatus,
  uploadProjectBriefPdf,
  uploadEmployeesDataset,
  uploadHistoryDataset,
  uploadProjectsDataset,
  uploadToolsDataset,
} from '../api/agentApi';
import UploadZone from './UploadZone';
import UploadPreview from './UploadPreview';
import UploadProgress from './UploadProgress';
import UploadSuccess from './UploadSuccess';

const uploaderMap = {
  employees: uploadEmployeesDataset,
  projects: uploadProjectsDataset,
  tools: uploadToolsDataset,
  history: uploadHistoryDataset,
};

const CARD_META = {
  employees: { icon: '👥', title: 'Employees Dataset' },
  projects: { icon: '📁', title: 'Projects Dataset' },
  tools: { icon: '🔧', title: 'Tools Dataset' },
  history: { icon: '🕰️', title: 'History Dataset' },
};

const DatasetManager = ({ stats }) => {
  const [previews, setPreviews] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [pdfConfirming, setPdfConfirming] = useState(false);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [progress, setProgress] = useState({ percent: 0 });
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState({ pending: {}, updated_at: null, imported_records: {}, summary: {} });

  const readyCount = useMemo(() => Object.keys(previews).length, [previews]);

  useEffect(() => {
    getDatasetStatus()
      .then((payload) => setStatus(payload || {}))
      .catch(() => {
        // keep UI resilient
      });
  }, []);

  const handleFile = async (dataset, file) => {
    if (!file) {
      return;
    }
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const payload = await uploaderMap[dataset](file);
      setPreviews((previous) => ({ ...previous, [dataset]: payload }));
      setNotice(`${file.name} prepared for ${dataset}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCancelPreview = () => {
    setPreviews({});
    setNotice('Selection cleared.');
  };

  const handleReloadAll = async () => {
    setReloading(true);
    setError('');
    try {
      const payload = await forceDatasetReload();
      setStatus((previous) => ({ ...previous, ...payload }));
      setNotice('All datasets reloaded from the database.');
      window.dispatchEvent(new CustomEvent('neurax:bulk-sync-complete', { detail: payload }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setReloading(false);
    }
  };

  const handleConfirm = async () => {
    setRebuilding(true);
    setError('');
    setNotice('');
    setSummary(null);
    try {
      setProgress({ percent: 20 });
      await new Promise((resolve) => setTimeout(resolve, 150));
      setProgress({ percent: 45 });
      await new Promise((resolve) => setTimeout(resolve, 150));
      setProgress({ percent: 72 });
      const payload = await confirmDatasetRebuild();
      setProgress({ percent: 100 });
      setSummary(payload);
      setStatus((previous) => ({ ...previous, ...payload }));
      setNotice('Bulk import completed successfully.');
      setPreviews({});
      window.dispatchEvent(new CustomEvent('neurax:bulk-sync-complete', { detail: payload }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRebuilding(false);
    }
  };

  const handlePdfBriefUpload = async (file) => {
    if (!file) {
      return;
    }
    setPdfProcessing(true);
    setError('');
    setNotice('Reading and analysing project brief...');
    try {
      const payload = await uploadProjectBriefPdf(file);
      setPdfPreview(payload);
      setNotice('PDF extraction complete. Review fields before append.');
    } catch (requestError) {
      setError(requestError.message);
      setNotice('');
    } finally {
      setPdfProcessing(false);
    }
  };

  const handlePdfRecordChange = (index, key, value) => {
    setPdfPreview((previous) => {
      if (!previous?.records) {
        return previous;
      }
      const nextRecords = previous.records.map((record, rowIndex) => {
        if (rowIndex !== index) {
          return record;
        }
        return {
          ...record,
          [key]: key === 'deadline_days' ? Number(value || 0) : value,
        };
      });
      return {
        ...previous,
        records: nextRecords,
      };
    });
  };

  const handlePdfSkillsChange = (index, value) => {
    const skills = String(value || '')
      .split(/[;,|]/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    handlePdfRecordChange(index, 'required_skills', skills);
  };

  const handleConfirmPdfAppend = async () => {
    if (!pdfPreview?.token) {
      return;
    }
    setPdfConfirming(true);
    setError('');
    try {
      const payload = await confirmProjectBriefPdfAppend({
        token: pdfPreview.token,
        records: pdfPreview.records || [],
      });
      setPdfPreview(null);
      setNotice(`Project appended and ready to plan. Added ${payload.inserted || 0}, updated ${payload.updated || 0}.`);
      window.dispatchEvent(new CustomEvent('neurax:bulk-sync-complete', { detail: payload }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPdfConfirming(false);
    }
  };

  return (
    <div className="view-stack dataset-manager-page">
      <section className="card dataset-hero-card">
        <div className="dataset-hero-head">
          <div>
            <p className="section-title">📂 Dataset Manager</p>
            <p className="section-subtitle">Power your platform with fresh data.</p>
            <p className="section-subtitle">Upload any format and the system adapts itself.</p>
          </div>
        </div>

        <div className="dataset-hero-stats">
          <div className="dataset-stat-pill">
            <span className="dataset-stat-value">{stats?.employees ?? 0}</span>
            <span className="dataset-stat-label">employees</span>
          </div>
          <div className="dataset-stat-pill">
            <span className="dataset-stat-value">{stats?.projects ?? 0}</span>
            <span className="dataset-stat-label">projects</span>
          </div>
          <div className="dataset-stat-pill">
            <span className="dataset-stat-value">{stats?.tools ?? 0}</span>
            <span className="dataset-stat-label">tools</span>
          </div>
        </div>
      </section>

      <section className="dataset-manager-grid">
        {['employees', 'projects', 'tools', 'history'].map((dataset) => (
          <UploadZone
            key={dataset}
            icon={CARD_META[dataset].icon}
            title={CARD_META[dataset].title}
            datasetKey={dataset}
            loadedCount={status?.imported_records?.[dataset] ?? status?.summary?.[dataset] ?? 0}
            lastLoadedAt={status?.updated_at}
            preview={previews[dataset]}
            busy={uploading || rebuilding || reloading}
            onFile={handleFile}
          />
        ))}
      </section>

      <section className="card dataset-hero-card">
        <div className="section-header compact">
          <div>
            <p className="section-title small">📄 Project Brief PDF</p>
            <p className="section-subtitle">Upload a client brief PDF to extract and append project presets.</p>
          </div>
        </div>

        <div className="card-actions" style={{ marginTop: 0 }}>
          <label className="secondary-button" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {pdfProcessing ? 'Reading and analysing document...' : 'Upload Project Brief PDF'}
            <input
              type="file"
              accept=".pdf"
              className="upload-hidden-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  handlePdfBriefUpload(file);
                }
                event.target.value = '';
              }}
              disabled={pdfProcessing || pdfConfirming}
            />
          </label>
        </div>

        {pdfPreview?.records?.length ? (
          <div className="view-stack" style={{ marginTop: 12 }}>
            <p className="section-title small">✅ PDF Extraction Complete</p>
            {(pdfPreview.records || []).map((record, index) => (
              <div key={`${record.project_id || 'project'}-${index}`} className="card" style={{ marginTop: 8 }}>
                <div className="form-grid">
                  <input
                    className="search-input"
                    value={record.project_id || ''}
                    onChange={(event) => handlePdfRecordChange(index, 'project_id', event.target.value)}
                    placeholder="Project ID"
                  />
                  <input
                    className="search-input"
                    value={record.project_name || ''}
                    onChange={(event) => handlePdfRecordChange(index, 'project_name', event.target.value)}
                    placeholder="Project Name"
                  />
                  <input
                    className="search-input"
                    value={record.client_name || ''}
                    onChange={(event) => handlePdfRecordChange(index, 'client_name', event.target.value)}
                    placeholder="Client Name"
                  />
                  <select
                    className="search-input"
                    value={record.priority || 'Medium'}
                    onChange={(event) => handlePdfRecordChange(index, 'priority', event.target.value)}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                  <input
                    className="search-input"
                    type="number"
                    min="1"
                    value={record.deadline_days || 30}
                    onChange={(event) => handlePdfRecordChange(index, 'deadline_days', event.target.value)}
                    placeholder="Deadline Days"
                  />
                </div>

                <textarea
                  className="description-input"
                  value={record.description || ''}
                  onChange={(event) => handlePdfRecordChange(index, 'description', event.target.value)}
                  placeholder="Description"
                />

                <input
                  className="search-input"
                  value={(record.required_skills || []).join('; ')}
                  onChange={(event) => handlePdfSkillsChange(index, event.target.value)}
                  placeholder="Skills separated by semicolon"
                />

                <div className="chip-row dense">
                  {(record.required_skills || []).map((skill) => (
                    <span key={`${record.project_id}-${skill}`} className="chip blue">{skill}</span>
                  ))}
                </div>

                {(record.workflow_steps || []).length ? (
                  <div className="view-stack" style={{ marginTop: 10 }}>
                    {(record.workflow_steps || []).map((step, stepIndex) => (
                      <p key={`${record.project_id}-step-${stepIndex}`} className="dataset-meta">
                        → {step.step || `Step ${stepIndex + 1}`} — {step.owner_role || 'TBD'}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            <div className="card-actions">
              <button type="button" className="secondary-button" onClick={() => setPdfPreview(null)} disabled={pdfConfirming}>
                ✏️ Edit Later
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleConfirmPdfAppend}
                disabled={pdfConfirming}
              >
                {pdfConfirming ? 'Appending...' : '✅ Confirm & Append to Projects'}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {error ? <div className="error-box">{error}</div> : null}
      {notice ? <div className="toast-success">{notice}</div> : null}

      <UploadPreview
        previews={previews}
        busy={rebuilding}
        onConfirm={handleConfirm}
        onCancel={handleCancelPreview}
      />
      <UploadProgress active={rebuilding} status={progress} />
      <UploadSuccess summary={summary} />

      <div className="dataset-action-bar">
        <div>
          <p className="dataset-action-title">{readyCount} {readyCount === 1 ? 'file' : 'files'} ready to import</p>
          <p className="dataset-meta">Use reload to force full resync from database.</p>
        </div>
        <div className="card-actions">
          <button type="button" className="secondary-button" onClick={handleReloadAll} disabled={reloading || rebuilding}>
            {reloading ? 'Reloading...' : '🔄 Reload All Datasets'}
          </button>
          <button
            type="button"
            className={readyCount > 0 ? 'primary-button import-pulse' : 'primary-button'}
            disabled={readyCount === 0 || rebuilding || reloading}
            onClick={handleConfirm}
          >
            {rebuilding ? 'Importing...' : '✅ Import Now'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatasetManager;
