import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/admin/Login';
import RequireAuth from './pages/admin/RequireAuth';
import DashboardLayout from './pages/admin/DashboardLayout';
import Leads from './pages/admin/Leads';
import Businesses from './pages/admin/Businesses';
import Registrations from './pages/admin/Registrations';
import RecycleBin from './pages/admin/RecycleBin';
import Licenses from './pages/admin/Licenses';
import Content from './pages/admin/Content';
import Users from './pages/admin/Users';
import Setup from './pages/admin/Setup';
import { PortalProvider } from './lib/PortalContext';
import PortalLogin from './pages/portal/PortalLogin';
import RequirePortal from './pages/portal/RequirePortal';
import PortalLayout from './pages/portal/PortalLayout';
import PortalSales from './pages/portal/PortalSales';
import PortalTables from './pages/portal/PortalTables';
import PortalRegisters from './pages/portal/PortalRegisters';
import PortalAccount from './pages/portal/PortalAccount';
import PortalGjendja from './pages/portal/PortalGjendja';
import PortalReports from './pages/portal/PortalReports';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
            <Route path="licenses" element={<Licenses />} />
            <Route path="recycle-bin" element={<RecycleBin />} />
            <Route path="registrations" element={<Registrations />} />
            <Route path="content" element={<Content />} />
            <Route path="setup" element={<Setup />} />
            <Route path="users" element={<Users />} />
          </Route>
          <Route path="/portal" element={<PortalProvider />}>
            <Route path="login" element={<PortalLogin />} />
            <Route
              element={
                <RequirePortal>
                  <PortalLayout />
                </RequirePortal>
              }
            >
              <Route index element={<PortalSales />} />
              <Route path="tables" element={<PortalTables />} />
              <Route path="registers" element={<PortalRegisters />} />
              <Route path="gjendja" element={<PortalGjendja />} />
              <Route path="reports" element={<PortalReports />} />
              <Route path="account" element={<PortalAccount />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
