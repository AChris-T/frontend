import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

const uploadConfig = { timeout: 120000 };

// Auth
export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const logoutUser = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');
export const reverseGeocode = (lat, lon) => api.get('/geocode', { params: { lat, lon } });

// Reports — long timeout for AI scan + file upload
export const scanMedia = (formData) => api.post('/reports/scan', formData, uploadConfig);
export const submitReport = (formData) => api.post('/reports', formData, uploadConfig);
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
