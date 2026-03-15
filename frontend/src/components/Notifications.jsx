const Notifications = ({ data, onMarkRead }) => {
  return (
    <div className="view-stack">
      <div className="section-header">
        <div>
          <p className="section-title">Notifications</p>
          <p className="section-subtitle">Unread: {data.unread_count || 0}</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => onMarkRead({ notification_ids: [] })}>Mark all as read</button>
      </div>

      <div className="view-stack">
        {(data.items || []).map((item) => (
          <div key={item.id} className={item.read_status ? 'card' : 'card warning-card'}>
            <p className="section-title small">{item.type}</p>
            <p className="dataset-meta">{item.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notifications;
