import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from '../utils/constants';

/** Batas waktu request (ms); tanpa ini browser bisa "pending" tanpa batas jika server tidak menjawab. */
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: DEFAULT_REQUEST_TIMEOUT_MS
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bintang_global_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.responseType === 'blob') {
    const t = typeof config.timeout === 'number' ? config.timeout : DEFAULT_REQUEST_TIMEOUT_MS;
    config.timeout = Math.max(t, 120000);
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('bintang_global_token');
      localStorage.removeItem('bintang_global_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ success: boolean; message?: string; data?: { user: any; token: string } }>('/auth/login', { email, password }),
  me: () => api.get<{ success: boolean; data: any }>('/auth/me'),
  changePassword: (current_password: string, new_password: string) =>
    api.post<{ success: boolean; message?: string }>('/auth/change-password', { current_password, new_password })
};

export const superAdminApi = {
  getMonitoring: (params?: { branch_id?: string; role?: string }) => api.get('/super-admin/monitoring', { params }),
  getLogs: (params?: { source?: string; level?: string; q?: string; page?: number; limit?: number }) => api.get('/super-admin/logs', { params }),
  createLog: (body: { source?: string; level?: string; message: string; meta?: object }) => api.post('/super-admin/logs', body),
  listMaintenance: (params?: { active_only?: string }) => api.get('/super-admin/maintenance', { params }),
  createMaintenance: (body: { title: string; message: string; type?: string; block_app?: boolean; starts_at?: string; ends_at?: string }) => api.post('/super-admin/maintenance', body),
  updateMaintenance: (id: string, body: object) => api.patch(`/super-admin/maintenance/${id}`, body),
  deleteMaintenance: (id: string) => api.delete(`/super-admin/maintenance/${id}`),
  getSettings: () => api.get('/super-admin/settings'),
  updateSettings: (body: object) => api.put('/super-admin/settings', body),
  exportMonitoringExcel: (params?: { period?: string; branch_id?: string; role?: string }) =>
    api.get('/super-admin/export-monitoring-excel', { params, responseType: 'blob' }),
  exportMonitoringPdf: (params?: { period?: string; branch_id?: string; role?: string }) =>
    api.get('/super-admin/export-monitoring-pdf', { params, responseType: 'blob' }),
  exportLogsExcel: (params?: { source?: string; level?: string; limit?: number }) =>
    api.get('/super-admin/export-logs-excel', { params, responseType: 'blob' }),
  exportLogsPdf: (params?: { source?: string; level?: string; limit?: number }) =>
    api.get('/super-admin/export-logs-pdf', { params, responseType: 'blob' })
};

export const publicApi = {
  getActiveMaintenance: () => api.get('/super-admin/maintenance/active'),
  getPublicSettings: () => api.get('/super-admin/settings/public'),
  getI18n: (locale: string) => api.get(`/i18n/${locale}`),
  /** Landing page search: product types, products list, bandara (no auth). */
  getProductsForSearch: (params?: { type?: string; q?: string; limit?: number }) =>
    api.get<{
      success: boolean;
      data: {
        productTypes: string[];
        products: { id: string; name: string; code: string; type: string; meta: Record<string, unknown> }[];
        byType: Record<string, { id: string; name: string; code: string; type: string; meta: Record<string, unknown> }[]>;
        bandara: { code: string; name: string }[];
      };
    }>('/public/products-for-search', { params })
};

export interface NotificationItem {
  id: string;
  trigger: string;
  title: string;
  message: string | null;
  data?: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export const notificationsApi = {
  list: (params?: { unread_only?: string; limit?: number; page?: number }) =>
    api.get<{ success: boolean; data: NotificationItem[]; pagination?: { total: number; page: number; limit: number; totalPages: number } }>('/notifications', { params }),
  unreadCount: () =>
    api.get<{ success: boolean; data: { count: number } }>('/notifications/unread-count'),
  markRead: (id: string) =>
    api.patch<{ success: boolean; data: NotificationItem }>(`/notifications/${id}/read`),
  markAllRead: () =>
    api.patch<{ success: boolean; message?: string }>('/notifications/read-all')
};

export const maskapaiApi = {
  list: (params?: { q?: string; active_only?: string }) =>
    api.get<{ success: boolean; data: { id: string; code: string; name: string; is_active: boolean }[] }>('/maskapai', { params })
};

export const productsApi = {
  list: (params?: { type?: string; with_prices?: string; hotel_monthly_year?: string; branch_id?: string; owner_id?: string; view_as_pusat?: string; is_package?: string; include_inactive?: string; name?: string; limit?: number; page?: number; sort_by?: string; sort_order?: 'asc' | 'desc' }) =>
    api.get('/products', { params, headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }),
  getById: (id: string) => api.get(`/products/${id}`),
  getPrice: (id: string, params?: { branch_id?: string; owner_id?: string; currency?: string; room_type?: string; with_meal?: string }) => api.get(`/products/${id}/price`, { params }),
  getAvailability: (id: string, params: { from: string; to: string }) =>
    api.get<{ success: boolean; data: { availability_mode?: 'global' | 'per_season'; byDate: Record<string, Record<string, { total: number; booked: number; available: number }>>; byRoomType: Record<string, number> } }>(`/products/${id}/availability`, { params }),
  getHotelStayQuote: (
    id: string,
    params: {
      check_in: string;
      check_out: string;
      room_type: string;
      with_meal?: boolean;
      quantity?: number;
      currency?: string;
      branch_id?: string;
      owner_id?: string;
    }
  ) =>
    api.get<{
      success: boolean;
      data: {
        nights: number;
        currency: string;
        unit_price_per_room_per_night: number;
        room_unit_per_night: number;
        meal_unit_per_person_per_night: number;
        subtotal_idr: number;
        room_subtotal_idr: number;
        meal_subtotal_idr: number;
        breakdown: unknown[];
        used_fallback_default: boolean;
      };
    }>(`/products/${id}/hotel-stay-quote`, {
      params: {
        ...params,
        with_meal: params.with_meal ? 'true' : 'false',
        quantity: params.quantity ?? 1
      }
    }),
  getHotelMonthlyPrices: (id: string, params?: { year?: string }) =>
    api.get<{
      success: boolean;
      data: Array<{
        id: string;
        year_month: string;
        currency: 'IDR' | 'SAR' | 'USD';
        room_type: string;
        with_meal: boolean;
        amount: number;
        component?: string;
        branch_id?: string | null;
        owner_id?: string | null;
      }>;
    }>(`/products/${id}/hotel-monthly-prices`, { params }),
  saveHotelMonthlyPricesBulk: (
    id: string,
    body: {
      rows: Array<{
        year_month: string;
        room_type?: 'single' | 'double' | 'triple' | 'quad' | 'quint' | string;
        with_meal?: boolean;
        amount: number;
        currency: 'IDR' | 'SAR' | 'USD';
        component?: 'room' | 'meal';
        branch_id?: string | null;
        owner_id?: string | null;
      }>;
    }
  ) => api.put<{ success: boolean; message?: string }>(`/products/${id}/hotel-monthly-prices/bulk`, body),
  getHotelCalendar: (id: string, params: { from: string; to: string }) =>
    api.get<{
      success: boolean;
      data: {
        productName: string;
        byDate: Record<string, {
          _noSeason?: boolean;
          seasonId?: string;
          seasonName?: string;
          roomTypes?: Record<string, { total: number; booked: number; available: number }>;
          bookings?: { order_id: string; owner_id: string; owner_name: string; total_jamaah: number; by_room_type: Record<string, number> }[];
        }>;
        byRoomType: Record<string, number>;
      };
    }>(`/products/${id}/hotel-calendar`, { params }),
  getVisaCalendar: (id: string, params: { from: string; to: string }) =>
    api.get<{
      success: boolean;
      data: {
        productName: string;
        byDate: Record<string, {
          _noSeason?: boolean;
          seasonId?: string;
          seasonName?: string;
          quota?: number;
          booked?: number;
          available?: number;
          bookings?: { order_id: string; owner_id: string; owner_name: string; quantity: number }[];
        }>;
      };
    }>(`/products/${id}/visa-calendar`, { params }),
  getTicketCalendar: (id: string, params: { bandara: string; from: string; to: string }) =>
    api.get<{
      success: boolean;
      data: {
        productName: string;
        bandara: string;
        byDate: Record<string, {
          quota?: number;
          booked?: number;
          available?: number;
          bookings?: { order_id: string; owner_id: string; owner_name: string; quantity: number }[];
        }>;
      };
    }>(`/products/${id}/ticket-calendar`, { params }),
  getBusCalendar: (id: string, params: { from: string; to: string }) =>
    api.get<{
      success: boolean;
      data: {
        productName: string;
        byDate: Record<string, {
          _noSeason?: boolean;
          seasonId?: string;
          seasonName?: string;
          quota?: number;
          booked?: number;
          available?: number;
          bookings?: { order_id: string; owner_id: string; owner_name: string; quantity: number }[];
        }>;
      };
    }>(`/products/${id}/bus-calendar`, { params }),
  listPrices: (params?: { product_id?: string; branch_id?: string }) => api.get('/products/prices', { params }),
  create: (body: { type: string; code?: string; name: string; description?: string; is_package?: boolean; meta?: object }) => api.post('/products', body),
  createHotel: (body: { name: string; description?: string; meta?: object }) => api.post('/products/hotels', body),
  createVisa: (body: { name: string; description?: string; visa_kind: 'only' | 'tasreh' | 'premium'; require_hotel?: boolean; default_quota?: number | null; currency?: 'IDR' | 'SAR' | 'USD' }) => api.post('/products/visas', body),
  createTicket: (body: { name: string; description?: string; trip_type?: 'one_way' | 'return_only' | 'round_trip'; maskapai_id?: string }) => api.post('/products/tickets', body),
  createBus: (body: { name: string; description?: string; bus_kind?: 'bus' | 'hiace'; trip_type?: 'one_way' | 'return_only' | 'round_trip'; price_currency?: 'IDR' | 'SAR' | 'USD'; route_prices_by_trip?: Record<'one_way' | 'return_only' | 'round_trip', number>; price_per_vehicle_idr?: number; default_quota?: number | null }) => api.post('/products/bus', body),
  setTicketBandara: (productId: string, body: { bandara: string; period_type?: 'default' | 'month' | 'week' | 'day'; period_key?: string; price_idr: number; seat_quota: number }) => api.put(`/products/${productId}/ticket-bandara`, body),
  setTicketBandaraBulk: (productId: string, body: { bandara_defaults: Record<string, { price_idr?: number; seat_quota?: number }> }) => api.put(`/products/${productId}/ticket-bandara-bulk`, body),
  update: (id: string, body: object) => api.patch(`/products/${id}`, body),
  delete: (id: string) => api.delete(`/products/${id}`),
  createPrice: (body: object) => api.post('/products/prices', body),
  updatePrice: (id: string, body: object) => api.patch(`/products/prices/${id}`, body),
  deletePrice: (id: string) => api.delete(`/products/prices/${id}`)
};

export const businessRulesApi = {
  get: (params?: { branch_id?: string; wilayah_id?: string }) => api.get('/business-rules', { params }),
  /** Nilai untuk halaman publik (tanpa auth), mis. nominal default pendaftaran Owner MOU */
  getPublic: () => api.get<{ success: boolean; data: { registration_deposit_idr: number } }>('/business-rules/public'),
  set: (body: { branch_id?: string; wilayah_id?: string; rules: object }) => api.put('/business-rules', body)
};

export const ordersApi = {
  list: (params?: { status?: string; branch_id?: string; owner_id?: string; limit?: number; page?: number; sort_by?: string; sort_order?: 'asc' | 'desc'; date_from?: string; date_to?: string; invoice_number?: string; provinsi_id?: string; wilayah_id?: string }) => api.get('/orders', { params }),
  getById: (id: string) => api.get(`/orders/${id}`),
  create: (body: object) => api.post('/orders', body),
  update: (id: string, body: object) => api.patch(`/orders/${id}`, body),
  /** Batalkan order. Jika ada pembayaran: action = 'to_balance' | 'refund' | 'allocate_to_order'. Refund: bank_name, account_number wajib; refund_amount opsional (default full); partial → remainder_action + remainder_target_invoice_id. allocate_to_order: target_invoice_id wajib. */
  delete: (id: string, body?: {
    action?: 'to_balance' | 'refund' | 'allocate_to_order';
    reason?: string;
    bank_name?: string;
    account_number?: string;
    account_holder_name?: string;
    refund_amount?: number;
    remainder_action?: 'to_balance' | 'allocate_to_order';
    remainder_target_invoice_id?: string;
    target_invoice_id?: string;
  }) => api.delete(`/orders/${id}`, { data: body }),
  sendResult: (orderId: string, channel?: 'email' | 'whatsapp' | 'both') => api.post(`/orders/${orderId}/send-result`, { channel }),
  /** Upload data jamaah (ZIP file atau link Google Drive) untuk order item visa/tiket */
  uploadJamaahData: (orderId: string, itemId: string, data: FormData | { jamaah_data_link: string }) =>
    data instanceof FormData
      ? api.post(`/orders/${orderId}/items/${itemId}/jamaah-data`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
      : api.post(`/orders/${orderId}/items/${itemId}/jamaah-data`, data),
  /** Unduh file data jamaah (stream dari server, hindari 404 direct URL) */
  getJamaahFile: (orderId: string, itemId: string) =>
    api.get(`/orders/${orderId}/items/${itemId}/jamaah-file`, { responseType: 'blob' }),
  /** Owner: ajukan pembatalan invoice lunas ke Admin Pusat (body sama seperti delete + opsional owner_note). */
  createCancellationRequest: (orderId: string, body: {
    action: 'to_balance' | 'refund' | 'allocate_to_order';
    reason?: string;
    bank_name?: string;
    account_number?: string;
    account_holder_name?: string;
    refund_amount?: number;
    remainder_action?: 'to_balance' | 'allocate_to_order';
    remainder_target_invoice_id?: string;
    target_invoice_id?: string;
    owner_note?: string;
  }) => api.post<{ success: boolean; message?: string; data?: unknown }>(`/orders/${orderId}/cancellation-requests`, body)
};

export const orderCancellationRequestsApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<{ success: boolean; data: unknown[]; pagination?: { total: number; page: number; limit: number; totalPages: number } }>('/order-cancellation-requests', { params }),
  review: (id: string, body: { decision: 'approve' | 'reject'; rejection_reason?: string }) =>
    api.patch<{ success: boolean; message?: string; data?: unknown }>(`/order-cancellation-requests/${id}`, body)
};

export const hotelApi = {
  getDashboard: () => api.get('/hotel/dashboard'),
  listInvoices: (params?: { status?: string; page?: number; limit?: number }) => api.get<{ success: boolean; data: any[]; pagination?: { total: number; page: number; limit: number; totalPages: number } }>('/hotel/invoices', { params }),
  getInvoice: (id: string) => api.get<{ success: boolean; data: any }>(`/hotel/invoices/${id}`),
  listOrders: (params?: { status?: string }) => api.get('/hotel/orders', { params }),
  getOrder: (id: string) => api.get(`/hotel/orders/${id}`),
  listProducts: () => api.get('/hotel/products'),
  updateItemProgress: (orderItemId: string, body: { status?: string; room_number?: string; meal_status?: string; check_in_date?: string; check_out_date?: string; notes?: string }) =>
    api.patch(`/hotel/order-items/${orderItemId}/progress`, body),
  getOrderItemSlip: (invoiceId: string, orderItemId: string) =>
    api.get(`/hotel/invoices/${invoiceId}/order-items/${orderItemId}/slip`, { responseType: 'blob' })
};

export const ticketApi = {
  getDashboard: () => api.get<{ success: boolean; data: TicketDashboardData }>('/ticket/dashboard'),
  listInvoices: (params?: { status?: string; page?: number; limit?: number }) => api.get<{ success: boolean; data: any[]; pagination?: { total: number; page: number; limit: number; totalPages: number } }>('/ticket/invoices', { params }),
  getInvoice: (id: string) => api.get<{ success: boolean; data: any }>(`/ticket/invoices/${id}`),
  updateItemProgress: (orderItemId: string, body: { status?: string; notes?: string }) =>
    api.patch(`/ticket/order-items/${orderItemId}/progress`, body),
  uploadTicket: (orderItemId: string, formData: FormData, setStatusIssued?: boolean) => {
    if (setStatusIssued) formData.append('set_status_issued', '1');
    return api.post(`/ticket/order-items/${orderItemId}/upload-ticket`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  exportExcel: () => api.get('/ticket/export-excel', { responseType: 'blob' }),
  getOrderItemSlip: (invoiceId: string, orderItemId: string) =>
    api.get(`/ticket/invoices/${invoiceId}/order-items/${orderItemId}/slip`, { responseType: 'blob' })
};

export const visaApi = {
  getDashboard: () => api.get<{ success: boolean; data: VisaDashboardData }>('/visa/dashboard'),
  listInvoices: (params?: { status?: string; page?: number; limit?: number }) => api.get<{ success: boolean; data: any[]; pagination?: { total: number; page: number; limit: number; totalPages: number } }>('/visa/invoices', { params }),
  getInvoice: (id: string) => api.get<{ success: boolean; data: any }>(`/visa/invoices/${id}`),
  updateItemProgress: (orderItemId: string, body: { status?: string; notes?: string }) =>
    api.patch(`/visa/order-items/${orderItemId}/progress`, body),
  uploadVisa: (orderItemId: string, formData: FormData, setStatusIssued?: boolean) => {
    if (setStatusIssued) formData.append('set_status_issued', '1');
    return api.post(`/visa/order-items/${orderItemId}/upload-visa`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  exportExcel: () => api.get('/visa/export-excel', { responseType: 'blob' }),
  getOrderItemSlip: (invoiceId: string, orderItemId: string) =>
    api.get(`/visa/invoices/${invoiceId}/order-items/${orderItemId}/slip`, { responseType: 'blob' })
};

export const busApi = {
  getDashboard: () => api.get<{ success: boolean; data: BusDashboardData }>('/bus/dashboard'),
  listInvoices: (params?: { status?: string; page?: number; limit?: number }) => api.get<{ success: boolean; data: any[]; pagination?: { total: number; page: number; limit: number; totalPages: number } }>('/bus/invoices', { params }),
  getInvoice: (id: string) => api.get<{ success: boolean; data: any }>(`/bus/invoices/${id}`),
  listOrders: (params?: { status?: string }) => api.get<{ success: boolean; data: Order[] }>('/bus/orders', { params }),
  getOrder: (id: string) => api.get<{ success: boolean; data: Order }>(`/bus/orders/${id}`),
  listProducts: () => api.get<{ success: boolean; data: BusProduct[] }>('/bus/products'),
  updateItemProgress: (orderItemId: string, body: { bus_ticket_status?: string; bus_ticket_info?: string; arrival_status?: string; departure_status?: string; return_status?: string; notes?: string }) =>
    api.patch(`/bus/order-items/${orderItemId}/progress`, body),
  updateOrderBusIncludeProgress: (invoiceId: string, body: {
    arrival_status?: string; arrival_bus_number?: string; arrival_date?: string; arrival_time?: string; arrival_ticket_file_url?: string;
    return_status?: string; return_bus_number?: string; return_date?: string; return_time?: string; return_ticket_file_url?: string;
    notes?: string;
  }) => api.put(`/bus/invoices/${invoiceId}/order-bus-include-progress`, body),
  uploadOrderBusIncludeTicketFile: (invoiceId: string, file: File, type: 'arrival' | 'return') => {
    const form = new FormData();
    form.append('ticket_file', file);
    form.append('type', type);
    return api.post<{ success: boolean; data?: { url: string; type: string } }>(`/bus/invoices/${invoiceId}/order-bus-include-ticket-file`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  exportExcel: () => api.get('/bus/export-excel', { responseType: 'blob' }),
  exportPdf: () => api.get('/bus/export-pdf', { responseType: 'blob' }),
  getOrderItemSlip: (invoiceId: string, orderItemId: string) =>
    api.get(`/bus/invoices/${invoiceId}/order-items/${orderItemId}/slip`, { responseType: 'blob' })
};

export interface HandlingDashboardData {
  total_orders: number;
  total_handling_items: number;
  by_status: { pending?: number; in_progress?: number; completed?: number };
  pending_list: Array<{
    order_id: string;
    order_number: string;
    invoice_id?: string;
    invoice_number?: string;
    order_item_id: string;
    owner_name?: string;
    product_name?: string;
    quantity: number;
    status: string;
  }>;
}

export const handlingApi = {
  getDashboard: (params?: { date_from?: string; date_to?: string }) =>
    api.get<{ success: boolean; data: HandlingDashboardData }>('/handling/dashboard', { params }),
  updateOrderItemProgress: (orderItemId: string, body: { handling_status: 'pending' | 'in_progress' | 'completed' }) =>
    api.patch(`/handling/order-items/${orderItemId}/progress`, body)
};

export interface SiskopatuhDashboardData {
  total_orders: number;
  total_siskopatuh_items: number;
  by_status: { pending?: number; in_progress?: number; completed?: number };
  pending_list: Array<{
    order_id: string;
    order_number?: string;
    invoice_id?: string;
    invoice_number?: string;
    order_item_id: string;
    owner_name?: string;
    product_name?: string;
    quantity: number;
    status: string;
  }>;
}

export const siskopatuhApi = {
  getDashboard: (params?: { date_from?: string; date_to?: string }) =>
    api.get<{ success: boolean; data: SiskopatuhDashboardData }>('/siskopatuh/dashboard', { params }),
  listInvoices: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<{ success: boolean; data: unknown[]; pagination?: { total: number; page: number; limit: number; totalPages: number } }>('/siskopatuh/invoices', { params }),
  getInvoice: (id: string) => api.get<{ success: boolean; data: unknown }>(`/siskopatuh/invoices/${id}`),
  updateOrderItemProgress: (orderItemId: string, body: { siskopatuh_status: 'pending' | 'in_progress' | 'completed' }) =>
    api.patch(`/siskopatuh/order-items/${orderItemId}/progress`, body)
};

// Minimal types for ticket dashboard (invoice-based)
export interface TicketDashboardData {
  total_invoices: number;
  total_ticket_items: number;
  by_status: Record<string, number>;
  pending_list: Array<{
    invoice_id?: string;
    invoice_number?: string;
    order_id: string;
    order_number: string;
    order_item_id: string;
    owner_name?: string;
    status: string;
    manifest_file_url?: string;
    ticket_file_url?: string;
    issued_at?: string;
  }>;
}
/** Status pembayaran DP order: tagihan_dp = belum bayar DP, pembayaran_dp = sudah ada bukti bayar DP */
export const DP_PAYMENT_STATUS = { TAGIHAN_DP: 'tagihan_dp', PEMBAYARAN_DP: 'pembayaran_dp' } as const;

interface Order {
  id: string;
  order_number: string;
  status?: string;
  dp_payment_status?: 'tagihan_dp' | 'pembayaran_dp' | null;
  dp_percentage_paid?: number | null;
  order_updated_at?: string | null;
  total_amount?: number;
  total_amount_idr?: number | null;
  total_amount_sar?: number | null;
  currency?: string;
  currency_rates_override?: { SAR_TO_IDR?: number; USD_TO_IDR?: number } | null;
  User?: { id: string; name: string; email?: string; company_name?: string };
  Branch?: { id: string; code: string; name: string };
  OrderItems?: OrderItem[];
}
interface OrderItem {
  id: string;
  type: string;
  quantity: number;
  manifest_file_url?: string;
  meta?: object;
  TicketProgress?: { id: string; status: string; ticket_file_url?: string; issued_at?: string; notes?: string };
  VisaProgress?: { id: string; status: string; visa_file_url?: string; issued_at?: string; notes?: string };
  BusProgress?: { id: string; bus_ticket_status: string; bus_ticket_info?: string; arrival_status: string; departure_status: string; return_status: string; notes?: string };
}

export interface BusDashboardData {
  total_orders: number;
  total_bus_items: number;
  bus_ticket: { pending: number; issued: number };
  arrival: Record<string, number>;
  departure: Record<string, number>;
  return: Record<string, number>;
  pending_list: Array<{
    order_id: string;
    order_number: string;
    order_item_id: string;
    owner_name?: string;
    quantity: number;
    bus_ticket_status: string;
    arrival_status: string;
    departure_status: string;
    return_status: string;
  }>;
}

interface BusProduct {
  id: string;
  code: string;
  name: string;
  price_general: number | null;
  price_branch: number | null;
  currency: string;
  special_prices: Array<{ owner_id: string; owner_name: string; amount: number; currency: string }>;
}

export interface VisaDashboardData {
  total_invoices: number;
  total_visa_items: number;
  by_status: Record<string, number>;
  pending_list: Array<{
    invoice_id?: string;
    invoice_number?: string;
    order_id: string;
    order_number: string;
    order_item_id: string;
    owner_name?: string;
    status: string;
    manifest_file_url?: string;
    visa_file_url?: string;
    issued_at?: string;
  }>;
}

export interface InvoicesSummaryData {
  total_invoices: number;
  total_orders: number;
  total_amount: number;
  total_paid: number;
  total_remaining: number;
  by_invoice_status: Record<string, number>;
  by_order_status: Record<string, number>;
}

export const invoicesApi = {
  list: (params?: { status?: string; branch_id?: string; provinsi_id?: string; wilayah_id?: string; owner_id?: string; order_status?: string; invoice_number?: string; date_from?: string; date_to?: string; due_status?: string; has_handling?: boolean; limit?: number; page?: number; sort_by?: string; sort_order?: 'asc' | 'desc' }) =>
    api.get('/invoices', { params, headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }),
  getDraftOrders: (params?: { branch_id?: string; provinsi_id?: string; wilayah_id?: string }) =>
    api.get<{ success: boolean; data: any[] }>('/invoices/draft-orders', { params, headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }),
  getSummary: (params?: { status?: string; branch_id?: string; provinsi_id?: string; wilayah_id?: string; owner_id?: string; order_status?: string; invoice_number?: string; date_from?: string; date_to?: string; due_status?: string }) =>
    api.get<{ success: boolean; data: InvoicesSummaryData }>('/invoices/summary', { params }),
  getById: (id: string) => api.get(`/invoices/${id}`),
  getStatusHistory: (id: string) => api.get(`/invoices/${id}/status-history`),
  getOrderRevisions: (id: string) => api.get(`/invoices/${id}/order-revisions`),
  getPdf: (id: string) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  /** Download ZIP: invoice PDF + semua bukti bayar (tagihan DP, pembayaran DP, lunas, dll) */
  getArchive: (id: string) => api.get(`/invoices/${id}/archive`, { responseType: 'blob' }),
  create: (body: { order_id: string; is_super_promo?: boolean }) => api.post('/invoices', body),
  unblock: (id: string) => api.patch(`/invoices/${id}/unblock`),
  verifyPayment: (id: string, body: { payment_proof_id: string; verified: boolean; notes?: string }) => api.post(`/invoices/${id}/verify-payment`, body),
  handleOverpaid: (id: string, body: { handling: string; target_invoice_id?: string; target_order_id?: string }) => api.patch(`/invoices/${id}/overpaid`, body),
  uploadPaymentProof: (id: string, formData: FormData) => api.post(`/invoices/${id}/payment-proofs`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getPaymentProofFile: (invoiceId: string, proofId: string) => api.get(`/invoices/${invoiceId}/payment-proofs/${proofId}/file`, { responseType: 'blob' }),
  /** Unduh dokumen tiket terbit (ZIP/RAR) via API — file di-stream dari server */
  getTicketFile: (invoiceId: string, orderItemId: string) => api.get(`/invoices/${invoiceId}/order-items/${orderItemId}/ticket-file`, { responseType: 'blob' }),
  /** Unduh dokumen visa terbit via API — file di-stream dari server */
  getVisaFile: (invoiceId: string, orderItemId: string) => api.get(`/invoices/${invoiceId}/order-items/${orderItemId}/visa-file`, { responseType: 'blob' }),
  /** Unduh file manifest jamaah via API (sama seperti invoice/visa/tiket) */
  getManifestFile: (invoiceId: string, orderItemId: string) => api.get(`/invoices/${invoiceId}/order-items/${orderItemId}/manifest-file`, { responseType: 'blob' }),
  allocateBalance: (id: string, body: { amount: number }) => api.post(`/invoices/${id}/allocate-balance`, body),
  /** Pemindahan dana: banyak sumber -> banyak penerima. Body: { transfers: [{ source_invoice_id, target_invoice_id, amount }], notes? } */
  reallocatePayments: (body: { transfers: Array<{ source_invoice_id: string; target_invoice_id: string; amount: number }>; notes?: string }) =>
    api.post<{ success: boolean; message?: string; data?: { transfers: number; total_amount: number } }>('/invoices/reallocate-payments', body),
  listReallocations: (params?: { invoice_id?: string; limit?: number; page?: number }) =>
    api.get<{ success: boolean; data: any[]; pagination?: { total: number; page: number; limit: number; totalPages: number } }>('/invoices/reallocations', { params }),
  getReleasable: (id: string) =>
    api.get<{ success: boolean; data: { invoice_id: string; invoice_number: string; releasable_amount: number } }>(`/invoices/${id}/releasable`)
};

export interface RefundStats {
  total_refunds: number;
  requested: number;
  approved: number;
  rejected: number;
  refunded: number;
  amount_requested: number;
  amount_refunded: number;
  amount_pending: number;
  by_status: Record<string, number>;
  amount_by_status: Record<string, number>;
}

export type RefundListParams = {
  status?: string;
  owner_id?: string;
  date_from?: string;
  date_to?: string;
  source?: string;
  limit?: number;
  page?: number;
};

export const refundsApi = {
  list: (params?: RefundListParams) => api.get('/refunds', { params }),
  getStats: (params?: Omit<RefundListParams, 'limit' | 'page'>) => api.get<{ success: boolean; data: RefundStats }>('/refunds/stats', { params }),
  getById: (id: string) => api.get(`/refunds/${id}`),
  updateStatus: (id: string, body: { status: string; rejection_reason?: string }) => api.patch(`/refunds/${id}`, body),
  /** Potong saldo penarikan jika belum tercatat (admin/accounting, idempoten). */
  syncBalanceDebit: (id: string) => api.post<{ success: boolean; message?: string; data?: { owner_balance: number | null } }>(`/refunds/${id}/sync-balance-debit`),
  /** Selesaikan transfer: bank & nama rekening pengirim + bukti (multipart). */
  completePayout: (id: string, formData: FormData) =>
    api.post<{ success: boolean; message?: string; data?: unknown }>(`/refunds/${id}/complete-payout`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  createFromBalance: (body: { amount: number; bank_name: string; account_number: string; account_holder_name: string }) => api.post('/refunds', body),
  /** Role accounting: upload bukti bayar refund. Setelah upload, status jadi refunded & bukti dikirim ke email pemesan. */
  uploadProof: (id: string, formData: FormData) => api.post(`/refunds/${id}/upload-proof`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getProofFile: (id: string) => api.get(`/refunds/${id}/proof/file`, { responseType: 'blob' })
};

export interface ProvinceItem {
  id: string | number;
  kode?: string;
  nama?: string;
  name?: string;
  wilayah_id?: string;
  wilayah?: string;
}

export interface KabupatenItem {
  id: string | number;
  nama: string;
}

export interface KabupatenForOwnerItem {
  id: string | number;
  kode: string;
  nama: string;
  provinsi_id: string;
  provinsi_nama: string;
  wilayah_id: string | null;
  wilayah_nama: string | null;
}

/** Master lokasi: wilayah, provinsi, kabupaten/kota dari API (database master). Jangan pakai data dummy. */
export const branchesApi = {
  list: (params?: { limit?: number; page?: number; include_inactive?: string; search?: string; region?: string; provinsi_id?: string; wilayah_id?: string; city?: string; is_active?: string; sort_by?: string; sort_order?: 'asc' | 'desc' }) => api.get<{ success: boolean; data: Branch[]; pagination?: { total: number; page: number; limit: number; totalPages: number } }>('/branches', { params }),
  listPublic: (params?: { search?: string; region?: string; limit?: number }) => api.get<{ success: boolean; data: Branch[] }>('/branches/public', { params }),
  listProvinces: (params?: { wilayah_id?: string }) => api.get<{ success: boolean; data: ProvinceItem[] }>('/branches/provinces', { params }),
  listWilayah: () => api.get<{ success: boolean; data: Array<{ id: string; name: string }> }>('/branches/wilayah'),
  listKabupaten: (provinceId: string | number) => api.get<{ success: boolean; data: KabupatenItem[] }>(`/branches/kabupaten/${provinceId}`),
  listKabupatenForOwner: () => api.get<{ success: boolean; data: KabupatenForOwnerItem[] }>('/branches/kabupaten-for-owner')
};
export interface Branch {
  id: string;
  code: string;
  name: string;
  city: string;
  region?: string;
  manager_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  koordinator_provinsi?: string;
  koordinator_provinsi_phone?: string;
  koordinator_provinsi_email?: string;
  koordinator_wilayah?: string;
  koordinator_wilayah_phone?: string;
  koordinator_wilayah_email?: string;
  is_active?: boolean;
}
export interface UserListItem {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: string;
  branch_id: string | null;
  region: string | null;
  company_name: string | null;
  is_active: boolean;
  created_at: string;
  Branch?: { id: string; code: string; name: string } | null;
  branch_name?: string | null;
  branch_code?: string | null;
  city?: string | null;
  provinsi_name?: string | null;
  wilayah_name?: string | null;
  owner_profile_id?: string;
  owner_status?: string;
  registration_payment_proof_url?: string | null;
  registration_payment_amount?: number | null;
  activation_generated_password?: string | null;
  last_login_at?: string | null;
  is_online?: boolean;
}
export const adminPusatApi = {
  /** Sinkronisasi lokasi: isi provinsi.wilayah_id & branch.provinsi_id yang null (dari kode/kota/region). */
  syncLocation: () =>
    api.post<{ success: boolean; message?: string; data?: { provinsi_updated?: number; branch_by_code?: number; branch_by_city?: number; branch_by_region?: number; user_wilayah_updated?: number } }>('/admin-pusat/sync-location'),
  getDashboard: (params?: { branch_id?: string; date_from?: string; date_to?: string; status?: string; provinsi_id?: string; wilayah_id?: string }) =>
    api.get<{ success: boolean; data: AdminPusatDashboardData }>('/admin-pusat/dashboard', { params }),
  listUsers: (params?: { role?: string; branch_id?: string; wilayah_id?: string; provinsi_id?: string; kabupaten_id?: string; is_active?: string; limit?: number; page?: number; sort_by?: string; sort_order?: 'asc' | 'desc' }) =>
    api.get<{ success: boolean; data: UserListItem[]; pagination?: { total: number; page: number; limit: number; totalPages: number } }>('/admin-pusat/users', { params }),
  getUserById: (id: string) =>
    api.get<{ success: boolean; data: UserListItem & { OwnerProfile?: any; address?: string; whatsapp?: string; npwp?: string; preferred_branch_id?: string } }>(`/admin-pusat/users/${id}`),
  createUser: (body: {
    name: string; email: string; password: string; role: string;
    branch_id?: string; region?: string;
    provinsi_id?: string; kabupaten_kode?: string; kabupaten_nama?: string;
  }) => api.post<{ success: boolean; data: any }>('/admin-pusat/users', body),
  updateUser: (id: string, body: { name?: string; email?: string; phone?: string; company_name?: string; password?: string; is_active?: boolean; address?: string; whatsapp?: string; npwp?: string; preferred_branch_id?: string }) =>
    api.patch<{ success: boolean; data: any }>(`/admin-pusat/users/${id}`, body),
  deleteUser: (id: string) => api.delete<{ success: boolean; message?: string }>(`/admin-pusat/users/${id}`),
  setProductAvailability: (productId: string, body: { quantity?: number; meta?: object }) =>
    api.put<{ success: boolean; data: any }>(`/admin-pusat/products/${productId}/availability`, body),
  getHotelAvailabilityConfig: (productId: string) =>
    api.get<{ success: boolean; data: HotelAvailabilityConfig }>(`/admin-pusat/products/${productId}/hotel-availability-config`),
  setHotelAvailabilityConfig: (productId: string, body: { availability_mode: 'global' | 'per_season'; global_room_inventory?: Record<string, number> }) =>
    api.put<{ success: boolean; data: HotelAvailabilityConfig; message?: string }>(`/admin-pusat/products/${productId}/hotel-availability-config`, body),
  listSeasons: (productId: string) =>
    api.get<{ success: boolean; data: HotelSeason[] }>(`/admin-pusat/products/${productId}/seasons`),
  createSeason: (productId: string, body: { name: string; start_date: string; end_date: string; meta?: object }) =>
    api.post<{ success: boolean; data: HotelSeason }>(`/admin-pusat/products/${productId}/seasons`, body),
  updateSeason: (productId: string, seasonId: string, body: { name?: string; start_date?: string; end_date?: string; meta?: object }) =>
    api.patch<{ success: boolean; data: HotelSeason }>(`/admin-pusat/products/${productId}/seasons/${seasonId}`, body),
  deleteSeason: (productId: string, seasonId: string) =>
    api.delete<{ success: boolean; message?: string }>(`/admin-pusat/products/${productId}/seasons/${seasonId}`),
  setSeasonInventory: (productId: string, seasonId: string, body: { inventory: { room_type: string; total_rooms: number }[] }) =>
    api.put<{ success: boolean; data: HotelRoomInventory[] }>(`/admin-pusat/products/${productId}/seasons/${seasonId}/inventory`, body),
  listVisaSeasons: (productId: string) =>
    api.get<{ success: boolean; data: VisaSeason[] }>(`/admin-pusat/products/${productId}/visa-seasons`),
  createVisaSeason: (productId: string, body: { name: string; start_date: string; end_date: string; quota?: number; meta?: object }) =>
    api.post<{ success: boolean; data: VisaSeason }>(`/admin-pusat/products/${productId}/visa-seasons`, body),
  updateVisaSeason: (productId: string, seasonId: string, body: { name?: string; start_date?: string; end_date?: string; meta?: object }) =>
    api.patch<{ success: boolean; data: VisaSeason }>(`/admin-pusat/products/${productId}/visa-seasons/${seasonId}`, body),
  deleteVisaSeason: (productId: string, seasonId: string) =>
    api.delete<{ success: boolean; message?: string }>(`/admin-pusat/products/${productId}/visa-seasons/${seasonId}`),
  setVisaSeasonQuota: (productId: string, seasonId: string, body: { quota: number }) =>
    api.put<{ success: boolean; data: VisaSeasonQuota }>(`/admin-pusat/products/${productId}/visa-seasons/${seasonId}/quota`, body),
  listTicketSeasons: (productId: string) =>
    api.get<{ success: boolean; data: TicketSeason[] }>(`/admin-pusat/products/${productId}/ticket-seasons`),
  createTicketSeason: (productId: string, body: { name: string; start_date: string; end_date: string; quota?: number; meta?: object }) =>
    api.post<{ success: boolean; data: TicketSeason }>(`/admin-pusat/products/${productId}/ticket-seasons`, body),
  updateTicketSeason: (productId: string, seasonId: string, body: { name?: string; start_date?: string; end_date?: string; meta?: object }) =>
    api.patch<{ success: boolean; data: TicketSeason }>(`/admin-pusat/products/${productId}/ticket-seasons/${seasonId}`, body),
  deleteTicketSeason: (productId: string, seasonId: string) =>
    api.delete<{ success: boolean; message?: string }>(`/admin-pusat/products/${productId}/ticket-seasons/${seasonId}`),
  setTicketSeasonQuota: (productId: string, seasonId: string, body: { quota: number }) =>
    api.put<{ success: boolean; data: TicketSeasonQuota }>(`/admin-pusat/products/${productId}/ticket-seasons/${seasonId}/quota`, body),
  listBusSeasons: (productId: string) =>
    api.get<{ success: boolean; data: BusSeason[] }>(`/admin-pusat/products/${productId}/bus-seasons`),
  createBusSeason: (productId: string, body: { name: string; start_date: string; end_date: string; quota?: number; meta?: object }) =>
    api.post<{ success: boolean; data: BusSeason }>(`/admin-pusat/products/${productId}/bus-seasons`, body),
  updateBusSeason: (productId: string, seasonId: string, body: { name?: string; start_date?: string; end_date?: string; meta?: object }) =>
    api.patch<{ success: boolean; data: BusSeason }>(`/admin-pusat/products/${productId}/bus-seasons/${seasonId}`, body),
  deleteBusSeason: (productId: string, seasonId: string) =>
    api.delete<{ success: boolean; message?: string }>(`/admin-pusat/products/${productId}/bus-seasons/${seasonId}`),
  setBusSeasonQuota: (productId: string, seasonId: string, body: { quota: number }) =>
    api.put<{ success: boolean; data: BusSeasonQuota }>(`/admin-pusat/products/${productId}/bus-seasons/${seasonId}/quota`, body)
};
export interface BusSeason {
  id: string;
  product_id: string;
  name: string;
  start_date: string;
  end_date: string;
  meta?: object;
  Quota?: { id: string; quota: number };
}
export interface BusSeasonQuota {
  id: string;
  season_id: string;
  quota: number;
}
export interface TicketSeason {
  id: string;
  product_id: string;
  name: string;
  start_date: string;
  end_date: string;
  meta?: object;
  Quota?: { id: string; quota: number };
}
export interface TicketSeasonQuota {
  id: string;
  season_id: string;
  quota: number;
}
export interface VisaSeason {
  id: string;
  product_id: string;
  name: string;
  start_date: string;
  end_date: string;
  meta?: object;
  Quota?: { id: string; quota: number };
}
export interface VisaSeasonQuota {
  id: string;
  season_id: string;
  quota: number;
}
export interface HotelAvailabilityConfig {
  mode: 'global' | 'per_season';
  global_room_inventory: Record<string, number>;
}
export interface HotelSeason {
  id: string;
  product_id: string;
  name: string;
  start_date: string;
  end_date: string;
  meta?: object;
  RoomInventory?: { id: string; room_type: string; total_rooms: number }[];
}
export interface HotelRoomInventory {
  id: string;
  season_id: string;
  room_type: string;
  total_rooms: number;
}
export interface AdminPusatDashboardData {
  branches: Branch[];
  orders: {
    total: number;
    by_status: Record<string, number>;
    by_branch: Array<{ branch_id: string; branch_name: string; code: string; count: number; revenue: number }>;
    by_wilayah: Array<{ wilayah_id: string | null; wilayah_name: string; count: number; revenue: number }>;
    by_provinsi: Array<{ provinsi_id: string | null; provinsi_name: string; count: number; revenue: number }>;
    total_revenue: number;
  };
  invoices: { total: number; by_status: Record<string, number> };
  owners_total: number;
  orders_recent: any[];
}

/** Invoice row returned by financial-report modal endpoints (wilayah/provinsi/kota/owner/periode). */
export interface FinancialReportModalInvoiceRow {
  id: string;
  invoice_number: string | null;
  owner_name?: string | null;
  branch_name?: string | null;
  wilayah_name?: string | null;
  provinsi_name?: string | null;
  city?: string | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  order_status?: string | null;
  issued_at?: string | null;
}

export interface FinancialReportModalInvoicesPayload {
  invoices: FinancialReportModalInvoiceRow[];
  period?: { start: string | Date; end: string | Date };
  branch_count?: number;
  year_month?: string;
}

export const accountingApi = {
  getDashboard: (params?: { branch_id?: string; provinsi_id?: string; wilayah_id?: string; date_from?: string; date_to?: string }) =>
    api.get<{ success: boolean; data: AccountingDashboardData }>('/accounting/dashboard', { params }),
  getDashboardKpi: (params?: { branch_id?: string; wilayah_id?: string; date_from?: string; date_to?: string }) =>
    api.get<{ success: boolean; data: AccountingKpiData }>('/accounting/dashboard-kpi', { params }),
  getChartOfAccounts: (params?: { active_only?: string; account_type?: string; level?: number; is_header?: string; parent_id?: string | null; search?: string }) =>
    api.get<{ success: boolean; data: ChartOfAccountItem[] }>('/accounting/chart-of-accounts', { params }),
  getChartOfAccountById: (id: string) =>
    api.get<{ success: boolean; data: ChartOfAccountItem }>(`/accounting/chart-of-accounts/${id}`),
  createChartOfAccount: (body: { code: string; name: string; account_type: string; parent_id?: string | null; is_header?: boolean; currency?: string; sort_order?: number }) =>
    api.post<{ success: boolean; data: ChartOfAccountItem; message: string }>('/accounting/chart-of-accounts', body),
  updateChartOfAccount: (id: string, body: { name?: string; account_type?: string; is_header?: boolean; currency?: string; sort_order?: number; is_active?: boolean }) =>
    api.patch<{ success: boolean; data: ChartOfAccountItem; message: string }>(`/accounting/chart-of-accounts/${id}`, body),
  deleteChartOfAccount: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/accounting/chart-of-accounts/${id}`),
  getBanks: (params?: { is_active?: string }) =>
    api.get<{ success: boolean; data: BankItem[] }>('/accounting/banks', { params }),
  getBankAccounts: (params?: { is_active?: string; bank_name?: string; currency?: string; search?: string }) =>
    api.get<{ success: boolean; data: BankAccountItem[] }>('/accounting/bank-accounts', { params }),
  getBankAccountById: (id: string) =>
    api.get<{ success: boolean; data: BankAccountItem }>(`/accounting/bank-accounts/${id}`),
  createBankAccount: (body: { code?: string; name: string; bank_name: string; account_number: string; currency?: string }) =>
    api.post<{ success: boolean; data: BankAccountItem; message: string }>('/accounting/bank-accounts', body),
  updateBankAccount: (id: string, body: { name?: string; bank_name?: string; account_number?: string; currency?: string; is_active?: boolean }) =>
    api.patch<{ success: boolean; data: BankAccountItem; message: string }>(`/accounting/bank-accounts/${id}`, body),
  deleteBankAccount: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/accounting/bank-accounts/${id}`),
  getFiscalYears: (params?: { is_closed?: string; search?: string }) =>
    api.get<{ success: boolean; data: FiscalYearItem[] }>('/accounting/fiscal-years', { params }),
  getFiscalYearById: (id: string) =>
    api.get<{ success: boolean; data: FiscalYearItem }>(`/accounting/fiscal-years/${id}`),
  createFiscalYear: (body: { code: string; name: string; start_date: string; end_date: string }) =>
    api.post<{ success: boolean; data: FiscalYearItem; message: string }>('/accounting/fiscal-years', body),
  lockAllPeriods: (id: string) =>
    api.post<{ success: boolean; data: FiscalYearItem; message: string }>(`/accounting/fiscal-years/${id}/lock-all`),
  closeFiscalYear: (id: string) =>
    api.post<{ success: boolean; data: FiscalYearItem; message: string }>(`/accounting/fiscal-years/${id}/close`),
  getAccountingPeriods: (params?: { fiscal_year_id?: string; is_locked?: string }) =>
    api.get<{ success: boolean; data: AccountingPeriodItem[] }>('/accounting/periods', { params }),
  lockPeriod: (id: string) =>
    api.post<{ success: boolean; data: AccountingPeriodItem; message: string }>(`/accounting/periods/${id}/lock`),
  unlockPeriod: (id: string) =>
    api.post<{ success: boolean; data: AccountingPeriodItem; message: string }>(`/accounting/periods/${id}/unlock`),
  getAccountMappings: () =>
    api.get<{ success: boolean; data: AccountMappingItem[] }>('/accounting/account-mappings'),
  listAccountingOwners: (params?: { branch_id?: string; provinsi_id?: string; wilayah_id?: string; kabupaten_id?: string }) =>
    api.get<{ success: boolean; data: Array<{ id: string; name: string }> }>('/accounting/owners', { params }),
  getAgingReport: (params?: { branch_id?: string; provinsi_id?: string; wilayah_id?: string; owner_id?: string; status?: string; order_status?: string; date_from?: string; date_to?: string; due_from?: string; due_to?: string; search?: string; page?: number; limit?: number; bucket?: string }) =>
    api.get<{ success: boolean; data: AccountingAgingData }>('/accounting/aging', { params }),
  exportAgingExcel: (params?: { branch_id?: string; provinsi_id?: string; wilayah_id?: string; owner_id?: string; status?: string; order_status?: string; date_from?: string; date_to?: string; due_from?: string; due_to?: string; search?: string }) =>
    api.get('/accounting/export-aging-excel', { params, responseType: 'blob' }),
  exportAgingPdf: (params?: { branch_id?: string; provinsi_id?: string; wilayah_id?: string; owner_id?: string; status?: string; order_status?: string; date_from?: string; date_to?: string; due_from?: string; due_to?: string; search?: string }) =>
    api.get('/accounting/export-aging-pdf', { params, responseType: 'blob' }),
  getPaymentsList: (params?: { branch_id?: string; verified?: string; date_from?: string; date_to?: string }) =>
    api.get<{ success: boolean; data: any[] }>('/accounting/payments', { params }),
  listInvoices: (params?: { status?: string; branch_id?: string }) =>
    api.get<{ success: boolean; data: any[] }>('/accounting/invoices', { params }),
  exportInvoicesExcel: (params?: { branch_id?: string; provinsi_id?: string; wilayah_id?: string; owner_id?: string; status?: string; date_from?: string; date_to?: string; invoice_number?: string }) =>
    api.get('/accounting/export-invoices-excel', { params, responseType: 'blob' }),
  listOrders: (params?: { branch_id?: string; status?: string; limit?: number }) =>
    api.get<{ success: boolean; data: any[] }>('/accounting/orders', { params }),
  getFinancialReport: (params?: { period?: string; year?: string; month?: string; date_from?: string; date_to?: string; branch_id?: string; provinsi_id?: string; wilayah_id?: string; owner_id?: string; status?: string; order_status?: string; product_type?: string; search?: string; min_amount?: number; max_amount?: number; page?: number; limit?: number; sort_by?: string; sort_order?: 'asc' | 'desc' }) =>
    api.get<{ success: boolean; data: AccountingFinancialReportData }>('/accounting/financial-report', { params }),
  getFinancialReportWilayahInvoices: (params: {
    wilayah_id: string;
    date_from?: string;
    date_to?: string;
    provinsi_id?: string;
    kabupaten_id?: string;
    owner_id?: string;
    period?: string;
    year?: string;
    month?: string;
  }) => api.get<{ success: boolean; data: FinancialReportModalInvoicesPayload }>('/accounting/financial-report/wilayah-invoices', { params }),
  getFinancialReportProvinsiInvoices: (params: {
    provinsi_id: string;
    date_from?: string;
    date_to?: string;
    kabupaten_id?: string;
    owner_id?: string;
    period?: string;
    year?: string;
    month?: string;
  }) => api.get<{ success: boolean; data: FinancialReportModalInvoicesPayload }>('/accounting/financial-report/provinsi-invoices', { params }),
  getFinancialReportKotaInvoices: (params: {
    branch_id: string;
    date_from?: string;
    date_to?: string;
    owner_id?: string;
    period?: string;
    year?: string;
    month?: string;
  }) => api.get<{ success: boolean; data: FinancialReportModalInvoicesPayload }>('/accounting/financial-report/kota-invoices', { params }),
  getFinancialReportOwnerInvoices: (params: {
    owner_id: string;
    date_from?: string;
    date_to?: string;
    wilayah_id?: string;
    provinsi_id?: string;
    branch_id?: string;
    kabupaten_id?: string;
    period?: string;
    year?: string;
    month?: string;
  }) => api.get<{ success: boolean; data: FinancialReportModalInvoicesPayload }>('/accounting/financial-report/owner-invoices', { params }),
  getFinancialReportPeriodInvoices: (params: {
    year_month: string;
    date_from?: string;
    date_to?: string;
    owner_id?: string;
    wilayah_id?: string;
    provinsi_id?: string;
    branch_id?: string;
  }) => api.get<{ success: boolean; data: FinancialReportModalInvoicesPayload & { year_month?: string } }>('/accounting/financial-report/period-invoices', { params }),
  exportFinancialExcel: (params?: { period?: string; year?: string; month?: string; date_from?: string; date_to?: string; branch_id?: string; provinsi_id?: string; wilayah_id?: string; owner_id?: string; status?: string; order_status?: string; product_type?: string; search?: string; min_amount?: number; max_amount?: number }) =>
    api.get('/accounting/export-financial-excel', { params, responseType: 'blob' }),
  exportFinancialPdf: (params?: { period?: string; year?: string; month?: string; date_from?: string; date_to?: string; branch_id?: string; provinsi_id?: string; wilayah_id?: string; owner_id?: string; status?: string; order_status?: string; product_type?: string; search?: string; min_amount?: number; max_amount?: number }) =>
    api.get('/accounting/export-financial-pdf', { params, responseType: 'blob' }),
  reconcilePayment: (id: string) =>
    api.post<{ success: boolean; data: any }>(`/accounting/payments/${id}/reconcile`)
};

export interface AccountingFinancialReportData {
  period: { start: string; end: string };
  total_revenue: number;
  by_branch: Array<{ branch_id: string; branch_name: string; revenue: number; invoice_count?: number }>;
  by_wilayah?: Array<{ wilayah_id: string; wilayah_name: string; revenue: number; invoice_count?: number }>;
  by_provinsi?: Array<{ provinsi_id: string; provinsi_name: string; revenue: number; invoice_count?: number }>;
  by_owner: Array<{ owner_id: string; owner_name: string; revenue: number; invoice_count?: number }>;
  by_product_type: Array<{ type: string; revenue: number }>;
  /** Rincian invoice per jenis produk (alokasi pendapatan pro-rata dari subtotal item) */
  invoices_by_product_type?: Record<
    string,
    Array<{
      invoice_id: string;
      invoice_number: string;
      order_id?: string | null;
      owner_name?: string | null;
      branch_name?: string | null;
      invoice_paid_amount: number;
      issued_at?: string | null;
      allocated_revenue: number;
      lines: Array<{
        order_item_id?: string | null;
        type: string;
        subtotal: number | null;
        allocated_revenue: number;
        quantity?: number;
        label?: string;
      }>;
    }>
  >;
  by_period?: Array<{ period: string; revenue: number; invoice_count?: number }>;
  invoice_count: number;
  invoices: Array<{
    id: string;
    invoice_number: string;
    order_number?: string;
    owner_name?: string;
    company_name?: string;
    branch_name?: string;
    wilayah_name?: string;
    provinsi_name?: string;
    city?: string;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    status: string;
    order_status?: string;
    issued_at?: string;
    created_at?: string;
    order_updated_at?: string;
  }>;
  pagination?: { total: number; page: number; limit: number; totalPages: number };
  previous_period?: {
    start: string;
    end: string;
    revenue: number;
    invoice_count: number;
    growth_percent: string | null;
  };
}
export interface AccountingDashboardData {
  branches: { id: string; code: string; name: string; Provinsi?: { id: string; name: string; Wilayah?: { id: string; name: string } } }[];
  summary: {
    total_invoices: number;
    total_receivable: number;
    total_paid: number;
    by_status: Record<string, number>;
    by_branch: Array<{ branch_id: string; branch_name: string; code: string; count: number; receivable: number; paid: number }>;
    by_provinsi?: Array<{ provinsi_id: string; provinsi_name: string; count: number; receivable: number; paid: number }>;
    by_wilayah?: Array<{ wilayah_id: string; wilayah_name: string; count: number; receivable: number; paid: number }>;
  };
  invoices_recent: any[];
}
export interface AccountingKpiData {
  total_revenue: number;
  total_receivable: number;
  by_wilayah: Array<{ wilayah_id: string; name: string; revenue: number; receivable: number }>;
  by_product: Record<string, number>;
  branches: { id: string; code: string; name: string }[];
}
export interface BankItem {
  id: string;
  code: string;
  name: string;
  is_active?: boolean;
  sort_order?: number;
}
export interface BankAccountItem {
  id: string;
  code: string;
  name: string;
  bank_name: string;
  account_number: string;
  currency: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
export interface ChartOfAccountItem {
  id: string;
  parent_id?: string | null;
  code: string;
  name: string;
  account_type: string;
  level: number;
  is_header: boolean;
  currency: string;
  is_active: boolean;
  sort_order?: number;
  Parent?: { id: string; code: string; name: string };
  Children?: ChartOfAccountItem[];
}
export interface FiscalYearItem {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  closed_at?: string | null;
  closed_by?: string | null;
  Periods?: AccountingPeriodItem[];
}
export interface AccountingPeriodItem {
  id: string;
  fiscal_year_id: string;
  period_number: number;
  start_date: string;
  end_date: string;
  is_locked: boolean;
  locked_at?: string | null;
  locked_by?: string | null;
  FiscalYear?: { id: string; code: string; name: string; is_closed?: boolean };
}
export interface AccountMappingItem {
  id: string;
  mapping_type: string;
  DebitAccount?: { id: string; code: string; name: string };
  CreditAccount?: { id: string; code: string; name: string };
}
export interface AccountingAgingData {
  buckets: { current: any[]; days_1_30: any[]; days_31_60: any[]; days_61_plus: any[] };
  bucket_counts?: { current: number; days_1_30: number; days_31_60: number; days_61_plus: number };
  items?: any[];
  pagination?: { total: number; page: number; limit: number; totalPages: number };
  totals: { current: number; days_1_30: number; days_31_60: number; days_61_plus: number };
  total_outstanding: number;
}

export type ReportType = 'revenue' | 'orders' | 'partners' | 'jamaah' | 'financial' | 'logs';
export type ReportGroupBy = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type ReportPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

export interface ReportsFiltersData {
  branches: { id: string; code: string; name: string; provinsi_id?: string | null }[];
  wilayah: { id: string; name: string }[];
  provinsi: { id: string; name: string; kode?: string; wilayah_id?: string; Wilayah?: { id: string; name: string } }[];
}

export interface ReportsAnalyticsData {
  report_type: string;
  period?: { start: string; end: string } | null;
  summary: Record<string, number>;
  series: Array<{ period: string; count?: number; revenue?: number; jamaah?: number }>;
  breakdown: {
    by_status?: Record<string, number>;
    by_branch?: Array<{ branch_id: string; branch_name?: string; code?: string; count?: number; revenue?: number; invoice_count?: number; jamaah?: number }>;
    by_wilayah?: Array<{ wilayah_id: string; wilayah_name?: string; count?: number; revenue?: number; invoice_count?: number }>;
    by_provinsi?: Array<{ provinsi_id: string; provinsi_name?: string; count?: number; revenue?: number; invoice_count?: number }>;
    by_owner?: Array<{ owner_id: string; owner_name?: string; count?: number; revenue?: number; invoice_count?: number }>;
    by_role?: Record<string, number>;
    by_source?: Record<string, number>;
    by_level?: Record<string, number>;
  };
  rows: any[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const reportsApi = {
  getFilters: () =>
    api.get<{ success: boolean; data: ReportsFiltersData }>('/reports/filters'),
  getAnalytics: (params?: {
    report_type?: ReportType;
    date_from?: string;
    date_to?: string;
    period?: ReportPeriod;
    branch_id?: string;
    wilayah_id?: string;
    provinsi_id?: string;
    group_by?: ReportGroupBy;
    role?: string;
    page?: number;
    limit?: number;
    source?: string;
    level?: string;
  }) =>
    api.get<{ success: boolean; data: ReportsAnalyticsData }>('/reports/analytics', { params }),
  exportExcel: (params?: {
    report_type?: ReportType;
    date_from?: string;
    date_to?: string;
    period?: ReportPeriod;
    branch_id?: string;
    wilayah_id?: string;
    provinsi_id?: string;
    role?: string;
    source?: string;
    level?: string;
  }) =>
    api.get('/reports/export-excel', { params, responseType: 'blob' }),
  exportPdf: (params?: {
    report_type?: ReportType;
    date_from?: string;
    date_to?: string;
    period?: ReportPeriod;
    branch_id?: string;
    wilayah_id?: string;
    provinsi_id?: string;
    role?: string;
    source?: string;
    level?: string;
  }) =>
    api.get('/reports/export-pdf', { params, responseType: 'blob' })
};

export const koordinatorApi = {
  getDashboard: () => api.get<{ success: boolean; data: KoordinatorDashboardData }>('/koordinator/dashboard')
};

export interface OwnerStats {
  total_owners: number;
  active: number;
  siap_aktivasi: number;
  pending_verifikasi: number;
  pending_mou: number;
  pending_bayar: number;
  rejected: number;
  by_status: Record<string, number>;
}

export const ownersApi = {
  /** Registrasi + upload bukti bayar MoU + jumlah. Body: FormData dengan field form + registration_payment_file + registration_payment_amount */
  register: (formData: FormData) =>
    api.post<{ success: boolean; message?: string; data?: { user: any; owner_status: string } }>('/owners/register', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getMe: () => api.get<{ success: boolean; data: OwnerProfile }>('/owners/me'),
  uploadRegistrationPayment: (formData: FormData) =>
    api.post<{ success: boolean; message?: string; data?: { owner_status: string } }>('/owners/upload-registration-payment', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list: (params?: { status?: string; branch_id?: string; wilayah_id?: string; q?: string; page?: number; limit?: number }) =>
    api.get<{ success: boolean; data: OwnerProfile[]; total?: number; page?: number; limit?: number }>('/owners', { params }),
  getStats: (params?: { status?: string; branch_id?: string; wilayah_id?: string }) =>
    api.get<{ success: boolean; data: OwnerStats }>('/owners/stats', { params }),
  getById: (id: string) => api.get<{ success: boolean; data: OwnerProfile }>(`/owners/${id}`),
  verifyMou: (id: string, body: { approved: boolean; rejection_reason?: string }) => api.patch<{ success: boolean; message?: string; data?: { owner_status: string } }>(`/owners/${id}/verify-mou`, body),
  verifyRegistrationPayment: (id: string, body: { approved: boolean; rejection_reason?: string }) =>
    api.patch<{ success: boolean; message?: string; data?: { owner_status: string } }>(`/owners/${id}/verify-registration-payment`, body),
  assignBranch: (ownerId: string, branchId: string) => api.patch(`/owners/${ownerId}/assign-branch`, { branch_id: branchId }),
  verifyDeposit: (ownerId: string) => api.patch(`/owners/${ownerId}/verify-deposit`),
  activate: (ownerId: string, body?: { is_mou_owner?: boolean }) => api.patch<{ success: boolean; message?: string; data?: { owner_status: string; user_id?: string; generated_password?: string; mou_generated_url?: string } }>(`/owners/${ownerId}/activate`, body || {}),
  updateProfile: (profileId: string, body: { is_mou_owner?: boolean }) => api.patch<{ success: boolean; data: OwnerProfile }>(`/owners/${profileId}`, body),
  getMyBalance: () => api.get<{ success: boolean; data: { balance: number; transactions: Array<{ id: string; amount: number; type: string; reference_type?: string; reference_id?: string; notes?: string; created_at: string }> } }>('/owners/me/balance'),
  /** Saldo owner (user_id) untuk invoice koordinator / invoice saudi / admin — dipakai alokasi ke invoice */
  getBalanceForUser: (userId: string) =>
    api.get<{ success: boolean; data: { balance: number; user_id: string } }>(`/owners/user/${userId}/balance`),
  /** Stream file bukti bayar pendaftaran (untuk preview; hindari 404 direct /uploads/). */
  getRegistrationPaymentFile: (ownerId: string) => api.get(`/owners/${ownerId}/registration-payment-file`, { responseType: 'blob' }),
  /** Stream file MOU (generated or signed) agar tidak 404. */
  getMouFile: (ownerId: string, type?: 'generated' | 'signed') => api.get(`/owners/${ownerId}/mou-file${type ? `?type=${type}` : ''}`, { responseType: 'blob' })
};

/** Item draft order dari AI chat (untuk "Isi ke Form Order"). */
export interface AiChatOrderDraftItem {
  type: 'hotel' | 'visa' | 'ticket' | 'bus' | 'siskopatuh' | 'handling' | 'package';
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_idr: number;
  meta?: {
    check_in?: string;
    check_out?: string;
    room_type?: string;
    with_meal?: boolean;
    room_unit_price?: number;
    meal_unit_price?: number;
    travel_date?: string;
    bandara?: string;
    trip_type?: string;
    departure_date?: string;
    return_date?: string;
    route_type?: string;
    bus_type?: string;
    [k: string]: unknown;
  };
}

export const aiChatApi = {
  /** Konteks untuk owner: produk, kurs (untuk tampilan/loading). Hanya untuk role owner. */
  getContext: () =>
    api.get<{ success: boolean; data: { rates: { SAR_TO_IDR: number; USD_TO_IDR: number }; branch_id: string | null; product_count: number; product_preview: Array<{ id: string; name: string; type: string; code: string; price_idr: number | null; price_sar: string | null; price_usd: string | null }> } }>('/ai-chat/context'),
  /** Kirim pesan ke AI; history opsional untuk konteks percakapan. Mengembalikan reply + order_draft jika AI mengeluarkan ORDER_DRAFT. */
  chat: (body: { message: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> }) =>
    api.post<{ success: boolean; reply: string; order_draft?: { items: AiChatOrderDraftItem[] } }>('/ai-chat', body)
};

export interface KoordinatorDashboardData {
  orders: { total: number; by_status: Record<string, number> };
  orders_recent: any[];
  owners: { total: number; list: any[] };
  recap_invoice: { total: number; by_status: Record<string, number> };
  recap_hotel: { total: number; by_status: Record<string, number> };
  recap_visa: { total: number; by_status: Record<string, number> };
  recap_ticket: { total: number; by_status: Record<string, number> };
  recap_bus: { total: number; by_status?: Record<string, number> };
}
export interface OwnerProfile {
  id: string;
  user_id: string;
  status: string;
  registration_payment_proof_url?: string;
  mou_generated_url?: string;
  mou_rejected_reason?: string;
  is_mou_owner?: boolean;
  assigned_branch_id?: string;
  activated_at?: string;
  activated_by?: string;
  User?: { id: string; name: string; email: string; company_name?: string };
  AssignedBranch?: { id: string; code: string; name: string };
}

export default api;
