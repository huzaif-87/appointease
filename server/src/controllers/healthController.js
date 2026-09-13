const { getDatabaseStatus } = require('../config/db');

/**
 * Health check handler returning service health and DB connectivity
 */
const getHealth = (req, res) => {
  const dbStatus = getDatabaseStatus();
  const uptimeSeconds = Math.floor(process.uptime());

  const healthData = {
    status: 'healthy',
    service: 'AppointEase Backend API',
    environment: process.env.NODE_ENV || 'development',
    uptime: {
      seconds: uptimeSeconds,
      formatted: `${Math.floor(uptimeSeconds / 60)}m ${uptimeSeconds % 60}s`
    },
    database: {
      status: dbStatus.state,
      connected: dbStatus.isConnected,
      name: dbStatus.name || 'appointease'
    },
    timestamp: new Date().toISOString()
  };

  res.status(200).json({
    success: true,
    message: 'AppointEase API is operational',
    data: healthData
  });
};

module.exports = {
  getHealth
};
