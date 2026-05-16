import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokens, logout as apiLogout } from './api';

const AuthContext = createContext(null);

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

function userFromAccess(accessToken) {
  if (!accessToken) return null;
  const p = decodeJwt(accessToken);
  if (!p) return null;
  if (p.exp && p.exp * 1000 < Date.now()) return null;
  return { sub: p.sub, username: p.username, role: p.role };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => userFromAccess(tokens.access));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (user || !tokens.refresh) { setReady(true); return; }
    api('/profile')
      .then((u) => setUser({ sub: u.sub, username: u.username, role: u.role }))
      .catch(() => tokens.clear())
      .finally(() => setReady(true));
  }, []);

  async function login(username, password) {
    const data = await api('/login', { method: 'POST', body: { username, password }, auth: false });
    tokens.set(data);
    setUser(userFromAccess(data.accessToken));
  }

  async function register(username, password) {
    await api('/register', { method: 'POST', body: { username, password }, auth: false });
    await login(username, password);
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
