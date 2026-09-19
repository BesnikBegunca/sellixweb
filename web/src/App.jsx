import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { PortalAuthProvider } from './lib/PortalAuthContext';
import Landing from './pages/Landing';
import Login from './pages/admin/Login';
import RequireAuth from './pages/admin/RequireAuth';
import DashboardLayout from './pages/admin/DashboardLayout';
import Leads from './pages/admin/Leads';
import Businesses from './pages/admin/Businesses';
import Registrations from './pages/admin/Registrations';
import Content from './pages/admin/Content';
import Users from './pages/admin/Users';
import PortalLogin from './pages/portal/PortalLogin';
import RequirePortalAuth from './pages/portal/RequirePortalAuth';
import PortalLayout from './pages/portal/PortalLayout';
import Sales from './pages/portal/Sales';
import Tables from './pages/portal/Tables';
import Account from './pages/portal/Account';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PortalAuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/admin/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <DashboardLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Leads />} />
              <Route path="leads" element={<Leads />} />
              <Route path="businesses" element={<Businesses />} />
              <Route path="registrations" element={<Registrations />} />
              <Route path="content" element={<Content />} />
              <Route path="users" element={<Users />} />
            </Route>

            {/* The business owner portal: a shop signs in here to watch its own
                takings. Separate session and separate routes from /admin. */}
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route
              path="/portal"
              element={
                <RequirePortalAuth>
                  <PortalLayout />
                </RequirePortalAuth>
              }
            >
              <Route index element={<Sales />} />
              <Route path="shitjet" element={<Sales />} />
              <Route path="tavolinat" element={<Tables />} />
              <Route path="llogaria" element={<Account />} />
            </Route>
          </Routes>
        </PortalAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
