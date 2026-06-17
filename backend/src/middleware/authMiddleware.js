const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'infast_secret_key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'infast_refresh_secret_key';

/**
 * Generate access token (short-lived).
 * @param {string} id - User/Driver/Courier ID
 * @param {string} role - 'user' | 'admin' | 'driver' | 'EATS_COURIER' | 'restaurant'
 * @returns {string} JWT access token
 */
const generateAccessToken = (id, role) => {
  return jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1d' });
};

/**
 * Generate refresh token (long-lived).
 * @param {string} id
 * @param {string} role
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (id, role) => {
  return jwt.sign({ id, role, type: 'refresh' }, REFRESH_SECRET, { expiresIn: '30d' });
};

/**
 * Verify and decode access token from Authorization header.
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Ruxsat berilmadi. Token topilmadi.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains id and role
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token muddati tugagan. Refresh token ishlatib yangilang.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({ success: false, message: 'Yaroqsiz token' });
  }
};

/**
 * Verify refresh token and issue new access token.
 */
const refreshTokenHandler = (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token kiritilmadi.' });
  }

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(400).json({ success: false, message: 'Noto\'g\'ri token turi.' });
    }

    const newAccessToken = generateAccessToken(decoded.id, decoded.role);
    const newRefreshToken = generateRefreshToken(decoded.id, decoded.role);

    return res.status(200).json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token yaroqsiz yoki muddati o\'tgan. Qayta kirish kerak.',
    });
  }
};

/**
 * Check if user is an admin.
 */
const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Ushbu amal uchun admin huquqi talab etiladi' });
  }
};

/**
 * Socket.io JWT authentication middleware.
 * Validates JWT token from socket handshake.
 */
const socketAuthMiddleware = (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    // Allow connection without auth for backward compatibility,
    // but mark as unauthenticated
    console.warn(`[Socket Auth] Connection without token: ${socket.id}`);
    socket.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    console.warn(`[Socket Auth] Invalid token for socket ${socket.id}: ${error.message}`);
    socket.user = null;
    next(); // Allow connection but unauthenticated
  }
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  generateAccessToken,
  generateRefreshToken,
  refreshTokenHandler,
  socketAuthMiddleware,
};