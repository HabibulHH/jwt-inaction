import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import ProtectedRoute from './ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Admin from './pages/Admin';

function NavBar() {
  const { user, logout } = useAuth();
  return (
    <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #ddd' }}>
      <Link to="/">Home</Link>
      {user && <Link to="/profile">Profile</Link>}
      {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
      <span style={{ marginLeft: 'auto' }}>
        {user ? (
          <>
            <span style={{ marginRight: 8 }}>{user.username} ({user.role})</span>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ marginRight: 8 }}>Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </span>
    </nav>
  );
}

function Home() {
  const { user } = useAuth();
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/profile'} replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={
            <ProtectedRoute><Profile /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
