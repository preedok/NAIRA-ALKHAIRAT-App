import axios from 'axios';

const API_BASE_URL = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bintang_global_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  loginGoogle: (id_token: string) => api.post('/auth/google', { id_token }),
  register: (payload: any) => api.post('/auth/register', payload),
  verifyOtp: (email: string, otp_code: string) => api.post('/auth/otp/verify', { email, otp_code }),
  resendOtp: (email: string) => api.post('/auth/otp/resend', { email }),
  me: () => api.get('/auth/me'),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password })
};

export interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  read_at?: string | null;
  created_at: string;
  data?: { invoice_id?: string; order_id?: string };
}

export const notificationsApi = {
  unreadCount: () => api.get('/notifications/unread-count'),
  list: (params?: { limit?: number }) => api.get('/notifications', { params }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all')
};

export const publicApi = {
  getI18n: (locale: string) => api.get(`/i18n/${locale}`),
  getPublicSettings: () => api.get('/settings/public'),
  getActiveMaintenance: () => api.get('/settings/maintenance/active'),
  getBranches: () => api.get('/public/branches'),
  getProvinces: () => api.get('/public/provinces'),
  getWilayahs: (provinceId: string) =>
    api.get('/public/wilayahs', { params: { province_id: provinceId } })
};
