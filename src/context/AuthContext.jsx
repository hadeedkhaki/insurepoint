import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const AuthContext = createContext(null);

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE = 2 * 60 * 1000;   // warn 2 min before expiry

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false);
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);

  const clearTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    setSessionWarning(false);
  };

  const handleLogout = useCallback((reason) => {
    clearTimers();
    const loggedOutUser = user;
    setUser(null);
    setSessionWarning(false);
    localStorage.removeItem('insured_user');
    localStorage.removeItem('insured_session_start');

    // Log the logout event
    if (loggedOutUser) {
      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: loggedOutUser.id,
          userName: loggedOutUser.name,
          role: loggedOutUser.role,
          action: 'logout',
          reason: reason || 'manual',
        }),
      }).catch(() => {});
    }
  }, [user]);

  const resetSessionTimer = useCallback(() => {
    if (!user) return;
    clearTimers();

    // Update last activity
    localStorage.setItem('insured_last_activity', Date.now().toString());

    // Set warning timer
    warningRef.current = setTimeout(() => {
      setSessionWarning(true);
    }, SESSION_TIMEOUT - WARNING_BEFORE);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      handleLogout('session_timeout');
    }, SESSION_TIMEOUT);
  }, [user, handleLogout]);

  // Track user activity to reset session timer
  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const onActivity = () => {
      if (sessionWarning) setSessionWarning(false);
      resetSessionTimer();
    };

    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    resetSessionTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      clearTimers();
    };
  }, [user, resetSessionTimer, sessionWarning]);

  // Load saved session on mount
  useEffect(() => {
    const saved = localStorage.getItem('insured_user');
    const lastActivity = localStorage.getItem('insured_last_activity');

    if (saved) {
      try {
        // Check if session has expired
        if (lastActivity && Date.now() - parseInt(lastActivity) > SESSION_TIMEOUT) {
          localStorage.removeItem('insured_user');
          localStorage.removeItem('insured_session_start');
          localStorage.removeItem('insured_last_activity');
        } else {
          setUser(JSON.parse(saved));
        }
      } catch {
        localStorage.removeItem('insured_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }

    const data = await res.json();
    setUser(data.user);
    localStorage.setItem('insured_user', JSON.stringify(data.user));
    localStorage.setItem('insured_session_start', Date.now().toString());
    localStorage.setItem('insured_last_activity', Date.now().toString());

    // Log login event
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: data.user.id,
        userName: data.user.name,
        role: data.user.role,
        action: 'login',
      }),
    }).catch(() => {});

    return data.user;
  };

  const logout = () => handleLogout('manual');

  const extendSession = () => {
    setSessionWarning(false);
    resetSessionTimer();
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin, sessionWarning, extendSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
