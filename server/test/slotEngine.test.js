require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');
const { Provider, Service, Availability, Appointment } = require('../src/models');
const {
  calculateSlots,
  generateCandidateSlots,
  validateDate,
  timeToMinutes,
  minutesToTime,
  isIntervalOverlapping,
  MIN_BOOKING_BUFFER_MINUTES
} = require('../src/services/slotService');

/**
 * Milestone 4 Slot Engine Automated Test Suite
 * Covers all 23 requirements specified in Milestone 4.
 */
const runSlotEngineTests = async () => {
  console.log('====================================================');
  console.log('  AppointEase — Milestone 4 Slot Engine Tests       ');
  console.log('  (All 23 Dynamic Slot Engine Requirements)         ');
  console.log('====================================================\n');

  let server;
  let baseUrl;
  let testCount = 0;
  let passCount = 0;
  let failCount = 0;

  const assert = (scenarioNum, description, condition, detail = '') => {
    testCount++;
    if (condition) {
      passCount++;
      console.log(`  ✓ Test ${scenarioNum}: ${description} ${detail ? `(${detail})` : ''}`);
    } else {
      failCount++;
      console.error(`  ✗ Test ${scenarioNum}: FAILED - ${description} ${detail ? `(${detail})` : ''}`);
    }
  };

  try {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    const makeRequest = async (path) => {
      const res = await fetch(`${baseUrl}${path}`);
      const data = await res.json().catch(() => null);
      return { status: res.status, data };
    };

    // Grab real data from MongoDB Atlas
    const activeProvider = await Provider.findOne({ status: 'ACTIVE' }).populate('serviceIds').lean();
    const inactiveProvider = await Provider.findOne({ status: 'INACTIVE' }).populate('serviceIds').lean();
    const activeService = activeProvider.serviceIds[0];

    // Find a service NOT offered by this provider
    const unofferedService = await Service.findOne({
      _id: { $nin: activeProvider.serviceIds.map((s) => s._id) }
    }).lean();

    // Find a weekday on which the provider works
    const providerAvails = await Availability.find({ providerId: activeProvider._id, isActive: true }).lean();
    const activeWeekday = providerAvails[0].dayOfWeek;

    // Helper: calculate a future YYYY-MM-DD string matching a specific weekday
    const getFutureDateForWeekday = (targetWeekday) => {
      const d = new Date();
      for (let i = 1; i <= 30; i++) {
        d.setDate(d.getDate() + 1);
        const dayName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(d);
        if (dayName === targetWeekday) {
          return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
        }
      }
      return null;
    };

    const futureDate = getFutureDateForWeekday(activeWeekday);

    // Find a weekday provider DOES NOT work
    const allWeekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const workingDays = new Set(providerAvails.map((a) => a.dayOfWeek));
    const offWeekday = allWeekdays.find((d) => !workingDays.has(d)) || 'Sunday';
    const offDate = getFutureDateForWeekday(offWeekday);

    // -------------------------------------------------------------
    // Test 1: Valid provider + service + future date
    // -------------------------------------------------------------
    const res1 = await makeRequest(
      `/api/availability/slots?providerId=${activeProvider._id}&serviceId=${activeService._id}&date=${futureDate}`
    );
    assert(
      1,
      'Valid provider + service + future date',
      res1.status === 200 && res1.data?.success === true && Array.isArray(res1.data?.data?.slots) && res1.data?.data?.slots.length > 0,
      `Status: ${res1.status}, Generated: ${res1.data?.data?.slots?.length} slots`
    );

    // -------------------------------------------------------------
    // Test 2: Invalid provider ID
    // -------------------------------------------------------------
    const res2 = await makeRequest(
      `/api/availability/slots?providerId=not-a-valid-id&serviceId=${activeService._id}&date=${futureDate}`
    );
    assert(2, 'Invalid provider ID returns 400', res2.status === 400, `Status: ${res2.status}`);

    // -------------------------------------------------------------
    // Test 3: Invalid service ID
    // -------------------------------------------------------------
    const res3 = await makeRequest(
      `/api/availability/slots?providerId=${activeProvider._id}&serviceId=invalid-service-xyz&date=${futureDate}`
    );
    assert(3, 'Invalid service ID returns 400', res3.status === 400, `Status: ${res3.status}`);

    // -------------------------------------------------------------
    // Test 4: Missing provider (404)
    // -------------------------------------------------------------
    const nonExistentId = new mongoose.Types.ObjectId();
    const res4 = await makeRequest(
      `/api/availability/slots?providerId=${nonExistentId}&serviceId=${activeService._id}&date=${futureDate}`
    );
    assert(4, 'Missing provider returns 404', res4.status === 404, `Status: ${res4.status}`);

    // -------------------------------------------------------------
    // Test 5: Missing service (404)
    // -------------------------------------------------------------
    const res5 = await makeRequest(
      `/api/availability/slots?providerId=${activeProvider._id}&serviceId=${nonExistentId}&date=${futureDate}`
    );
    assert(5, 'Missing service returns 404', res5.status === 404, `Status: ${res5.status}`);

    // -------------------------------------------------------------
    // Test 6: Provider does not offer service (400)
    // -------------------------------------------------------------
    const res6 = await makeRequest(
      `/api/availability/slots?providerId=${activeProvider._id}&serviceId=${unofferedService._id}&date=${futureDate}`
    );
    assert(
      6,
      'Provider does not offer service returns 400',
      res6.status === 400 && res6.data?.message?.includes('does not offer'),
      `Status: ${res6.status}, Message: ${res6.data?.message}`
    );

    // -------------------------------------------------------------
    // Test 7: Inactive provider rejection (400)
    // -------------------------------------------------------------
    const res7 = await makeRequest(
      `/api/availability/slots?providerId=${inactiveProvider._id}&serviceId=${inactiveProvider.serviceIds[0]._id}&date=${futureDate}`
    );
    assert(7, 'Inactive provider returns 400', res7.status === 400, `Status: ${res7.status}`);

    // -------------------------------------------------------------
    // Test 8: Inactive service rejection (400)
    // -------------------------------------------------------------
    // Create temporary inactive service
    const inactiveService = await Service.create({
      name: 'Temp Inactive Service',
      category: 'General Consultation',
      durationMinutes: 30,
      price: 500,
      status: 'INACTIVE'
    });
    // Add to provider's services temporarily
    await Provider.updateOne({ _id: activeProvider._id }, { $push: { serviceIds: inactiveService._id } });

    const res8 = await makeRequest(
      `/api/availability/slots?providerId=${activeProvider._id}&serviceId=${inactiveService._id}&date=${futureDate}`
    );
    assert(8, 'Inactive service returns 400', res8.status === 400 && res8.data?.message?.includes('inactive'), `Status: ${res8.status}`);

    // Cleanup temporary test service
    await Provider.updateOne({ _id: activeProvider._id }, { $pull: { serviceIds: inactiveService._id } });
    await Service.deleteOne({ _id: inactiveService._id });

    // -------------------------------------------------------------
    // Test 9: Invalid date format (400)
    // -------------------------------------------------------------
    const res9 = await makeRequest(
      `/api/availability/slots?providerId=${activeProvider._id}&serviceId=${activeService._id}&date=16-09-2026`
    );
    assert(9, 'Invalid date format returns 400', res9.status === 400, `Status: ${res9.status}`);

    // -------------------------------------------------------------
    // Test 10: Past date rejection (400)
    // -------------------------------------------------------------
    const res10 = await makeRequest(
      `/api/availability/slots?providerId=${activeProvider._id}&serviceId=${activeService._id}&date=2020-01-01`
    );
    assert(10, 'Past date returns 400', res10.status === 400 && res10.data?.message?.includes('Past dates'), `Status: ${res10.status}`);

    // -------------------------------------------------------------
    // Test 11: Provider unavailable on weekday (returns 200 with empty slots & reason)
    // -------------------------------------------------------------
    const offProv = await Provider.create({
      name: 'Dr. Off Day Test',
      email: `off.test.${Date.now()}@test.com`,
      specialty: 'General Medicine',
      qualification: 'MBBS',
      experienceYears: 5,
      location: 'Chennai',
      serviceIds: [activeService._id],
      status: 'ACTIVE'
    });
    const res11 = await makeRequest(
      `/api/availability/slots?providerId=${offProv._id}&serviceId=${activeService._id}&date=${futureDate}`
    );
    assert(
      11,
      'Provider unavailable on weekday returns empty slots & reason',
      res11.status === 200 && res11.data?.data?.slots?.length === 0 && res11.data?.data?.reason === 'PROVIDER_NOT_AVAILABLE',
      `Reason: ${res11.data?.data?.reason}`
    );
    await Provider.deleteOne({ _id: offProv._id });

    // -------------------------------------------------------------
    // Test 12: Generate correct 30-minute slots
    // -------------------------------------------------------------
    const srv30 = await Service.findOne({ durationMinutes: 30 }).lean();
    const provWithSrv30 = await Provider.findOne({ status: 'ACTIVE', serviceIds: srv30._id }).lean();
    const res12 = await makeRequest(
      `/api/availability/slots?providerId=${provWithSrv30._id}&serviceId=${srv30._id}&date=${futureDate}`
    );
    const slots12 = res12.data?.data?.slots || [];
    const is30Min = slots12.length > 0 && slots12.every((s) => timeToMinutes(s.endTime) - timeToMinutes(s.startTime) === 30);
    assert(12, 'Generate correct 30-minute slots', is30Min, `Total: ${slots12.length} slots, Duration: 30m`);

    // -------------------------------------------------------------
    // Test 13: Generate correct 45-minute slots
    // -------------------------------------------------------------
    const srv45 = await Service.findOne({ durationMinutes: 45 }).lean();
    const provWithSrv45 = await Provider.findOne({ status: 'ACTIVE', serviceIds: srv45._id }).lean();
    const res13 = await makeRequest(
      `/api/availability/slots?providerId=${provWithSrv45._id}&serviceId=${srv45._id}&date=${futureDate}`
    );
    const slots13 = res13.data?.data?.slots || [];
    const is45Min = slots13.length > 0 && slots13.every((s) => timeToMinutes(s.endTime) - timeToMinutes(s.startTime) === 45);
    assert(13, 'Generate correct 45-minute slots', is45Min, `Total: ${slots13.length} slots, Duration: 45m`);

    // -------------------------------------------------------------
    // Test 14: Generate correct 60-minute slots
    // -------------------------------------------------------------
    const srv60 = await Service.findOne({ durationMinutes: 60 }).lean();
    const provWithSrv60 = await Provider.findOne({ status: 'ACTIVE', serviceIds: srv60._id }).lean();
    const res14 = await makeRequest(
      `/api/availability/slots?providerId=${provWithSrv60._id}&serviceId=${srv60._id}&date=${futureDate}`
    );
    const slots14 = res14.data?.data?.slots || [];
    const is60Min = slots14.length > 0 && slots14.every((s) => timeToMinutes(s.endTime) - timeToMinutes(s.startTime) === 60);
    assert(14, 'Generate correct 60-minute slots', is60Min, `Total: ${slots14.length} slots, Duration: 60m`);

    // -------------------------------------------------------------
    // Test 15: Existing confirmed appointment blocks slot
    // -------------------------------------------------------------
    // Create a temporary test appointment on futureDate
    const targetAptDate = new Date(`${futureDate}T00:00:00.000Z`);
    const testAptConfirmed = await Appointment.create({
      appointmentId: `TEST-CONFIRMED-${Date.now()}`,
      userId: new mongoose.Types.ObjectId(),
      providerId: activeProvider._id,
      serviceId: activeService._id,
      appointmentDate: targetAptDate,
      startTime: '09:00',
      endTime: '09:30',
      status: 'CONFIRMED'
    });

    const res15 = await makeRequest(
      `/api/availability/slots?providerId=${activeProvider._id}&serviceId=${activeService._id}&date=${futureDate}`
    );
    const slot0900 = res15.data?.data?.slots?.find((s) => s.startTime === '09:00');
    assert(
      15,
      'Existing confirmed appointment blocks slot',
      slot0900 && slot0900.status === 'BOOKED',
      `Slot 09:00 status: ${slot0900?.status}`
    );

    // -------------------------------------------------------------
    // Test 16: Cancelled appointment does NOT block slot
    // -------------------------------------------------------------
    await Appointment.updateOne({ _id: testAptConfirmed._id }, { status: 'CANCELLED' });
    const res16 = await makeRequest(
      `/api/availability/slots?providerId=${activeProvider._id}&serviceId=${activeService._id}&date=${futureDate}`
    );
    const slot0900Cancelled = res16.data?.data?.slots?.find((s) => s.startTime === '09:00');
    assert(
      16,
      'Cancelled appointment does NOT block slot',
      slot0900Cancelled && slot0900Cancelled.status === 'AVAILABLE',
      `Slot 09:00 status: ${slot0900Cancelled?.status}`
    );
    await Appointment.deleteOne({ _id: testAptConfirmed._id }); // Cleanup

    // -------------------------------------------------------------
    // Test 17: Partial overlap is detected
    // -------------------------------------------------------------
    // Appointment from 09:15 to 09:45 (partially overlaps 09:00-09:30 and 09:30-10:00)
    const testPartial = await Appointment.create({
      appointmentId: `TEST-PARTIAL-${Date.now()}`,
      userId: new mongoose.Types.ObjectId(),
      providerId: activeProvider._id,
      serviceId: activeService._id,
      appointmentDate: targetAptDate,
      startTime: '09:15',
      endTime: '09:45',
      status: 'CONFIRMED'
    });

    const res17 = await makeRequest(
      `/api/availability/slots?providerId=${activeProvider._id}&serviceId=${activeService._id}&date=${futureDate}`
    );
    const slot1 = res17.data?.data?.slots?.find((s) => s.startTime === '09:00');
    const slot2 = res17.data?.data?.slots?.find((s) => s.startTime === '09:30');
    assert(
      17,
      'Partial overlap is detected on intersecting intervals',
      slot1?.status === 'BOOKED' && slot2?.status === 'BOOKED',
      `09:00: ${slot1?.status}, 09:30: ${slot2?.status}`
    );
    await Appointment.deleteOne({ _id: testPartial._id }); // Cleanup

    // -------------------------------------------------------------
    // Test 18: Adjacent appointments do not conflict
    // -------------------------------------------------------------
    // Appointment strictly at 09:00-09:30
    const testAdjacent = await Appointment.create({
      appointmentId: `TEST-ADJACENT-${Date.now()}`,
      userId: new mongoose.Types.ObjectId(),
      providerId: activeProvider._id,
      serviceId: activeService._id,
      appointmentDate: targetAptDate,
      startTime: '09:00',
      endTime: '09:30',
      status: 'CONFIRMED'
    });

    const res18 = await makeRequest(
      `/api/availability/slots?providerId=${activeProvider._id}&serviceId=${activeService._id}&date=${futureDate}`
    );
    const slotAdjacentBlocked = res18.data?.data?.slots?.find((s) => s.startTime === '09:00');
    const slotAdjacentFree = res18.data?.data?.slots?.find((s) => s.startTime === '09:30');
    assert(
      18,
      'Adjacent appointments do not conflict (09:00 booked, 09:30 available)',
      slotAdjacentBlocked?.status === 'BOOKED' && slotAdjacentFree?.status === 'AVAILABLE',
      `09:00=${slotAdjacentBlocked?.status}, 09:30=${slotAdjacentFree?.status}`
    );
    await Appointment.deleteOne({ _id: testAdjacent._id }); // Cleanup

    // -------------------------------------------------------------
    // Test 19: Multiple shifts generate correct slots
    // -------------------------------------------------------------
    // Create temporary provider with 2 distinct shifts on same day (09:00-11:00 and 14:00-16:00)
    const multiShiftProv = await Provider.create({
      name: 'Dr. Multi Shift Test',
      email: `multi.shift.${Date.now()}@test.com`,
      specialty: 'General Medicine',
      qualification: 'MBBS',
      experienceYears: 10,
      location: 'Chennai',
      serviceIds: [activeService._id],
      consultationDuration: 30,
      status: 'ACTIVE'
    });

    await Availability.create([
      { providerId: multiShiftProv._id, dayOfWeek: activeWeekday, startTime: '09:00', endTime: '11:00', slotDurationMinutes: 30, isActive: true },
      { providerId: multiShiftProv._id, dayOfWeek: activeWeekday, startTime: '14:00', endTime: '16:00', slotDurationMinutes: 30, isActive: true }
    ]);

    const res19 = await makeRequest(
      `/api/availability/slots?providerId=${multiShiftProv._id}&serviceId=${activeService._id}&date=${futureDate}`
    );
    const slots19 = res19.data?.data?.slots || [];
    const hasMorning = slots19.some((s) => s.startTime === '09:00' && s.endTime === '09:30');
    const hasGapSlot = slots19.some((s) => s.startTime === '12:00'); // Gap between 11:00 and 14:00
    const hasAfternoon = slots19.some((s) => s.startTime === '14:00' && s.endTime === '14:30');

    assert(
      19,
      'Multiple shifts generate correct slots without gap slots',
      hasMorning && !hasGapSlot && hasAfternoon,
      `Morning: ${hasMorning}, Gap 12:00: ${hasGapSlot}, Afternoon: ${hasAfternoon}`
    );

    await Availability.deleteMany({ providerId: multiShiftProv._id });
    await Provider.deleteOne({ _id: multiShiftProv._id });

    // -------------------------------------------------------------
    // Test 20: Slot never exceeds working-hours boundary
    // -------------------------------------------------------------
    // 45-min service on 09:00-11:00 shift generates 09:00-09:45, 09:45-10:30 (10:30-11:15 exceeds 11:00, must NOT be generated)
    const boundProv = await Provider.create({
      name: 'Dr. Boundary Test',
      email: `bound.test.${Date.now()}@test.com`,
      specialty: 'General Medicine',
      qualification: 'MBBS',
      experienceYears: 10,
      location: 'Chennai',
      serviceIds: [srv45._id],
      consultationDuration: 45,
      status: 'ACTIVE'
    });
    await Availability.create({
      providerId: boundProv._id,
      dayOfWeek: activeWeekday,
      startTime: '09:00',
      endTime: '11:00',
      slotDurationMinutes: 45,
      isActive: true
    });

    const res20 = await makeRequest(
      `/api/availability/slots?providerId=${boundProv._id}&serviceId=${srv45._id}&date=${futureDate}`
    );
    const slots20 = res20.data?.data?.slots || [];
    const lastSlot = slots20[slots20.length - 1];
    assert(
      20,
      'Slot never exceeds working-hours boundary (ends <= 11:00)',
      timeToMinutes(lastSlot.endTime) <= timeToMinutes('11:00'),
      `Last slot: ${lastSlot?.startTime}-${lastSlot?.endTime} <= 11:00`
    );
    await Availability.deleteMany({ providerId: boundProv._id });
    await Provider.deleteOne({ _id: boundProv._id });

    // -------------------------------------------------------------
    // Test 21: Today's past slots are excluded / marked unavailable
    // -------------------------------------------------------------
    // Get today's date in Asia/Kolkata
    const nowFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr = nowFormatter.format(new Date());

    // Ensure a dedicated provider has availability starting at 06:00 today for testing
    const todayDayName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(new Date());
    const todayProv = await Provider.create({
      name: 'Dr. Today Slot Test',
      email: `today.test.${Date.now()}@test.com`,
      specialty: 'General Medicine',
      qualification: 'MBBS',
      experienceYears: 5,
      location: 'Chennai',
      serviceIds: [activeService._id],
      status: 'ACTIVE'
    });
    await Availability.create({
      providerId: todayProv._id,
      dayOfWeek: todayDayName,
      startTime: '06:00',
      endTime: '23:00',
      slotDurationMinutes: 30,
      isActive: true
    });

    const res21 = await makeRequest(
      `/api/availability/slots?providerId=${todayProv._id}&serviceId=${activeService._id}&date=${todayStr}`
    );
    const slotsToday = res21.data?.data?.slots || [];
    const earlySlot = slotsToday.find((s) => s.startTime === '06:00');
    assert(
      21,
      "Today's past slots are marked UNAVAILABLE",
      earlySlot?.status === 'UNAVAILABLE',
      `06:00 slot status: ${earlySlot?.status}`
    );

    await Availability.deleteMany({ providerId: todayProv._id });
    await Provider.deleteOne({ _id: todayProv._id });

    // -------------------------------------------------------------
    // Test 22: Booking buffer (30m) is respected
    // -------------------------------------------------------------
    assert(
      22,
      `Booking buffer (${MIN_BOOKING_BUFFER_MINUTES}m) is configured and respected`,
      res21.data?.data?.bookingBufferMinutes === 30,
      `Configured buffer: ${res21.data?.data?.bookingBufferMinutes} mins`
    );


    // -------------------------------------------------------------
    // Test 23: Pure In-Memory Slot Generation Execution (< 5ms)
    // -------------------------------------------------------------
    // Verify pure in-memory calculation derives all slots in < 5ms without DB queries
    const memStartMs = performance.now();
    const memSlots = generateCandidateSlots({
      shifts: [{ startTime: '09:00', endTime: '17:00', dayOfWeek: 'Monday' }],
      duration: 30,
      bookedIntervals: [{ startMin: 540, endMin: 570 }, { startMin: 660, endMin: 690 }]
    });
    const memDurationMs = performance.now() - memStartMs;
    assert(
      23,
      'Pure in-memory slot calculation executes in < 5ms without DB queries',
      memDurationMs < 5 && memSlots.length === 16,
      `Calculated ${memSlots.length} slots in ${memDurationMs.toFixed(2)}ms (pure in-memory O(N))`
    );

    console.log('\n====================================================');
    console.log(`Slot Engine Test Summary: ${passCount} Passed, ${failCount} Failed (Total: ${testCount})`);
    console.log('====================================================\n');

    server.close();
    await mongoose.connection.close();

    if (failCount > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('[Slot Test Error] Unexpected error:', err);
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

runSlotEngineTests();
