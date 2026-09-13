const express = require('express');
const router = express.Router();
const {
  getNotificationsHandler,
  markReadHandler,
  markAllReadHandler,
  sendTestEmailHandler
} = require('../controllers/notificationController');
const { protect, requireRole } = require('../middleware/authMiddleware');

// All notification endpoints require authentication
router.use(protect());

// Admin-only test email diagnostic endpoint (Part 1, #5)
router.post('/test-email', requireRole('ADMIN'), sendTestEmailHandler);

// Patient notification endpoints
router.get('/', requireRole('PATIENT'), getNotificationsHandler);
router.patch('/read-all', requireRole('PATIENT'), markAllReadHandler);
router.patch('/:id/read', requireRole('PATIENT'), markReadHandler);

module.exports = router;
