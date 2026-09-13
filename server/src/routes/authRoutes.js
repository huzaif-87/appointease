const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  register,
  login,
  getMe,
  getProfile,
  getDemoToken,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');

// POST /api/auth/register - Register new patient
router.post('/register', register);

// POST /api/auth/login - Authenticate existing user
router.post('/login', login);

// POST /api/auth/forgot-password - Request password reset link (anti-enumeration)
router.post('/forgot-password', forgotPassword);

// POST /api/auth/reset-password - Reset password using hashed one-time token
router.post('/reset-password', resetPassword);

// GET /api/auth/me - Get current user profile from verified JWT
router.get('/me', protect(), getMe);

// GET /api/auth/profile - Get profile stats
router.get('/profile', protect(), getProfile);

// POST /api/auth/demo-token - Role-based testing token
router.post('/demo-token', getDemoToken);

module.exports = router;
