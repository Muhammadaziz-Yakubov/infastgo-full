import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://infastgo-backendd.onrender.com/api';
const TOKEN_KEY = 'eats_courier_token';

let courierToken = null;

export const setToken = async (token) => {
  courierToken = token;
  await AsyncStorage.setItem(TOKEN_KEY, token);
};

export const loadToken = async () => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) courierToken = token;
  return token;
};

export const clearToken = async () => {
  courierToken = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem('eats_courier_info');
};

const request = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(courierToken ? { Authorization: `Bearer ${courierToken}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Xatolik yuz berdi');
  return data;
};

export const api = {
  login: (phone) => request('/eats/courier/login', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  }),
  toggleOnline: (online) => request('/eats/courier/status', {
    method: 'PUT',
    body: JSON.stringify({ online }),
  }),
  updateLocation: (lat, lng) => request('/eats/courier/location', {
    method: 'PUT',
    body: JSON.stringify({ lat, lng }),
  }),
  acceptOrder: (orderId) => request(`/eats/courier/deliveries/${orderId}/accept`, {
    method: 'POST',
  }),
  updateOrderStatus: (orderId, status) => request(`/eats/orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }),
  completeDelivery: (orderId) => request(`/eats/courier/deliveries/${orderId}/complete`, {
    method: 'PUT',
  }),
  getProfile: () => request('/eats/courier/profile'),
  getHistory: () => request('/eats/courier/history'),

  // Wallet
  getWallet: () => request('/eats/wallet/me'),
  getTransactions: (page = 1) => request(`/eats/wallet/transactions?page=${page}`),
  settleCash: (amount, paymentMethod, orderIds) => request('/eats/wallet/courier/settle', {
    method: 'POST',
    body: JSON.stringify({ amount, paymentMethod, orderIds }),
  }),
  requestWithdrawal: (amount, cardNumber, paymentMethod) => request('/eats/wallet/withdraw', {
    method: 'POST',
    body: JSON.stringify({ amount, cardNumber, paymentMethod }),
  }),
  getWithdrawals: () => request('/eats/wallet/withdrawals'),

  setToken,
  loadToken,
  clearToken,
};
