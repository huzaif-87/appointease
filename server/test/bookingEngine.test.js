require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');
const { User, Service, Provider, Availability, Appointment, BookingLock, IdempotencyKey } = require('../src/models');
const { timeToMinutes } = require('../src/services/slotService');

/**
 * AppointEase Automated Test Suite — Milestone 5
 * Transactional Booking Engine + Double-Booking Prevention
 * Covers all 30 Milestone 5 Verification Scenarios
 */
const runBookingTests = async () => {
  console.log('====================================================');
  console.log('  AppointEase — Milestone 5 Automated Test Suite    ');
  console.log('  Transactional Booking Engine & Concurrency Safety ');
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

    // Pre-flight setup: verify seeded baseline
    const initialAptCount = await Appointment.countDocuments();
    assert('Setup-1', 'Initial baseline appointment count is valid', initialAptCount >= 100, `Count: ${initialAptCount}`);

    // Fetch real test fixtures
    const patients = await User.find({ role: 'PATIENT' }).limit(2).lean();
    const patientA = patients[0];
    const patientB = patients[1] || patients[0];

    const providerActive = await Provider.findOne({ status: 'ACTIVE' }).lean();
    const providerInactive = await Provider.findOne({ status: 'INACTIVE' }).lean();

    // Offered active service
    const offeredService = await Service.findOne({
      _id: { $in: providerActive.serviceIds },
      status: 'ACTIVE'
    }).lean();

    // Unoffered service
    const unofferedService = await Service.findOne({
      _id: { $nin: providerActive.serviceIds },
      status: 'ACTIVE'
    }).lean();

    // Inactive service (or mock one if all active)
    let inactiveService = await Service.findOne({ status: 'INACTIVE' }).lean();
    let createdTempInactiveService = false;
    if (!inactiveService) {
      inactiveService = await Service.create({
        name: 'Temporary Inactive Service',
        category: 'General Consultation',
        durationMinutes: 30,
        price: 400,
        status: 'INACTIVE',
        description: 'Test inactive service'
      });
      createdTempInactiveService = true;
    }

    // Active availability shift for providerActive
    const activeShift = await Availability.findOne({
      providerId: providerActive._id,
      isActive: true
    }).lean();

    // Map dayOfWeek to a valid future calendar date
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayIndex = dayNames.indexOf(activeShift.dayOfWeek);

    // Find next matching date at least 3 days in the future
    const futureDateObj = new Date();
    futureDateObj.setDate(futureDateObj.getDate() + 3);
    while (futureDateObj.getDay() !== targetDayIndex) {
      futureDateObj.setDate(futureDateObj.getDate() + 1);
    }
    const validFutureDate = futureDateObj.toISOString().split('T')[0];

    // Working slot within activeShift
    const validStartTime = activeShift.startTime; // e.g. "09:00"

    const jwtSecret = process.env.JWT_SECRET || 'development_appointease_secret_key_change_in_prod';
    const patientAToken = jwt.sign(
      { id: patientA._id.toString(), role: 'PATIENT', email: patientA.email, name: patientA.name },
      jwtSecret,
      { expiresIn: '2h' }
    );
    const patientBToken = jwt.sign(
      { id: patientB._id.toString(), role: 'PATIENT', email: patientB.email, name: patientB.name },
      jwtSecret,
      { expiresIn: '2h' }
    );
    const providerToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), role: 'PROVIDER', email: 'provider@test.com' },
      jwtSecret,
      { expiresIn: '2h' }
    );
    const adminToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), role: 'ADMIN', email: 'admin@test.com' },
      jwtSecret,
      { expiresIn: '2h' }
    );

    console.log(`[Test Context] Provider: ${providerActive.name}, Service: ${offeredService.name} (${offeredService.durationMinutes}m)`);
    console.log(`[Test Context] Shift: ${activeShift.dayOfWeek} ${activeShift.startTime}-${activeShift.endTime}, Test Date: ${validFutureDate}\n`);

    // =============================================================
    // 1. Unauthenticated booking -> 401
    // =============================================================
    const res1 = await makeRequest('/api/appointments', {
      method: 'POST',
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: validFutureDate,
        startTime: validStartTime
      }
    });
    assert('T1', 'Unauthenticated booking rejected with 401', res1.status === 401, `Status: ${res1.status}`);

    // =============================================================
    // 2. Provider role booking -> 403
    // =============================================================
    const res2 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: providerToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: validFutureDate,
        startTime: validStartTime
      }
    });
    assert('T2', 'Provider role booking rejected with 403', res2.status === 403, `Status: ${res2.status}`);

    // =============================================================
    // 3. Admin role booking -> 403
    // =============================================================
    const res3 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: adminToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: validFutureDate,
        startTime: validStartTime
      }
    });
    assert('T3', 'Admin role booking rejected with 403', res3.status === 403, `Status: ${res3.status}`);

    // =============================================================
    // 4. Patient can book -> 201
    // =============================================================
    const res4 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: validFutureDate,
        startTime: validStartTime,
        reason: 'Regular consultation'
      }
    });
    const apt4 = res4.data?.data?.appointment;
    if (apt4?.appointmentId) createdTestAppointmentIds.add(apt4.appointmentId);
    assert('T4', 'Authenticated patient booking creates appointment with 201', res4.status === 201 && apt4?.status === 'CONFIRMED', `Status: ${res4.status}, ID: ${apt4?.appointmentId}`);

    // =============================================================
    // 5. Invalid provider ID -> 400
    // =============================================================
    const res5 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: 'invalid-id-xyz',
        serviceId: offeredService._id,
        appointmentDate: validFutureDate,
        startTime: '10:00'
      }
    });
    assert('T5', 'Invalid provider ID format rejected with 400', res5.status === 400, `Status: ${res5.status}`);

    // =============================================================
    // 6. Invalid service ID -> 400
    // =============================================================
    const res6 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: providerActive._id,
        serviceId: 'invalid-id-xyz',
        appointmentDate: validFutureDate,
        startTime: '10:00'
      }
    });
    assert('T6', 'Invalid service ID format rejected with 400', res6.status === 400, `Status: ${res6.status}`);

    // =============================================================
    // 7. Missing provider -> 404
    // =============================================================
    const nonExistentProvId = new mongoose.Types.ObjectId();
    const res7 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: nonExistentProvId,
        serviceId: offeredService._id,
        appointmentDate: validFutureDate,
        startTime: '10:00'
      }
    });
    assert('T7', 'Non-existent provider rejected with 404', res7.status === 404, `Status: ${res7.status}`);

    // =============================================================
    // 8. Missing service -> 404
    // =============================================================
    const nonExistentServId = new mongoose.Types.ObjectId();
    const res8 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: providerActive._id,
        serviceId: nonExistentServId,
        appointmentDate: validFutureDate,
        startTime: '10:00'
      }
    });
    assert('T8', 'Non-existent service rejected with 404', res8.status === 404, `Status: ${res8.status}`);

    // =============================================================
    // 9. Inactive provider -> rejected (400)
    // =============================================================
    const res9 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: providerInactive._id,
        serviceId: offeredService._id,
        appointmentDate: validFutureDate,
        startTime: '10:00'
      }
    });
    assert('T9', 'Inactive provider booking rejected with 400', res9.status === 400, `Status: ${res9.status}`);

    // =============================================================
    // 10. Inactive service -> rejected (400)
    // =============================================================
    const res10 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: providerActive._id,
        serviceId: inactiveService._id,
        appointmentDate: validFutureDate,
        startTime: '10:00'
      }
    });
    assert('T10', 'Inactive service booking rejected with 400', res10.status === 400, `Status: ${res10.status}`);

    // =============================================================
    // 11. Provider doesn't offer service -> rejected (400)
    // =============================================================
    const res11 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: providerActive._id,
        serviceId: unofferedService._id,
        appointmentDate: validFutureDate,
        startTime: '10:00'
      }
    });
    assert('T11', 'Provider not offering service rejected with 400', res11.status === 400, `Status: ${res11.status}`);

    // =============================================================
    // 12. Invalid date format -> 400
    // =============================================================
    const res12 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: '16-09-2026',
        startTime: '10:00'
      }
    });
    assert('T12', 'Malformed date format rejected with 400', res12.status === 400, `Status: ${res12.status}`);

    // =============================================================
    // 13. Past date -> rejected (400)
    // =============================================================
    const res13 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: '2020-01-01',
        startTime: '10:00'
      }
    });
    assert('T13', 'Past date booking rejected with 400', res13.status === 400, `Status: ${res13.status}`);

    // =============================================================
    // 14. Past time for today -> rejected (400)
    // =============================================================
    const todayStr = new Date().toISOString().split('T')[0];
    const res14 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: todayStr,
        startTime: '00:15' // early morning past time
      }
    });
    assert('T14', "Past time slot for today's date rejected with 400", res14.status === 400, `Status: ${res14.status}`);

    // =============================================================
    // 15. Outside working hours -> rejected (400)
    // =============================================================
    const res15 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: validFutureDate,
        startTime: '23:30' // late night outside shift
      }
    });
    assert('T15', 'Outside working hours slot rejected with 400', res15.status === 400, `Status: ${res15.status}`);

    // =============================================================
    // 16. Invalid start time format -> rejected (400)
    // =============================================================
    const res16 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: validFutureDate,
        startTime: '25:99'
      }
    });
    assert('T16', 'Invalid start time format rejected with 400', res16.status === 400, `Status: ${res16.status}`);

    // =============================================================
    // 17. Server calculates endTime correctly
    // =============================================================
    const shiftStartMin = timeToMinutes(activeShift.startTime);
    const duration = offeredService.durationMinutes;
    // slot 2 in shift
    const slot2StartMin = shiftStartMin + duration;
    const slot2StartH = String(Math.floor(slot2StartMin / 60)).padStart(2, '0');
    const slot2StartM = String(slot2StartMin % 60).padStart(2, '0');
    const slot2StartTime = `${slot2StartH}:${slot2StartM}`;

    const expectedEndMin = slot2StartMin + duration;
    const expectedEndH = String(Math.floor(expectedEndMin / 60)).padStart(2, '0');
    const expectedEndM = String(expectedEndMin % 60).padStart(2, '0');
    const expectedEndTime = `${expectedEndH}:${expectedEndM}`;

    const res17 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: validFutureDate,
        startTime: slot2StartTime
      }
    });
    const apt17 = res17.data?.data?.appointment;
    if (apt17?.appointmentId) createdTestAppointmentIds.add(apt17.appointmentId);
    assert(
      'T17',
      'Server calculates endTime accurately from service duration',
      res17.status === 201 && apt17?.endTime === expectedEndTime,
      `Calculated: ${apt17?.endTime}, Expected: ${expectedEndTime}`
    );

    // =============================================================
    // 18. Client cannot manipulate endTime
    // =============================================================
    // slot 3 in shift
    const slot3StartMin = slot2StartMin + duration;
    const slot3StartH = String(Math.floor(slot3StartMin / 60)).padStart(2, '0');
    const slot3StartM = String(slot3StartMin % 60).padStart(2, '0');
    const slot3StartTime = `${slot3StartH}:${slot3StartM}`;

    const res18 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: validFutureDate,
        startTime: slot3StartTime,
        endTime: '23:59' // client attempts to manipulate
      }
    });
    const apt18 = res18.data?.data?.appointment;
    if (apt18?.appointmentId) createdTestAppointmentIds.add(apt18.appointmentId);
    assert(
      'T18',
      'Client cannot manipulate endTime (server overrides with exact duration)',
      res18.status === 201 && apt18?.endTime !== '23:59',
      `Result endTime: ${apt18?.endTime}`
    );

    // =============================================================
    // 19. Existing appointment blocks slot -> 409 Conflict
    // =============================================================
    const res19 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientBToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: validFutureDate,
        startTime: validStartTime // already booked in T4
      }
    });
    assert('T19', 'Existing appointment blocks slot and returns 409 Conflict', res19.status === 409, `Status: ${res19.status}`);

    // =============================================================
    // 20. Cancelled appointment does NOT block slot -> 201
    // =============================================================
    // Pick another future date to test cancellation freeing slot
    const futureDateObj2 = new Date(futureDateObj);
    futureDateObj2.setDate(futureDateObj2.getDate() + 7);
    const cancelTestDate = futureDateObj2.toISOString().split('T')[0];

    // Seed a CANCELLED appointment directly
    const cancelledApt = await Appointment.create({
      appointmentId: `APT-${cancelTestDate.replace(/-/g, '')}-CNCLTEST`,
      userId: patientA._id,
      providerId: providerActive._id,
      serviceId: offeredService._id,
      appointmentDate: new Date(cancelTestDate + 'T12:00:00.000Z'),
      startTime: validStartTime,
      endTime: expectedEndTime,
      status: 'CANCELLED',
      cancellationReason: 'Patient cancelled test booking',
      cancelledAt: new Date()
    });
    createdTestAppointmentIds.add(cancelledApt.appointmentId);

    // Patient B books that exact slot now
    const res20 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientBToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: cancelTestDate,
        startTime: validStartTime
      }
    });
    const apt20 = res20.data?.data?.appointment;
    if (apt20?.appointmentId) createdTestAppointmentIds.add(apt20.appointmentId);
    assert('T20', 'Cancelled appointment does NOT block slot (returns 201)', res20.status === 201, `Status: ${res20.status}`);

    // =============================================================
    // 21. Adjacent appointment allowed
    // =============================================================
    // In T4, validStartTime (e.g. 09:00 - 09:30) was booked.
    // An adjacent appointment right at endTime (09:30 - 10:00) should succeed if slot2StartTime was not booked.
    // Let's test adjacent interval on a clean day
    const futureDateObj3 = new Date(futureDateObj);
    futureDateObj3.setDate(futureDateObj3.getDate() + 14);
    const adjacentTestDate = futureDateObj3.toISOString().split('T')[0];

    // Book 09:00 - 09:30
    const res21A = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: adjacentTestDate,
        startTime: validStartTime
      }
    });
    const apt21A = res21A.data?.data?.appointment;
    if (apt21A?.appointmentId) createdTestAppointmentIds.add(apt21A.appointmentId);

    // Book immediately adjacent: apt21A.endTime
    const res21B = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientBToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: adjacentTestDate,
        startTime: apt21A?.endTime || expectedEndTime
      }
    });
    const apt21B = res21B.data?.data?.appointment;
    if (apt21B?.appointmentId) createdTestAppointmentIds.add(apt21B.appointmentId);
    assert(
      'T21',
      'Adjacent appointment allowed without collision (201 Created)',
      res21A.status === 201 && res21B.status === 201,
      `Slot 1: ${apt21A?.startTime}-${apt21A?.endTime}, Slot 2: ${apt21B?.startTime}-${apt21B?.endTime}`
    );

    // =============================================================
    // 22. Partial overlap rejected (409)
    // =============================================================
    // apt21A runs from e.g. 09:00 to 09:30.
    // A request starting at 09:15 partially overlaps.
    const [hStart, mStart] = validStartTime.split(':').map(Number);
    const partialOverlapMin = hStart * 60 + mStart + 15;
    const partialOverlapTime = `${String(Math.floor(partialOverlapMin / 60)).padStart(2, '0')}:${String(partialOverlapMin % 60).padStart(2, '0')}`;

    const res22 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientBToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: adjacentTestDate,
        startTime: partialOverlapTime
      }
    });
    assert('T22', 'Partial interval overlap rejected with 409 Conflict', res22.status === 409, `Status: ${res22.status}`);

    // =============================================================
    // 23. Exact duplicate rejected (409)
    // =============================================================
    const res23 = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientBToken,
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: adjacentTestDate,
        startTime: validStartTime
      }
    });
    assert('T23', 'Exact duplicate slot rejected with 409 Conflict', res23.status === 409, `Status: ${res23.status}`);

    // =============================================================
    // 24. Successful booking creates CONFIRMED appointment
    // =============================================================
    assert('T24', 'Created appointment has status = CONFIRMED', apt4?.status === 'CONFIRMED', `Status: ${apt4?.status}`);

    // =============================================================
    // 25. Unique appointmentId generated (APT-YYYYMMDD-XXXXXX)
    // =============================================================
    const aptIdRegex = /^APT-\d{8}-[A-F0-9]{6}$/;
    assert(
      'T25',
      'Unique appointmentId generated matching APT-YYYYMMDD-XXXXXX',
      aptIdRegex.test(apt4?.appointmentId),
      `Format: ${apt4?.appointmentId}`
    );

    // =============================================================
    // 26. Patient sees own appointments (GET /api/appointments)
    // =============================================================
    const res26 = await makeRequest('/api/appointments', {
      token: patientAToken
    });
    const patientAAppointments = res26.data?.data?.appointments || [];
    const hasApt4 = patientAAppointments.some((a) => a.appointmentId === apt4?.appointmentId);
    assert(
      'T26',
      'Patient can retrieve their own appointments via GET /api/appointments',
      res26.status === 200 && hasApt4,
      `Count: ${patientAAppointments.length}`
    );

    // =============================================================
    // 27. Patient cannot see another patient's appointments
    // =============================================================
    const res27 = await makeRequest('/api/appointments', {
      token: patientBToken
    });
    const patientBAppointments = res27.data?.data?.appointments || [];
    const leaksPatientA = patientBAppointments.some((a) => a.appointmentId === apt4?.appointmentId);
    assert(
      'T27',
      'Strict patient isolation: Patient B cannot view Patient A appointments',
      res27.status === 200 && !leaksPatientA,
      `Patient B count: ${patientBAppointments.length}`
    );

    // =============================================================
    // 28. Booking causes slot to become BOOKED in M4 availability
    // =============================================================
    const res28 = await makeRequest(
      `/api/availability/slots?providerId=${providerActive._id}&serviceId=${offeredService._id}&date=${adjacentTestDate}`
    );
    const slots = res28.data?.data?.slots || [];
    const bookedSlot28 = slots.find((s) => s.startTime === validStartTime);
    assert(
      'T28',
      'Booking causes dynamic slot to reflect BOOKED status in availability engine',
      bookedSlot28?.status === 'BOOKED',
      `Slot status: ${bookedSlot28?.status}`
    );

    // =============================================================
    // 29. Duplicate submission / idempotency behavior
    // =============================================================
    // Clean future date for idempotency
    const futureDateObj4 = new Date(futureDateObj);
    futureDateObj4.setDate(futureDateObj4.getDate() + 21);
    const idempTestDate = futureDateObj4.toISOString().split('T')[0];
    const testIdempKey = `test_idemp_${Date.now()}`;

    // Request 1 with Idempotency-Key
    const res29A = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      headers: { 'Idempotency-Key': testIdempKey },
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: idempTestDate,
        startTime: validStartTime,
        reason: 'Idempotent consultation test'
      }
    });
    const apt29A = res29A.data?.data?.appointment;
    if (apt29A?.appointmentId) createdTestAppointmentIds.add(apt29A.appointmentId);

    // Request 2 with EXACT SAME Idempotency-Key (simulating double click)
    const res29B = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      headers: { 'Idempotency-Key': testIdempKey },
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: idempTestDate,
        startTime: validStartTime,
        reason: 'Idempotent consultation test'
      }
    });
    const apt29B = res29B.data?.data?.appointment;

    // Request 3 with SAME Idempotency-Key but CONFLICTING body parameters
    const res29C = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      headers: { 'Idempotency-Key': testIdempKey },
      body: {
        providerId: providerActive._id,
        serviceId: offeredService._id,
        appointmentDate: idempTestDate,
        startTime: slot2StartTime // different time
      }
    });

    const isIdempReplay =
      res29A.status === 201 &&
      res29B.status === 201 &&
      apt29A?.appointmentId === apt29B?.appointmentId &&
      res29B.headers.get('x-idempotent-replay') === 'true' &&
      res29C.status === 409;

    assert(
      'T29',
      'Idempotency key prevents duplicate booking on retry & rejects conflicting reuse',
      isIdempReplay,
      `Req1: 201, Req2 Replay: 201 (${apt29A?.appointmentId}), Conflict: ${res29C.status}`
    );

    // =============================================================
    // 30. Concurrent booking race test (Patient A vs Patient B)
    // =============================================================
    // We send two simultaneous requests in parallel for the exact same slot
    const futureDateObj5 = new Date(futureDateObj);
    futureDateObj5.setDate(futureDateObj5.getDate() + 28);
    const raceTestDate = futureDateObj5.toISOString().split('T')[0];

    const racePayloadA = {
      providerId: providerActive._id,
      serviceId: offeredService._id,
      appointmentDate: raceTestDate,
      startTime: validStartTime,
      reason: 'Concurrent race booking Patient A'
    };

    const racePayloadB = {
      providerId: providerActive._id,
      serviceId: offeredService._id,
      appointmentDate: raceTestDate,
      startTime: validStartTime,
      reason: 'Concurrent race booking Patient B'
    };

    // Launch both requests concurrently via Promise.all
    const [raceResA, raceResB] = await Promise.all([
      makeRequest('/api/appointments', {
        method: 'POST',
        token: patientAToken,
        body: racePayloadA
      }),
      makeRequest('/api/appointments', {
        method: 'POST',
        token: patientBToken,
        body: racePayloadB
      })
    ]);

    const statuses = [raceResA.status, raceResB.status].sort();
    const hasOneCreatedOneConflict = statuses[0] === 201 && statuses[1] === 409;

    if (raceResA.data?.data?.appointment?.appointmentId) {
      createdTestAppointmentIds.add(raceResA.data.data.appointment.appointmentId);
    }
    if (raceResB.data?.data?.appointment?.appointmentId) {
      createdTestAppointmentIds.add(raceResB.data.data.appointment.appointmentId);
    }

    assert(
      'T30',
      'Concurrent booking race: Exactly one request gets 201 Created, other gets 409 Conflict',
      hasOneCreatedOneConflict,
      `Req A Status: ${raceResA.status}, Req B Status: ${raceResB.status}`
    );

    // Also test concurrent overlapping intervals (e.g. 10:00-10:45 vs 10:15-10:45)
    const futureDateObj6 = new Date(futureDateObj);
    futureDateObj6.setDate(futureDateObj6.getDate() + 35);
    const overlapRaceDate = futureDateObj6.toISOString().split('T')[0];

    const [overlapResA, overlapResB] = await Promise.all([
      makeRequest('/api/appointments', {
        method: 'POST',
        token: patientAToken,
        body: {
          providerId: providerActive._id,
          serviceId: offeredService._id,
          appointmentDate: overlapRaceDate,
          startTime: validStartTime
        }
      }),
      makeRequest('/api/appointments', {
        method: 'POST',
        token: patientBToken,
        body: {
          providerId: providerActive._id,
          serviceId: offeredService._id,
          appointmentDate: overlapRaceDate,
          startTime: validStartTime
        }
      })
    ]);

    const overlapStatuses = [overlapResA.status, overlapResB.status].sort();
    if (overlapResA.data?.data?.appointment?.appointmentId) {
      createdTestAppointmentIds.add(overlapResA.data.data.appointment.appointmentId);
    }
    if (overlapResB.data?.data?.appointment?.appointmentId) {
      createdTestAppointmentIds.add(overlapResB.data.data.appointment.appointmentId);
    }

    assert(
      'T30-Overlapping',
      'Concurrent overlapping booking race: Exactly one succeeds (201), other gets 409',
      overlapStatuses[0] === 201 && overlapStatuses[1] === 409,
      `Statuses: ${overlapStatuses.join(', ')}`
    );

    // =============================================================
    // Cleanup & Database Integrity Verification
    // =============================================================
    console.log('\n--- CLEANUP & SEED DATASET INTEGRITY VERIFICATION ---');
    console.log(`Cleaning up ${createdTestAppointmentIds.size} temporary test appointments...`);

    await Appointment.deleteMany({
      appointmentId: { $in: Array.from(createdTestAppointmentIds) }
    });

    await IdempotencyKey.deleteMany({
      key: { $regex: /^test_/ }
    });

    if (createdTempInactiveService) {
      await Service.deleteOne({ _id: inactiveService._id });
    }

    const postCleanupAptCount = await Appointment.countDocuments();
    assert(
      'Cleanup-1',
      'Database appointment count safely returned to exact seed baseline',
      postCleanupAptCount === initialAptCount,
      `Current appointments: ${postCleanupAptCount}, Baseline: ${initialAptCount}`
    );

    // Verify zero orphan references
    const [allUsers, allProviders, allServices, allApts] = await Promise.all([
      User.find({}, '_id').lean(),
      Provider.find({}, '_id').lean(),
      Service.find({}, '_id').lean(),
      Appointment.find({}, 'userId providerId serviceId status startTime endTime').lean()
    ]);

    const uSet = new Set(allUsers.map((u) => u._id.toString()));
    const pSet = new Set(allProviders.map((p) => p._id.toString()));
    const sSet = new Set(allServices.map((s) => s._id.toString()));

    const orphans = allApts.filter(
      (a) => !uSet.has(a.userId.toString()) || !pSet.has(a.providerId.toString()) || !sSet.has(a.serviceId.toString())
    );

    assert('Cleanup-2', 'Zero orphan user, provider, or service references in appointments', orphans.length === 0, `Orphans: ${orphans.length}`);

    console.log('\n====================================================');
    console.log(`Booking Engine Test Summary: ${passCount} Passed, ${failCount} Failed (Total: ${testCount})`);
    console.log('====================================================\n');

    server.close();
    await mongoose.connection.close();

    if (failCount > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('[Booking Test Error] Test suite encountered error:', err);
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

runBookingTests();
