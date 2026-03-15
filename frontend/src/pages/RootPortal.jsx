import { useMemo, useState } from 'react';
import EmployeeDashboard from '../components/EmployeeDashboard';
import EmployeeLogin from '../components/EmployeeLogin';
import LandingPage from '../components/LandingPage';
import ManagerDashboard from './App';

const ManagerLogin = ({ onLogin, onBack }) => {
  const [email, setEmail] = useState('manager@neurax.io');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  return (
    <div className="portal-landing-shell">
      <div className="portal-landing-card">
        <p className="section-title">Manager Login</p>
        <div className="form-grid">
          <input className="search-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Manager email" />
          <input className="search-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" />
        </div>
        {error ? <div className="error-box">{error}</div> : null}
        <div className="card-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              if (!email.trim() || !password.trim()) {
                setError('Email and password are required.');
                return;
              }
              localStorage.setItem('neuraxManagerSession', 'active');
              onLogin();
            }}
          >
            Continue
          </button>
          <button type="button" className="secondary-button" onClick={onBack}>Back</button>
        </div>
      </div>
    </div>
  );
};

const RootPortal = () => {
  const [screen, setScreen] = useState('landing');
  const [employeeProfile, setEmployeeProfile] = useState(() => {
    const raw = localStorage.getItem('neuraxEmployeeProfile');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });
  const hasManagerSession = useMemo(() => localStorage.getItem('neuraxManagerSession') === 'active', []);

  if (hasManagerSession || screen === 'manager-dashboard') {
    return <ManagerDashboard />;
  }

  if (employeeProfile || screen === 'employee-dashboard') {
    return <EmployeeDashboard employee={employeeProfile || { full_name: 'Employee' }} onLogout={() => {
      setEmployeeProfile(null);
      setScreen('landing');
    }} />;
  }

  if (screen === 'manager-login') {
    return <ManagerLogin onLogin={() => setScreen('manager-dashboard')} onBack={() => setScreen('landing')} />;
  }

  if (screen === 'employee-login') {
    return <EmployeeLogin onAuthenticated={(account) => {
      setEmployeeProfile(account);
      setScreen('employee-dashboard');
    }} onBack={() => setScreen('landing')} />;
  }

  return <LandingPage onSelectRole={(role) => setScreen(role === 'manager' ? 'manager-login' : 'employee-login')} />;
};

export default RootPortal;
