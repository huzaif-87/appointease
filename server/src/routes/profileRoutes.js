const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getProfile,
  updateProfile,
  verifyEmailChange
} = require('../controllers/profileController');

// GET /api/profile - Fetch current user profile & stats
router.get('/', protect(), getProfile);

// PATCH /api/profile - Edit user profile (name, phone, request email change)
router.patch('/', protect(), updateProfile);

// POST /api/profile/verify-email - Verify email change token
router.post('/verify-email', verifyEmailChange);

// GET /api/profile/verify-email - Support direct link query param
router.get('/verify-email', verifyEmailChange);

module.exports = router;
