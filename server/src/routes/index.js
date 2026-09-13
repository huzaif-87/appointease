const express = require('express');
const router = express.Router();

const healthRoutes = require('./healthRoutes');
const serviceRoutes = require('./serviceRoutes');
const providerRoutes = require('./providerRoutes');
const adminRoutes = require('./adminRoutes');
const authRoutes = require('./authRoutes');
const availabilityRoutes = require('./availabilityRoutes');
const appointmentRoutes = require('./appointmentRoutes');
const aiRoutes = require('./aiRoutes');
const notificationRoutes = require('./notificationRoutes');
const profileRoutes = require('./profileRoutes');

const {
  publicCatalogLimiter,
  authLimiter,
  bookingLimiter,
  aiLimiter,
  notificationsLimiter,
  generalApiLimiter
} = require('../middleware/rateLimiter');

// 1. Health check: Lightweight, uninhibited for load balancers and monitoring
router.use('/health', healthRoutes);

// 2. Public read-only catalogs: Permissive (300 req / 15 min)
router.use('/services', publicCatalogLimiter, serviceRoutes);
router.use('/providers', publicCatalogLimiter, providerRoutes);
router.use('/availability', publicCatalogLimiter, availabilityRoutes);

// 3. Authentication: Strict protection against credential stuffing (30 req / 15 min)
router.use('/auth', authLimiter, authRoutes);

// 4. Booking engine: Protected against slot-hogging & race attacks (40 req / 15 min)
router.use('/appointments', bookingLimiter, appointmentRoutes);

// 5. Smart Time Recommendation: Moderate Gemini / NLP quota protection (30 req / 15 min)
router.use('/ai', aiLimiter, aiRoutes);

// 6. Notifications: Balanced polling capacity (120 req / 15 min)
router.use('/notifications', notificationsLimiter, notificationRoutes);

// 7. Profile management & email change verification (100 req / 15 min)
router.use('/profile', generalApiLimiter, profileRoutes);

const providerConsoleRoutes = require('./providerConsoleRoutes');

// 8. Admin and backoffice operations (200 req / 15 min)
router.use('/admin', generalApiLimiter, adminRoutes);

// 9. Provider Console operations (200 req / 15 min)
router.use('/provider/console', generalApiLimiter, providerConsoleRoutes);

module.exports = router;
