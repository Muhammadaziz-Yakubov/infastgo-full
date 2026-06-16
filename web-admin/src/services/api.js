const BASE_URL = 'https://infastgo-backendd.onrender.com/api';

let adminToken = localStorage.getItem('infast_admin_token') || null;

export const setToken = (token) => {
  adminToken = token;
  if (token) {
    localStorage.setItem('infast_admin_token', token);
  } else {
    localStorage.removeItem('infast_admin_token');
  }
};

export const getToken = () => adminToken;

const request = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Xatolik yuz berdi');
    }
    return data;
  } catch (error) {
    console.error(`Admin API Error on ${endpoint}:`, error.message);
    throw error;
  }
};

export const api = {
  adminLogin: (login, password) => request('/auth/admin-login', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  }),

  requestOTP: (phone) => request('/auth/otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  }),

  verifyOTP: (phone, code) => request('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  }),

  getProfile: () => request('/auth/profile'),

  getStats: () => request('/admin/stats'),

  getUsers: () => request('/admin/users'),

  blockUser: (userId) => request(`/admin/users/${userId}/block`, {
    method: 'POST',
  }),

  getDrivers: () => request('/admin/drivers'),

  createDriver: (driverData) => request('/admin/drivers', {
    method: 'POST',
    body: JSON.stringify(driverData),
  }),

  toggleDriverActive: (driverId) => request(`/admin/drivers/${driverId}/active`, {
    method: 'POST',
  }),

  deleteDriver: (driverId) => request(`/admin/drivers/${driverId}`, {
    method: 'DELETE',
  }),

  getLive: () => request('/admin/live'),

  getRides: () => request('/admin/rides'),

  getPricing: () => request('/admin/pricing'),

  updatePricing: (pricingData) => request('/admin/pricing', {
    method: 'PUT',
    body: JSON.stringify(pricingData),
  }),

  sendPush: (pushData) => request('/admin/push', {
    method: 'POST',
    body: JSON.stringify(pushData),
  }),

  // Commission & Debt Management API Methods
  getSettings: () => request('/admin/settings'),
  updateSettings: (settingsData) => request('/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(settingsData),
  }),
  getDriversDebts: (params = {}) => {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.append('search', params.search);
    if (params.page) searchParams.append('page', params.page);
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.sortByDebt) searchParams.append('sortByDebt', params.sortByDebt);
    return request(`/admin/drivers/debts?${searchParams.toString()}`);
  },
  getCommissionsStats: () => request('/admin/statistics/commissions'),
  adjustDriverBalance: (driverId, amount, note) => request(`/admin/drivers/${driverId}/balance`, {
    method: 'PUT',
    body: JSON.stringify({ amount, note }),
  }),

  // InFast Eats Admin APIs
  getEatsRestaurants: () => request('/admin/eats/restaurants'),
  createEatsRestaurant: (data) => request('/admin/eats/restaurants', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateEatsRestaurant: (id, data) => request(`/admin/eats/restaurants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  toggleEatsRestaurant: (id) => request(`/admin/eats/restaurants/${id}/toggle`, {
    method: 'POST',
  }),

  getEatsCouriers: () => request('/admin/eats/couriers'),
  createEatsCourier: (data) => request('/admin/eats/couriers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateEatsCourier: (id, data) => request(`/admin/eats/couriers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  getEatsOrders: () => request('/admin/eats/orders'),
  getEatsAnalytics: () => request('/admin/eats/analytics'),

  // Eats Wallet Management
  getEatsWalletOverview: () => request('/eats/wallet/admin/overview'),
  getEatsWithdrawals: (status) => request(status ? `/eats/wallet/admin/withdrawals?status=${status}` : '/eats/wallet/admin/withdrawals'),
  updateEatsWithdrawal: (id, status, adminNote) => request(`/eats/wallet/admin/withdrawals/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status, adminNote }),
  }),
  
  // Seeding trigger for quick local dev setup
  triggerSeed: () => request('/seed', { method: 'POST', headers: {} }).catch(() => null),

  // Promo Codes
  getPromoCodes: () => request('/admin/promo'),
  createPromoCode: (data) => request('/admin/promo', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  togglePromoCode: (id) => request(`/admin/promo/${id}/toggle`, {
    method: 'PUT',
  }),
  deletePromoCode: (id) => request(`/admin/promo/${id}`, {
    method: 'DELETE',
  }),

  baseUrl: BASE_URL,
};
