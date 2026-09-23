const crypto = require('crypto');
const mongoose = require('mongoose');
const { Provider, Service, Availability, Appointment, BookingLock, IdempotencyKey } = require('../models');
const {
  validateDate,
  timeToMinutes,
  minutesToTime,
  isIntervalOverlapping,
  getNowInAppTimezone,
  APP_TIMEZONE,
  MIN_BOOKING_BUFFER_MINUTES
} = require('./slotService');
const {
  notifyAppointmentConfirmed,
  notifyAppointmentCancelled,
  notifyAppointmentRescheduled
} = require('./notificationService');
const {
  sendRescheduleConfirmationEmail,
  sendCancellationEmail
} = require('./emailService');

const CANCELLATION_WINDOW_MINUTES = parseInt(process.env.CANCELLATION_WINDOW_MINUTES, 10) || 120;
const RESCHEDULE_WINDOW_MINUTES = parseInt(process.env.RESCHEDULE_WINDOW_MINUTES, 10) || 120;

/**
 * Calculates remaining minutes from current time in APP_TIMEZONE to scheduled appointment start
 */
const getRemainingMinutesToAppointment = (appointmentDate, startTime) => {
  const dateStr =
    appointmentDate instanceof Date
      ? appointmentDate.toISOString().split('T')[0]
      : String(appointmentDate).split('T')[0];

  // Appointment start time in Asia/Kolkata (+05:30)
  const aptStartMs = new Date(`${dateStr}T${startTime}:00+05:30`).getTime();
  const diffMinutes = Math.floor((aptStartMs - Date.now()) / (1000 * 60));
  return diffMinutes;
};

/**
 * Helper to locate an appointment by either MongoDB ObjectId or appointmentId string
 */
const findAppointmentByIdentifier = async (id, session = null) => {
  if (!id) return null;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const query = isObjectId ? { $or: [{ _id: id }, { appointmentId: id }] } : { appointmentId: id };
  const queryExec = Appointment.findOne(query);
  if (session) {
    queryExec.session(session);
  }
  return queryExec;
};

/**
 * Cache for database transaction capability
 */
let cachedSupportsTransactions = null;

const checkTransactionSupport = async () => {
  if (cachedSupportsTransactions !== null) {
    return cachedSupportsTransactions;
  }
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    // Test command within session to verify replica set capability
    await mongoose.connection.db.admin().command({ ping: 1 }, { session });
    await session.abortTransaction();
    session.endSession();
    cachedSupportsTransactions = true;
    console.log('[Booking Engine] MongoDB deployment supports multi-document transactions (Replica Set mode)');
  } catch (err) {
    cachedSupportsTransactions = false;
    console.log(
      '[Booking Engine] MongoDB deployment is Standalone; deploying atomic distributed mutex locking on BookingLock'
    );
  }
  return cachedSupportsTransactions;
};

/**
 * Generates a unique, user-friendly appointment ID
 * Format: APT-YYYYMMDD-XXXXXX
 */
const generateAppointmentId = (dateStr) => {
  const compactDate = dateStr.replace(/-/g, '');
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `APT-${compactDate}-${randomHex}`;
};

/**
 * Computes a deterministic request hash for idempotency checking
 */
