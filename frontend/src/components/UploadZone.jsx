import { useMemo, useRef, useState } from 'react';

const FORMAT_CHIPS = ['CSV', 'XLSX', 'XLS', 'PDF', 'TXT', 'JSON'];

const prettyDate = (value) => {
  if (!value) {
    return 'Never';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Recently';
  }
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const UploadZone = ({
  icon,
  title,
  datasetKey,
  loadedCount,
  lastLoadedAt,
  preview,
  busy,
  onFile,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const state = useMemo(() => {
    if (preview) {
      return 'loaded';
    }
    if (isDragging) {
      return 'hover';
    }
    return 'empty';
  }, [isDragging, preview]);

  const browse = () => inputRef.current?.click();

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      onFile(datasetKey, file);
    }
  };

  return (
    <div className="dataset-upload-card hover-lift">
      <div className="dataset-upload-header">
        <div>
          <p className="dataset-upload-title">{icon} {title}</p>
          <p className="dataset-upload-meta">Last loaded: {loadedCount} records · {prettyDate(lastLoadedAt)}</p>
        </div>
      </div>

      <div
        className={`upload-zone upload-zone-${state}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        {!preview ? (
          <>
            <div className="upload-icon" aria-hidden="true">⬆️</div>
            <p className="upload-zone-title">{isDragging ? 'Release to upload' : 'Drop your file here'}</p>
            <button type="button" className="secondary-button upload-browse-button" onClick={browse} disabled={busy}>
              Browse File
            </button>
            <div className="upload-format-chips">
              {FORMAT_CHIPS.map((item) => (
                <span key={`${datasetKey}-${item}`} className="upload-format-chip">{item}</span>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="upload-zone-file">✅ {preview.file_name}</p>
            <p className="upload-zone-subtitle">{preview.rows} rows · {preview.mapped_fields?.length || 0} columns detected</p>
            <button type="button" className="secondary-button upload-browse-button" onClick={browse} disabled={busy}>
              Change File
            </button>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.tsv,.pdf,.txt,.json"
          className="upload-hidden-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onFile(datasetKey, file);
            }
            event.target.value = '';
          }}
          disabled={busy}
        />
      </div>

      <div className="dataset-upload-status">
        {preview ? (
          <p className="dataset-meta">✅ {preview.rows} records ready · {preview.mapped_fields?.length || 0} cols mapped</p>
        ) : (
          <p className="dataset-meta">Awaiting file selection.</p>
        )}
      </div>
    </div>
  );
};

export default UploadZone;
