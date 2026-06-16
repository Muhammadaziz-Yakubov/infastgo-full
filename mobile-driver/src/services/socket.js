import { io } from 'socket.io-client';
import { Platform } from 'react-native';

const SOCKET_URL = 'https://infastgo-backendd.onrender.com';

let socket = null;

export const connectSocket = (driverId, onRideRequest) => {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('[Driver Socket] Connected to backend');
    socket.emit('join', { userId: driverId, role: 'driver' });
  });

  socket.on('rideRequest', (data) => {
    console.log('[Driver Socket] Incoming Ride Request:', data);
    if (onRideRequest) {
      onRideRequest(data);
    }
  });

  socket.on('disconnect', () => {
    console.log('[Driver Socket] Disconnected');
  });

  return socket;
};

export const emitLocation = (driverId, lat, lng) => {
  if (socket && socket.connected) {
    socket.emit('updateLocation', { driverId, lat, lng });
    return true;
  }
  return false;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;
