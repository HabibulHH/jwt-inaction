import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/profile').then(setProfile).catch((e) => setError(e.message));
  }, []);

  return (
    <div style={{ maxWidth: 480, margin: '32px auto', padding: 16 }}>
      <h2>Profile</h2>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {profile ? (
        <ul>
          <li><b>id:</b> {profile.sub}</li>
          <li><b>username:</b> {profile.username}</li>
          <li><b>role:</b> {profile.role}</li>
        </ul>
      ) : !error && <p>Loading…</p>}
      <p style={{ color: '#666' }}>Logged in as {user?.username} ({user?.role})</p>
    </div>
  );
}
