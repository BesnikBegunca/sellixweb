// Empty in production: nginx serves the app and proxies /api to the backend on
// the same domain, so requests stay same-origin and the session cookie works.
const API_URL = import.meta.env.VITE_API_URL ?? '';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    credentials: 'include',
    cache: 'no-store',
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

export async function downloadPdf(path, fallbackName = 'raport.pdf') {
  const res = await fetch(`${API_URL}/api${path}`, {
    credentials: 'include',
    cache: 'no-store'
  });
  if (!res.ok) {
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : null;
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const match = cd.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Server-sent events for the live sales views. Same base URL and same cookie
// as request() above, so the stream authenticates exactly like a fetch does.
export function openStream(path) {
  if (typeof EventSource === 'undefined') return null;
  const url = `${API_URL}/api${path}`;
  try {
    return new EventSource(url, { withCredentials: true });
  } catch {
    try {
      return new EventSource(url);
    } catch {
      return null;
    }
  }
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
  getTrash: () => request('/businesses/trash'),
  restoreBusiness: (id) => request(`/businesses/${id}/restore`, { method: 'POST' }),
  purgeBusiness: (id) => request(`/businesses/${id}/purge`, { method: 'DELETE' }),
  verifyBusiness: (id, color) => request(`/businesses/${id}/verify`, { method: 'POST', body: JSON.stringify({ color }) }),
  unverifyBusiness: (id) => request(`/businesses/${id}/unverify`, { method: 'POST' }),
  setVerifiedColor: (id, color) => request(`/businesses/${id}/verify-color`, { method: 'PATCH', body: JSON.stringify({ color }) }),
  notifyLicense: (id) => request(`/businesses/${id}/license/notify`, { method: 'POST' }),
  extendLicense: (id, months) => request(`/businesses/${id}/license/extend`, { method: 'POST', body: JSON.stringify({ months }) }),
  revokeLicense: (id) => request(`/businesses/${id}/license/revoke`, { method: 'POST' }),
  reactivateLicense: (id) => request(`/businesses/${id}/license/reactivate`, { method: 'POST' }),
  regenerateLicense: (id) => request(`/businesses/${id}/license/regenerate`, { method: 'POST' }),
  getBusinessDevices: (id) => request(`/businesses/${id}/devices`),
  getBusinessPortalSessions: (id) => request(`/businesses/${id}/portal-sessions`),
  releaseBusinessDevice: (id, deviceId) => request(`/businesses/${id}/devices/${deviceId}`, { method: 'DELETE' }),
  createPortalAccount: (id, email) =>
    request(`/businesses/${id}/portal-account`, { method: 'POST', body: JSON.stringify({ email }) }),
  deletePortalAccount: (id) => request(`/businesses/${id}/portal-account`, { method: 'DELETE' }),

  getRegistrations: () => request('/registrations'),
  approveRegistration: (id, data) => request(`/registrations/${id}/approve`, { method: 'POST', body: JSON.stringify(data) }),
  rejectRegistration: (id) => request(`/registrations/${id}/reject`, { method: 'POST' }),
  deleteRegistration: (id) => request(`/registrations/${id}`, { method: 'DELETE' }),

  getUsers: () => request('/users'),
  createUser: (email, name) => request('/users', { method: 'POST', body: JSON.stringify({ email, name }) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  resetUserPassword: (id) => request(`/users/${id}/reset-password`, { method: 'POST' }),
  getUserSessions: (id) => request(`/users/${id}/sessions`),
  changeOwnPassword: (newPassword) =>
    request('/users/me/password', { method: 'PATCH', body: JSON.stringify({ newPassword }) }),

  portalLogin: (email, password) => request('/portal/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  portalLogout: () => request('/portal/logout', { method: 'POST' }),
  portalMe: () => request(`/portal/me?t=${Date.now()}`),
  portalChangePassword: (newPassword) =>
    request('/portal/me/password', { method: 'PATCH', body: JSON.stringify({ newPassword }) }),
  portalSetGoal: (goal) => request('/portal/me/goal', { method: 'PATCH', body: JSON.stringify({ goal }) }),
  portalOverview: (date) => request(`/portal/overview?date=${encodeURIComponent(date)}`),
  portalBreakdown: (query) => request(`/portal/breakdown?${query}`),
  portalTables: () => request('/portal/tables'),
  portalDevices: (query) => request(`/portal/devices?${query}`),
  portalSales: (query) => request(`/portal/sales?${query}`),
  portalShifts: () => request('/portal/shifts'),
  portalRenewalRequest: () => request('/portal/renewal-request', { method: 'POST' }),
  portalAckNotice: () => request('/portal/notice/ack', { method: 'POST' }),
  portalReports: () => request('/portal/reports'),
  portalReportPreview: (kind, period) =>
    request(`/portal/reports/preview?kind=${encodeURIComponent(kind)}&period=${encodeURIComponent(period)}`),
  portalCreateReport: (kind, period) =>
    request('/portal/reports', { method: 'POST', body: JSON.stringify({ kind, period }) }),
  portalDownloadReport: (id) => downloadPdf(`/portal/reports/${id}/file`),
  portalDeleteReport: (id) => request(`/portal/reports/${id}`, { method: 'DELETE' }),

  getBusinessSalesOverview: (id, date) => request(`/businesses/${id}/sales/overview?date=${encodeURIComponent(date)}`),
  getBusinessSalesBreakdown: (id, query) => request(`/businesses/${id}/sales/breakdown?${query}`),
  getBusinessSalesTables: (id) => request(`/businesses/${id}/sales/tables`),
  getBusinessSalesDevices: (id, query) => request(`/businesses/${id}/sales/devices?${query}`),
  getBusinessSales: (id, query) => request(`/businesses/${id}/sales?${query}`),
  getBusinessSalesShifts: (id) => request(`/businesses/${id}/sales/shifts`),
  getBusinessReports: (id) => request(`/businesses/${id}/reports`),
  getBusinessReportPreview: (id, kind, period) =>
    request(`/businesses/${id}/reports/preview?kind=${encodeURIComponent(kind)}&period=${encodeURIComponent(period)}`),
  createBusinessReport: (id, kind, period) =>
    request(`/businesses/${id}/reports`, { method: 'POST', body: JSON.stringify({ kind, period }) }),
  downloadBusinessReport: (id, rid) => downloadPdf(`/businesses/${id}/reports/${rid}/file`),
  deleteBusinessReport: (id, rid) => request(`/businesses/${id}/reports/${rid}`, { method: 'DELETE' }),

  getSetup: () => request('/setup'),
  getSetupAdmin: () => request('/setup/admin'),
  setupDownloadUrl: () => `${API_URL}/api/setup/download`,
  uploadSetup: (file, onProgress) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `${API_URL}/api/setup/upload`);
      xhr.withCredentials = true;
      xhr.timeout = 30 * 60 * 1000;
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name || 'Sellix Setup.exe'));
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = null;
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data?.error || `Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Upload failed — kontrollo lidhjen'));
      xhr.ontimeout = () => reject(new Error('Upload timeout'));
      xhr.send(file);
    })
};
