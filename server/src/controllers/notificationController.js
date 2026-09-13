const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const { User } = require('../models');
const { sendEmail } = require('../services/emailService');
const {
  getPatientNotifications,
  markNotificationRead,
  markAllNotificationsRead
} = require('../services/notificationService');

/**
 * @route   GET /api/notifications
 * @desc    Retrieve in-app notifications for authenticated patient
 * @access  Private (PATIENT role required)
 */
const getNotificationsHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  const { unreadOnly, limit } = req.query;

  const result = await getPatientNotifications({
    userId,
    unreadOnly: unreadOnly === 'true',
    limit
  });

  return ApiResponse.success(res, result, 'Notifications retrieved successfully');
});

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a specific notification as read (scoped to req.user.id)
 * @access  Private (PATIENT role required)
 */
const markReadHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  const { id } = req.params;

  try {
    const result = await markNotificationRead({
      userId,
      notificationId: id
    });

    return ApiResponse.success(res, result, 'Notification marked as read');
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to update notification',
      statusCode: status
    });
  }
});

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all unread notifications as read for the authenticated patient
 * @access  Private (PATIENT role required)
 */
const markAllReadHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  const result = await markAllNotificationsRead({ userId });

  return ApiResponse.success(res, result, 'All notifications marked as read');
});

/**
 * @route   POST /api/notifications/test-email
 * @desc    Send diagnostic test email to the authenticated admin's registered email
 * @access  Private (ADMIN role required)
 */
const sendTestEmailHandler = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  // Recipient strictly comes from the authenticated admin's User document in DB
  const adminUser = await User.findById(userId).select('name email role');
  if (!adminUser || !adminUser.email) {
    return res.status(404).json({
      success: false,
      code: 'USER_NOT_FOUND',
      message: 'Authenticated admin profile or email not found'
    });
  }

  if (adminUser.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN_ROLE',
      message: 'Admin access required for diagnostic test email'
    });
  }

  const subject = 'AppointEase SMTP Diagnostic Test Email';
  const text = `Hello ${adminUser.name || 'Administrator'},\n\nThis is a diagnostic test email verifying that AppointEase SMTP transmission is functioning correctly.\n\nTimestamp: ${new Date().toISOString()}\nRecipient: ${adminUser.email}\n\nAppointEase System Diagnostics`;
  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0d9488; margin-top: 0;">AppointEase Diagnostic Test</h2>
      <p>Hello <strong>${adminUser.name || 'Administrator'}</strong>,</p>
      <p>This is a verified test email dispatched from your AppointEase server via SMTP.</p>
      <div style="background-color: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; margin: 16px 0;">
        Timestamp: ${new Date().toISOString()}<br/>
        Recipient: ${adminUser.email}<br/>
        Status: SMTP Transmission Handshake
      </div>
      <p style="font-size: 11px; color: #64748b;">Notice: This test confirms acceptance by the configured SMTP server.</p>
    </div>
  `;

  const result = await sendEmail({
    to: adminUser.email,
    subject,
    text,
    html,
    emailType: 'DIAGNOSTIC_TEST'
  });

  if (result.success) {
    return res.status(200).json({
      success: true,
      code: 'EMAIL_ACCEPTED',
      messageId: result.messageId,
      accepted: result.accepted || [result.recipient]
    });
  } else {
    const statusCode = result.code === 'EMAIL_AUTHENTICATION_FAILED' ? 401 : 502;
    return res.status(statusCode).json({
      success: false,
      code: result.code || 'EMAIL_DELIVERY_FAILED',
      message: result.message || result.reason || 'SMTP transmission failed'
    });
  }
});

module.exports = {
  getNotificationsHandler,
  markReadHandler,
  markAllReadHandler,
  sendTestEmailHandler
};
