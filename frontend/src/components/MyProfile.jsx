import { useEffect, useState } from 'react';

const MyProfile = ({ profile, onUpdateProfile, onChangePassword, onUpdateAvailability }) => {
  const [form, setForm] = useState(profile || {});
  const [password, setPassword] = useState({ current_password: '', new_password: '' });

  useEffect(() => {
    setForm(profile || {});
  }, [profile]);

  return (
    <div className="view-stack">
      <div className="card">
        <p className="section-title">My Profile</p>
        <div className="form-grid">
          <input className="search-input" value={form.full_name || ''} onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))} placeholder="Full Name" />
          <input className="search-input" value={form.location || ''} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} placeholder="Location" />
          <input className="search-input" value={form.skills || ''} onChange={(event) => setForm((prev) => ({ ...prev, skills: event.target.value }))} placeholder="Skills" />
          <input className="search-input" value={form.profile_photo_url || ''} onChange={(event) => setForm((prev) => ({ ...prev, profile_photo_url: event.target.value }))} placeholder="Profile photo URL" />
        </div>
        <textarea className="description-input" value={form.bio || ''} onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))} placeholder="Bio" />
        <div className="card-actions">
          <button type="button" className="primary-button" onClick={() => onUpdateProfile(form)}>Save Profile</button>
        </div>
      </div>

      <div className="card">
        <p className="section-title small">Read-only Fields</p>
        <p className="dataset-meta">Email: {profile?.email || 'N/A'}</p>
        <p className="dataset-meta">Role: {profile?.role || 'N/A'}</p>
        <p className="dataset-meta">Workload: {profile?.workload_percent || 0}%</p>
        <p className="dataset-meta">Rating: {profile?.rating || 0}</p>
      </div>

      <div className="card">
        <p className="section-title small">Availability</p>
        <div className="form-grid">
          <select className="search-input" defaultValue="available" onChange={(event) => onUpdateAvailability({ availability_status: event.target.value, availability_reason: '' })}>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
      </div>

      <div className="card">
        <p className="section-title small">Change Password</p>
        <div className="form-grid">
          <input className="search-input" type="password" value={password.current_password} onChange={(event) => setPassword((prev) => ({ ...prev, current_password: event.target.value }))} placeholder="Current password" />
          <input className="search-input" type="password" value={password.new_password} onChange={(event) => setPassword((prev) => ({ ...prev, new_password: event.target.value }))} placeholder="New password" />
        </div>
        <div className="card-actions">
          <button type="button" className="secondary-button" onClick={() => onChangePassword(password)}>Change Password</button>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
