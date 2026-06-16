import { io } from 'socket.io-client';
import { Platform } from 'react-native';

const SOCKET_URL = 'https://infastgo-backendd.onrender.com';

let socket = null;

export const connectSocket = (userId, onStatusUpdate, onLocationUpdate) => {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to backend');
    socket.emit('join', { userId, role: 'user' });
  });

  socket.on('rideStatusUpdate', (data) => {
    console.log('[Socket] Ride Status Update:', data);
    if (onStatusUpdate) {
      onStatusUpdate(data);
    }
  });

  socket.on('driverLocationUpdate', (data) => {
    console.log('[Socket] Driver Location Update:', data);
    if (onLocationUpdate) {
      onLocationUpdate(data);
    }
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;
