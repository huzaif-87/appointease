const rateLimit = require('express-rate-limit');

/**
 * Common standard 429 response payload
 */
const createRateLimitMessage = (customMsg) => ({
  success: false,
  message: customMsg || "You're making requests a little too quickly. Please wait a moment and try again.",
  statusCode: 429,
  errorCode: 'RATE_LIMITED',
  timestamp: new Date().toISOString()
});

/**
 * 1. Public Read-Only Catalog Limiter (Providers, Services, Shift/Availability queries)
 * Permissive: 300 requests per 15 minutes per IP
 */
const publicCatalogLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage("You're browsing quickly. Please pause a moment and refresh.")
});

/**
 * 2. Authentication Rate Limiter (Register, Login, Token generation)
 * Strict: 30 attempts per 15 minutes per IP (protects against credential stuffing & brute-force)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage("Too many authentication attempts. Please wait a few minutes before trying again.")
});

/**
 * 3. Booking Engine Rate Limiter (Creation, Cancellation, Rescheduling)
 * Protected: 40 requests per 15 minutes per IP (prevents slot-hogging and automated race attacks)
 */
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage("You've submitted several booking requests recently. Please wait a moment before trying again.")
});

/**
 * 4. AI Recommendation Rate Limiter (Gemini & Fallback NLP Queries)
 * Moderate: 30 queries per 15 minutes per IP (protects Gemini quota and compute resources)
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage("AI scheduling limit reached for this session. Please wait a few moments or use manual slot booking.")
});

/**
 * 5. Notifications Polling Limiter
 * Accommodates regular background polling (e.g., every 45-60 seconds): 120 requests per 15 minutes per IP
 */
const notificationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage("Notification request limit reached. Updates will resume in a moment.")
});

/**
 * 6. General API Limiter (Other endpoints, profile, admin)
 * 200 requests per 15 minutes per IP
 */
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: createRateLimitMessage()
});

module.exports = {
  publicCatalogLimiter,
  authLimiter,
  bookingLimiter,
  aiLimiter,
  notificationsLimiter,
  generalApiLimiter,
  // Backwards compatibility aliases
  apiLimiter: generalApiLimiter,
  sensitiveActionLimiter: bookingLimiter
};
