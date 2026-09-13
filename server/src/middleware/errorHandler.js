/**
 * Centralized error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message || 'An unexpected error occurred';
  const isDev = process.env.NODE_ENV === 'development';

  // Handle MongoDB transient network / SSL connection errors gracefully
  if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError' || (err.code && err.code === 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR')) {
    statusCode = 503;
    message = 'Database service is temporarily re-establishing connection. Please try again.';
    console.warn(`[Database Warning] ${req.method} ${req.originalUrl}: ${err.name} - ${err.message}`);
  } else {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, message);
  }

  res.status(statusCode).json({
    success: false,
    message,
    statusCode,
    ...(err.errors && { errors: err.errors }),
    ...(isDev && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandler;
