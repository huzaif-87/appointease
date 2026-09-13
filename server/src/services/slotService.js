const mongoose = require('mongoose');
const { Provider, Service, Availability, Appointment } = require('../models');

// Application Timezone and Configurable Booking Buffer
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const MIN_BOOKING_BUFFER_MINUTES = parseInt(process.env.MIN_BOOKING_BUFFER_MINUTES, 10) || 30;

/**
 * Converts "HH:MM" 24-hour string to integer minutes from midnight
 */
const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Converts integer minutes from midnight to "HH:MM" 24-hour string
 */
const minutesToTime = (totalMinutes) => {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Returns current date and time components in the configured application timezone
 */
const getNowInAppTimezone = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const partMap = {};
  parts.forEach((p) => {
    partMap[p.type] = p.value;
  });

  const currentDateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const currentMinutes = parseInt(partMap.hour, 10) * 60 + parseInt(partMap.minute, 10);

  return {
    currentDateStr,
    currentMinutes
  };
};

/**
 * Validates a YYYY-MM-DD date string strictly against calendar reality and past-date rules
 */
const validateDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') {
    const error = new Error('Date parameter is required');
    error.statusCode = 400;
    error.errorCode = 'MISSING_DATE';
    throw error;
  }

  // Strict format check
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    const error = new Error("Invalid date format. Expected 'YYYY-MM-DD'");
    error.statusCode = 400;
    error.errorCode = 'INVALID_DATE_FORMAT';
    throw error;
  }

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    const error = new Error(`Invalid calendar date: '${dateStr}' is out of range`);
    error.statusCode = 400;
    error.errorCode = 'INVALID_CALENDAR_DATE';
    throw error;
  }

  // Verify real calendar days in month (e.g. February leap years, 30-day months)
  const testDate = new Date(Date.UTC(year, month - 1, day));
  if (
    testDate.getUTCFullYear() !== year ||
    testDate.getUTCMonth() !== month - 1 ||
    testDate.getUTCDate() !== day
  ) {
    const error = new Error(`Invalid calendar date: '${dateStr}' does not exist on the calendar`);
    error.statusCode = 400;
    error.errorCode = 'INVALID_CALENDAR_DATE';
    throw error;
  }

  // Past date validation compared to application timezone today
  const { currentDateStr } = getNowInAppTimezone();
  if (dateStr < currentDateStr) {
    const error = new Error(`Past dates cannot be booked. Selected date: '${dateStr}', Today: '${currentDateStr}'`);
    error.statusCode = 400;
    error.errorCode = 'PAST_DATE';
    throw error;
  }

  // Calculate day of the week in English
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[testDate.getUTCDay()];

  return {
    year,
    month,
    day,
    dayOfWeek,
    isToday: dateStr === currentDateStr
  };
};

/**
 * Interval overlap logic:
 * A candidate slot conflicts with an existing appointment if and only if:
 * candidateStart < aptEnd AND candidateEnd > aptStart
 */
const isIntervalOverlapping = (candidateStart, candidateEnd, aptStart, aptEnd) => {
  return candidateStart < aptEnd && candidateEnd > aptStart;
};

/**
 * Pure in-memory slot calculation function.
 * Evaluates shifts, duration, and booked intervals without database access.
 */
const generateCandidateSlots = ({
  shifts = [],
  duration = 30,
  bookedIntervals = [],
  isToday = false,
  currentMinutes = 0,
  minBookingBufferMinutes = MIN_BOOKING_BUFFER_MINUTES
}) => {
  const cutoffMinutes = isToday ? currentMinutes + minBookingBufferMinutes : -1;
  const generatedSlots = [];

  for (const shift of shifts) {
    const shiftStartMin = timeToMinutes(shift.startTime);
    const shiftEndMin = timeToMinutes(shift.endTime);

    for (let slotStart = shiftStartMin; slotStart + duration <= shiftEndMin; slotStart += duration) {
      const slotEnd = slotStart + duration;

      let slotStatus = 'AVAILABLE';
      let reason = null;

      // Check Past-Time / Minimum Booking Buffer for today
      if (isToday && slotStart < cutoffMinutes) {
        slotStatus = 'UNAVAILABLE';
        reason = slotStart < currentMinutes ? 'TIME_PASSED' : 'BOOKING_BUFFER_RESTRICTION';
      } else {
        // Check Interval Overlap against existing appointments
        const hasConflict = bookedIntervals.some((apt) =>
          isIntervalOverlapping(slotStart, slotEnd, apt.startMin, apt.endMin)
        );

        if (hasConflict) {
          slotStatus = 'BOOKED';
          reason = 'APPOINTMENT_COLLISION';
        }
      }

      generatedSlots.push({
        startTime: minutesToTime(slotStart),
        endTime: minutesToTime(slotEnd),
        status: slotStatus,
        ...(reason && { reason })
      });
    }
  }

  return generatedSlots;
};

/**
 * Core Slot Calculation Service
 * Generates available slots in-memory from provider availability, service duration, and existing bookings
 */
