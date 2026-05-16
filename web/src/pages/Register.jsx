import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(username, password);
      navigate('/profile', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '64px auto', padding: 16 }}>
      <h2>Register</h2>
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 8 }}>
          <label>Username (3–32 chars)<br />
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </label>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Password (min 8 chars)<br />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </div>
        <button type="submit" disabled={busy}>{busy ? '…' : 'Create account'}</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <p>Have an account? <Link to="/login">Login</Link></p>
    </div>
  );
}
