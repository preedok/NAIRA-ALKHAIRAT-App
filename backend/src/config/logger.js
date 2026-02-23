const winston = require('winston');
const path = require('path');

const logLevel = process.env.LOG_LEVEL || 'info';

/**
 * Winston transport that writes to system_logs table so Super Admin can see backend logs in the app (realtime).
 * Uses lazy require to avoid circular dependency with models.
 */
class SystemLogTransport extends winston.Transport {
  log(info, callback) {
    setImmediate(() => {
      try {
        // Winston may pass formatted string (e.g. from format.json()) or object
        let raw = info;
        if (typeof info === 'string') {
          try {
            raw = JSON.parse(info);
          } catch {
            raw = { message: info, level: 'info' };
          }
        }
        const level = (raw.level && ['info', 'warn', 'error', 'debug'].includes(raw.level)) ? raw.level : 'info';
        let message = raw.message;
        if (message == null) message = JSON.stringify(raw);
        else if (typeof message !== 'string') message = String(message);
        const meta = { ...raw };
        delete meta.level;
        delete meta.message;
        delete meta.timestamp;
        delete meta[Symbol.for('level')];
        delete meta[Symbol.for('message')];
        const { SystemLog } = require('../models');
        SystemLog.create({
          source: 'backend',
          level,
          message: message.substring(0, 10000),
          meta: meta && typeof meta === 'object' && Object.keys(meta).length ? meta : {}
        })
          .then(() => callback())
          .catch((err) => {
            console.error('[SystemLogTransport] Failed to write log to DB:', err.message);
            callback();
          });
      } catch (err) {
        console.error('[SystemLogTransport] Error:', err.message);
        callback();
      }
    });
  }
}

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log')
    }),
    new SystemLogTransport({ level: logLevel })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
