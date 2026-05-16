import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';

export default function ProtectedRoute({ roles, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <p style={{ padding: 16 }}>Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/profile" replace />;
  return children;
}
