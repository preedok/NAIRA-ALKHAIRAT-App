const { SystemLog } = require('../models');

/**
 * Log API errors to system_logs for Super Admin monitoring.
 * Attach to app after routes: app.use(systemLogger);
 */
const systemLogger = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const level = err.status >= 500 ? 'error' : 'warn';
  SystemLog.create({
    source: 'backend',
    level,
    message: err.message || 'Unknown error',
    meta: {
      path: req.path,
      method: req.method,
      status: err.status || 500,
      userId: req.user?.id,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    }
  }).catch(() => {});
  next(err);
};

module.exports = systemLogger;
