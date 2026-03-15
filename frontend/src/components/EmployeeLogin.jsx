import { useState } from 'react';
import {
  employeeForgotPasswordRequest,
  employeeForgotPasswordReset,
  employeeLogin,
  employeeRegister,
} from '../api/agentApi';

const EmployeeLogin = ({ onAuthenticated, onBack }) => {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ full_name: '', email: '', password: '', employee_id: '' });
  const [forgot, setForgot] = useState({ email: '', otp: '', new_password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const saveSession = (payload) => {
    localStorage.setItem('neuraxEmployeeToken', payload.access_token);
    localStorage.setItem('neuraxEmployeeProfile', JSON.stringify(payload.account));
    onAuthenticated(payload.account);
  };

  return (
    <div className="portal-landing-shell">
      <div className="portal-landing-card">
        <p className="section-title">Employee Access</p>
        <div className="chip-row dense">
          <button type="button" className={mode === 'login' ? 'preset-chip active-chip' : 'preset-chip'} onClick={() => setMode('login')}>Login</button>
          <button type="button" className={mode === 'register' ? 'preset-chip active-chip' : 'preset-chip'} onClick={() => setMode('register')}>Register</button>
          <button type="button" className={mode === 'forgot' ? 'preset-chip active-chip' : 'preset-chip'} onClick={() => setMode('forgot')}>Forgot Password</button>
        </div>

        {mode !== 'forgot' ? (
          <div className="form-grid">
            {mode === 'register' ? <input className="search-input" placeholder="Full Name" value={form.full_name} onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))} /> : null}
            <input className="search-input" placeholder="Company Email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            <input className="search-input" type="password" placeholder="Password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} />
            {mode === 'register' ? <input className="search-input" placeholder="Employee ID" value={form.employee_id} onChange={(event) => setForm((prev) => ({ ...prev, employee_id: event.target.value }))} /> : null}
          </div>
        ) : (
          <div className="form-grid">
            <input className="search-input" placeholder="Email" value={forgot.email} onChange={(event) => setForgot((prev) => ({ ...prev, email: event.target.value }))} />
            <input className="search-input" placeholder="OTP" value={forgot.otp} onChange={(event) => setForgot((prev) => ({ ...prev, otp: event.target.value }))} />
            <input className="search-input" type="password" placeholder="New Password" value={forgot.new_password} onChange={(event) => setForgot((prev) => ({ ...prev, new_password: event.target.value }))} />
          </div>
        )}

        {error ? <div className="error-box">{error}</div> : null}
        {message ? <div className="toast-success">{message}</div> : null}

        <div className="card-actions">
          {mode === 'login' ? (
            <button
              type="button"
              className="primary-button"
              onClick={async () => {
                setError('');
                try {
                  const payload = await employeeLogin({ email: form.email, password: form.password });
                  saveSession(payload);
                } catch (requestError) {
                  setError(requestError.message);
                }
              }}
            >
              Login
            </button>
          ) : null}

          {mode === 'register' ? (
            <button
              type="button"
              className="primary-button"
              onClick={async () => {
                setError('');
                try {
                  const payload = await employeeRegister(form);
                  saveSession(payload);
                } catch (requestError) {
                  setError(requestError.message);
                }
              }}
            >
              Register
            </button>
          ) : null}

          {mode === 'forgot' ? (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={async () => {
                  setError('');
                  try {
                    await employeeForgotPasswordRequest({ email: forgot.email });
                    setMessage('OTP sent to email.');
                  } catch (requestError) {
                    setError(requestError.message);
                  }
                }}
              >
                Send OTP
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={async () => {
                  setError('');
                  try {
                    await employeeForgotPasswordReset(forgot);
                    setMessage('Password reset successful. Please login.');
                    setMode('login');
                  } catch (requestError) {
                    setError(requestError.message);
                  }
                }}
              >
                Reset Password
              </button>
            </>
          ) : null}

          <button type="button" className="secondary-button" onClick={onBack}>Back</button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeLogin;
