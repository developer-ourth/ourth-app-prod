import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

// Base URL — set EXPO_PUBLIC_API_URL in your .env file.
// For Android emulator use http://10.0.2.2:8000/api/v1 (php artisan serve on port 8000)
// For a physical device or production use your server's HTTPS URL.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api/v1';

/**
 * Rewrites any asset URL that points to "localhost" or "127.0.0.1" so it works on the
 * Android emulator (which must use 10.0.2.2 to reach the host machine).
 */
export function fixAssetUrl(url: string | null | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  let resolvedUrl = url;
  if (url.includes('laravel.cloud')) {
    const localHostBase = API_BASE_URL.replace('/api/v1', '');
    resolvedUrl = url.replace(/^https:\/\/.*\.laravel\.cloud/g, localHostBase);
  }
  return resolvedUrl.replace(/http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/g, (_, host, port) => `http://10.0.2.2${port ?? ':8000'}`);
}

export const TOKEN_KEY      = 'ourth_auth_token';
export const VENDOR_ID_KEY  = 'ourth_vendor_id';
export const VENDOR_CODE_KEY = 'ourth_vendor_code';
export const VENDOR_GSTIN_KEY = 'ourth_vendor_gstin';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Attach stored token to every request
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalise error messages
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<{ message?: string; errors?: Record<string, string[]> }>) => {
    // Auto-logout on 401 — the root layout will redirect to /(auth) when token clears
    if (error.response?.status === 401) {
      const { useAuthStore } = await import('@/lib/store');
      await useAuthStore.getState().logout();
    }

    const serverMessage = error.response?.data?.message;
    const validationErrors = error.response?.data?.errors;

    if (validationErrors) {
      const first = Object.values(validationErrors)[0]?.[0];
      return Promise.reject(new Error(first ?? serverMessage ?? 'Validation error'));
    }

    return Promise.reject(new Error(serverMessage ?? error.message ?? 'Network error'));
  },
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authAPI = {
  forgotPassword: (email: string) =>
    api.post<{ success: boolean; message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, email: string, password: string) =>
    api.post<{ success: boolean; message: string }>('/auth/reset-password', {
      token,
      email,
      password,
      password_confirmation: password,
    }),
};

// ─── Marketplace ─────────────────────────────────────────────────────────────

export const marketplaceAPI = {
  getCategories: () => api.get('/categories'),
  getProducts: (params?: { category_id?: number; search?: string; featured?: boolean; page?: number; per_page?: number }) =>
    api.get('/products', { params }),
  getProduct: (id: number) => api.get(`/products/${id}`),
};

// ─── Addresses ───────────────────────────────────────────────────────────────

export type AddressPayload = {
  name: string;
  address_line1: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  mobile?: string;
  is_default?: boolean;
};

export const addressAPI = {
  list:    ()                                          => api.get('/me/addresses'),
  create:  (payload: AddressPayload)                   => api.post('/me/addresses', payload),
  update:  (id: number, payload: Partial<AddressPayload>) => api.patch(`/me/addresses/${id}`, payload),
  remove:  (id: number)                               => api.delete(`/me/addresses/${id}`),
};

// ─── Payment Methods ─────────────────────────────────────────────────────────

export type PaymentMethodPayload = {
  type: 'upi' | 'card' | 'netbanking' | 'wallet' | 'cod';
  provider?: string;
  identifier?: string;
  is_default?: boolean;
};

export const paymentMethodAPI = {
  list:   ()                                                  => api.get('/me/payment-methods'),
  create: (payload: PaymentMethodPayload)                     => api.post('/me/payment-methods', payload),
  update: (id: number, payload: Partial<PaymentMethodPayload>) => api.patch(`/me/payment-methods/${id}`, payload),
  remove: (id: number)                                        => api.delete(`/me/payment-methods/${id}`),
};

// ─── Tax / GST Profile ───────────────────────────────────────────────────────

export type TaxProfilePayload = {
  is_gst_registered: boolean;
  gstin?: string;
  legal_business_name?: string;
};

export const taxProfileAPI = {
  get:    ()                          => api.get('/me/tax-profile'),
  upsert: (payload: TaxProfilePayload) => api.put('/me/tax-profile', payload),
};

// ─── Cart ─────────────────────────────────────────────────────────────────────

export const cartAPI = {
  getCart:    ()                                     => api.get('/me/cart'),
  addItem:    (productId: number, quantity = 1, productPackId?: number | null)      => api.post('/me/cart/items', { product_id: productId, quantity, product_pack_id: productPackId }),
  updateItem: (itemId: number, quantity: number)     => api.patch(`/me/cart/items/${itemId}`, { quantity }),
  removeItem: (itemId: number)                       => api.delete(`/me/cart/items/${itemId}`),
  clearCart:  ()                                     => api.delete('/me/cart'),
};

// ─── Orders ──────────────────────────────────────────────────────────────────

export type OrderPayload = {
  delivery_address_line1: string;
  delivery_address_line2?: string | null;
  delivery_city: string;
  delivery_state: string;
  delivery_postal_code: string;
  delivery_phone: string;
  payment_method: 'cod' | 'online' | 'wallet' | 'upi' | 'card' | 'netbanking';
  notes?: string;
};

export type RazorpayInitiateResponse = {
  key: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  order_id: number;
};

export type RazorpayVerifyPayload = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export const orderAPI = {
  placeOrder: (payload: OrderPayload) => api.post('/me/orders', payload),
  listOrders: (params?: { per_page?: number; page?: number }) => api.get('/me/orders', { params }),
  initiateRazorpayPayment: (orderId: number) =>
    api.post<{ success: boolean; data: RazorpayInitiateResponse }>(`/me/orders/${orderId}/payments/razorpay/initiate`),
  verifyRazorpayPayment: (orderId: number, payload: RazorpayVerifyPayload) =>
    api.post(`/me/orders/${orderId}/payments/razorpay/verify`, payload),
};

// ─── Device Push Tokens ───────────────────────────────────────────────────────

export const deviceTokenAPI = {
  register: (token: string, platform: 'android' | 'ios' | 'web') =>
    api.post('/me/device-token', { token, platform }),
  unregister: (token: string) =>
    api.delete('/me/device-token', { data: { token } }),
};

export default api;
