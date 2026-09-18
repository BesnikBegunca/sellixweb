import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  return children;
}
