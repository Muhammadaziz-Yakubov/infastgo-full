const socketIo = require('socket.io');
const Driver = require('../models/Driver');
const Ride = require('../models/Ride');

// Maps to track active connections
const userSockets = new Map();   // userId -> socket.id
const driverSockets = new Map(); // driverId -> socket.id
const adminSockets = new Set();  // Set of socket.ids

let io = null;

const init = (server) => {
  io = socketIo(server, {
    cors: {
      origin: '*', // Allow connections from mobile & admin web panel
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join channel
    socket.on('join', (data) => {
      const { userId, role, room } = data || {};
      console.log(`User joined: userId=${userId}, role=${role}, room=${room} (Socket: ${socket.id})`);
      if (userId) socket.userId = userId;
      if (role) socket.role = role;

      if (room) {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);
      }

      if (role === 'driver') {
        driverSockets.set(userId, socket.id);
      } else if (role === 'user') {
        userSockets.set(userId, socket.id);
      } else if (role === 'admin') {
        adminSockets.add(socket.id);
      } else if (role === 'EATS_COURIER') {
        if (userId) {
          socket.join(`courier_${userId}`);
          console.log(`Socket ${socket.id} joined room: courier_${userId}`);
        }
      }

      // Broadcast active stats to admins
      broadcastActiveStats();
    });

    // Handle driver location updates
    socket.on('updateLocation', async ({ driverId, lat, lng }) => {
      try {
        // Update database
        await Driver.findByIdAndUpdate(driverId, {
          currentLocation: {
            lat,
            lng,
            updatedAt: new Date(),
          },
        });

        // Broadcast to admin panel for live tracking
        broadcastToAdmins('driverLocationUpdate', { driverId, lat, lng });

        // If driver is currently on a ride, notify the specific user
        const activeRide = await Ride.findOne({
          driverId,
          status: { $in: ['accepted', 'arriving', 'started'] },
        });

        if (activeRide) {
          const userId = activeRide.userId.toString();
          sendToUser(userId, 'driverLocationUpdate', {
            driverId,
            lat,
            lng,
            rideId: activeRide._id,
          });
        }
      } catch (error) {
        console.error('Error updating driver location via socket:', error);
      }
    });

    // Handle manual disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      if (socket.role === 'driver' && socket.userId) {
        driverSockets.delete(socket.userId);
      } else if (socket.role === 'user' && socket.userId) {
        userSockets.delete(socket.userId);
      } else if (socket.role === 'admin') {
        adminSockets.delete(socket.id);
      }

      broadcastActiveStats();
    });
  });

  return io;
};

const sendToUser = (userId, event, data) => {
  const socketId = userSockets.get(userId);
  if (socketId && io) {
    io.to(socketId).emit(event, data);
    return true;
  }
  return false;
};

const sendToDriver = (driverId, event, data) => {
  const socketId = driverSockets.get(driverId);
  if (socketId && io) {
    io.to(socketId).emit(event, data);
    return true;
  }
  return false;
};

const broadcastToAdmins = (event, data) => {
  if (io) {
    for (const socketId of adminSockets) {
      io.to(socketId).emit(event, data);
    }
  }
};

const broadcastActiveStats = () => {
  broadcastToAdmins('activeStatsUpdate', {
    onlineUsers: userSockets.size,
    onlineDrivers: driverSockets.size,
  });
};

const sendSocketNotification = ({ recipientType, recipientId, title, body }) => {
  if (!io) return false;

  const payload = { title, body, sentAt: new Date() };

  if (recipientType === 'all') {
    io.emit('notification', payload);
    return true;
  }

  if (recipientType === 'users') {
    for (const socketId of userSockets.values()) {
      io.to(socketId).emit('notification', payload);
    }
    return true;
  }

  if (recipientType === 'drivers') {
    for (const socketId of driverSockets.values()) {
      io.to(socketId).emit('notification', payload);
    }
    return true;
  }

  if (recipientType === 'single_user' && recipientId) {
    const socketId = userSockets.get(recipientId);
    if (socketId) {
      io.to(socketId).emit('notification', payload);
      return true;
    }
  }

  if (recipientType === 'single_driver' && recipientId) {
    const socketId = driverSockets.get(recipientId);
    if (socketId) {
      io.to(socketId).emit('notification', payload);
      return true;
    }
  }

  return false;
};

const getIO = () => io;

module.exports = {
  init,
  getIO,
  sendToUser,
  sendToDriver,
  broadcastToAdmins,
  sendSocketNotification,
};
