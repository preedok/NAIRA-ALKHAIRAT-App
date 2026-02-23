import axios, { type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = 'bintang_global_token';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch (_) {}
  return config;
});

api.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (err: AxiosError) => {
    if (err.response?.status === 401) {
      try {
        await AsyncStorage.removeItem(TOKEN_KEY);
      } catch (_) {}
    }
    return Promise.reject(err);
  }
);

export async function setToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ success: boolean; message?: string; data?: { user: any; token: string } }>('/auth/login', { email, password }),
  me: () => api.get<{ success: boolean; data: any }>('/auth/me'),
};

export const productsApi = {
  list: (params?: { type?: string; limit?: number; page?: number }) =>
    api.get('/products', { params }),
  getById: (id: string) => api.get(`/products/${id}`),
};

export interface InvoicesSummaryData {
  total_invoices?: number;
  total_orders?: number;
  total_amount?: number;
  total_paid?: number;
  total_remaining?: number;
  by_invoice_status?: Record<string, number>;
  by_order_status?: Record<string, number>;
}

export const invoicesApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => api.get('/invoices', { params, headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }),
  getSummary: (params?: Record<string, string>) =>
    api.get<{ success: boolean; data: InvoicesSummaryData }>('/invoices/summary', { params }),
  getById: (id: string) => api.get(`/invoices/${id}`),
};

/** @deprecated use invoicesApi */
export const ordersInvoicesApi = invoicesApi;
