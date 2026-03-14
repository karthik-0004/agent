import { useEffect, useMemo, useState } from 'react';
import {
  confirmDatasetRebuild,
  forceDatasetReload,
  getDatasetStatus,
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
