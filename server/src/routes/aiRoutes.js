const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/authMiddleware');
const { getTimeRecommendationsHandler } = require('../controllers/aiController');

// All AI recommendation endpoints require authentication (PATIENT or ADMIN role)
router.use(protect());
router.use(requireRole('PATIENT', 'ADMIN'));

// POST /api/ai/time-recommendations
router.post('/time-recommendations', getTimeRecommendationsHandler);

module.exports = router;
