import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { usePortal } from '../../lib/PortalContext';
import '../admin/admin.css';
import './portal.css';

export default function PortalLayout() {
  const { business, logout } = usePortal();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/portal/login', { replace: true });
  };

  return (
    <div className="ad pt-shell">
      <header className="pt-top">
        <div className="pt-brand">
          <span className="pt-mark">
            <span></span>
          </span>
          <div>
            <div className="ad-heading pt-name">{business?.name || 'SelliX'}</div>
            <div className="ad-hint">{business?.city ? `${business.city} · ` : ''}Portal i biznesit</div>
          </div>
        </div>
        <button className="ad-btn-ghost" onClick={onLogout}>Dil</button>
      </header>

      <nav className="pt-tabs" aria-label="Portal">
        <NavLink to="/portal" end className={({ isActive }) => `pt-tab${isActive ? ' active' : ''}`}>
          Shitjet
        </NavLink>
        {business?.isRestaurant && (
          <NavLink to="/portal/tables" className={({ isActive }) => `pt-tab${isActive ? ' active' : ''}`}>
            Tavolinat
          </NavLink>
        )}
      </nav>

      <main className="pt-main">
        <Outlet />
      </main>

      <div className="pt-foot">
        <Link to="/" className="ad-hint" style={{ textDecoration: 'underline' }}>← Faqja e SelliX</Link>
      </div>
    </div>
  );
}
