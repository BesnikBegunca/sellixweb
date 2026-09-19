import { Navigate, useLocation } from 'react-router-dom';
import { usePortalAuth } from '../../lib/PortalAuthContext';

export default function RequirePortalAuth({ children }) {
  const { business, loading } = usePortalAuth();
  const location = useLocation();

  if (loading) return null;
  if (!business) return <Navigate to="/portal/login" state={{ from: location }} replace />;
  return children;
}