const computeRequestHash = ({ patientId, providerId, serviceId, appointmentDate, startTime }) => {
  const raw = `${patientId}:${providerId}:${serviceId}:${appointmentDate}:${startTime}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
};

/**
 * Core Transactional Booking Engine
 */
const bookAppointment = async ({
  patientId,
  providerId,
  serviceId,
  appointmentDate,
  startTime,
  reason = '',
  notes = '',
  idempotencyKey = null
}) => {
  // -------------------------------------------------------------
  // 1. Mandatory Input Sanity & ObjectId Validation
  // -------------------------------------------------------------
  if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
    const error = new Error('A valid authenticated patient identity is required');
    error.statusCode = 401;
    error.errorCode = 'UNAUTHENTICATED';
    throw error;
  }

  if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
    const error = new Error(`Invalid or missing provider ID: '${providerId}'`);
    error.statusCode = 400;
    error.errorCode = 'INVALID_PROVIDER_ID';
    throw error;
  }

  if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
    const error = new Error(`Invalid or missing service ID: '${serviceId}'`);
    error.statusCode = 400;
    error.errorCode = 'INVALID_SERVICE_ID';
    throw error;
  }

  // Strict HH:MM start time validation
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!startTime || !timeRegex.test(startTime)) {
    const error = new Error(`Invalid start time format: '${startTime}'. Expected HH:MM in 24-hour format`);
    error.statusCode = 400;
    error.errorCode = 'INVALID_TIME_FORMAT';
    throw error;
  }

  // -------------------------------------------------------------
  // 2. Strict Calendar & Temporal Validation (Asia/Kolkata)
  // -------------------------------------------------------------
  const dateInfo = validateDate(appointmentDate);

  // -------------------------------------------------------------
  // 3. Provider & Service Relational Integrity
  // -------------------------------------------------------------
  const [provider, service] = await Promise.all([
    Provider.findById(providerId).lean(),
    Service.findById(serviceId).lean()
  ]);

  if (!provider) {
    const error = new Error('Provider not found');
    error.statusCode = 404;
    error.errorCode = 'PROVIDER_NOT_FOUND';
    throw error;
  }

  if (provider.status !== 'ACTIVE') {
    const error = new Error(
      `Provider '${provider.name}' is currently ${provider.status.toLowerCase()} and cannot accept appointments`
    );
    error.statusCode = 400;
    error.errorCode = 'PROVIDER_NOT_ACTIVE';
    throw error;
  }

  if (!service) {
    const error = new Error('Service not found');
    error.statusCode = 404;
    error.errorCode = 'SERVICE_NOT_FOUND';
    throw error;
  }

  if (service.status !== 'ACTIVE') {
    const error = new Error(`Service '${service.name}' is currently inactive`);
    error.statusCode = 400;
    error.errorCode = 'SERVICE_NOT_ACTIVE';
    throw error;
  }

  // Verify Provider offers this Service
  const offersService = (provider.serviceIds || []).some(
    (sId) => sId.toString() === serviceId.toString()
  );

  if (!offersService) {
    const error = new Error(`Provider '${provider.name}' does not offer '${service.name}'`);
    error.statusCode = 400;
    error.errorCode = 'SERVICE_NOT_OFFERED';
    throw error;
  }

  // -------------------------------------------------------------
  // 4. Server-Side End Time Calculation
  // -------------------------------------------------------------
  const duration = service.durationMinutes || provider.consultationDuration || 30;
  const startMin = timeToMinutes(startTime);
  const endMin = startMin + duration;

  if (endMin > 1440) {
    const error = new Error('Appointment interval extends beyond the end of the day');
    error.statusCode = 400;
    error.errorCode = 'INTERVAL_EXCEEDS_DAY';
    throw error;
  }

  const calculatedEndTime = minutesToTime(endMin);

  // -------------------------------------------------------------
  // 5. Working Hours & Shift Verification
  // -------------------------------------------------------------
  const activeShifts = await Availability.find({
    providerId: provider._id,
    dayOfWeek: dateInfo.dayOfWeek,
    isActive: true
  }).lean();

  if (activeShifts.length === 0) {
    const error = new Error(`Provider '${provider.name}' does not have working hours on ${dateInfo.dayOfWeek}s`);
    error.statusCode = 400;
    error.errorCode = 'PROVIDER_UNAVAILABLE_ON_DAY';
    throw error;
  }

  const fitsInShift = activeShifts.some((shift) => {
    const shiftStart = timeToMinutes(shift.startTime);
    const shiftEnd = timeToMinutes(shift.endTime);
    return startMin >= shiftStart && endMin <= shiftEnd;
  });

  if (!fitsInShift) {
    const error = new Error(
      `Requested time ${startTime}–${calculatedEndTime} falls outside provider '${provider.name}' working hours on ${dateInfo.dayOfWeek}`
    );
    error.statusCode = 400;
    error.errorCode = 'OUTSIDE_WORKING_HOURS';
    throw error;
  }

  // -------------------------------------------------------------
  // 6. Booking Buffer Validation for Today
  // -------------------------------------------------------------
  const { currentMinutes } = getNowInAppTimezone();
  if (dateInfo.isToday) {
    if (startMin < currentMinutes) {
      const error = new Error(`Cannot book a time slot in the past (${startTime})`);
      error.statusCode = 400;
      error.errorCode = 'PAST_TIME';
      throw error;
    }

    if (startMin < currentMinutes + MIN_BOOKING_BUFFER_MINUTES) {
      const error = new Error(
        `Requested slot is within the ${MIN_BOOKING_BUFFER_MINUTES}-minute minimum advance booking buffer`
      );
      error.statusCode = 400;
      error.errorCode = 'BOOKING_BUFFER_RESTRICTION';
      throw error;
    }
  }

  // -------------------------------------------------------------
  // 7. Idempotency Check (Double-click / browser retry protection)
  // -------------------------------------------------------------
  const currentRequestHash = computeRequestHash({
    patientId: patientId.toString(),
    providerId: provider._id.toString(),
    serviceId: service._id.toString(),
    appointmentDate,
    startTime
  });

  if (idempotencyKey) {
    const existingIdempotency = await IdempotencyKey.findOne({ key: idempotencyKey }).lean();
    if (existingIdempotency) {
      if (existingIdempotency.requestHash === currentRequestHash) {
        return {
          isIdempotentReplay: true,
          statusCode: existingIdempotency.responseStatus,
          data: existingIdempotency.responseData
        };
      } else {
        const error = new Error('Idempotency-Key cannot be reused for different booking parameters');
        error.statusCode = 409;
        error.errorCode = 'IDEMPOTENCY_CONFLICT';
        throw error;
      }
    }
  }

  // -------------------------------------------------------------
  // 8. Database-Level Concurrency & Serialization Strategy
  // -------------------------------------------------------------
  const targetDate = new Date(Date.UTC(dateInfo.year, dateInfo.month - 1, dateInfo.day, 12, 0, 0, 0));
  const targetDateStart = new Date(Date.UTC(dateInfo.year, dateInfo.month - 1, dateInfo.day, 0, 0, 0, 0));
  const targetDateEnd = new Date(Date.UTC(dateInfo.year, dateInfo.month - 1, dateInfo.day, 23, 59, 59, 999));
  const lockKey = `${provider._id.toString()}_${appointmentDate}`;

  const hasTxSupport = await checkTransactionSupport();

  if (hasTxSupport) {
    // -----------------------------------------------------------
    // STRATEGY A: Full MongoDB Replica Set Transactions (Atlas)
    // -----------------------------------------------------------
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      let session = null;

      try {
        session = await mongoose.startSession();
        session.startTransaction();

        // Step 8A: Acquire exclusive schedule lock per provider+date inside transaction
        await BookingLock.findOneAndUpdate(
          { lockKey },
          {
            $inc: { version: 1 },
            $setOnInsert: { providerId: provider._id, date: appointmentDate }
          },
          {
            upsert: true,
            new: true,
            session
          }
        );

        // Step 8B: Query existing non-cancelled appointments within transaction
        const existingAppointments = await Appointment.find({
          providerId: provider._id,
          appointmentDate: { $gte: targetDateStart, $lte: targetDateEnd },
          status: { $ne: 'CANCELLED' }
        })
          .session(session)
          .lean();

        // Step 8C: Interval Overlap Check
        const conflict = existingAppointments.find((apt) => {
          const aptStartMin = timeToMinutes(apt.startTime);
          const aptEndMin = timeToMinutes(apt.endTime);
          return isIntervalOverlapping(startMin, endMin, aptStartMin, aptEndMin);
        });

        if (conflict) {
          await session.abortTransaction();
          const error = new Error('Requested appointment time is no longer available. Slot conflict detected.');
          error.statusCode = 409;
          error.errorCode = 'SLOT_NO_LONGER_AVAILABLE';
          throw error;
        }

        // Generate unique appointment ID
        const appointmentId = generateAppointmentId(appointmentDate);

        const [newAppointment] = await Appointment.create(
          [
            {
              appointmentId,
              userId: patientId,
              providerId: provider._id,
              serviceId: service._id,
              appointmentDate: targetDate,
              startTime,
              endTime: calculatedEndTime,
              status: 'CONFIRMED',
              reason: (reason || '').trim(),
              notes: (notes || '').trim()
            }
          ],
          { session }
        );

        const responsePayload = {
          appointment: {
            _id: newAppointment._id,
            id: newAppointment._id,
            appointmentId: newAppointment.appointmentId,
            date: appointmentDate,
            startTime: newAppointment.startTime,
            endTime: newAppointment.endTime,
            status: newAppointment.status,
            provider: {
              _id: provider._id,
              id: provider._id,
              name: provider.name,
              specialty: provider.specialty,
              location: provider.location
            },
            service: {
              _id: service._id,
              id: service._id,
              name: service.name,
              category: service.category,
              durationMinutes: duration,
              price: service.price
            },
            reason: newAppointment.reason,
            notes: newAppointment.notes,
            createdAt: newAppointment.createdAt
          }
        };

        if (idempotencyKey) {
          try {
            await IdempotencyKey.create(
              [
                {
                  key: idempotencyKey,
                  userId: patientId,
                  requestHash: currentRequestHash,
                  responseStatus: 201,
                  responseData: responsePayload
                }
              ],
              { session }
            );
          } catch (idempErr) {}
        }

        await session.commitTransaction();

        // Milestone 8: Reliable notification & email dispatch (Never blocks or rolls back committed appointment)
        notifyAppointmentConfirmed({
          appointment: newAppointment,
          patient: null, // Will resolve patient doc via userId
          provider,
          service
        }).catch((notifErr) => {
          console.error('[Booking Engine] Confirmation notification dispatch notice:', notifErr.message);
        });

        return {
          isIdempotentReplay: false,
          statusCode: 201,
          data: responsePayload
        };
      } catch (err) {
        if (session && session.inTransaction()) {
          await session.abortTransaction().catch(() => {});
        }

        const isTransientConflict =
          err.hasErrorLabel && err.hasErrorLabel('TransientTransactionError');
        const isWriteConflict =
          err.code === 112 || (err.message && err.message.includes('WriteConflict'));

        if ((isTransientConflict || isWriteConflict) && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 50 * attempt));
          continue;
        }
        throw err;
      } finally {
        if (session) {
          session.endSession();
        }
      }
    }
  } else {
    // -----------------------------------------------------------
    // STRATEGY B: Atomic Mutex Lease Lock on BookingLock (Standalone Mongo)
    // -----------------------------------------------------------
    const lockToken = crypto.randomUUID();
    const leaseMs = 8000;
    const maxWaitMs = 5000;
    const startTimeAcquire = Date.now();
    let acquired = false;

    while (!acquired && Date.now() - startTimeAcquire < maxWaitMs) {
      try {
        const now = new Date();
        const staleThreshold = new Date(Date.now() - leaseMs);

        const lockDoc = await BookingLock.findOneAndUpdate(
          {
            lockKey,
            $or: [
              { isLocked: false },
              { isLocked: { $exists: false } },
              { lockedAt: { $lt: staleThreshold } }
            ]
          },
          {
            $set: { isLocked: true, lockedAt: now, holder: lockToken },
            $inc: { version: 1 },
            $setOnInsert: { providerId: provider._id, date: appointmentDate }
          },
          { upsert: true, new: true }
        );

        if (lockDoc && lockDoc.holder === lockToken) {
          acquired = true;
          break;
        }
      } catch (upsertErr) {
        // E11000 duplicate key race on concurrent upsert - retry loop
      }
      await new Promise((r) => setTimeout(r, 20));
    }

    if (!acquired) {
      const err = new Error('Could not acquire booking lock. Please try again.');
      err.statusCode = 409;
      throw err;
    }

    try {
      // Inside Mutex Lock: Check for conflicts
      const existingAppointments = await Appointment.find({
        providerId: provider._id,
        appointmentDate: { $gte: targetDateStart, $lte: targetDateEnd },
        status: { $ne: 'CANCELLED' }
      }).lean();

      const conflict = existingAppointments.find((apt) => {
        const aptStartMin = timeToMinutes(apt.startTime);
        const aptEndMin = timeToMinutes(apt.endTime);
        return isIntervalOverlapping(startMin, endMin, aptStartMin, aptEndMin);
      });

      if (conflict) {
        const error = new Error('Requested appointment time is no longer available. Slot conflict detected.');
        error.statusCode = 409;
        error.errorCode = 'SLOT_NO_LONGER_AVAILABLE';
        throw error;
      }

      const appointmentId = generateAppointmentId(appointmentDate);

      const newAppointment = await Appointment.create({
        appointmentId,
        userId: patientId,
        providerId: provider._id,
        serviceId: service._id,
        appointmentDate: targetDate,
        startTime,
        endTime: calculatedEndTime,
        status: 'CONFIRMED',
        reason: (reason || '').trim(),
        notes: (notes || '').trim()
      });

      const responsePayload = {
        appointment: {
          _id: newAppointment._id,
          id: newAppointment._id,
          appointmentId: newAppointment.appointmentId,
          date: appointmentDate,
          startTime: newAppointment.startTime,
          endTime: newAppointment.endTime,
          status: newAppointment.status,
          provider: {
            _id: provider._id,
            id: provider._id,
            name: provider.name,
            specialty: provider.specialty,
            location: provider.location
          },
          service: {
            _id: service._id,
            id: service._id,
            name: service.name,
            category: service.category,
            durationMinutes: duration,
            price: service.price
          },
          reason: newAppointment.reason,
          notes: newAppointment.notes,
          createdAt: newAppointment.createdAt
        }
      };

      if (idempotencyKey) {
        try {
          await IdempotencyKey.create({
            key: idempotencyKey,
            userId: patientId,
            requestHash: currentRequestHash,
            responseStatus: 201,
            responseData: responsePayload
          });
        } catch (idempErr) {}
      }

      // Milestone 8: Reliable notification & email dispatch (Never blocks or rolls back committed appointment)
      notifyAppointmentConfirmed({
        appointment: newAppointment,
        patient: null,
        provider,
        service
      }).catch((notifErr) => {
        console.error('[Booking Engine] Confirmation notification dispatch notice:', notifErr.message);
      });

      return {
        isIdempotentReplay: false,
        statusCode: 201,
        data: responsePayload
      };
    } finally {
      // Always release mutex lock
      await BookingLock.updateOne(
        { lockKey, holder: lockToken },
        { $set: { isLocked: false, holder: null } }
      ).catch(() => {});
    }
  }
};

/**
 * Retrieve appointments for the authenticated patient
 */
const getPatientAppointments = async ({ patientId, status, timeframe }) => {
  if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
    const error = new Error('Valid authenticated patient ID required');
    error.statusCode = 401;
    throw error;
  }

  const query = { userId: patientId };

  if (status) {
    query.status = status.toUpperCase();
  }

  const appointments = await Appointment.find(query)
    .populate('providerId', 'name specialty location consultationDuration')
    .populate('serviceId', 'name category durationMinutes price')
    .sort({ appointmentDate: -1, startTime: -1 })
    .lean();

  const { currentDateStr, currentMinutes } = getNowInAppTimezone();

  const formattedAppointments = appointments.map((apt) => {
    const dateStr = new Date(apt.appointmentDate).toISOString().split('T')[0];
    const aptStartMin = timeToMinutes(apt.startTime);
    const isPast =
      dateStr < currentDateStr || (dateStr === currentDateStr && aptStartMin <= currentMinutes);

    return {
      _id: apt._id,
      appointmentId: apt.appointmentId,
      appointmentDate: apt.appointmentDate,
      date: dateStr,
      startTime: apt.startTime,
      endTime: apt.endTime,
      status: apt.status,
      isPast,
      provider: apt.providerId
        ? {
            _id: apt.providerId._id,
            id: apt.providerId._id,
            name: apt.providerId.name,
            specialty: apt.providerId.specialty,
            location: apt.providerId.location
          }
        : null,
      service: apt.serviceId
        ? {
            _id: apt.serviceId._id,
            id: apt.serviceId._id,
            name: apt.serviceId.name,
            category: apt.serviceId.category,
            durationMinutes: apt.serviceId.durationMinutes,
            price: apt.serviceId.price
          }
        : null,
      reason: apt.reason,
      notes: apt.notes,
      createdAt: apt.createdAt
    };
  });

  if (timeframe === 'upcoming') {
    return formattedAppointments.filter((a) => !a.isPast && a.status === 'CONFIRMED');
  }

  if (timeframe === 'past') {
    return formattedAppointments.filter((a) => a.isPast || a.status !== 'CONFIRMED');
  }

  return formattedAppointments;
};

/**
 * Cancel an appointment (Milestone 6)
 * Strictly scoped to authenticated patient. Enforces status and policy window.
 */
const cancelAppointment = async ({ patientId, appointmentId, cancellationReason = '' }) => {
  if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
    const error = new Error('A valid authenticated patient identity is required');
    error.statusCode = 401;
    error.errorCode = 'UNAUTHENTICATED';
    throw error;
  }

  if (!appointmentId) {
    const error = new Error('Appointment identifier is required');
    error.statusCode = 400;
    error.errorCode = 'MISSING_APPOINTMENT_ID';
    throw error;
  }

  const appointment = await findAppointmentByIdentifier(appointmentId);
  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    error.errorCode = 'APPOINTMENT_NOT_FOUND';
    throw error;
  }

  // Strict ownership check: Only patient who owns the appointment may cancel
  if (appointment.userId.toString() !== patientId.toString()) {
    const error = new Error('Forbidden. You do not have permission to cancel this appointment.');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN_RESOURCE';
    throw error;
  }

  // Validate current status
  if (appointment.status === 'CANCELLED') {
    const error = new Error('This appointment has already been cancelled.');
    error.statusCode = 400;
    error.errorCode = 'APPOINTMENT_ALREADY_CANCELLED';
    throw error;
  }

  if (appointment.status === 'COMPLETED') {
    const error = new Error('Completed appointments cannot be cancelled.');
    error.statusCode = 400;
    error.errorCode = 'APPOINTMENT_ALREADY_COMPLETED';
    throw error;
  }

  if (appointment.status === 'NO_SHOW') {
    const error = new Error('No-show appointments cannot be cancelled.');
    error.statusCode = 400;
    error.errorCode = 'APPOINTMENT_MARKED_NO_SHOW';
    throw error;
  }

  if (appointment.status !== 'CONFIRMED') {
    const error = new Error(`Appointments with status '${appointment.status}' cannot be cancelled.`);
    error.statusCode = 400;
    error.errorCode = 'INVALID_APPOINTMENT_STATUS';
    throw error;
  }

  // Enforce configurable cancellation policy window
  const diffMinutes = getRemainingMinutesToAppointment(
    appointment.appointmentDate,
    appointment.startTime
  );

  if (diffMinutes < CANCELLATION_WINDOW_MINUTES) {
    const hours = Math.round(CANCELLATION_WINDOW_MINUTES / 60);
    const error = new Error(
      `Cancellation window has closed. Appointments cannot be cancelled less than ${hours} hours before the scheduled time.`
    );
    error.statusCode = 400;
    error.errorCode = 'CANCELLATION_WINDOW_EXPIRED';
    throw error;
  }

  // Update appointment record
  appointment.status = 'CANCELLED';
  appointment.cancellationReason = (cancellationReason || 'Schedule changed').trim();
  appointment.cancelledAt = new Date();
  await appointment.save();

  await appointment.populate('userId', 'name email');
  await appointment.populate('providerId', 'name specialty location consultationDuration');
  await appointment.populate('serviceId', 'name category durationMinutes price');

  const cancelBookingId = appointment.appointmentId || appointment._id.toString();
  const cancelUserEmail = appointment.userId?.email;
  const cancelPatientName = appointment.userId?.name || 'Patient';
  const cancelDoctorName = appointment.providerId?.name || 'Doctor';
  const cancelTime = appointment.startTime && appointment.endTime
    ? `${appointment.startTime} – ${appointment.endTime}`
    : appointment.startTime;

  sendCancellationEmail({
    userEmail: cancelUserEmail,
    patientName: cancelPatientName,
    doctorName: cancelDoctorName,
    appointmentDate: appointment.appointmentDate,
    time: cancelTime,
    bookingId: cancelBookingId,
    cancellationReason: appointment.cancellationReason
  }).then((res) => {
    console.log(`[Cancellation Route] Email result for booking ID ${cancelBookingId}:`, res);
  }).catch((err) => {
    console.error(`[Cancellation Route] Error sending email for booking ID ${cancelBookingId}:`, err.message);
  });

  const cancellationResult = {
    appointmentId: appointment.appointmentId,
    status: appointment.status,
    cancellationReason: appointment.cancellationReason,
    cancelledAt: appointment.cancelledAt,
    date: new Date(appointment.appointmentDate).toISOString().split('T')[0],
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    provider: appointment.providerId
      ? {
          _id: appointment.providerId._id,
          id: appointment.providerId._id,
          name: appointment.providerId.name,
          specialty: appointment.providerId.specialty,
          location: appointment.providerId.location
        }
      : null,
    service: appointment.serviceId
      ? {
          _id: appointment.serviceId._id,
          id: appointment.serviceId._id,
          name: appointment.serviceId.name,
          category: appointment.serviceId.category
        }
      : null
  };

  // Milestone 8: Reliable notification & email dispatch (Never blocks or rolls back cancelled appointment)
  notifyAppointmentCancelled({
    appointment,
    patient: null,
    provider: cancellationResult.provider,
    service: cancellationResult.service,
    cancellationReason: appointment.cancellationReason
  }).catch((notifErr) => {
    console.error('[Booking Engine] Cancellation notification dispatch notice:', notifErr.message);
  });

  return cancellationResult;
};

/**
 * Reschedule an appointment (Milestone 6)
 * Strictly scoped to authenticated patient. Atomically moves the appointment to a new available slot.
 * If target slot is unavailable or conflict occurs, original appointment remains unchanged!
 */
const rescheduleAppointment = async ({
  patientId,
  appointmentId,
  appointmentDate,
  startTime
}) => {
  // 1. Mandatory input sanity
  if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
    const error = new Error('A valid authenticated patient identity is required');
    error.statusCode = 401;
    error.errorCode = 'UNAUTHENTICATED';
    throw error;
  }

  if (!appointmentId) {
    const error = new Error('Appointment identifier is required');
    error.statusCode = 400;
    error.errorCode = 'MISSING_APPOINTMENT_ID';
    throw error;
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!startTime || !timeRegex.test(startTime)) {
    const error = new Error(`Invalid start time format: '${startTime}'. Expected HH:MM in 24-hour format`);
    error.statusCode = 400;
    error.errorCode = 'INVALID_TIME_FORMAT';
    throw error;
  }

  // 2. Validate calendar date for target reschedule
  const dateInfo = validateDate(appointmentDate);

  // 3. Locate existing appointment
  const appointment = await findAppointmentByIdentifier(appointmentId);
  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    error.errorCode = 'APPOINTMENT_NOT_FOUND';
    throw error;
  }

  // Store original date & time for reschedule notifications
  const previousDate = appointment.appointmentDate;
  const previousStartTime = appointment.startTime;

  // Strict ownership check
  if (appointment.userId.toString() !== patientId.toString()) {
    const error = new Error('Forbidden. You do not have permission to reschedule this appointment.');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN_RESOURCE';
    throw error;
  }

  // Validate status
  if (appointment.status !== 'CONFIRMED') {
    const error = new Error(
      `Only confirmed appointments can be rescheduled. Current status: '${appointment.status}'`
    );
    error.statusCode = 400;
    error.errorCode = 'INVALID_APPOINTMENT_STATUS';
    throw error;
  }

  // Check rescheduling policy window on original appointment
  const diffMinutes = getRemainingMinutesToAppointment(
    appointment.appointmentDate,
    appointment.startTime
  );

  if (diffMinutes < RESCHEDULE_WINDOW_MINUTES) {
    const hours = Math.round(RESCHEDULE_WINDOW_MINUTES / 60);
    const error = new Error(
      `Rescheduling window has closed. Appointments cannot be rescheduled less than ${hours} hours before the scheduled time.`
    );
    error.statusCode = 400;
    error.errorCode = 'RESCHEDULE_WINDOW_EXPIRED';
    throw error;
  }

  // 4. Provider & Service Relational Integrity
  const [provider, service] = await Promise.all([
    Provider.findById(appointment.providerId).lean(),
    Service.findById(appointment.serviceId).lean()
  ]);

  if (!provider) {
    const error = new Error('Provider associated with this appointment no longer exists');
    error.statusCode = 404;
    error.errorCode = 'PROVIDER_NOT_FOUND';
    throw error;
  }

  if (provider.status !== 'ACTIVE') {
    const error = new Error(`Provider '${provider.name}' is currently inactive`);
    error.statusCode = 400;
    error.errorCode = 'PROVIDER_NOT_ACTIVE';
    throw error;
  }

  if (!service) {
    const error = new Error('Service associated with this appointment no longer exists');
    error.statusCode = 404;
    error.errorCode = 'SERVICE_NOT_FOUND';
    throw error;
  }

  if (service.status !== 'ACTIVE') {
    const error = new Error(`Service '${service.name}' is currently inactive`);
    error.statusCode = 400;
    error.errorCode = 'SERVICE_NOT_ACTIVE';
    throw error;
  }

  // 5. Calculate new end time strictly from service duration (client-supplied endTime is disregarded)
  const duration = service.durationMinutes || provider.consultationDuration || 30;
  const startMin = timeToMinutes(startTime);
  const endMin = startMin + duration;

  if (endMin > 1440) {
    const error = new Error('Rescheduled appointment interval extends beyond the end of the day');
    error.statusCode = 400;
    error.errorCode = 'INTERVAL_EXCEEDS_DAY';
    throw error;
  }
  const calculatedEndTime = minutesToTime(endMin);

  // 6. Working Hours & Shift Verification for target date
  const activeShifts = await Availability.find({
    providerId: provider._id,
    dayOfWeek: dateInfo.dayOfWeek,
    isActive: true
  }).lean();

  if (activeShifts.length === 0) {
    const error = new Error(
      `Provider '${provider.name}' has no available working hours on ${dateInfo.dayOfWeek}s`
    );
    error.statusCode = 400;
    error.errorCode = 'PROVIDER_UNAVAILABLE_ON_DAY';
    throw error;
  }

  const fitsInShift = activeShifts.some((shift) => {
    const shiftStart = timeToMinutes(shift.startTime);
    const shiftEnd = timeToMinutes(shift.endTime);
    return startMin >= shiftStart && endMin <= shiftEnd;
  });

  if (!fitsInShift) {
    const error = new Error(
      `Requested time ${startTime}–${calculatedEndTime} falls outside provider working hours on ${dateInfo.dayOfWeek}`
    );
    error.statusCode = 400;
    error.errorCode = 'OUTSIDE_WORKING_HOURS';
    throw error;
  }

  // 7. Booking buffer check if target date is today
  const { currentMinutes } = getNowInAppTimezone();
  if (dateInfo.isToday) {
    if (startMin < currentMinutes) {
      const error = new Error(`Cannot reschedule to a time slot in the past (${startTime})`);
      error.statusCode = 400;
      error.errorCode = 'PAST_TIME';
      throw error;
    }
    if (startMin < currentMinutes + MIN_BOOKING_BUFFER_MINUTES) {
      const error = new Error(
        `Requested slot is within the ${MIN_BOOKING_BUFFER_MINUTES}-minute minimum advance booking buffer`
      );
      error.statusCode = 400;
      error.errorCode = 'BOOKING_BUFFER_RESTRICTION';
      throw error;
    }
  }

  // 8. Atomic Concurrency & Collision Check on target date
  const targetDate = new Date(Date.UTC(dateInfo.year, dateInfo.month - 1, dateInfo.day, 12, 0, 0, 0));
  const targetDateStart = new Date(Date.UTC(dateInfo.year, dateInfo.month - 1, dateInfo.day, 0, 0, 0, 0));
  const targetDateEnd = new Date(Date.UTC(dateInfo.year, dateInfo.month - 1, dateInfo.day, 23, 59, 59, 999));
  const lockKey = `${provider._id.toString()}_${appointmentDate}`;

  const hasTxSupport = await checkTransactionSupport();

  if (hasTxSupport) {
    // Replica Set ACID Transaction
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      let session = null;
      try {
        session = await mongoose.startSession();
        session.startTransaction();

        // Lock schedule for provider+date
        await BookingLock.findOneAndUpdate(
          { lockKey },
          {
            $inc: { version: 1 },
            $setOnInsert: { providerId: provider._id, date: appointmentDate }
          },
          { upsert: true, new: true, session }
        );

        // Find existing active appointments on target date EXCLUDING this appointment
        const existingAppointments = await Appointment.find({
          providerId: provider._id,
          appointmentDate: { $gte: targetDateStart, $lte: targetDateEnd },
          status: { $ne: 'CANCELLED' },
          _id: { $ne: appointment._id }
        })
          .session(session)
          .lean();

        // Overlap check
        const conflict = existingAppointments.find((apt) => {
          const aptStartMin = timeToMinutes(apt.startTime);
          const aptEndMin = timeToMinutes(apt.endTime);
          return isIntervalOverlapping(startMin, endMin, aptStartMin, aptEndMin);
        });

        if (conflict) {
          await session.abortTransaction();
          const error = new Error('Requested appointment time is no longer available. Slot conflict detected.');
          error.statusCode = 409;
          error.errorCode = 'SLOT_NO_LONGER_AVAILABLE';
          throw error;
        }

        // Atomically update the appointment
        const updatedAppointment = await Appointment.findByIdAndUpdate(
          appointment._id,
          {
            $set: {
              appointmentDate: targetDate,
              startTime,
              endTime: calculatedEndTime,
              updatedAt: new Date()
            }
          },
          { new: true, session }
        )
          .populate('userId', 'name email')
          .populate('providerId', 'name specialty location')
          .populate('serviceId', 'name category durationMinutes price');

        const txRescheduleBookingId = updatedAppointment.appointmentId || updatedAppointment._id.toString();
        const txRescheduleUserEmail = updatedAppointment.userId?.email;
        const txReschedulePatientName = updatedAppointment.userId?.name || 'Patient';
        const txRescheduleDoctorName = updatedAppointment.providerId?.name || provider.name || 'Doctor';
        const txRescheduleTime = updatedAppointment.startTime && updatedAppointment.endTime
          ? `${updatedAppointment.startTime} – ${updatedAppointment.endTime}`
          : updatedAppointment.startTime;

        sendRescheduleConfirmationEmail({
          userEmail: txRescheduleUserEmail,
          patientName: txReschedulePatientName,
          doctorName: txRescheduleDoctorName,
          appointmentDate: updatedAppointment.appointmentDate,
          time: txRescheduleTime,
          bookingId: txRescheduleBookingId
        }).then((res) => {
          console.log(`[Reschedule Route] Email result for booking ID ${txRescheduleBookingId}:`, res);
        }).catch((err) => {
          console.error(`[Reschedule Route] Error sending email for booking ID ${txRescheduleBookingId}:`, err.message);
        });

        await session.commitTransaction();

        const rescheduleResult = {
          appointmentId: updatedAppointment.appointmentId,
          date: appointmentDate,
          startTime: updatedAppointment.startTime,
          endTime: updatedAppointment.endTime,
          status: updatedAppointment.status,
          provider: {
            _id: provider._id,
            id: provider._id,
            name: provider.name,
            specialty: provider.specialty,
            location: provider.location
          },
          service: {
            _id: service._id,
            id: service._id,
            name: service.name,
            category: service.category,
            durationMinutes: duration,
            price: service.price
          },
          reason: updatedAppointment.reason,
          notes: updatedAppointment.notes,
          updatedAt: updatedAppointment.updatedAt
        };

        // Milestone 8: Reliable notification & email dispatch (Never blocks or rolls back rescheduled appointment)
        notifyAppointmentRescheduled({
          appointment: updatedAppointment,
          patient: null,
          provider: rescheduleResult.provider,
          service: rescheduleResult.service,
          previousDate,
          previousStartTime
        }).catch((notifErr) => {
          console.error('[Booking Engine] Reschedule notification dispatch notice:', notifErr.message);
        });

        return rescheduleResult;
      } catch (err) {
        if (session && session.inTransaction()) {
          await session.abortTransaction().catch(() => {});
        }
        const isTransientConflict =
          err.hasErrorLabel && err.hasErrorLabel('TransientTransactionError');
        const isWriteConflict =
          err.code === 112 || (err.message && err.message.includes('WriteConflict'));

        if ((isTransientConflict || isWriteConflict) && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 50 * attempt));
          continue;
        }
        throw err;
      } finally {
        if (session) {
          session.endSession();
        }
      }
    }
  } else {
    // Standalone Atomic Mutex Lock
    const lockToken = crypto.randomUUID();
    const leaseMs = 8000;
    const maxWaitMs = 5000;
    const startTimeAcquire = Date.now();
    let acquired = false;

    while (!acquired && Date.now() - startTimeAcquire < maxWaitMs) {
      try {
        const now = new Date();
        const staleThreshold = new Date(Date.now() - leaseMs);

        const lockDoc = await BookingLock.findOneAndUpdate(
          {
            lockKey,
            $or: [
              { isLocked: false },
              { isLocked: { $exists: false } },
              { lockedAt: { $lt: staleThreshold } }
            ]
          },
          {
            $set: { isLocked: true, lockedAt: now, holder: lockToken },
            $inc: { version: 1 },
            $setOnInsert: { providerId: provider._id, date: appointmentDate }
          },
          { upsert: true, new: true }
        );

        if (lockDoc && lockDoc.holder === lockToken) {
          acquired = true;
          break;
        }
      } catch (upsertErr) {
        // E11000 race
      }
      await new Promise((r) => setTimeout(r, 20));
    }

    if (!acquired) {
      const err = new Error('Could not acquire reschedule lock. Please try again.');
      err.statusCode = 409;
      throw err;
    }

    try {
      // Find existing active appointments on target date EXCLUDING this appointment
      const existingAppointments = await Appointment.find({
        providerId: provider._id,
        appointmentDate: { $gte: targetDateStart, $lte: targetDateEnd },
        status: { $ne: 'CANCELLED' },
        _id: { $ne: appointment._id }
      }).lean();

      const conflict = existingAppointments.find((apt) => {
        const aptStartMin = timeToMinutes(apt.startTime);
        const aptEndMin = timeToMinutes(apt.endTime);
        return isIntervalOverlapping(startMin, endMin, aptStartMin, aptEndMin);
      });

      if (conflict) {
        const error = new Error('Requested appointment time is no longer available. Slot conflict detected.');
        error.statusCode = 409;
        error.errorCode = 'SLOT_NO_LONGER_AVAILABLE';
        throw error;
      }

      const updatedAppointment = await Appointment.findByIdAndUpdate(
        appointment._id,
        {
          $set: {
            appointmentDate: targetDate,
            startTime,
            endTime: calculatedEndTime,
            updatedAt: new Date()
          }
        },
        { new: true }
      )
        .populate('userId', 'name email')
        .populate('providerId', 'name specialty location')
        .populate('serviceId', 'name category durationMinutes price');

      const standaloneRescheduleBookingId = updatedAppointment.appointmentId || updatedAppointment._id.toString();
      const standaloneRescheduleUserEmail = updatedAppointment.userId?.email;
      const standaloneReschedulePatientName = updatedAppointment.userId?.name || 'Patient';
      const standaloneRescheduleDoctorName = updatedAppointment.providerId?.name || provider.name || 'Doctor';
      const standaloneRescheduleTime = updatedAppointment.startTime && updatedAppointment.endTime
        ? `${updatedAppointment.startTime} – ${updatedAppointment.endTime}`
        : updatedAppointment.startTime;

      sendRescheduleConfirmationEmail({
        userEmail: standaloneRescheduleUserEmail,
        patientName: standaloneReschedulePatientName,
        doctorName: standaloneRescheduleDoctorName,
        appointmentDate: updatedAppointment.appointmentDate,
        time: standaloneRescheduleTime,
        bookingId: standaloneRescheduleBookingId
      }).then((res) => {
        console.log(`[Reschedule Route] Email result for booking ID ${standaloneRescheduleBookingId}:`, res);
      }).catch((err) => {
        console.error(`[Reschedule Route] Error sending email for booking ID ${standaloneRescheduleBookingId}:`, err.message);
      });

      const rescheduleResult = {
        appointmentId: updatedAppointment.appointmentId,
        date: appointmentDate,
        startTime: updatedAppointment.startTime,
        endTime: updatedAppointment.endTime,
        status: updatedAppointment.status,
        provider: {
          _id: provider._id,
          id: provider._id,
          name: provider.name,
          specialty: provider.specialty,
          location: provider.location
        },
        service: {
          _id: service._id,
          id: service._id,
          name: service.name,
          category: service.category,
          durationMinutes: duration,
          price: service.price
        },
        reason: updatedAppointment.reason,
        notes: updatedAppointment.notes,
        updatedAt: updatedAppointment.updatedAt
      };

      // Milestone 8: Reliable notification & email dispatch (Never blocks or rolls back rescheduled appointment)
      notifyAppointmentRescheduled({
        appointment: updatedAppointment,
        patient: null,
        provider: rescheduleResult.provider,
        service: rescheduleResult.service,
        previousDate,
        previousStartTime
      }).catch((notifErr) => {
        console.error('[Booking Engine] Reschedule notification dispatch notice:', notifErr.message);
      });

      return rescheduleResult;
    } finally {
      await BookingLock.updateOne(
        { lockKey, holder: lockToken },
        { $set: { isLocked: false, holder: null } }
      ).catch(() => {});
    }
  }
};

/**
 * Retrieve single appointment details for authenticated patient
 */
const getAppointmentById = async ({ appointmentId, patientId }) => {
  if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
    const error = new Error('A valid authenticated patient identity is required');
    error.statusCode = 401;
    error.errorCode = 'UNAUTHENTICATED';
    throw error;
  }

  const appointment = await findAppointmentByIdentifier(appointmentId);
  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    error.errorCode = 'APPOINTMENT_NOT_FOUND';
    throw error;
  }

  if (appointment.userId.toString() !== patientId.toString()) {
    const error = new Error('Forbidden. You do not have permission to access this appointment.');
    error.statusCode = 403;
    error.errorCode = 'FORBIDDEN_RESOURCE';
    throw error;
  }

  await appointment.populate('providerId', 'name specialty location consultationDuration');
  await appointment.populate('serviceId', 'name category durationMinutes price');

  const dateStr = new Date(appointment.appointmentDate).toISOString().split('T')[0];
  const { currentDateStr, currentMinutes } = getNowInAppTimezone();
  const aptStartMin = timeToMinutes(appointment.startTime);
  const isPast =
    dateStr < currentDateStr || (dateStr === currentDateStr && aptStartMin <= currentMinutes);

  return {
    _id: appointment._id,
    appointmentId: appointment.appointmentId,
    appointmentDate: appointment.appointmentDate,
    date: dateStr,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    status: appointment.status,
    isPast,
    provider: appointment.providerId
      ? {
          _id: appointment.providerId._id,
          id: appointment.providerId._id,
          name: appointment.providerId.name,
          specialty: appointment.providerId.specialty,
          location: appointment.providerId.location
        }
      : null,
    service: appointment.serviceId
      ? {
          _id: appointment.serviceId._id,
          id: appointment.serviceId._id,
          name: appointment.serviceId.name,
          category: appointment.serviceId.category,
          durationMinutes: appointment.serviceId.durationMinutes,
          price: appointment.serviceId.price
        }
      : null,
    reason: appointment.reason,
    notes: appointment.notes,
    cancellationReason: appointment.cancellationReason,
    cancelledAt: appointment.cancelledAt,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt
  };
};

module.exports = {
  bookAppointment,
  getPatientAppointments,
  cancelAppointment,
  rescheduleAppointment,
  getAppointmentById,
  generateAppointmentId,
  computeRequestHash,
  CANCELLATION_WINDOW_MINUTES,
  RESCHEDULE_WINDOW_MINUTES,
  getRemainingMinutesToAppointment
};

