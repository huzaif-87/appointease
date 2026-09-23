import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token if present in localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('appointease_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for centralized error extraction & session management
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isNetworkError = !error.response && Boolean(error.message);
    const status = error.response?.status;
    let message = error.response?.data?.message || error.message || 'An unexpected error occurred';

    // 1. Map 429 Rate Limit to compassionate user copy
    if (status === 429) {
      message = "You're making requests a little too quickly. Please wait a moment and try again.";
    }

    // 2. On 401: Clear stale credentials & redirect if attempting private access
    if (status === 401) {
      localStorage.removeItem('appointease_token');
      localStorage.removeItem('appointease_role');
      localStorage.removeItem('appointease_user');

      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        const publicRoutes = ['/', '/login', '/register', '/services', '/providers'];
        const isPublic = publicRoutes.some((p) => (p === '/' ? path === '/' : path.startsWith(p)));
        if (!isPublic && !path.startsWith('/login') && !path.startsWith('/register')) {
          const redirectQuery = encodeURIComponent(path + window.location.search);
          window.location.href = `/login?redirect=${redirectQuery}`;
        }
      }
    }

    const customError = {
      message,
      statusCode: status || (isNetworkError ? 0 : 500),
      errorCode:
        error.response?.data?.errorCode ||
        (isNetworkError ? 'NETWORK_ERROR' : status === 429 ? 'RATE_LIMITED' : null),
      isNetworkError,
      errors: error.response?.data?.errors || null,
      raw: error
    };
    return Promise.reject(customError);
  }
);

// Authentication Services
export const login = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

export const register = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const getProfile = async () => {
  const response = await api.get('/auth/profile');
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('appointease_token');
  localStorage.removeItem('appointease_role');
  localStorage.removeItem('appointease_user');
  window.location.href = '/login';
};

// API Service functions
export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

export const getServices = async (params = {}) => {
  const response = await api.get('/services', { params });
  return response.data;
};

export const getServiceById = async (id) => {
  const response = await api.get(`/services/${id}`);
  return response.data;
};

export const getProviders = async (params = {}) => {
  const response = await api.get('/providers', { params });
  return response.data;
};

export const getProviderById = async (id) => {
  const response = await api.get(`/providers/${id}`);
  return response.data;
};

export const getProviderAvailability = async (id) => {
  const response = await api.get(`/providers/${id}/availability`);
  return response.data;
};

export const getAvailableSlots = async (params = {}) => {
  const response = await api.get('/availability/slots', { params });
  return response.data;
};

export const getAdminOverview = async () => {
  const response = await api.get('/admin/overview');
  return response.data;
};

export const getAdminAppointments = async (params = {}) => {
  const response = await api.get('/admin/appointments', { params });
  return response.data;
};

export const updateAdminAppointmentStatus = async (id, data = {}) => {
  const response = await api.patch(`/admin/appointments/${id}/status`, data);
  return response.data;
};

export const getAdminProviders = async (params = {}) => {
  const response = await api.get('/admin/providers', { params });
  return response.data;
};

export const createAdminProvider = async (providerData) => {
  const response = await api.post('/admin/providers', providerData);
  return response.data;
};

export const updateAdminProvider = async (id, providerData) => {
  const response = await api.patch(`/admin/providers/${id}`, providerData);
  return response.data;
};

export const getAdminServices = async (params = {}) => {
  const response = await api.get('/admin/services', { params });
  return response.data;
};

export const createAdminService = async (serviceData) => {
  const response = await api.post('/admin/services', serviceData);
  return response.data;
};

export const updateAdminService = async (id, serviceData) => {
  const response = await api.patch(`/admin/services/${id}`, serviceData);
  return response.data;
};

export const getAdminAvailabilities = async (params = {}) => {
  const response = await api.get('/admin/availabilities', { params });
  return response.data;
};

export const createAdminAvailability = async (availabilityData) => {
  const response = await api.post('/admin/availabilities', availabilityData);
  return response.data;
};

export const updateAdminAvailability = async (id, availabilityData) => {
  const response = await api.patch(`/admin/availabilities/${id}`, availabilityData);
  return response.data;
};

export const deleteAdminAvailability = async (id) => {
  const response = await api.delete(`/admin/availabilities/${id}`);
  return response.data;
};

export const getAdminUsers = async (params = {}) => {
  const response = await api.get('/admin/users', { params });
  return response.data;
};

export const updateAdminUser = async (id, userData) => {
  const response = await api.patch(`/admin/users/${id}`, userData);
  return response.data;
};

// Provider Console API Functions
export const getProviderDashboard = async () => {
  const response = await api.get('/provider/console/dashboard');
  return response.data;
};

export const getProviderConsoleAppointments = async (params = {}) => {
  const response = await api.get('/provider/console/appointments', { params });
  return response.data;
};

export const updateProviderConsoleAppointmentStatus = async (id, data = {}) => {
  const response = await api.patch(`/provider/console/appointments/${id}/status`, data);
  return response.data;
};

export const getProviderConsoleAvailability = async () => {
  const response = await api.get('/provider/console/availability');
  return response.data;
};

export const createProviderConsoleAvailability = async (availabilityData) => {
  const response = await api.post('/provider/console/availability', availabilityData);
  return response.data;
};

export const deleteProviderConsoleAvailability = async (id) => {
  const response = await api.delete(`/provider/console/availability/${id}`);
  return response.data;
};

export const getProviderConsoleServices = async () => {
  const response = await api.get('/provider/console/services');
  return response.data;
};

export const getProviderConsoleProfile = async () => {
  const response = await api.get('/provider/console/profile');
  return response.data;
};

export const updateProviderConsoleProfile = async (profileData) => {
  const response = await api.patch('/provider/console/profile', profileData);
  return response.data;
};

export const updateProviderConsoleAvailability = async (id, data) => {
  const response = await api.patch(`/provider/console/availability/${id}`, data);
  return response.data;
};

export const createAppointment = async (bookingData, idempotencyKey = null) => {
  const headers = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  const response = await api.post('/appointments', bookingData, { headers });
  return response.data;
};

export const getMyAppointments = async (params = {}) => {
  const response = await api.get('/appointments', { params });
  return response.data;
};

export const getAppointmentById = async (id) => {
  const response = await api.get(`/appointments/${id}`);
  return response.data;
};

export const cancelAppointment = async (id, data = {}) => {
  const response = await api.patch(`/appointments/${id}/cancel`, data);
  return response.data;
};

export const rescheduleAppointment = async (id, data = {}) => {
  const response = await api.patch(`/appointments/${id}/reschedule`, data);
  return response.data;
};

export const getSmartRecommendations = async ({ query }) => {
  const response = await api.post('/ai/time-recommendations', { query });
  return response.data;
};

// Notifications API (Milestone 8)
export const getNotifications = async (params = {}) => {
  const response = await api.get('/notifications', { params });
  return response.data;
};

export const markNotificationAsRead = async (id) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
};

export const markAllNotificationsAsRead = async () => {
  const response = await api.patch('/notifications/read-all');
  return response.data;
};

export default api;
