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

module.exports = {
  createAppointment,
  getMyAppointments,
  getAppointmentDetailsHandler,
  cancelAppointmentHandler,
  rescheduleAppointmentHandler
};

