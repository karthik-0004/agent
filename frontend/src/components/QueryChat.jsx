import { useState } from 'react';

const QueryChat = ({ messages, onSendMessage, onSendLeave }) => {
  const [text, setText] = useState('');
  const [leave, setLeave] = useState({ leave_type: 'casual', from_date: '', to_date: '', reason: '' });

  return (
    <div className="view-stack">
      <div className="card">
        <p className="section-title">Query and Leave Chat</p>
        <p className="section-subtitle">Direct communication with your manager.</p>

        <div className="thinking-log" style={{ background: '#ffffff', color: '#0f172a', border: '0.5px solid #e5e7eb' }}>
          {(messages || []).map((message) => (
            <div key={message.id} className="thinking-entry">
              <span className="thinking-entry-index">{message.sender_type === 'employee' ? 'You' : 'Manager'}</span>
              <span>{message.content}</span>
            </div>
          ))}
        </div>

        <textarea className="description-input" value={text} onChange={(event) => setText(event.target.value)} placeholder="Type your query..." />
        <div className="card-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onSendMessage({ content: text, message_type: 'query' });
              setText('');
            }}
          >
            Send Query
          </button>
        </div>
      </div>

      <div className="card">
        <p className="section-title small">Leave Request</p>
        <div className="form-grid">
          <select className="search-input" value={leave.leave_type} onChange={(event) => setLeave((prev) => ({ ...prev, leave_type: event.target.value }))}>
            <option value="sick">Sick Leave</option>
            <option value="casual">Casual Leave</option>
            <option value="emergency">Emergency Leave</option>
          </select>
          <input className="search-input" type="date" value={leave.from_date} onChange={(event) => setLeave((prev) => ({ ...prev, from_date: event.target.value }))} />
          <input className="search-input" type="date" value={leave.to_date} onChange={(event) => setLeave((prev) => ({ ...prev, to_date: event.target.value }))} />
        </div>
        <textarea className="description-input" value={leave.reason} onChange={(event) => setLeave((prev) => ({ ...prev, reason: event.target.value }))} placeholder="Reason" />
        <div className="card-actions">
          <button type="button" className="secondary-button" onClick={() => onSendLeave(leave)}>Submit Leave Request</button>
        </div>
      </div>
    </div>
  );
};

export default QueryChat;
