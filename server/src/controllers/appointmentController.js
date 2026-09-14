const mongoose = require('mongoose');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const {
  bookAppointment,
  getPatientAppointments,
  cancelAppointment,
  rescheduleAppointment,
  getAppointmentById
} = require('../services/bookingService');

/**
 * @route   POST /api/appointments
 * @desc    Create and confirm an appointment with concurrency-safe double-booking prevention
 * @access  Private (PATIENT role required)
 */
const createAppointment = asyncHandler(async (req, res) => {
  // Enforce patient identity from verified JWT only
  const patientId = req.user?.id;
  if (!patientId) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  // Extract and sanitize request parameters
  // Explicitly disregard any client-provided userId or endTime
  const {
    providerId,
    serviceId,
    appointmentDate,
    startTime,
    reason,
    notes,
    idempotencyKey: bodyIdempotencyKey
  } = req.body;

  const headerIdempotencyKey = req.headers['idempotency-key'];
  const effectiveIdempotencyKey = headerIdempotencyKey || bodyIdempotencyKey || null;

  try {
    const result = await bookAppointment({
      patientId,
      providerId,
      serviceId,
      appointmentDate,
      startTime,
      reason,
      notes,
      idempotencyKey: effectiveIdempotencyKey
    });

    if (result.isIdempotentReplay) {
      res.set('X-Idempotent-Replay', 'true');
      return res.status(result.statusCode).json({
        success: true,
        message: 'Appointment booking retrieved via idempotency replay',
        data: result.data
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Appointment booked and confirmed successfully',
      data: result.data
    });
  } catch (err) {
    const status = err.statusCode || 500;
    const errorCode = err.errorCode || (status === 409 ? 'SLOT_NO_LONGER_AVAILABLE' : 'SERVER_ERROR');
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to book appointment',
      statusCode: status,
      errorCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   GET /api/appointments
 * @desc    Get appointments for the authenticated patient
 * @access  Private (PATIENT role required)
 */
const getMyAppointments = asyncHandler(async (req, res) => {
  // Scoped strictly to authenticated JWT user ID
  const patientId = req.user?.id;
  if (!patientId) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  const { status, timeframe } = req.query;

  try {
    const appointments = await getPatientAppointments({
      patientId,
      status,
      timeframe
    });

    return ApiResponse.success(
      res,
      {
        appointments,
        count: appointments.length
      },
      'Patient appointments retrieved successfully'
    );
  } catch (err) {
    const status = err.statusCode || 500;
    const errorCode = err.errorCode || 'SERVER_ERROR';
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to retrieve appointments',
      statusCode: status,
      errorCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   GET /api/appointments/:id
 * @desc    Get details of a single appointment owned by the authenticated patient
 * @access  Private (PATIENT role required)
 */
const getAppointmentDetailsHandler = asyncHandler(async (req, res) => {
  const patientId = req.user?.id;
  if (!patientId) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  const { id } = req.params;

  try {
    const appointment = await getAppointmentById({
      patientId,
      appointmentId: id
    });

    return res.status(200).json({
      success: true,
      message: 'Appointment details retrieved successfully',
      data: { appointment }
    });
  } catch (err) {
    const status = err.statusCode || 500;
    const errorCode = err.errorCode || 'SERVER_ERROR';
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to retrieve appointment details',
      statusCode: status,
      errorCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   PATCH /api/appointments/:id/cancel
 * @desc    Cancel a confirmed appointment
 * @access  Private (PATIENT role required)
 */
const cancelAppointmentHandler = asyncHandler(async (req, res) => {
  const patientId = req.user?.id;
  if (!patientId) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  const { id } = req.params;
  const { cancellationReason } = req.body || {};

  try {
    const cancelled = await cancelAppointment({
      patientId,
      appointmentId: id,
      cancellationReason
    });

    return res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: cancelled
    });
  } catch (err) {
    const status = err.statusCode || 500;
    const errorCode = err.errorCode || 'SERVER_ERROR';
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to cancel appointment',
      statusCode: status,
      errorCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   PATCH /api/appointments/:id/reschedule
 * @desc    Reschedule a confirmed appointment to a new slot
 * @access  Private (PATIENT role required)
 */
const rescheduleAppointmentHandler = asyncHandler(async (req, res) => {
  const patientId = req.user?.id;
  if (!patientId) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  const { id } = req.params;
  const { appointmentDate, startTime } = req.body || {};

  try {
    const rescheduled = await rescheduleAppointment({
      patientId,
      appointmentId: id,
      appointmentDate,
      startTime
    });

    return res.status(200).json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: rescheduled
    });
  } catch (err) {
    const status = err.statusCode || 500;
    const errorCode = err.errorCode || (status === 409 ? 'SLOT_NO_LONGER_AVAILABLE' : 'SERVER_ERROR');
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to reschedule appointment',
      statusCode: status,
      errorCode,
      timestamp: new Date().toISOString()
    });
  }
});

const { sendConfirmationEmail } = require('../services/emailService');
const { Appointment } = require('../models');

/**
 * @route   PATCH /api/appointments/:id/confirm
 * @route   POST /api/appointments/booking-confirmation
 * @desc    Confirm booking status and send per-user automatic HTML confirmation email
 * @access  Private
 */
const confirmBookingHandler = asyncHandler(async (req, res) => {
  const targetId = req.params.id || req.body.bookingId || req.body.appointmentId;
  if (!targetId) {
    return ApiResponse.error(res, 'Booking ID or appointment ID is required', 400);
  }

  // Locate appointment document safely by ObjectId or string appointmentId
  const isObjectId = mongoose.Types.ObjectId.isValid(targetId);
  const query = isObjectId ? { $or: [{ _id: targetId }, { appointmentId: targetId }] } : { appointmentId: targetId };
  const appointment = await Appointment.findOne(query);

  if (!appointment) {
    return ApiResponse.error(res, 'Booking document not found', 404);
  }

  // Update booking status to confirmed
  appointment.status = 'CONFIRMED';
  await appointment.save();

  // Populate linked user field to retrieve specific user's email and name dynamically
  const confirmedBooking = await Appointment.findById(appointment._id)
    .populate('userId', 'name email')
    .populate('providerId', 'name specialty location')
    .populate('serviceId', 'name category price durationMinutes')
    .lean();

  const bookingId = confirmedBooking.appointmentId || confirmedBooking._id.toString();
  const userEmail = confirmedBooking.userId?.email;
  const patientName = confirmedBooking.userId?.name || 'Patient';
  const doctorName = confirmedBooking.providerId?.name || 'Doctor';
  const appointmentDate = confirmedBooking.appointmentDate;
  const time = confirmedBooking.startTime && confirmedBooking.endTime
    ? `${confirmedBooking.startTime} – ${confirmedBooking.endTime}`
    : confirmedBooking.startTime;

  // Wrap email call in try/catch so a failed send never blocks the booking confirmation itself; log error with booking ID
  let emailSent = false;
  try {
    if (userEmail) {
      const emailRes = await sendConfirmationEmail({
        userEmail,
        patientName,
        doctorName,
        appointmentDate,
        time,
        bookingId
      });
      emailSent = emailRes?.success || false;
    } else {
      console.warn(`[Booking Confirmation] No email address found for linked user in booking ID ${bookingId}`);
    }
  } catch (emailErr) {
    console.error(`[Booking Confirmation] Failed to send confirmation email for booking ID ${bookingId}:`, emailErr.message);
  }

  return res.status(200).json({
    success: true,
    message: 'Booking status updated to confirmed successfully',
    data: {
      appointment: confirmedBooking,
      emailSent
    }
  });
});

module.exports = {
  createAppointment,
  getMyAppointments,
  getAppointmentDetailsHandler,
  cancelAppointmentHandler,
  rescheduleAppointmentHandler,
  confirmBookingHandler
};


