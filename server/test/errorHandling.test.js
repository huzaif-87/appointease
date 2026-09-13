require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');
const { User, Service, Provider, Availability, Appointment } = require('../src/models');

/**
 * Frontend Error Mapper Unit & Contract Logic
 * Mirroring client/src/utils/errorMapper.js to test frontend mapping contracts directly
 */
const containsTechnicalDetails = (text) => {
  if (!text || typeof text !== 'string') return false;
  const technicalPatterns = [
    /ObjectId/i,
    /MongoDB/i,
    /MongoServerError/i,
    /E11000/i,
    /status code \d{3}/i,
    /Cast to/i,
    /syntaxerror/i,
    /typeerror/i,
    /stack trace/i,
    /at \w+ \(/i,
    /node_modules/i,
    /JWT/i,
    /Bearer/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i
  ];
  return technicalPatterns.some((pattern) => pattern.test(text));
};

const mapBookingError = (error) => {
  const statusCode = error?.statusCode || (error?.response?.status ?? null);
  const errorCode = error?.errorCode || error?.response?.data?.errorCode;
  const isNetwork = Boolean(error?.isNetworkError || statusCode === 0 || error?.code === 'ERR_NETWORK');

  if (isNetwork) {
    return {
      title: 'Connection Issue',
      message: "We couldn't connect to the booking service. Please check your connection and try again.",
      type: 'network',
      isSlotConflict: false,
      isSessionExpired: false,
      isNetworkError: true,
      canRetry: true,
      primaryAction: 'Try Again'
    };
  }

  if (statusCode === 409 || errorCode === 'SLOT_NO_LONGER_AVAILABLE') {
    if (errorCode === 'IDEMPOTENCY_CONFLICT') {
      return {
        title: 'Booking Already Processed',
        message: 'Your booking request was already processed.',
        type: 'idempotent',
        isSlotConflict: false,
        isSessionExpired: false,
        canRetry: false
      };
    }

    return {
      title: 'Time slot no longer available',
      message: 'This time slot was just booked by another patient. Please choose another available time.',
      type: 'conflict',
      isSlotConflict: true,
      isSessionExpired: false,
      canRetry: true,
      primaryAction: 'Refresh Availability',
      secondaryAction: 'Choose Another Time'
    };
  }

  if (statusCode === 401 || errorCode === 'SESSION_EXPIRED' || errorCode === 'UNAUTHENTICATED') {
    return {
      title: 'Session Expired',
      message: 'Your session has expired. Please sign in again.',
      type: 'session',
      isSlotConflict: false,
      isSessionExpired: true,
      canRetry: true,
      primaryAction: 'Sign In'
    };
  }

  if (statusCode === 403 || errorCode === 'FORBIDDEN_ROLE') {
    return {
      title: 'Access Restricted',
      message: "You don't have permission to perform this action.",
      type: 'permission',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: false
    };
  }

  if (errorCode === 'PROVIDER_NOT_FOUND' || errorCode === 'PROVIDER_NOT_ACTIVE') {
    return {
      title: 'Specialist Unavailable',
      message: 'This provider is no longer available.',
      type: 'notFound',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: false
    };
  }

  if (errorCode === 'SERVICE_NOT_FOUND' || errorCode === 'SERVICE_NOT_ACTIVE') {
    return {
      title: 'Service Unavailable',
      message: 'This service is no longer available.',
      type: 'notFound',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: false
    };
  }

  if (errorCode === 'SERVICE_NOT_OFFERED') {
    return {
      title: 'Service Not Offered',
      message: 'This provider does not offer the selected service.',
      type: 'validation',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: true
    };
  }

  if (errorCode === 'PROVIDER_UNAVAILABLE_ON_DAY' || errorCode === 'OUTSIDE_WORKING_HOURS') {
    return {
      title: 'Outside Working Hours',
      message: 'This provider is not available on the selected day.',
      type: 'validation',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: true
    };
  }

  if (
    errorCode === 'INVALID_DATE' ||
    errorCode === 'INVALID_DATE_FORMAT' ||
    errorCode === 'INVALID_CALENDAR_DATE' ||
    errorCode === 'PAST_DATE' ||
    errorCode === 'PAST_TIME' ||
    errorCode === 'INVALID_TIME_FORMAT' ||
    errorCode === 'BOOKING_BUFFER_RESTRICTION'
  ) {
    return {
      title: 'Invalid Schedule',
      message: 'Please choose a valid appointment date and time.',
      type: 'validation',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: true
    };
  }

  return {
    title: 'Booking Notice',
    message: 'Something went wrong while confirming your appointment. Please try again.',
    type: 'server',
    isSlotConflict: false,
    isSessionExpired: false,
    canRetry: true,
    primaryAction: 'Try Again'
  };
};

/**
 * M5 UX Refinement Test Suite
 */
const runErrorHandlingTests = async () => {
  console.log('====================================================');
  console.log('  AppointEase — M5 UX Refinement Test Suite         ');
  console.log('  User-Friendly Error Mapping & Conflict UX Tests   ');
  console.log('====================================================\n');

  let server;
  let baseUrl;
  let testCount = 0;
  let passCount = 0;
  let failCount = 0;

  const createdTestAppointmentIds = new Set();

  const assert = (scenarioLabel, description, condition, detail = '') => {
    testCount++;
    if (condition) {
      passCount++;
      console.log(`  ✓ [${scenarioLabel}]: ${description} ${detail ? `(${detail})` : ''}`);
    } else {
      failCount++;
      console.error(`  ✗ [${scenarioLabel}]: FAILED - ${description} ${detail ? `(${detail})` : ''}`);
    }
  };

  try {
    await connectDB();
    const initialAptCount = await Appointment.countDocuments();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    const makeRequest = async (path, options = {}) => {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(options.token && { Authorization: `Bearer ${options.token}` }),
          ...options.headers
        },
        method: options.method || 'GET',
        ...(options.body && { body: JSON.stringify(options.body) })
      });
      const data = await res.json().catch(() => null);
      return { status: res.status, data, headers: res.headers };
    };

    const patient = await User.findOne({ role: 'PATIENT' }).lean();
    const provider = await Provider.findOne({ status: 'ACTIVE' }).lean();
    const service = await Service.findOne({ _id: { $in: provider.serviceIds }, status: 'ACTIVE' }).lean();
    const shift = await Availability.findOne({ providerId: provider._id, isActive: true }).lean();

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayIndex = dayNames.indexOf(shift.dayOfWeek);

    const futureDateObj = new Date();
    futureDateObj.setDate(futureDateObj.getDate() + 10);
    while (futureDateObj.getDay() !== targetDayIndex) {
      futureDateObj.setDate(futureDateObj.getDate() + 1);
    }
    const testDate = futureDateObj.toISOString().split('T')[0];

    const jwtSecret = process.env.JWT_SECRET || 'development_appointease_secret_key_change_in_prod';
    const patientToken = jwt.sign(
      { id: patient._id.toString(), role: 'PATIENT', email: patient.email, name: patient.name },
      jwtSecret,
      { expiresIn: '2h' }
    );
    const providerToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), role: 'PROVIDER', email: 'prov@test.com' },
      jwtSecret,
      { expiresIn: '2h' }
    );

    // -------------------------------------------------------------
    // Test 1: Successful booking -> confirmation response (201)
    // -------------------------------------------------------------
    const res1 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientToken,
      body: {
        providerId: provider._id,
        serviceId: service._id,
        appointmentDate: testDate,
        startTime: shift.startTime,
        reason: 'Error handling suite test'
      }
    });
    const apt1 = res1.data?.data?.appointment;
    if (apt1?.appointmentId) createdTestAppointmentIds.add(apt1.appointmentId);
    assert('UX-1', 'Successful booking returns 201 with clean confirmation payload', res1.status === 201 && apt1?.appointmentId, `ID: ${apt1?.appointmentId}`);

    // -------------------------------------------------------------
    // Test 2: 409 Slot Conflict returns structured errorCode
    // -------------------------------------------------------------
    const res2 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientToken,
      body: {
        providerId: provider._id,
        serviceId: service._id,
        appointmentDate: testDate,
        startTime: shift.startTime // already booked
      }
    });
    assert(
      'UX-2',
      'Conflicting booking returns HTTP 409 with structured errorCode: SLOT_NO_LONGER_AVAILABLE',
      res2.status === 409 && res2.data?.errorCode === 'SLOT_NO_LONGER_AVAILABLE',
      `Status: ${res2.status}, Code: ${res2.data?.errorCode}`
    );

    // -------------------------------------------------------------
    // Test 3: 409 Conflict maps to user-friendly message without raw 409
    // -------------------------------------------------------------
    const mappedConflict = mapBookingError({
      statusCode: res2.status,
      errorCode: res2.data?.errorCode,
      message: res2.data?.message
    });
    const expectedTitle = 'Time slot no longer available';
    const expectedMsg = 'This time slot was just booked by another patient. Please choose another available time.';
    const noRawTechDetails =
      !containsTechnicalDetails(mappedConflict.title) &&
      !containsTechnicalDetails(mappedConflict.message) &&
      !mappedConflict.title.includes('409') &&
      !mappedConflict.message.includes('409');

    assert(
      'UX-3',
      '409 Conflict translates to friendly title & message with zero technical/status leak',
      mappedConflict.title === expectedTitle &&
        mappedConflict.message === expectedMsg &&
        mappedConflict.primaryAction === 'Refresh Availability' &&
        mappedConflict.secondaryAction === 'Choose Another Time' &&
        noRawTechDetails,
      `Title: "${mappedConflict.title}"`
    );

    // -------------------------------------------------------------
    // Test 4: Refresh Availability returns backend source of truth
    // -------------------------------------------------------------
    const res4 = await makeRequest(
      `/api/availability/slots?providerId=${provider._id}&serviceId=${service._id}&date=${testDate}`
    );
    const slots = res4.data?.data?.slots || [];
    const refreshedSlot = slots.find((s) => s.startTime === shift.startTime);
    assert(
      'UX-4',
      'GET /api/availability/slots called on refresh confirms newly booked slot is marked BOOKED',
      res4.status === 200 && refreshedSlot?.status === 'BOOKED',
      `Slot status: ${refreshedSlot?.status}`
    );

    // -------------------------------------------------------------
    // Test 5: 401 Session Expired maps to friendly session message
    // -------------------------------------------------------------
    const res5 = await makeRequest('/api/appointments', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid_or_expired_token' },
      body: { providerId: provider._id, serviceId: service._id, appointmentDate: testDate, startTime: '10:00' }
    });
    const mapped401 = mapBookingError({
      statusCode: res5.status,
      errorCode: res5.data?.errorCode
    });
    assert(
      'UX-5',
      '401 translates to friendly session-expired message with "Sign In" action',
      res5.status === 401 &&
        mapped401.message === 'Your session has expired. Please sign in again.' &&
        mapped401.primaryAction === 'Sign In',
      `Message: "${mapped401.message}"`
    );

    // -------------------------------------------------------------
    // Test 6: 403 Forbidden maps to friendly permission message
    // -------------------------------------------------------------
    const res6 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: providerToken,
      body: { providerId: provider._id, serviceId: service._id, appointmentDate: testDate, startTime: '10:00' }
    });
    const mapped403 = mapBookingError({
      statusCode: res6.status,
      errorCode: res6.data?.errorCode
    });
    assert(
      'UX-6',
      '403 translates to friendly permission message without exposing RBAC internals',
      res6.status === 403 && mapped403.message === "You don't have permission to perform this action.",
      `Message: "${mapped403.message}"`
    );

    // -------------------------------------------------------------
    // Test 7: 404 Provider & Service maps to clean resource message
    // -------------------------------------------------------------
    const mapped404Prov = mapBookingError({ errorCode: 'PROVIDER_NOT_FOUND', statusCode: 404 });
    const mapped404Serv = mapBookingError({ errorCode: 'SERVICE_NOT_FOUND', statusCode: 404 });
    assert(
      'UX-7',
      '404 provider/service translates to friendly unavailable resource message',
      mapped404Prov.message === 'This provider is no longer available.' &&
        mapped404Serv.message === 'This service is no longer available.',
      `Prov: "${mapped404Prov.message}", Serv: "${mapped404Serv.message}"`
    );

    // -------------------------------------------------------------
    // Test 8: Network failure maps to friendly connection message
    // -------------------------------------------------------------
    const mappedNetwork = mapBookingError({ isNetworkError: true, statusCode: 0 });
    assert(
      'UX-8',
      'Network failure maps to friendly connection message with "Try Again"',
      mappedNetwork.message === "We couldn't connect to the booking service. Please check your connection and try again." &&
        mappedNetwork.primaryAction === 'Try Again',
      `Message: "${mappedNetwork.message}"`
    );

    // -------------------------------------------------------------
    // Test 9: 500 Server error maps to safe generic message
    // -------------------------------------------------------------
    const rawErrorWithTrace = {
      statusCode: 500,
      message: 'MongoServerError: connection timed out at Connection.execute (node_modules/mongodb/lib/...)'
    };
    const mapped500 = mapBookingError(rawErrorWithTrace);
    assert(
      'UX-9',
      '500 Server error never exposes stack trace or MongoServerError; returns safe notice',
      mapped500.message === 'Something went wrong while confirming your appointment. Please try again.' &&
        !mapped500.message.includes('Mongo') &&
        !mapped500.message.includes('Connection'),
      `Safe message: "${mapped500.message}"`
    );

    // -------------------------------------------------------------
    // Test 10: Technical details detector validates clean output
    // -------------------------------------------------------------
    assert('UX-10', 'Technical leak detector correctly catches ObjectId and MongoDB traces',
      containsTechnicalDetails('Cast to ObjectId failed for value 6aa582a2') &&
      containsTechnicalDetails('MongoServerError: E11000 duplicate key') &&
      !containsTechnicalDetails(mappedConflict.message) &&
      !containsTechnicalDetails(mapped500.message)
    );

    // Cleanup test appointments
    await Appointment.deleteMany({
      appointmentId: { $in: Array.from(createdTestAppointmentIds) }
    });

    const finalAptCount = await Appointment.countDocuments();
    assert('UX-Cleanup', 'Database appointment count preserved at baseline', finalAptCount === initialAptCount, `Count: ${finalAptCount}, Baseline: ${initialAptCount}`);

    console.log('\n====================================================');
    console.log(`M5 UX Refinement Test Summary: ${passCount} Passed, ${failCount} Failed (Total: ${testCount})`);
    console.log('====================================================\n');

    server.close();
    await mongoose.connection.close();

    if (failCount > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('[UX Refinement Test Error]', err);
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

runErrorHandlingTests();
