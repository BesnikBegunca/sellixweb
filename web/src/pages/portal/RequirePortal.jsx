import { Navigate, useLocation } from 'react-router-dom';
import { usePortal } from '../../lib/PortalContext';

export default function RequirePortal({ children }) {
  const { business, loading } = usePortal();
  const location = useLocation();

  if (loading) return null;
  if (!business) return <Navigate to="/portal/login" state={{ from: location }} replace />;
  return children;
}
