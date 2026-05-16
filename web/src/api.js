const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const STORAGE = {
  access: 'jwt.access',
  refresh: 'jwt.refresh',
};

export const tokens = {
  get access() { return localStorage.getItem(STORAGE.access); },
  get refresh() { return localStorage.getItem(STORAGE.refresh); },
  set({ accessToken, refreshToken }) {
    localStorage.setItem(STORAGE.access, accessToken);
    localStorage.setItem(STORAGE.refresh, refreshToken);
  },
  clear() {
    localStorage.removeItem(STORAGE.access);
    localStorage.removeItem(STORAGE.refresh);
  },
};

let refreshing = null;

async function doRefresh() {
  const refreshToken = tokens.refresh;
  if (!refreshToken) throw new Error('no_refresh_token');

  const res = await fetch(`${API_URL}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    tokens.clear();
    throw new Error('refresh_failed');
  }
  const data = await res.json();
  tokens.set(data);
  return data.accessToken;
}

function refreshOnce() {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;

  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);

  let res = await fetch(`${API_URL}${path}`, init);

  if (res.status === 401 && auth && tokens.refresh) {
    try {
      const newAccess = await refreshOnce();
      headers.Authorization = `Bearer ${newAccess}`;
      res = await fetch(`${API_URL}${path}`, init);
    } catch {
      // fall through with original 401
    }
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || `http_${res.status}`);
    err.status = res.status;
    err.details = data?.details;
    throw err;
  }
  return data;
}

export async function logout() {
  const refreshToken = tokens.refresh;
  tokens.clear();
  if (!refreshToken) return;
  try {
    await fetch(`${API_URL}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch { /* idempotent */ }
}
