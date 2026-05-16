import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      const to = location.state?.from?.pathname || '/profile';
      navigate(to, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '64px auto', padding: 16 }}>
      <h2>Login</h2>
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 8 }}>
          <label>Username<br />
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </label>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Password<br />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </div>
        <button type="submit" disabled={busy}>{busy ? '…' : 'Login'}</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <p>No account? <Link to="/register">Register</Link></p>
    </div>
  );
}
