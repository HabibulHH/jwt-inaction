import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Admin() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try { setUsers(await api('/admin/users')); }
    catch (e) { setError(e.message); }
  }

  useEffect(() => { load(); }, []);

  async function changeRole(username, role) {
    setError('');
    try {
      await api(`/admin/users/${encodeURIComponent(username)}/role`, {
        method: 'PATCH',
        body: { role },
      });
      load();
    } catch (e) { setError(e.message); }
  }

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: 16 }}>
      <h2>Admin · Users</h2>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {!users && !error && <p>Loading…</p>}
      {users && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              <th>Username</th><th>Role</th><th>ID</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{u.username}</td>
                <td>{u.role}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.id}</td>
                <td>
                  <button onClick={() => changeRole(u.username, u.role === 'admin' ? 'user' : 'admin')}>
                    Make {u.role === 'admin' ? 'user' : 'admin'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
