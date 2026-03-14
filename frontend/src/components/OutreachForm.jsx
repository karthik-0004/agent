import { useState } from 'react';

const parseSkillInput = (value) =>
  String(value || '')
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);

const OutreachForm = ({ projectName, onCancel, onSubmit, busy }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [ratePerDay, setRatePerDay] = useState('');
  const [notes, setNotes] = useState('');

  const addSkill = () => {
    const incoming = parseSkillInput(skillInput).map((item) => item.toLowerCase());
    if (!incoming.length) {
      return;
    }
    setSkills((previous) => Array.from(new Set([...previous, ...incoming])));
    setSkillInput('');
  };

  const removeSkill = (item) => {
    setSkills((previous) => previous.filter((skill) => skill !== item));
  };

  const handleSubmit = () => {
    onSubmit({
      name,
      role,
      email,
      skills: skills.join(', '),
      rate_per_day: ratePerDay ? Number(ratePerDay) : null,
      notes,
    });
  };

  return (
    <div className="view-stack">
      <div>
        <p className="section-title">Add Outreach Expert</p>
        <p className="section-subtitle">Temporary freelancer for this project only.</p>
      </div>

      <div className="form-grid outreach-form-grid">
        <input className="search-input" placeholder="Full Name" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="search-input" placeholder="Role" value={role} onChange={(event) => setRole(event.target.value)} />
        <input className="search-input" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="search-input" type="number" min="0" placeholder="Rate/Day (USD)" value={ratePerDay} onChange={(event) => setRatePerDay(event.target.value)} />
      </div>

      <div className="chip-row dense">
        {skills.map((skill) => (
          <button key={skill} type="button" className="chip orange removable" onClick={() => removeSkill(skill)}>
            {skill} ✕
          </button>
        ))}
      </div>

      <div className="form-grid outreach-skill-row">
        <input
          className="search-input"
          placeholder="Add skills (comma/semicolon/pipe separated)"
          value={skillInput}
          onChange={(event) => setSkillInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addSkill();
            }
          }}
        />
        <button type="button" className="secondary-button" onClick={addSkill}>+ Add Skill</button>
      </div>

      <textarea
        className="description-input"
        placeholder="Notes (optional)"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      <div className="card warning-card">
        <p className="dataset-meta">Linked to project: 📌 {projectName}</p>
        <p className="dataset-meta">This person will be automatically removed when the project completes.</p>
      </div>

      <div className="card-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="primary-button"
          disabled={busy || !name.trim() || !role.trim() || !email.trim()}
          onClick={handleSubmit}
        >
          {busy ? 'Adding...' : 'Add Outreach Expert'}
        </button>
      </div>
    </div>
  );
};

export default OutreachForm;
