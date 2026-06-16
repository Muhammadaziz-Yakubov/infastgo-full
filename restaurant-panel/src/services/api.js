const API_URL = 'https://infastgo-backendd.onrender.com/api';

let token = null;

const getToken = () => token || localStorage.getItem('restaurant_token');

const request = async (endpoint, options = {}) => {
  const t = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Xatolik yuz berdi');
  return data;
};

export const api = {
  setToken: (t) => {
    token = t;
    localStorage.setItem('restaurant_token', t);
  },
  clearToken: () => {
    token = null;
    localStorage.removeItem('restaurant_token');
    localStorage.removeItem('restaurant_info');
  },
  login: (login, password) => request('/eats/restaurant/login', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  }),
  getDashboardStats: () => request('/eats/restaurant/dashboard/stats'),
  getOrders: () => request('/eats/restaurant/orders'),
  updateOrderStatus: (id, status, rejectionReason) =>
    request(`/eats/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, rejectionReason }),
    }),
  getMenu: () => request('/eats/restaurant/menu'),
  addMenuItem: (data) => request('/eats/restaurant/menu', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateMenuItem: (id, data) => request(`/eats/restaurant/menu/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteMenuItem: (id) => request(`/eats/restaurant/menu/${id}`, {
    method: 'DELETE',
  }),

  // Wallet
  getWallet: () => request('/eats/wallet/me'),
  getWithdrawals: () => request('/eats/wallet/withdrawals'),
  requestWithdrawal: (amount, cardNumber, paymentMethod) => request('/eats/wallet/withdraw', {
    method: 'POST',
    body: JSON.stringify({ amount, cardNumber, paymentMethod }),
  }),
};
