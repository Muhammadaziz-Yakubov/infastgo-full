import { io } from 'socket.io-client';

const SOCKET_URL = 'https://infastgo-backendd.onrender.com';
let socket = null;

export const connectCourierSocket = (courierId, { onDeliveryRequest, onOrderUpdate } = {}) => {
  if (socket) socket.disconnect();

  socket = io(SOCKET_URL, { transports: ['websocket'] });

  socket.on('connect', () => {
    console.log('[CourierSocket] Connected');
    // Join courier-specific room so backend can target this courier
    socket.emit('join', { room: `courier_${courierId}`, role: 'EATS_COURIER' });
  });

  socket.on('new_delivery_request', (data) => {
    console.log('[CourierSocket] New delivery request:', data);
    if (onDeliveryRequest) onDeliveryRequest(data);
  });

  socket.on('order_status_changed', (data) => {
    if (onOrderUpdate) onOrderUpdate(data);
  });

  socket.on('disconnect', () => {
    console.log('[CourierSocket] Disconnected');
  });

  return socket;
};

export const disconnectCourierSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getCourierSocket = () => socket;
