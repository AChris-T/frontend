import axios from 'axios';

/** Public Railway backend URL — required in production for file uploads (scan/submit). */
export function getPublicBackendUrl() {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  return url ? url.replace(/\/+$/, '') : null;
}

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

const uploadConfig = { timeout: 120000 };

/** File uploads bypass the Vercel proxy to avoid 4.5MB limits and broken multipart forwarding. */
function uploadPost(path, formData) {
  const backend = getPublicBackendUrl();
  if (backend) {
    return axios.post(`${backend}${path}`, formData, uploadConfig);
  }
  return api.post(path, formData, uploadConfig);
}

// Auth — JSON requests stay on same-origin /api proxy (cookies)
export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const logoutUser = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');
export const reverseGeocode = (lat, lon) => api.get('/geocode', { params: { lat, lon } });

// Reports — direct to Railway backend in production
export const scanMedia = (formData) => uploadPost('/reports/scan', formData);
export const submitReport = (formData) => uploadPost('/reports', formData);
export const getMyReports = () => api.get('/reports/my-reports');
export const getReport = (id) => api.get(`/reports/${id}`);

// Roads
export const getAllRoads = () => api.get('/roads');
export const getRoadsGeoJSON = () => api.get('/roads/geojson/all');
export const getRoadReports = (id) => api.get(`/roads/${id}/reports`);
export const getNearestRoad = (lat, lon) =>
  api.get(`/roads/nearest/point?lat=${lat}&lon=${lon}`);

// Admin
export const getAdminDashboard = () => api.get('/admin/dashboard');
export const getAdminReports = () => api.get('/admin/reports');
export const updateReportStatus = (id, data) =>
  api.put(`/admin/reports/${id}/status`, data);
export const deleteReport = (id) => api.delete(`/admin/reports/${id}`);

export default api;
