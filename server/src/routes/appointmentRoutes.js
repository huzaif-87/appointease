const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/authMiddleware');
const {
  createAppointment,
  getMyAppointments,
  getAppointmentDetailsHandler,
  cancelAppointmentHandler,
  rescheduleAppointmentHandler,
  confirmBookingHandler
} = require('../controllers/appointmentController');

// All appointment operations require authentication
router.use(protect());

// POST /api/appointments/booking-confirmation - Confirm booking and trigger per-user email
router.post('/booking-confirmation', confirmBookingHandler);

// POST /api/appointments - Book appointment (PATIENT role)
router.post('/', requireRole('PATIENT'), createAppointment);

// GET /api/appointments - Get authenticated user's appointments (PATIENT role)
router.get('/', requireRole('PATIENT'), getMyAppointments);

// GET /api/appointments/:id - Get single appointment details for reschedule/review (PATIENT role)
router.get('/:id', requireRole('PATIENT'), getAppointmentDetailsHandler);

// PATCH /api/appointments/:id/confirm - Confirm booking status
router.patch('/:id/confirm', confirmBookingHandler);

// PATCH /api/appointments/:id/cancel - Cancel appointment (PATIENT role required per policy)
router.patch('/:id/cancel', requireRole('PATIENT'), cancelAppointmentHandler);

// PATCH /api/appointments/:id/reschedule - Atomically reschedule appointment (PATIENT role required)
router.patch('/:id/reschedule', requireRole('PATIENT'), rescheduleAppointmentHandler);

module.exports = router;

