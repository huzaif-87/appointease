const express = require('express');
const router = express.Router();
const {
  getAdminOverview,
  getAdminAppointments,
  updateAdminAppointmentStatus,
  getAdminProviders,
  createAdminProvider,
  updateAdminProvider,
  getAdminServices,
  createAdminService,
  updateAdminService,
  getAdminAvailabilities,
  createAdminAvailability,
  updateAdminAvailability,
  deleteAdminAvailability,
  getAdminUsers,
  updateAdminUser
} = require('../controllers/adminController');
const { protect, requireRole } = require('../middleware/authMiddleware');

// All admin routes strictly require authentication and ADMIN role
router.use(protect());
router.use(requireRole('ADMIN'));

// Overview
router.get('/overview', getAdminOverview);

// Appointments Management
router.get('/appointments', getAdminAppointments);
router.patch('/appointments/:id/status', updateAdminAppointmentStatus);

// Providers Management
router.get('/providers', getAdminProviders);
router.post('/providers', createAdminProvider);
router.patch('/providers/:id', updateAdminProvider);

// Services Catalog Management
router.get('/services', getAdminServices);
router.post('/services', createAdminService);
router.patch('/services/:id', updateAdminService);

// Availability & Schedule Management
router.get('/availabilities', getAdminAvailabilities);
router.post('/availabilities', createAdminAvailability);
router.patch('/availabilities/:id', updateAdminAvailability);
router.delete('/availabilities/:id', deleteAdminAvailability);

// Users Management
router.get('/users', getAdminUsers);
router.patch('/users/:id', updateAdminUser);

// ── TEMP: Email delivery test ─────────────────────────────────────────────────
// POST /api/admin/test-email  { to, patientName?, doctorName? }
// Sends a real booking-confirmation email via Resend so you can verify the
// integration end-to-end from the Admin portal. DELETE this route when done.
router.post('/test-email', async (req, res) => {
  const { sendBookingConfirmationEmail } = require('../services/emailService');
  const { to, patientName = 'Test Patient', doctorName = 'Dr. Test Doctor' } = req.body;

  if (!to) {
    return res.status(400).json({ success: false, message: '"to" email address is required' });
  }

  const result = await sendBookingConfirmationEmail({
    userEmail: to,
    patientName,
    doctorName,
    appointmentDate: new Date(),
    time: '10:30 AM',
    bookingId: 'TEST-' + Date.now(),
  });

  if (result.success) {
    return res.json({ success: true, message: `Test email sent to ${to}`, messageId: result.messageId });
  }
  return res.status(500).json({ success: false, message: result.error || 'Email send failed' });
});
// ── END TEMP ─────────────────────────────────────────────────────────────────

module.exports = router;
