import { Navigate, useLocation } from 'react-router-dom';
import { usePortal } from '../../lib/PortalContext';

export default function RequirePortal({ children }) {
  const { business, loading } = usePortal();
  const location = useLocation();

  if (loading) {
    return (
      <div className="ad" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8DA396' }}>
        Duke ngarkuar…
      </div>
    );
  }
  if (!business) return <Navigate to="/portal/login" state={{ from: location }} replace />;
  return children;
}
