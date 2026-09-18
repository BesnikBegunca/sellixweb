import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/admin/Login';
import RequireAuth from './pages/admin/RequireAuth';
import DashboardLayout from './pages/admin/DashboardLayout';
import Leads from './pages/admin/Leads';
import Businesses from './pages/admin/Businesses';
import Content from './pages/admin/Content';
import Users from './pages/admin/Users';

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
            <Route path="content" element={<Content />} />
            <Route path="users" element={<Users />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
