require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');
const { User, Provider, Service, Availability, Appointment } = require('../src/models');
const { setTransporter, resetTransporter, sendConfirmationEmail } = require('../src/services/emailService');

const runConfirmationEmailTests = async () => {
  console.log('====================================================');
  console.log('  Appointees — Automatic Confirmation Email Test Suite');
  console.log('====================================================\n');

  let server;
  let baseUrl;
  let testCount = 0;
  let passCount = 0;
  let failCount = 0;

  const createdTestAppointmentIds = new Set();
  const interceptedEmails = [];

  // Mock transporter to intercept outgoing emails and verify properties
  const mockTransporter = {
    sendMail: async (options) => {
      interceptedEmails.push(options);
      return { messageId: `mock-msg-${Date.now()}-${Math.random().toString(36).substring(7)}` };
    }
  };

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
    setTransporter(mockTransporter);

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

    // Retrieve multiple distinct patients from DB to test multi-user scaling
    const patients = await User.find({ role: 'PATIENT' }).limit(2);
    const patientUser1 = patients[0];
    const patientUser2 = patients[1];

    assert('Setup-1', 'Patient 1 exists', !!patientUser1, patientUser1?.email);
    assert('Setup-2', 'Patient 2 exists', !!patientUser2, patientUser2?.email);

    const jwtSecret = process.env.JWT_SECRET || 'development_appointease_secret_key_change_in_prod';
    const patient1Token = jwt.sign(
      { id: patientUser1._id.toString(), role: patientUser1.role },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const patient2Token = jwt.sign(
      { id: patientUser2._id.toString(), role: patientUser2.role },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // Retrieve provider and service for appointment creation
    const avail = await Availability.findOne({ isActive: true });
    const providerDoc = await Provider.findById(avail.providerId).populate('serviceIds');
    const serviceDoc = providerDoc.serviceIds[0];
    const targetDate = '2026-10-05';

    // =========================================================================
    // TEST 1: Direct invocation of reusable sendConfirmationEmail(details)
    // =========================================================================
    console.log('\n--- 1. Direct sendConfirmationEmail(details) Unit Test ---');
    interceptedEmails.length = 0;

    const directEmailRes = await sendConfirmationEmail({
      userEmail: patientUser1.email,
      patientName: patientUser1.name,
      doctorName: providerDoc.name,
      appointmentDate: targetDate,
      time: '10:00 – 10:30',
      bookingId: 'APT-TEST-001'
    });

    assert('T1-1', 'sendConfirmationEmail returns success', directEmailRes.success === true);
    assert('T1-2', 'Email was dispatched to mock transporter', interceptedEmails.length === 1);
    
    const intercepted1 = interceptedEmails[0];
    assert('T1-3', 'Dynamic recipient match details.userEmail', intercepted1?.to === patientUser1.email);
    assert('T1-4', 'HTML body includes patient name', intercepted1?.html.includes(patientUser1.name));
    assert('T1-5', 'HTML body includes doctor name', intercepted1?.html.includes(providerDoc.name));
    assert('T1-6', 'HTML body includes appointment time slot', intercepted1?.html.includes('10:00 – 10:30'));
    assert('T1-7', 'HTML body includes booking ID', intercepted1?.html.includes('APT-TEST-001'));

    // =========================================================================
    // TEST 2: Booking Confirmation Route populates linked user & sends email (User 1)
    // =========================================================================
    console.log('\n--- 2. Booking Confirmation Route - User 1 ---');
    interceptedEmails.length = 0;

    // Create an unconfirmed / test appointment doc linked to patientUser1
    const testApt1 = await Appointment.create({
      appointmentId: `APT-CONFIRM-U1-${Date.now()}`,
      userId: patientUser1._id,
      providerId: providerDoc._id,
      serviceId: serviceDoc._id,
      appointmentDate: new Date(targetDate),
      startTime: '11:00',
      endTime: '11:30',
      status: 'CANCELLED', // set to CANCELLED initially then confirm
      reason: 'Testing confirmation route'
    });
    createdTestAppointmentIds.add(testApt1._id);

    const confirmRes1 = await makeRequest(`/api/appointments/${testApt1.appointmentId}/confirm`, {
      method: 'PATCH',
      token: patient1Token
    });

    assert('T2-1', 'PATCH /api/appointments/:id/confirm returns 200 OK', confirmRes1.status === 200);
    assert('T2-2', 'Returned appointment status is CONFIRMED', confirmRes1.data?.data?.appointment?.status === 'CONFIRMED');
    assert('T2-3', 'Returned appointment populated linked userId field with email', confirmRes1.data?.data?.appointment?.userId?.email === patientUser1.email);

    await new Promise((r) => setTimeout(r, 100));

    const emailSentUser1 = interceptedEmails.find((e) => e.to === patientUser1.email);
    assert('T2-4', 'Confirmation email was sent to User 1 dynamic email address', !!emailSentUser1);
    assert('T2-5', 'Confirmation email contains User 1 name', emailSentUser1?.html.includes(patientUser1.name));

    // =========================================================================
    // TEST 3: Multi-User Scale Test - Booking Confirmation for User 2
    // =========================================================================
    console.log('\n--- 3. Multi-User Scale Verification - User 2 ---');
    interceptedEmails.length = 0;

    const testApt2 = await Appointment.create({
      appointmentId: `APT-CONFIRM-U2-${Date.now()}`,
      userId: patientUser2._id,
      providerId: providerDoc._id,
      serviceId: serviceDoc._id,
      appointmentDate: new Date(targetDate),
      startTime: '12:00',
      endTime: '12:30',
      status: 'CANCELLED',
      reason: 'Testing scale with User 2'
    });
    createdTestAppointmentIds.add(testApt2._id);

    const confirmRes2 = await makeRequest('/api/appointments/booking-confirmation', {
      method: 'POST',
      token: patient2Token,
      body: { bookingId: testApt2.appointmentId }
    });

    assert('T3-1', 'POST /api/appointments/booking-confirmation returns 200 OK', confirmRes2.status === 200);
    assert('T3-2', 'Status updated to CONFIRMED for User 2', confirmRes2.data?.data?.appointment?.status === 'CONFIRMED');

    await new Promise((r) => setTimeout(r, 100));

    const emailSentUser2 = interceptedEmails.find((e) => e.to === patientUser2.email);
    assert('T3-3', 'Confirmation email sent dynamically to User 2 (not hardcoded)', !!emailSentUser2, emailSentUser2?.to);
    assert('T3-4', 'Confirmation email contains User 2 name', emailSentUser2?.html.includes(patientUser2.name));

    // =========================================================================
    // TEST 4: Error Isolation - Email Failure Never Blocks Booking Confirmation
    // =========================================================================
    console.log('\n--- 4. Error Isolation Test (Failed Email Never Blocks Booking) ---');
    
    // Set mock transporter to throw network / auth error
    const throwingTransporter = {
      sendMail: async () => {
        const err = new Error('SMTP Connection Refused: 535 Authentication Failed');
        err.code = 'EAUTH';
        throw err;
      }
    };
    setTransporter(throwingTransporter);

    const testAptFailEmail = await Appointment.create({
      appointmentId: `APT-FAIL-EMAIL-${Date.now()}`,
      userId: patientUser1._id,
      providerId: providerDoc._id,
      serviceId: serviceDoc._id,
      appointmentDate: new Date(targetDate),
      startTime: '14:00',
      endTime: '14:30',
      status: 'CANCELLED',
      reason: 'Testing email failure isolation'
    });
    createdTestAppointmentIds.add(testAptFailEmail._id);

    const confirmResFail = await makeRequest(`/api/appointments/${testAptFailEmail.appointmentId}/confirm`, {
      method: 'PATCH',
      token: patient1Token
    });

    assert('T4-1', 'Confirmation API returns 200 OK even when email delivery throws exception', confirmResFail.status === 200);
    assert('T4-2', 'Booking status is updated to CONFIRMED despite email failure', confirmResFail.data?.data?.appointment?.status === 'CONFIRMED');

    const verifiedDbApt = await Appointment.findById(testAptFailEmail._id);
    assert('T4-3', 'Database state reflects CONFIRMED status', verifiedDbApt?.status === 'CONFIRMED');

    // =========================================================================
    // CLEANUP
    // =========================================================================
    console.log('\n--- 5. Cleanup Test Artifacts ---');
    for (const aptId of createdTestAppointmentIds) {
      await Appointment.findByIdAndDelete(aptId).catch(() => {});
    }
    assert('Cleanup', 'Cleaned up all temporary test appointment documents', true);

  } catch (err) {
    console.error('Fatal error during confirmation email tests:', err);
    failCount++;
  } finally {
    resetTransporter();
    for (const aptId of createdTestAppointmentIds) {
      await Appointment.findByIdAndDelete(aptId).catch(() => {});
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.connection.close();
  }

  console.log('\n====================================================');
  console.log(`  Confirmation Email Test Summary: ${passCount}/${testCount} Passed (${failCount} Failed)`);
  console.log('====================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
};

runConfirmationEmailTests();
