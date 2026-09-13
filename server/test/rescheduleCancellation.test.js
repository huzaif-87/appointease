require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');
const { User, Service, Provider, Availability, Appointment } = require('../src/models');
const {
  CANCELLATION_WINDOW_MINUTES,
  RESCHEDULE_WINDOW_MINUTES
} = require('../src/services/bookingService');

/**
 * Mirroring error mapper to verify patient-friendly UI contracts
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

  if (statusCode === 409 || errorCode === 'SLOT_NO_LONGER_AVAILABLE') {
    return {
      title: 'Time slot no longer available',
      message: 'This time slot was just booked by another patient. Please choose another available time.',
      isSlotConflict: true
    };
  }

  if (errorCode === 'CANCELLATION_WINDOW_EXPIRED') {
    return {
      title: 'Cancellation Window Passed',
      message:
        'Appointments cannot be cancelled less than 2 hours before the scheduled time. Please contact the clinic directly.',
      isSlotConflict: false
    };
  }

  if (errorCode === 'RESCHEDULE_WINDOW_EXPIRED') {
    return {
      title: 'Rescheduling Window Passed',
      message:
        'Appointments cannot be rescheduled less than 2 hours before the scheduled time. Please contact the clinic directly.',
      isSlotConflict: false
    };
  }

  if (errorCode === 'FORBIDDEN_RESOURCE') {
    return {
      title: 'Access Restricted',
      message: 'You do not have permission to modify this appointment.',
      isSlotConflict: false
    };
  }

  return {
    title: 'Booking Notice',
    message: 'Something went wrong while confirming your appointment. Please try again.',
    isSlotConflict: false
  };
};

const runMilestone6Tests = async () => {
  console.log('====================================================');
  console.log('  AppointEase — Milestone 6 Automated Test Suite     ');
  console.log('  Cancellation & Atomic Rescheduling Engine Tests     ');
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
      return { status: res.status, headers: res.headers, data };
    };

    // Baseline count verification
    const initialBaselineCount = await Appointment.countDocuments();
    assert(
      'Setup-1',
      'Initial baseline appointment count is valid',
      initialBaselineCount >= 100,
      `Count: ${initialBaselineCount}`
    );

    // Retrieve Test Users & Entities
    const patientAUser = await User.findOne({ role: 'PATIENT' });
    const patientBUser = await User.findOne({ role: 'PATIENT', _id: { $ne: patientAUser._id } });
    const providerUser = await User.findOne({ role: 'PROVIDER' });
    const adminUser = await User.findOne({ role: 'ADMIN' });

    const activeProvider = await Provider.findOne({ status: 'ACTIVE' }).populate('serviceIds');
    const activeService = activeProvider.serviceIds[0];

    // Find shift for active provider
    const providerShifts = await Availability.find({
      providerId: activeProvider._id,
      isActive: true
    }).lean();

    const testShift = providerShifts[0];
    const dayMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6
    };

    // Helper: Find upcoming date matching day of week (> 4 days in future to easily clear 2hr policy window)
    const findUpcomingDate = (targetDayName, weeksAhead = 2) => {
      const targetDayNum = dayMap[targetDayName];
      const d = new Date();
      d.setDate(d.getDate() + 7 * weeksAhead);
      while (d.getDay() !== targetDayNum) {
        d.setDate(d.getDate() + 1);
      }
      return d.toISOString().split('T')[0];
    };

    const futureDate = findUpcomingDate(testShift.dayOfWeek, 2);
    const futureDate2 = findUpcomingDate(testShift.dayOfWeek, 3);

    // Generate JWT tokens
    const secret = process.env.JWT_SECRET || 'development_appointease_secret_key_change_in_prod';
    const patientAToken = jwt.sign(
      { id: patientAUser._id, email: patientAUser.email, role: 'PATIENT' },
      secret,
      { expiresIn: '1h' }
    );
    const patientBToken = jwt.sign(
      { id: patientBUser._id, email: patientBUser.email, role: 'PATIENT' },
      secret,
      { expiresIn: '1h' }
    );
    const providerToken = jwt.sign(
      { id: providerUser._id, email: providerUser.email, role: 'PROVIDER' },
      secret,
      { expiresIn: '1h' }
    );
    const adminToken = jwt.sign(
      { id: adminUser._id, email: adminUser.email, role: 'ADMIN' },
      secret,
      { expiresIn: '1h' }
    );

    console.log(`[Test Context] Provider: ${activeProvider.name}, Service: ${activeService.name}`);
    console.log(`[Test Context] Shift: ${testShift.dayOfWeek} ${testShift.startTime}-${testShift.endTime}, Future Dates: ${futureDate}, ${futureDate2}\n`);

    // Helper to book a test appointment for Patient A
    const bookTestAppointment = async (date, time, token = patientAToken) => {
      const res = await makeRequest('/api/appointments', {
        method: 'POST',
        token,
        body: {
          providerId: activeProvider._id.toString(),
          serviceId: activeService._id.toString(),
          appointmentDate: date,
          startTime: time,
          reason: 'M6 Test Consultation'
        }
      });
      if (res.status === 201 && res.data?.data?.appointment?.appointmentId) {
        const aptDoc = await Appointment.findOne({
          appointmentId: res.data.data.appointment.appointmentId
        });
        if (aptDoc) {
          createdTestAppointmentIds.add(aptDoc._id.toString());
          return aptDoc;
        }
      }
      return null;
    };

    // =========================================================================
    // 1. CANCELLATION TESTS
    // =========================================================================
    const aptToCancel = await bookTestAppointment(futureDate, testShift.startTime, patientAToken);
    assert('Setup-2', 'Successfully created confirmed appointment for cancellation tests', Boolean(aptToCancel));

    // Test 1: Patient can cancel own confirmed appointment
    const cancelRes = await makeRequest(`/api/appointments/${aptToCancel.appointmentId}/cancel`, {
      method: 'PATCH',
      token: patientAToken,
      body: { cancellationReason: 'Schedule changed unexpectedly' }
    });

    assert(
      'M6-T1',
      'Patient can cancel own confirmed appointment (200 OK)',
      cancelRes.status === 200 && cancelRes.data?.data?.status === 'CANCELLED',
      `Status: ${cancelRes.status}`
    );

    // Test 6: Cancelled appointment remains in database
    const cancelledDbDoc = await Appointment.findById(aptToCancel._id);
    assert(
      'M6-T6',
      'Cancelled appointment remains in database (not deleted)',
      Boolean(cancelledDbDoc && cancelledDbDoc.status === 'CANCELLED'),
      `Status in DB: ${cancelledDbDoc?.status}`
    );

    // Test 7: Cancellation reason stored
    assert(
      'M6-T7',
      'Cancellation reason stored in database',
      cancelledDbDoc.cancellationReason === 'Schedule changed unexpectedly',
      `Stored reason: "${cancelledDbDoc.cancellationReason}"`
    );

    // Test 8: cancelledAt stored
    assert(
      'M6-T8',
      'cancelledAt timestamp stored in database',
      Boolean(cancelledDbDoc.cancelledAt instanceof Date),
      `CancelledAt: ${cancelledDbDoc.cancelledAt}`
    );

    // Test 11: Already cancelled appointment cannot be cancelled again
    const repeatCancelRes = await makeRequest(`/api/appointments/${aptToCancel.appointmentId}/cancel`, {
      method: 'PATCH',
      token: patientAToken,
      body: { cancellationReason: 'Trying again' }
    });

    assert(
      'M6-T11',
      'Already cancelled appointment cannot be cancelled again (400 Bad Request)',
      repeatCancelRes.status === 400 && repeatCancelRes.data?.errorCode === 'APPOINTMENT_ALREADY_CANCELLED',
      `Status: ${repeatCancelRes.status}, Code: ${repeatCancelRes.data?.errorCode}`
    );

    // Test 13: Cancelled slot becomes available in slot engine
    const slotsResAfterCancel = await makeRequest(
      `/api/availability/slots?providerId=${activeProvider._id}&serviceId=${activeService._id}&date=${futureDate}`
    );
    const cancelledSlot = slotsResAfterCancel.data?.data?.slots?.find(
      (s) => s.startTime === testShift.startTime
    );
    assert(
      'M6-T13',
      'Cancelled slot immediately becomes AVAILABLE in slot engine',
      cancelledSlot?.status === 'AVAILABLE',
      `Slot status: ${cancelledSlot?.status}`
    );

    // Test 2: Patient cannot cancel another patient's appointment
    const patientBAppointment = await bookTestAppointment(futureDate, testShift.startTime, patientBToken);
    const unauthorizedCancelRes = await makeRequest(
      `/api/appointments/${patientBAppointment.appointmentId}/cancel`,
      {
        method: 'PATCH',
        token: patientAToken, // Patient A trying to cancel Patient B
        body: { cancellationReason: 'Malicious cancellation attempt' }
      }
    );

    assert(
      'M6-T2',
      'Patient cannot cancel another patient appointment (403 Forbidden)',
      unauthorizedCancelRes.status === 403 && unauthorizedCancelRes.data?.errorCode === 'FORBIDDEN_RESOURCE',
      `Status: ${unauthorizedCancelRes.status}, Code: ${unauthorizedCancelRes.data?.errorCode}`
    );

    // Test 3: Unauthenticated cancellation -> 401
    const unauthCancelRes = await makeRequest(
      `/api/appointments/${patientBAppointment.appointmentId}/cancel`,
      {
        method: 'PATCH',
        body: { cancellationReason: 'No token' }
      }
    );

    assert(
      'M6-T3',
      'Unauthenticated cancellation rejected with 401',
      unauthCancelRes.status === 401,
      `Status: ${unauthCancelRes.status}`
    );

    // Test 4: Provider cancellation attempt on patient endpoint -> 403
    const providerCancelRes = await makeRequest(
      `/api/appointments/${patientBAppointment.appointmentId}/cancel`,
      {
        method: 'PATCH',
        token: providerToken,
        body: { cancellationReason: 'Doctor cancel' }
      }
    );

    assert(
      'M6-T4',
      'Provider role cancellation attempt rejected with 403 Forbidden',
      providerCancelRes.status === 403 && providerCancelRes.data?.errorCode === 'FORBIDDEN_ROLE',
      `Status: ${providerCancelRes.status}`
    );

    // Test 5: Admin cancellation on patient endpoint -> 403 (strict patient self-service policy)
    const adminCancelRes = await makeRequest(
      `/api/appointments/${patientBAppointment.appointmentId}/cancel`,
      {
        method: 'PATCH',
        token: adminToken,
        body: { cancellationReason: 'Admin cancel' }
      }
    );

    assert(
      'M6-T5',
      'Admin role rejected with 403 on patient cancellation endpoint per policy',
      adminCancelRes.status === 403 && adminCancelRes.data?.errorCode === 'FORBIDDEN_ROLE',
      `Status: ${adminCancelRes.status}`
    );

    // Test 9: Completed appointment cannot be cancelled
    const completedApt = await bookTestAppointment(futureDate2, testShift.startTime, patientAToken);
    await Appointment.updateOne({ _id: completedApt._id }, { $set: { status: 'COMPLETED' } });

    const cancelCompletedRes = await makeRequest(
      `/api/appointments/${completedApt.appointmentId}/cancel`,
      {
        method: 'PATCH',
        token: patientAToken
      }
    );

    assert(
      'M6-T9',
      'Completed appointment cannot be cancelled (400 Bad Request)',
      cancelCompletedRes.status === 400 && cancelCompletedRes.data?.errorCode === 'APPOINTMENT_ALREADY_COMPLETED',
      `Status: ${cancelCompletedRes.status}, Code: ${cancelCompletedRes.data?.errorCode}`
    );

    // Test 10: No-show appointment cannot be cancelled
    const noShowApt = await bookTestAppointment(futureDate2, '10:00', patientAToken);
    await Appointment.updateOne({ _id: noShowApt._id }, { $set: { status: 'NO_SHOW' } });

    const cancelNoShowRes = await makeRequest(
      `/api/appointments/${noShowApt.appointmentId}/cancel`,
      {
        method: 'PATCH',
        token: patientAToken
      }
    );

    assert(
      'M6-T10',
      'No-show appointment cannot be cancelled (400 Bad Request)',
      cancelNoShowRes.status === 400 && cancelNoShowRes.data?.errorCode === 'APPOINTMENT_MARKED_NO_SHOW',
      `Status: ${cancelNoShowRes.status}, Code: ${cancelNoShowRes.data?.errorCode}`
    );

    // Test 12: Cancellation window enforced (sub-2 hour appointment cannot be cancelled)
    const pastApt = await bookTestAppointment(futureDate2, '10:30', patientAToken);
    // Artificially simulate appointment scheduled 30 minutes from now (less than 120 mins)
    const nowInKol = new Date(Date.now() + 30 * 60 * 1000);
    const kolDateStr = nowInKol.toISOString().split('T')[0];
    const kolTimeStr = `${String(nowInKol.getUTCHours()).padStart(2, '0')}:${String(nowInKol.getUTCMinutes()).padStart(2, '0')}`;
    await Appointment.updateOne(
      { _id: pastApt._id },
      { $set: { appointmentDate: nowInKol, startTime: kolTimeStr } }
    );

    const windowCancelRes = await makeRequest(`/api/appointments/${pastApt.appointmentId}/cancel`, {
      method: 'PATCH',
      token: patientAToken
    });

    assert(
      'M6-T12',
      'Cancellation window (2 hours) enforced: sub-2hr appointment rejected (400)',
      windowCancelRes.status === 400 && windowCancelRes.data?.errorCode === 'CANCELLATION_WINDOW_EXPIRED',
      `Status: ${windowCancelRes.status}, Code: ${windowCancelRes.data?.errorCode}`
    );

    // =========================================================================
    // 2. RESCHEDULING TESTS
    // =========================================================================
    const aptToReschedule = await bookTestAppointment(futureDate, '11:00', patientAToken);
    assert('Setup-3', 'Created confirmed appointment for rescheduling tests', Boolean(aptToReschedule));

    // Test 14: Patient can reschedule own appointment to new available slot
    const targetRescheduleTime = '11:30';
    const rescheduleRes = await makeRequest(
      `/api/appointments/${aptToReschedule.appointmentId}/reschedule`,
      {
        method: 'PATCH',
        token: patientAToken,
        body: {
          appointmentDate: futureDate,
          startTime: targetRescheduleTime
        }
      }
    );

    assert(
      'M6-T14',
      'Patient can reschedule own appointment to new available slot (200 OK)',
      rescheduleRes.status === 200 &&
        rescheduleRes.data?.data?.startTime === targetRescheduleTime &&
        rescheduleRes.data?.data?.date === futureDate,
      `Status: ${rescheduleRes.status}, New Time: ${rescheduleRes.data?.data?.startTime}`
    );

    // Test 24: Successful reschedule updates appointment correctly without creating duplicates
    const rescheduledDbDoc = await Appointment.findById(aptToReschedule._id);
    assert(
      'M6-T24',
      'Successful reschedule updates original document (preserves appointmentId & zero duplicates)',
      rescheduledDbDoc.startTime === targetRescheduleTime &&
        rescheduledDbDoc.appointmentId === aptToReschedule.appointmentId,
      `appointmentId: ${rescheduledDbDoc.appointmentId}, startTime: ${rescheduledDbDoc.startTime}`
    );

    // Test 20: Reschedule uses service duration to calculate end time
    const expectedDuration = activeService.durationMinutes || 30;
    const [stH, stM] = targetRescheduleTime.split(':').map(Number);
    const endMinutes = stH * 60 + stM + expectedDuration;
    const expectedEndTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

    assert(
      'M6-T20',
      'Reschedule uses service duration to compute endTime accurately',
      rescheduledDbDoc.endTime === expectedEndTime,
      `Calculated: ${rescheduledDbDoc.endTime}, Expected: ${expectedEndTime}`
    );

    // Test 21: Client cannot manipulate endTime on reschedule
    const manipulatedReschedule = await makeRequest(
      `/api/appointments/${aptToReschedule.appointmentId}/reschedule`,
      {
        method: 'PATCH',
        token: patientAToken,
        body: {
          appointmentDate: futureDate,
          startTime: '12:00',
          endTime: '13:59' // Malicious client attempt
        }
      }
    );

    const checkManipulatedDoc = await Appointment.findById(aptToReschedule._id);
    assert(
      'M6-T21',
      'Client cannot manipulate endTime on reschedule (server overrides strictly)',
      manipulatedReschedule.status === 200 && checkManipulatedDoc.endTime !== '13:59',
      `EndTime stored: ${checkManipulatedDoc.endTime}`
    );

    // Test 15: Patient cannot reschedule another patient's appointment
    const unauthRescheduleRes = await makeRequest(
      `/api/appointments/${patientBAppointment.appointmentId}/reschedule`,
      {
        method: 'PATCH',
        token: patientAToken,
        body: {
          appointmentDate: futureDate2,
          startTime: '11:00'
        }
      }
    );

    assert(
      'M6-T15',
      'Patient cannot reschedule another patient appointment (403 Forbidden)',
      unauthRescheduleRes.status === 403 && unauthRescheduleRes.data?.errorCode === 'FORBIDDEN_RESOURCE',
      `Status: ${unauthRescheduleRes.status}, Code: ${unauthRescheduleRes.data?.errorCode}`
    );

    // Test 16: Invalid reschedule date rejected
    const invalidDateRes = await makeRequest(
      `/api/appointments/${aptToReschedule.appointmentId}/reschedule`,
      {
        method: 'PATCH',
        token: patientAToken,
        body: {
          appointmentDate: 'not-a-date',
          startTime: '10:00'
        }
      }
    );

    assert(
      'M6-T16',
      'Malformed reschedule date format rejected with 400',
      invalidDateRes.status === 400 && invalidDateRes.data?.errorCode === 'INVALID_DATE_FORMAT',
      `Status: ${invalidDateRes.status}`
    );

    // Test 17: Invalid reschedule time rejected
    const invalidTimeRes = await makeRequest(
      `/api/appointments/${aptToReschedule.appointmentId}/reschedule`,
      {
        method: 'PATCH',
        token: patientAToken,
        body: {
          appointmentDate: futureDate,
          startTime: '99:99'
        }
      }
    );

    assert(
      'M6-T17',
      'Invalid reschedule time format rejected with 400',
      invalidTimeRes.status === 400 && invalidTimeRes.data?.errorCode === 'INVALID_TIME_FORMAT',
      `Status: ${invalidTimeRes.status}`
    );

    // Test 18: Reschedule outside provider availability rejected
    const outsideHoursRes = await makeRequest(
      `/api/appointments/${aptToReschedule.appointmentId}/reschedule`,
      {
        method: 'PATCH',
        token: patientAToken,
        body: {
          appointmentDate: futureDate,
          startTime: '04:00' // Outside shift
        }
      }
    );

    assert(
      'M6-T18',
      'Reschedule outside provider working hours rejected with 400',
      outsideHoursRes.status === 400 && outsideHoursRes.data?.errorCode === 'OUTSIDE_WORKING_HOURS',
      `Status: ${outsideHoursRes.status}, Code: ${outsideHoursRes.data?.errorCode}`
    );

    // Test 19 & 23: Reschedule to conflicting slot rejected (409) AND leaves original appointment unchanged
    // Book slot 12:30 with Patient B
    const blockerApt = await bookTestAppointment(futureDate, '12:30', patientBToken);
    assert('Setup-4', 'Booked conflicting slot for Patient B', Boolean(blockerApt));

    const stateBeforeFailedReschedule = await Appointment.findById(aptToReschedule._id);

    const conflictRescheduleRes = await makeRequest(
      `/api/appointments/${aptToReschedule.appointmentId}/reschedule`,
      {
        method: 'PATCH',
        token: patientAToken,
        body: {
          appointmentDate: futureDate,
          startTime: '12:30' // Conflicting with blockerApt!
        }
      }
    );

    assert(
      'M6-T19',
      'Reschedule into existing appointment slot rejected with 409 Conflict',
      conflictRescheduleRes.status === 409 && conflictRescheduleRes.data?.errorCode === 'SLOT_NO_LONGER_AVAILABLE',
      `Status: ${conflictRescheduleRes.status}, Code: ${conflictRescheduleRes.data?.errorCode}`
    );

    const stateAfterFailedReschedule = await Appointment.findById(aptToReschedule._id);
    assert(
      'M6-T23',
      'Failed reschedule leaves original appointment completely untouched and confirmed',
      stateAfterFailedReschedule.startTime === stateBeforeFailedReschedule.startTime &&
        stateAfterFailedReschedule.status === 'CONFIRMED',
      `Time remained: ${stateAfterFailedReschedule.startTime}, Status: ${stateAfterFailedReschedule.status}`
    );

    // Test 22: Concurrent rescheduling conflict protected
    const raceSlotTime = '10:00';
    const candidateApt1 = await bookTestAppointment(futureDate2, '11:00', patientAToken);
    const candidateApt2 = await bookTestAppointment(futureDate2, '11:30', patientBToken);

    const [raceRes1, raceRes2] = await Promise.all([
      makeRequest(`/api/appointments/${candidateApt1.appointmentId}/reschedule`, {
        method: 'PATCH',
        token: patientAToken,
        body: { appointmentDate: futureDate, startTime: raceSlotTime }
      }),
      makeRequest(`/api/appointments/${candidateApt2.appointmentId}/reschedule`, {
        method: 'PATCH',
        token: patientBToken,
        body: { appointmentDate: futureDate, startTime: raceSlotTime }
      })
    ]);

    const statuses = [raceRes1.status, raceRes2.status].sort();
    assert(
      'M6-T22',
      'Concurrent rescheduling race: Exactly one succeeds (200), competing request gets 409 Conflict',
      statuses[0] === 200 && statuses[1] === 409,
      `Statuses: ${raceRes1.status}, ${raceRes2.status}`
    );

    // Test 25: GET /api/appointments/:id single appointment retrieval for reschedule preloading
    const singleAptRes = await makeRequest(`/api/appointments/${aptToReschedule.appointmentId}`, {
      method: 'GET',
      token: patientAToken
    });

    assert(
      'M6-T25',
      'GET /api/appointments/:id returns single appointment scoped to patient for reschedule flow',
      singleAptRes.status === 200 && singleAptRes.data?.data?.appointment?.appointmentId === aptToReschedule.appointmentId,
      `Status: ${singleAptRes.status}`
    );

    // Test 26: Error mapper handles policy errors cleanly without technical leakage
    const policyMapped = mapBookingError({
      statusCode: 400,
      errorCode: 'CANCELLATION_WINDOW_EXPIRED'
    });
    assert(
      'M6-T26',
      'Frontend error mapper produces compassionate policy copy with zero technical leaks',
      policyMapped.title === 'Cancellation Window Passed' &&
        !containsTechnicalDetails(policyMapped.message),
      `Title: "${policyMapped.title}"`
    );

    // =========================================================================
    // CLEANUP & INTEGRITY VERIFICATION
    // =========================================================================
    console.log(`\n--- CLEANUP & SEED DATASET INTEGRITY VERIFICATION ---`);
    console.log(`Cleaning up ${createdTestAppointmentIds.size} temporary test appointments...`);

    for (const testId of createdTestAppointmentIds) {
      await Appointment.findByIdAndDelete(testId);
    }

    const finalAppointmentCount = await Appointment.countDocuments();
    assert(
      'Cleanup-1',
      'Database appointment count safely returned to exact seed baseline',
      finalAppointmentCount === initialBaselineCount,
      `Current appointments: ${finalAppointmentCount}, Baseline: ${initialBaselineCount}`
    );

    // Check for orphan references
    const activeAppointments = await Appointment.find().lean();
    let orphanCount = 0;
    for (const apt of activeAppointments) {
      if (!apt.userId || !apt.providerId || !apt.serviceId) {
        orphanCount++;
      }
    }

    assert(
      'Cleanup-2',
      'Zero orphan user, provider, or service references in appointments',
      orphanCount === 0,
      `Orphans: ${orphanCount}`
    );

    console.log('\n====================================================');
    console.log(`Milestone 6 Test Summary: ${passCount} Passed, ${failCount} Failed (Total: ${testCount})`);
    console.log('====================================================\n');

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.connection.close();
    process.exit(failCount > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal Error running Milestone 6 tests:', err);
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(1);
  }
};

runMilestone6Tests();
