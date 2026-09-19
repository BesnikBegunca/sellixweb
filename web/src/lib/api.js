// Empty in production: nginx serves the app and proxies /api to the backend on
// the same domain, so requests stay same-origin and the session cookie works.
const API_URL = import.meta.env.VITE_API_URL ?? '';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  getContent: () => request('/content'),
  updateContent: (content) => request('/content', { method: 'PUT', body: JSON.stringify({ content }) }),

  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  submitLead: (lead) => request('/leads', { method: 'POST', body: JSON.stringify(lead) }),
  getLeads: () => request('/leads'),
  updateLeadStatus: (id, status) => request(`/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  getBusinesses: () => request('/businesses'),
  createBusiness: (data) => request('/businesses', { method: 'POST', body: JSON.stringify(data) }),
  updateBusiness: (id, data) => request(`/businesses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBusiness: (id) => request(`/businesses/${id}`, { method: 'DELETE' }),
  extendLicense: (id, months) => request(`/businesses/${id}/license/extend`, { method: 'POST', body: JSON.stringify({ months }) }),
  revokeLicense: (id) => request(`/businesses/${id}/license/revoke`, { method: 'POST' }),
  reactivateLicense: (id) => request(`/businesses/${id}/license/reactivate`, { method: 'POST' }),
  regenerateLicense: (id) => request(`/businesses/${id}/license/regenerate`, { method: 'POST' }),
  getBusinessDevices: (id) => request(`/businesses/${id}/devices`),
  releaseBusinessDevice: (id, deviceId) => request(`/businesses/${id}/devices/${deviceId}`, { method: 'DELETE' }),

  getRegistrations: () => request('/registrations'),
  approveRegistration: (id, data) => request(`/registrations/${id}/approve`, { method: 'POST', body: JSON.stringify(data) }),
  rejectRegistration: (id) => request(`/registrations/${id}/reject`, { method: 'POST' }),
  deleteRegistration: (id) => request(`/registrations/${id}`, { method: 'DELETE' }),

  getUsers: () => request('/users'),
  createUser: (email, name) => request('/users', { method: 'POST', body: JSON.stringify({ email, name }) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  resetUserPassword: (id) => request(`/users/${id}/reset-password`, { method: 'POST' }),
  changeOwnPassword: (currentPassword, newPassword) =>
    request('/users/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),

  portalLogin: (licenseKey) => request('/portal/login', { method: 'POST', body: JSON.stringify({ licenseKey }) }),
  portalLogout: () => request('/portal/logout', { method: 'POST' }),
  portalMe: () => request('/portal/me'),
  portalOverview: (date) => request(`/portal/overview?date=${encodeURIComponent(date)}`),
  portalBreakdown: (query) => request(`/portal/breakdown?${query}`),
  portalTables: (query) => request(`/portal/tables?${query}`),
  portalSales: (query) => request(`/portal/sales?${query}`),

  getBusinessSalesOverview: (id, date) => request(`/businesses/${id}/sales/overview?date=${encodeURIComponent(date)}`),
  getBusinessSalesBreakdown: (id, query) => request(`/businesses/${id}/sales/breakdown?${query}`),
  getBusinessSalesTables: (id, query) => request(`/businesses/${id}/sales/tables?${query}`),
  getBusinessSales: (id, query) => request(`/businesses/${id}/sales?${query}`)
};