const calculateSlots = async ({ providerId, serviceId, date, excludeAppointmentId = null }) => {
  // 1. Validate ObjectIds
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    const error = new Error(`Invalid provider ID: '${providerId}'`);
    error.statusCode = 400;
    throw error;
  }

  if (!mongoose.Types.ObjectId.isValid(serviceId)) {
    const error = new Error(`Invalid service ID: '${serviceId}'`);
    error.statusCode = 400;
    throw error;
  }

  // 2. Validate Date Format and Temporal Constraints
  const dateInfo = validateDate(date);

  // 3. Batch Query Provider and Service (Single DB Roundtrip)
  const [provider, service] = await Promise.all([
    Provider.findById(providerId).lean(),
    Service.findById(serviceId).lean()
  ]);

  if (!provider) {
    const error = new Error('Provider not found');
    error.statusCode = 404;
    throw error;
  }

  if (provider.status !== 'ACTIVE') {
    const error = new Error(`Provider '${provider.name}' is currently ${provider.status.toLowerCase()} and cannot accept appointments`);
    error.statusCode = 400;
    throw error;
  }

  if (!service) {
    const error = new Error('Service not found');
    error.statusCode = 404;
    throw error;
  }

  if (service.status !== 'ACTIVE') {
    const error = new Error(`Service '${service.name}' is currently inactive`);
    error.statusCode = 400;
    throw error;
  }

  // 4. Verify Provider Offers Requested Service
  const offersService = (provider.serviceIds || []).some(
    (sId) => sId.toString() === serviceId.toString()
  );

  if (!offersService) {
    const error = new Error(`Provider '${provider.name}' does not offer '${service.name}'`);
    error.statusCode = 400;
    throw error;
  }

  // 5. Query Relevant Active Availability Shifts for that weekday
  const shifts = await Availability.find({
    providerId: provider._id,
    dayOfWeek: dateInfo.dayOfWeek,
    isActive: true
  })
    .sort({ startTime: 1 })
    .lean();

  if (shifts.length === 0) {
    return {
      provider: {
        id: provider._id,
        name: provider.name,
        specialty: provider.specialty,
        location: provider.location
      },
      service: {
        id: service._id,
        name: service.name,
        category: service.category,
        durationMinutes: service.durationMinutes,
        price: service.price
      },
      date,
      timezone: APP_TIMEZONE,
      workingHours: [],
      slotDurationMinutes: service.durationMinutes,
      slots: [],
      reason: 'PROVIDER_NOT_AVAILABLE',
      message: `Provider does not have working hours on ${dateInfo.dayOfWeek}s`
    };
  }

  // 6. Query Existing Appointments for that Provider & Date (Single DB Query)
  // Matching UTC date range for exact day
  const targetDateStart = new Date(Date.UTC(dateInfo.year, dateInfo.month - 1, dateInfo.day, 0, 0, 0, 0));
  const targetDateEnd = new Date(Date.UTC(dateInfo.year, dateInfo.month - 1, dateInfo.day, 23, 59, 59, 999));

  const aptQuery = {
    providerId: provider._id,
    appointmentDate: { $gte: targetDateStart, $lte: targetDateEnd },
    status: { $ne: 'CANCELLED' } // Cancelled appointments DO NOT block slots
  };

  // If rescheduling an existing appointment, exclude it from collision detection
  if (excludeAppointmentId) {
    if (mongoose.Types.ObjectId.isValid(excludeAppointmentId)) {
      aptQuery._id = { $ne: new mongoose.Types.ObjectId(excludeAppointmentId) };
    } else {
      aptQuery.appointmentId = { $ne: String(excludeAppointmentId).trim() };
    }
  }

  const existingAppointments = await Appointment.find(aptQuery)
    .select('startTime endTime status')
    .lean();

  const bookedIntervals = existingAppointments.map((apt) => ({
    startMin: timeToMinutes(apt.startTime),
    endMin: timeToMinutes(apt.endTime),
    status: apt.status
  }));

  // 7. Dynamic In-Memory Slot Generation
  const duration = service.durationMinutes || provider.consultationDuration || 30;
  const { currentMinutes } = getNowInAppTimezone();

  const workingHoursSummary = shifts.map((shift) => ({
    startTime: shift.startTime,
    endTime: shift.endTime,
    dayOfWeek: shift.dayOfWeek
  }));

  const generatedSlots = generateCandidateSlots({
    shifts,
    duration,
    bookedIntervals,
    isToday: dateInfo.isToday,
    currentMinutes,
    minBookingBufferMinutes: MIN_BOOKING_BUFFER_MINUTES
  });

  return {
    provider: {
      id: provider._id,
      name: provider.name,
      specialty: provider.specialty,
      location: provider.location
    },
    service: {
      id: service._id,
      name: service.name,
      category: service.category,
      durationMinutes: duration,
      price: service.price
    },
    date,
    dayOfWeek: dateInfo.dayOfWeek,
    timezone: APP_TIMEZONE,
    bookingBufferMinutes: MIN_BOOKING_BUFFER_MINUTES,
    workingHours: workingHoursSummary,
    slotDurationMinutes: duration,
    slots: generatedSlots,
    summary: {
      totalSlots: generatedSlots.length,
      availableSlots: generatedSlots.filter((s) => s.status === 'AVAILABLE').length,
      bookedSlots: generatedSlots.filter((s) => s.status === 'BOOKED').length,
      unavailableSlots: generatedSlots.filter((s) => s.status === 'UNAVAILABLE').length
    }
  };
};

module.exports = {
  calculateSlots,
  generateCandidateSlots,
  validateDate,
  timeToMinutes,
  minutesToTime,
  isIntervalOverlapping,
  getNowInAppTimezone,
  APP_TIMEZONE,
  MIN_BOOKING_BUFFER_MINUTES
};
