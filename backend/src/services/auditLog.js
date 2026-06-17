/**
 * auditLog.js
 * Simple audit logging service for tracking important actions.
 * Stores audit records in MongoDB for accountability and debugging.
 */

const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    index: true,
  },
  actor: {
    id: { type: mongoose.Schema.Types.Mixed, default: null },
    role: { type: String, default: 'system' },
    ip: { type: String, default: '' },
  },
  target: {
    type: { type: String, default: '' },   // 'ride', 'order', 'driver', 'user', 'wallet'
    id: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  level: {
    type: String,
    enum: ['info', 'warn', 'error', 'critical'],
    default: 'info',
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: { expires: 90 * 24 * 60 * 60 }, // TTL: auto-delete after 90 days
  },
});

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

/**
 * Log an audit event.
 * @param {Object} params
 * @param {string} params.action - What happened (e.g. 'ride.accepted', 'wallet.withdrawal.approved')
 * @param {Object} [params.actor] - Who did it { id, role, ip }
 * @param {Object} [params.target] - What was affected { type, id }
 * @param {Object} [params.details] - Additional context
 * @param {string} [params.level] - 'info' | 'warn' | 'error' | 'critical'
 */
const log = async ({ action, actor = {}, target = {}, details = {}, level = 'info' }) => {
  try {
    await AuditLog.create({
      action,
      actor: {
        id: actor.id || null,
        role: actor.role || 'system',
        ip: actor.ip || '',
      },
      target: {
        type: target.type || '',
        id: target.id || null,
      },
      details,
      level,
    });
  } catch (err) {
    // Audit log should never crash the main flow
    console.error('[AuditLog] Failed to write audit log:', err.message);
  }
};

/**
 * Express middleware to auto-audit requests.
 * Use on sensitive routes.
 */
const auditMiddleware = (action, level = 'info') => {
  return (req, res, next) => {
    // Log after response is sent
    res.on('finish', () => {
      if (res.statusCode < 400) {
        log({
          action,
          actor: {
            id: req.user?.id || req.user?._id || null,
            role: req.user?.role || 'anonymous',
            ip: req.ip || req.connection?.remoteAddress || '',
          },
          target: {
            type: req.params?.rideId ? 'ride' : req.params?.id ? 'entity' : '',
            id: req.params?.rideId || req.params?.id || null,
          },
          details: {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
          },
          level,
        });
      }
    });
    next();
  };
};

module.exports = {
  log,
  auditMiddleware,
  AuditLog,
};
