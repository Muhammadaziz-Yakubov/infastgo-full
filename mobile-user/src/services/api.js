import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://infastgo-backendd.onrender.com/api';

const TOKEN_KEY = 'infast_user_token';

let userToken = null;

// Save token to device storage + memory
export const setToken = async (token) => {
  userToken = token;
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
      userToken = token;
    }
    return token;
  } catch (e) {
    console.error('Token yuklashda xatolik:', e);
    return null;
  }
};

// Clear token on logout
export const clearToken = async () => {
  userToken = null;
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.error('Token o\'chirishda xatolik:', e);
  }
};

export const getToken = () => userToken;

const request = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
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
    console.error(`API Error on ${endpoint}:`, error.message);
    throw error;
  }
};

export const api = {
  requestOTP: (phone) => request('/auth/otp', {
    method: 'POST',
    body: JSON.stringify({ phone, isDriverLogin: false }),
  }),
  
  verifyOTP: (phone, code) => request('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code, isDriverLogin: false }),
  }),

  getProfile: () => request('/auth/profile'),

  updateProfile: (name, surname) => request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({ name, surname }),
  }),

  estimateFare: (distance) => request('/rides/estimate', {
    method: 'POST',
    body: JSON.stringify({ distance }),
  }),

  requestRide: (pickup, destination, distance, price, tariff, options, paymentMethod) => request('/rides/request', {
    method: 'POST',
    body: JSON.stringify({ pickup, destination, distance, price, tariff, options, paymentMethod }),
  }),

  rateDriver: (rideId, rating) => request(`/rides/${rideId}/rate`, {
    method: 'POST',
    body: JSON.stringify({ rating }),
  }),

  cancelRide: (rideId) => request(`/rides/${rideId}/cancel`, {
    method: 'POST',
  }),

  getHistory: () => request('/rides/history'),

  getActiveRide: () => request('/rides/active'),

  getEatsRestaurants: (lat, lng, category, search) => {
    let query = `?lat=${lat || ''}&lng=${lng || ''}`;
    if (category) query += `&category=${encodeURIComponent(category)}`;
    if (search) query += `&search=${encodeURIComponent(search)}`;
    return request(`/eats/restaurants${query}`);
  },

  getEatsRestaurantDetail: (id) => request(`/eats/restaurants/${id}`),

  createEatsOrder: (orderData) => request('/eats/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  }),

  trackEatsOrder: (id) => request(`/eats/orders/${id}/track`),

  getEatsHistory: () => request('/eats/orders/history'),

  rateEatsOrder: (orderId, rating, comment) => request(`/eats/orders/${orderId}/rate`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment }),
  }),


  searchPlaces: (query) => request(`/places?q=${encodeURIComponent(query)}&limit=20`),

  getPlaces: (limit = 20) => request(`/places?limit=${limit}`),

  reverseGeocode: (lat, lng) => request(`/places/reverse?lat=${lat}&lng=${lng}`),

  transcribeVoice: async (uri) => {
    const formData = new FormData();

    if (Platform.OS === 'web') {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, 'recording.m4a');
      } catch (err) {
        console.error('Web blob fetch error:', err);
        throw new Error('Ovozli faylni tayyorlashda xatolik yuz berdi');
      }
    } else {
      formData.append('file', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        type: 'audio/m4a',
        name: 'recording.m4a',
      });
    }

    const response = await fetch(`${API_URL}/voice-order/transcribe`, {
      method: 'POST',
      headers: {
        ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Nutqni matnga aylantirishda xatolik');
    }
    return data;
  },

  triggerSeed: () => request('/seed', { method: 'POST', headers: {} }).catch(() => null),
  
  isOnboardingCompleted: async () => {
    try {
      const val = await AsyncStorage.getItem('infast_onboarding_completed');
      return val === 'true';
    } catch (e) {
      return false;
    }
  },

  setOnboardingCompleted: async () => {
    try {
      await AsyncStorage.setItem('infast_onboarding_completed', 'true');
    } catch (e) {
      console.error('Onboarding holatini saqlashda xatolik:', e);
    }
  },

  validatePromoCode: (code, service = 'taxi') => request('/promo/validate', {
    method: 'POST',
    body: JSON.stringify({ code, service }),
  }),

  apiUrl: API_URL,
  getToken,
  setToken,
  loadToken,
  clearToken,
};
