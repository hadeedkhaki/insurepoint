import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import PatientQueue from './components/PatientQueue';
import ScanHistory from './components/ScanHistory';
import PatientDirectory from './components/PatientDirectory';
import Registration from './components/Registration';
import './App.css';

function SessionWarning() {
  const { sessionWarning, extendSession, logout } = useAuth();
  if (!sessionWarning) return null;

  return (
    <div className="session-warning-overlay">
      <div className="session-warning-modal">
        <div className="session-warning-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="session-warning-stroke">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h3>Session Expiring</h3>
        <p>Your session will expire in 2 minutes due to inactivity. Any unsaved work may be lost.</p>
        <div className="session-warning-actions">
          <button className="btn btn-primary" onClick={extendSession}>Stay Logged In</button>
          <button className="btn btn-secondary" onClick={logout}>Log Out</button>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <div className="loading"><div className="spinner" /><p>Loading...</p></div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      <Navigation />
      <main className="main">
        <Routes>
          <Route path="/queue" element={<PatientQueue />} />
          <Route path="/history" element={<ScanHistory />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/patients" element={<PatientDirectory />} />
          {isAdmin && <Route path="/dashboard" element={<Dashboard />} />}
          <Route path="*" element={<Navigate to={isAdmin ? '/dashboard' : '/register'} replace />} />
        </Routes>
      </main>
      <SessionWarning />
      <footer className="footer">
        inSUREd &copy; 2026 — For authorized medical staff use only
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
