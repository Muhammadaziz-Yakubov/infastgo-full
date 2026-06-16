import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://infastgo-backendd.onrender.com/api';

const TOKEN_KEY = 'infast_driver_token';

let driverToken = null;

// Save token to device storage + memory
export const setToken = async (token) => {
  driverToken = token;
  try {
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) {
    console.error('Token saqlashda xatolik:', e);
  }
};

// Load token from device storage (call once on app start)
export const loadToken = async () => {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) {
      driverToken = token;
    }
    return token;
  } catch (e) {
    console.error('Token yuklashda xatolik:', e);
    return null;
  }
};

// Clear token on logout
export const clearToken = async () => {
  driverToken = null;
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.error('Token o\'chirishda xatolik:', e);
  }
};

export const getToken = () => driverToken;

const request = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(driverToken ? { Authorization: `Bearer ${driverToken}` } : {}),
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Xatolik yuz berdi');
    }
    return data;
  } catch (error) {
    console.error(`Driver API Error on ${endpoint}:`, error.message);
    throw error;
  }
};

export const api = {
  requestOTP: (phone) => request('/auth/otp', {
    method: 'POST',
    body: JSON.stringify({ phone, isDriverLogin: true }),
  }),
  
  verifyOTP: (phone, code) => request('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code, isDriverLogin: true }),
  }),

  getProfile: () => request('/auth/profile'),

  updateProfile: (data) => request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  payCommission: (amount) => request('/auth/pay-commission', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  }),

  createPayment: (amount) => request('/driver/payments/create', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  }),

  acceptRide: (rideId) => request(`/rides/${rideId}/accept`, {
    method: 'POST',
  }),

  rejectRide: (rideId) => request(`/rides/${rideId}/reject`, {
    method: 'POST',
  }),

  updateRideStatus: (rideId, status) => request(`/rides/${rideId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  }),

  getHistory: () => request('/rides/history'),

  getActiveRide: () => request('/rides/active'),

  triggerSeed: () => request('/seed', { method: 'POST', headers: {} }).catch(() => null),

  apiUrl: API_URL,
  getToken,
  setToken,
  loadToken,
  clearToken,
};
