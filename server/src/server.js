require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDB } = require('./config/db');
const { verifySmtpConnection } = require('./services/emailService');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// 1. Trust Proxy Configuration (safely trust first hop for reverse proxies like Render)
app.set('trust proxy', 1);

// 2. Security HTTP Headers
app.use(helmet());

// 2. CORS Configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000'
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('CORS policy: This origin is not allowed'));
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// 3. Body Parsing Middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 4. Mount API Routes (routes employ categorized rate limiters)
app.use('/api', apiRoutes);

// 6. Base / welcome route
app.get('/', (req, res) => {
  res.json({
    name: 'AppointEase API',
    version: '1.0.0',
    description: 'Smart Appointment Booking Platform Backend API',
    endpoints: {
      health: '/api/health'
    }
  });
});

// 7. 404 Handler for undefined routes
app.use(notFoundHandler);

// 8. Centralized Error Handler
app.use(errorHandler);

/**
 * Bootstrap Server: Connect to Database before accepting requests
 */
const startServer = async () => {
  try {
    // Attempt database connection
    console.log('[Server] Initializing database connection...');
    await connectDB();

    // Safe startup SMTP verification (asynchronous, never blocks or crashes server)
    verifySmtpConnection().catch((smtpErr) => {
      console.error('[Server] Startup SMTP verification notice:', smtpErr.message);
    });

    const server = app.listen(PORT, HOST, () => {
      console.log(`=========================================`);
      console.log(` AppointEase Server running on http://${HOST}:${PORT}`);
      console.log(` Health check: http://${HOST}:${PORT}/api/health`);
      console.log(` Environment:  ${process.env.NODE_ENV || 'development'}`);
      console.log(`=========================================`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal) => {
      console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
      server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (err) {
    console.error('[Server Error] Critical error starting server:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
