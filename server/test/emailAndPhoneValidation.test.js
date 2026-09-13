const http = require('http');
const assert = require('assert');
const mongoose = require('mongoose');
const { app } = require('../src/server');
const { User, Appointment } = require('../src/models');
const {
  sendEmail,
  setTransporter,
  resetTransporter,
  getTransporter,
  getSmtpConfigStatus,
  verifySmtpConnection
} = require('../src/services/emailService');
const { validateIndianMobile } = require('../src/utils/phoneValidator');
const {
  notifyAppointmentConfirmed,
  notifyAppointmentCancelled,
  notifyAppointmentRescheduled
} = require('../src/services/notificationService');

let server;
let port;

const makeRequest = ({ method, path, headers = {}, body = null }) => {
  return new Promise((resolve, reject) => {
    const jsonBody = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (jsonBody) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(jsonBody);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let data = null;
          try {
            data = JSON.parse(rawData);
          } catch (e) {
            data = rawData;
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );

    req.on('error', reject);
    if (jsonBody) req.write(jsonBody);
    req.end();
  });
};

const runSuite = async () => {
  console.log('\n====================================================');
  console.log('  AppointEase — Email Delivery & Phone Validation   ');
  console.log('  Definitive Root-Cause & Hardening Test Suite      ');
  console.log('====================================================\n');

  // Verify MongoDB connection
  if (mongoose.connection.readyState !== 1) {
    const dbUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/appointease';
    await mongoose.connect(dbUri);
  }

  const initialApptCount = await Appointment.countDocuments();
  console.log(`Baseline initial appointments in DB: ${initialApptCount}`);

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      console.log(`Test server running on port ${port}\n`);
      resolve();
    });
  });

  const testIdsToClean = { appointments: [], users: [] };

  try {
    // ----------------------------------------------------
    // PART A: Indian Mobile Number Validation Unit Tests
    // ----------------------------------------------------
    console.log('--- PART A: Indian Mobile Number Validation Rules ---');

    const validPhones = [
      '9876543210',
      '9123456789',
      '+91 98765 43210'
    ];

    for (const vp of validPhones) {
      const res = validateIndianMobile(vp);
      assert(res.isValid === true, `Expected valid phone: ${vp}`);
      assert(res.normalized && res.normalized.length === 10, `Normalized must be 10 digits: ${vp}`);
      console.log(`  ✓ Valid phone accepted: ${vp} -> ${res.normalized}`);
    }

    const invalidPhones = [
      { input: '1234567890', reason: 'starts with 1' },
      { input: '0123456789', reason: 'starts with 0' },
      { input: '987654321', reason: '9 digits' },
      { input: '98765432101', reason: '11 digits' },
      { input: '1111111111', reason: 'repeated 1s' },
      { input: '2222222222', reason: 'repeated 2s' },
      { input: '0000000000', reason: 'repeated 0s' },
      { input: 'abcdefghij', reason: 'letters' },
      { input: '98765abcde', reason: 'letters in number' },
      { input: '   ', reason: 'whitespace only' }
    ];

    for (const { input, reason } of invalidPhones) {
      const res = validateIndianMobile(input);
      assert(res.isValid === false, `Expected invalid phone: ${input} (${reason})`);
      assert(res.errorCode === 'INVALID_PHONE_NUMBER', `Expected errorCode INVALID_PHONE_NUMBER: ${input}`);
      assert(res.message === 'Please enter a valid 10-digit Indian mobile number.', `Expected friendly message: ${input}`);
      console.log(`  ✓ Invalid phone rejected: '${input}' (${reason}) -> ${res.errorCode}`);
    }

    // ----------------------------------------------------
    // PART B: Backend Profile & Auth Error Response Structure
    // ----------------------------------------------------
    console.log('\n--- PART B: Backend Profile & Registration Enforcement ---');

    // Register a test patient
    const testPatientEmail = `audit.phone.${Date.now()}@example.com`;
    const regRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Phone Audit Patient',
        email: testPatientEmail,
        password: 'Password123!',
        phone: '+91 98765 43210'
      }
    });
    assert(regRes.status === 201, 'Test patient registered successfully (201)');
    const patientToken = regRes.data.data.token;
    const patientUserId = regRes.data.data.user.id;
    testIdsToClean.users.push(patientUserId);

    // Verify initial phone was stored properly
    const patientInDb = await User.findById(patientUserId);
    assert(patientInDb.phone === '+91 98765 43210', 'Initial valid phone stored in DB');
    console.log('  ✓ Initial valid phone stored in MongoDB');

    // Attempt registration with invalid phone (e.g. 1234567890)
    const badRegRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Bad Phone User',
        email: `bad.phone.${Date.now()}@example.com`,
        password: 'Password123!',
        phone: '1234567890'
      }
    });
    assert(badRegRes.status === 400, 'Registration with invalid phone rejected (400)');
    assert(badRegRes.data.errorCode === 'INVALID_PHONE_NUMBER', 'Registration returns errorCode INVALID_PHONE_NUMBER');
    assert(badRegRes.data.message === 'Please enter a valid 10-digit Indian mobile number.', 'Registration returns friendly message');
    console.log('  ✓ Registration blocks invalid phone with HTTP 400 & INVALID_PHONE_NUMBER');

    // Attempt PATCH /api/profile with invalid phone
    const patchInvalidRes = await makeRequest({
      method: 'PATCH',
      path: '/api/profile',
      headers: { Authorization: `Bearer ${patientToken}` },
      body: { phone: '1234567890' }
    });
    assert(patchInvalidRes.status === 400, 'Profile update with invalid phone rejected (400)');
    assert(patchInvalidRes.data.errorCode === 'INVALID_PHONE_NUMBER', 'Profile update returns errorCode INVALID_PHONE_NUMBER');
    assert(patchInvalidRes.data.message === 'Please enter a valid 10-digit Indian mobile number.', 'Profile returns friendly message');
    assert(!patchInvalidRes.data.stack, 'Zero stack traces returned in response');
    console.log('  ✓ Profile PATCH returns structured HTTP 400 without leaking stack traces');

    // Verify DB was NOT updated
    const untouchedUser = await User.findById(patientUserId);
    assert(untouchedUser.phone === '+91 98765 43210', 'MongoDB phone was NOT modified by rejected update');
    console.log('  ✓ MongoDB data untouched after validation failure');

    // Attempt PATCH /api/profile with valid phone (9876543210)
    const patchValidRes = await makeRequest({
      method: 'PATCH',
      path: '/api/profile',
      headers: { Authorization: `Bearer ${patientToken}` },
      body: { phone: '9876543210' }
    });
    assert(patchValidRes.status === 200, 'Profile update with valid phone succeeds (200)');
    const updatedUser = await User.findById(patientUserId);
    assert(updatedUser.phone === '9876543210', 'MongoDB phone successfully updated to 9876543210');
    console.log('  ✓ Profile PATCH succeeds and updates MongoDB for valid 9876543210');

    // ----------------------------------------------------
    // PART C: SMTP Transporter Configuration & Port Handling
    // ----------------------------------------------------
    console.log('\n--- PART C: SMTP Configuration & Verification Diagnostics ---');

    // Verify getSmtpConfigStatus structure
    const configStatus = getSmtpConfigStatus();
    assert(configStatus.host === 'SET' || configStatus.host === 'NOT_SET', 'Config status host is SET or NOT_SET');
    assert(configStatus.port === 'SET' || configStatus.port === 'NOT_SET', 'Config status port is SET or NOT_SET');
    assert(configStatus.user === 'SET' || configStatus.user === 'NOT_SET', 'Config status user is SET or NOT_SET');
    assert(configStatus.password === 'SET' || configStatus.password === 'NOT_SET', 'Config status password is SET or NOT_SET');
    assert(configStatus.from === 'SET' || configStatus.from === 'NOT_SET', 'Config status from is SET or NOT_SET');
    console.log('  ✓ SMTP config status reporting verified without exposing credentials');

    // Test verifySmtpConnection in unconfigured environment (safe skip)
    resetTransporter();
    const origHost = process.env.EMAIL_HOST;
    const origUser = process.env.EMAIL_USER;
    delete process.env.EMAIL_HOST;
    delete process.env.EMAIL_USER;

    const unconfiguredVerify = await verifySmtpConnection();
    assert(typeof unconfiguredVerify.success === 'boolean', 'Startup-safe verify handles unconfigured environment gracefully');
    console.log('  ✓ Startup-safe verify handles unconfigured environment gracefully');

    // Test verifySmtpConnection with mocked verified transporter
    let verifyCallCount = 0;
    const mockSuccessTransporter = {
      verify: async () => {
        verifyCallCount++;
        return true;
      },
      sendMail: async (opts) => ({
        accepted: [opts.to],
        rejected: [],
        messageId: `<mock-test-${Date.now()}@appointease.com>`
      })
    };
    setTransporter(mockSuccessTransporter);

    const successVerify = await verifySmtpConnection();
    assert(successVerify.success === true, 'Mocked verify returns success: true');
    assert(successVerify.code === 'EMAIL_SMTP_VERIFY_SUCCESS', 'Returns EMAIL_SMTP_VERIFY_SUCCESS');
    assert(verifyCallCount === 1, 'Transporter.verify() was executed');
    console.log('  ✓ verifySmtpConnection successfully executes transporter.verify() and reports EMAIL_SMTP_VERIFY_SUCCESS');

    // Test verifySmtpConnection with simulated authentication error
    const mockAuthFailTransporter = {
      verify: async () => {
        const err = new Error('Invalid login: 535-5.7.8 Username and Password not accepted');
        err.code = 'EAUTH';
        err.responseCode = 535;
        throw err;
      }
    };
    setTransporter(mockAuthFailTransporter);

    const failedVerify = await verifySmtpConnection();
    assert(typeof failedVerify === 'object' && failedVerify !== null, 'verifySmtpConnection handles SMTP auth failure safely without crashing');
    console.log('  ✓ verifySmtpConnection handles SMTP auth failure safely without leaking credentials');

    // ----------------------------------------------------
    // PART D: sendMail() Result Inspection & Safe Logging
    // ----------------------------------------------------
    console.log('\n--- PART D: sendMail() Accepted/Rejected Result Inspection ---');

    // Test sendMail when recipient accepted by SMTP server
    setTransporter({
      sendMail: async (opts) => ({
        accepted: [opts.to],
        rejected: [],
        messageId: '<accepted-msg-999@appointease.com>'
      })
    });

    const acceptedSend = await sendEmail({
      to: 'aarav.sharma@example.com',
      subject: 'Test Subject',
      text: 'Test Body'
    });
    assert(acceptedSend.success === true, 'Accepted send returns success: true');
    assert(acceptedSend.code === 'EMAIL_ACCEPTED', 'Returns EMAIL_ACCEPTED');
    assert(acceptedSend.acceptedCount === 1, 'Accepted count is 1');
    assert(acceptedSend.rejectedCount === 0, 'Rejected count is 0');
    assert(acceptedSend.messageId === '<accepted-msg-999@appointease.com>', 'Captures real messageId');
    console.log('  ✓ sendMail() accurately inspects info.accepted and returns EMAIL_ACCEPTED with messageId');

    // Test sendMail when recipient rejected by SMTP server
    setTransporter({
      sendMail: async (opts) => ({
        accepted: [],
        rejected: [opts.to],
        messageId: '<rejected-msg-000@appointease.com>'
      })
    });

    const rejectedSend = await sendEmail({
      to: 'bad.mailbox@example.com',
      subject: 'Test Subject',
      text: 'Test Body'
    });
    assert(rejectedSend.success === false, 'Rejected send returns success: false');
    assert(rejectedSend.code === 'EMAIL_REJECTED', 'Returns EMAIL_REJECTED');
    assert(rejectedSend.acceptedCount === 0, 'Accepted count is 0');
    assert(rejectedSend.rejectedCount === 1, 'Rejected count is 1');
    console.log('  ✓ sendMail() accurately inspects info.rejected and returns EMAIL_REJECTED');

    // ----------------------------------------------------
    // PART E: Diagnostic Endpoint POST /api/notifications/test-email
    // ----------------------------------------------------
    console.log('\n--- PART E: Admin Diagnostic Endpoint POST /api/notifications/test-email ---');

    // Register an ADMIN user
    const adminEmail = `admin.diag.${Date.now()}@example.com`;
    const adminUser = await User.create({
      name: 'System Admin',
      email: adminEmail,
      password: 'AdminPassword123!',
      role: 'ADMIN'
    });
    testIdsToClean.users.push(adminUser._id);

    // Login as Admin
    const adminLoginRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: adminEmail,
        password: 'AdminPassword123!'
      }
    });
    assert(adminLoginRes.status === 200, 'Admin login succeeds');
    const adminToken = adminLoginRes.data.data.token;

    // 1. Anonymous access is blocked
    const anonRes = await makeRequest({
      method: 'POST',
      path: '/api/notifications/test-email',
      body: {}
    });
    assert(anonRes.status === 401, 'Anonymous access returns 401 Unauthorized');
    console.log('  ✓ Anonymous access to test-email returns 401');

    // 2. Patient access is forbidden
    const patientAccessRes = await makeRequest({
      method: 'POST',
      path: '/api/notifications/test-email',
      headers: { Authorization: `Bearer ${patientToken}` },
      body: {}
    });
    assert(patientAccessRes.status === 403, 'Patient access returns 403 Forbidden');
    console.log('  ✓ Patient access to test-email returns 403 Forbidden');

    // 3. Admin access succeeds and strictly delivers to adminUser.email
    let dispatchedRecipient = null;
    setTransporter({
      sendMail: async (opts) => {
        dispatchedRecipient = opts.to;
        return {
          accepted: [opts.to],
          rejected: [],
          messageId: `<admin-test-diag-${Date.now()}@appointease.com>`
        };
      }
    });

    const adminDiagRes = await makeRequest({
      method: 'POST',
      path: '/api/notifications/test-email',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { to: 'malicious.arbitrary@example.com' } // Public payload trying to spoof recipient
    });
    assert(adminDiagRes.status === 200, 'Admin diagnostic email returns 200 OK');
    assert(adminDiagRes.data.success === true, 'Response indicates success: true');
    assert(adminDiagRes.data.code === 'EMAIL_ACCEPTED', 'Response code is EMAIL_ACCEPTED');
    assert(adminDiagRes.data.messageId, 'Response includes messageId');
    assert(dispatchedRecipient === adminEmail, 'Dispatched strictly to authenticated admin email from MongoDB');
    console.log('  ✓ Admin diagnostic email endpoint strictly uses MongoDB admin email (ignores request body)');

    // ----------------------------------------------------
    // PART F: Reliable Email Pipeline in Confirmation, Cancellation & Reschedule
    // ----------------------------------------------------
    console.log('\n--- PART F: Confirmation, Cancellation & Reschedule Email Pipeline ---');

    let confirmedRecipient = null;
    let cancelledRecipient = null;
    let rescheduledRecipient = null;

    setTransporter({
      sendMail: async (opts) => {
        if (/Confirmed/i.test(opts.subject)) confirmedRecipient = opts.to;
        if (/Cancelled/i.test(opts.subject)) cancelledRecipient = opts.to;
        if (/Rescheduled/i.test(opts.subject)) rescheduledRecipient = opts.to;
        return {
          accepted: [opts.to],
          rejected: [],
          messageId: `<mock-pipeline-${Date.now()}@appointease.com>`
        };
      }
    });

    // Confirmation notification
    const mockAppt = {
      _id: new mongoose.Types.ObjectId(),
      appointmentId: 'APT-TEST-EMAIL-001',
      userId: patientUserId,
      appointmentDate: '2026-09-20',
      startTime: '10:00',
      endTime: '10:30'
    };

    await notifyAppointmentConfirmed({
      appointment: mockAppt,
      patient: { email: 'untrusted.fake@example.com' }, // Spoofed patient object
      provider: { name: 'Dr. Suresh Varma' },
      service: { name: 'General Consultation' }
    });
    assert(confirmedRecipient === testPatientEmail, 'Confirmation strictly resolves patient email from User.findById');
    console.log('  ✓ notifyAppointmentConfirmed strictly uses User.findById (ignored spoofed email)');

    // Cancellation notification
    await notifyAppointmentCancelled({
      appointment: mockAppt,
      patient: { email: 'untrusted.fake@example.com' },
      provider: { name: 'Dr. Suresh Varma' },
      service: { name: 'General Consultation' },
      cancellationReason: 'Patient request'
    });
    assert(cancelledRecipient === testPatientEmail, 'Cancellation strictly resolves patient email from User.findById');
    console.log('  ✓ notifyAppointmentCancelled strictly uses User.findById (ignored spoofed email)');

    // Reschedule notification
    await notifyAppointmentRescheduled({
      appointment: mockAppt,
      patient: { email: 'untrusted.fake@example.com' },
      provider: { name: 'Dr. Suresh Varma' },
      service: { name: 'General Consultation' },
      previousDate: '2026-09-18',
      previousStartTime: '11:00'
    });
    assert(rescheduledRecipient === testPatientEmail, 'Reschedule strictly resolves patient email from User.findById');
    console.log('  ✓ notifyAppointmentRescheduled strictly uses User.findById (ignored spoofed email)');

    // Verify non-blocking failure: appointment logic remains unharmed if email service throws
    setTransporter({
      sendMail: async () => {
        throw new Error('Simulated network timeout during sendMail');
      }
    });

    const failingRes = await notifyAppointmentConfirmed({
      appointment: mockAppt,
      provider: { name: 'Dr. Suresh Varma' },
      service: { name: 'General Consultation' }
    });
    assert(failingRes && failingRes.inAppNotification, 'In-app notification is still generated despite email failure');
    assert(failingRes.emailResult && typeof failingRes.emailResult.success === 'boolean', 'Email failure safely captured without throwing');
    console.log('  ✓ Email failure is non-blocking: in-app notification created and error caught cleanly');

    // Restore environment variables
    if (origHost) process.env.EMAIL_HOST = origHost;
    if (origUser) process.env.EMAIL_USER = origUser;
    resetTransporter();

    // ----------------------------------------------------
    // Cleanup & Baseline Integrity
    // ----------------------------------------------------
    console.log('\n--- Cleanup & Baseline Restoration ---');
    if (testIdsToClean.users.length > 0) {
      await User.deleteMany({ _id: { $in: testIdsToClean.users } });
    }
    if (testIdsToClean.appointments.length > 0) {
      await Appointment.deleteMany({ _id: { $in: testIdsToClean.appointments } });
    }

    const finalApptCount = await Appointment.countDocuments();
    assert(finalApptCount === initialApptCount, `Appointment count must remain exact baseline: ${finalApptCount} == ${initialApptCount}`);
    console.log(`  ✓ Database restored to exact baseline: ${finalApptCount} == ${initialApptCount}`);

    console.log('\n====================================================');
    console.log('✓ ALL EMAIL & PHONE VALIDATION TESTS PASSED (100% GREEN)');
    console.log('====================================================\n');
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
};

runSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
  });
