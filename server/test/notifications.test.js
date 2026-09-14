require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');
const { User, Service, Provider, Availability, Appointment, Notification } = require('../src/models');
const { setTransporter, resetTransporter, sendEmail } = require('../src/services/emailService');

const runMilestone8Tests = async () => {
  console.log('====================================================');
  console.log('  AppointEase — Milestone 8 Automated Test Suite     ');
  console.log('  Appointment Notifications & Email Delivery Tests    ');
  console.log('====================================================\n');

  let server;
  let baseUrl;
  let testCount = 0;
  let passCount = 0;
  let failCount = 0;

  const createdTestAppointmentIds = new Set();
  const createdTestNotificationIds = new Set();
  const interceptedEmails = [];

  // Mock transporter to verify email attempts without sending real emails
  const mockTransporter = {
    sendMail: async (options) => {
      interceptedEmails.push(options);
      return { messageId: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}` };
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

    // Baseline count verification
    const initialBaselineCount = await Appointment.countDocuments();
    assert(
      'M8-Setup-1',
      'Initial baseline appointment count is valid',
      initialBaselineCount >= 100,
      `Count: ${initialBaselineCount}`
    );

    // Retrieve Test Users & Roles
    const patientUsers = await User.find({ role: 'PATIENT' }).limit(2);
    const patientA = patientUsers[0];
    const patientB = patientUsers[1];
    const providerUser = await User.findOne({ role: 'PROVIDER' });

    assert('M8-Setup-2', 'Patient A exists', !!patientA, patientA?.email);
    assert('M8-Setup-3', 'Patient B exists', !!patientB, patientB?.email);

    const jwtSecret = process.env.JWT_SECRET || 'development_appointease_secret_key_change_in_prod';
    const patientAToken = jwt.sign(
      { id: patientA._id.toString(), role: patientA.role },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const patientBToken = jwt.sign(
      { id: patientB._id.toString(), role: patientB.role },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const providerToken = jwt.sign(
      { id: providerUser ? providerUser._id.toString() : new mongoose.Types.ObjectId().toString(), role: 'PROVIDER' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // Find an active provider and service with an EXISTING 10:00–18:00 availability shift (never mutate 165 baseline availabilities)
    const avail = await Availability.findOne({
      dayOfWeek: 'Monday',
      isActive: true,
      startTime: '10:00',
      endTime: '18:00'
    });
    
    const providerDoc = await Provider.findById(avail.providerId).populate('serviceIds');
    const serviceDoc = providerDoc.serviceIds[0];
    const targetDate = '2026-09-28'; // Monday

    // ==========================================
    // 1. CONFIRMATION NOTIFICATION & EMAIL ATTEMPT
    // ==========================================
    console.log('\n--- 1. Confirmation Notification & Email Delivery ---');
    interceptedEmails.length = 0;

    const bookRes = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      headers: { 'Idempotency-Key': `m8-confirm-${Date.now()}` },
      body: {
        providerId: providerDoc._id.toString(),
        serviceId: serviceDoc._id.toString(),
        appointmentDate: targetDate,
        startTime: '10:00',
        reason: 'Milestone 8 Notification Testing'
      }
    });

    assert('M8-T1', 'Appointment booked successfully (201 Created)', bookRes.status === 201);
    const confirmedApt = bookRes.data?.data?.appointment;
    const aptRefId = confirmedApt?.appointmentId;
    const aptDbId = confirmedApt?._id || confirmedApt?.id;
    if (aptDbId) createdTestAppointmentIds.add(aptDbId);

    // Wait a tick for async notification/email dispatch
    await new Promise((r) => setTimeout(r, 200));

    // Verify In-App Notification created in MongoDB
    const confirmNotif = await Notification.findOne({
      userId: patientA._id,
      appointmentId: aptRefId,
      type: 'APPOINTMENT_CONFIRMED'
    });

    assert('M8-T2', 'Confirmation created in-app notification in database', !!confirmNotif);
    assert(
      'M8-T3',
      'Notification contains informative title and message',
      confirmNotif?.title === 'Appointment Confirmed' && confirmNotif?.message.includes(providerDoc.name)
    );
    assert('M8-T4', 'Notification is initially marked unread (read: false)', confirmNotif?.read === false);
    if (confirmNotif?._id) createdTestNotificationIds.add(confirmNotif._id.toString());

    // Verify confirmation email was attempted
    const confirmEmail = interceptedEmails.find(
      (e) => e.to === patientA.email && (e.subject.includes('Confirmation') || e.subject.includes('Appointment'))
    );
    assert('M8-T5', 'Confirmation email was attempted to patient email', !!confirmEmail, confirmEmail?.to);
    assert(
      'M8-T6',
      'Email contains appointment details without passwords or JWTs',
      confirmEmail?.text.includes(aptRefId) &&
        !confirmEmail?.text.includes('Bearer') &&
        !confirmEmail?.text.includes('password')
    );

    // ==========================================
    // 2. RESCHEDULE NOTIFICATION & EMAIL ATTEMPT
    // ==========================================
    console.log('\n--- 2. Reschedule Notification & Email Delivery ---');
    interceptedEmails.length = 0;

    const rescheduleRes = await makeRequest(`/api/appointments/${aptRefId}/reschedule`, {
      method: 'PATCH',
      token: patientAToken,
      body: {
        appointmentDate: targetDate,
        startTime: '11:00'
      }
    });

    assert('M8-T7', 'Appointment rescheduled successfully (200 OK)', rescheduleRes.status === 200);
    await new Promise((r) => setTimeout(r, 200));

    // Verify in-app reschedule notification
    const rescheduleNotif = await Notification.findOne({
      userId: patientA._id,
      appointmentId: aptRefId,
      type: 'APPOINTMENT_RESCHEDULED'
    });

    assert('M8-T8', 'Reschedule created in-app notification in database', !!rescheduleNotif);
    assert(
      'M8-T9',
      'Notification specifies previous time and new time',
      rescheduleNotif?.message.includes('10:00') && rescheduleNotif?.message.includes('11:00')
    );
    if (rescheduleNotif?._id) createdTestNotificationIds.add(rescheduleNotif._id.toString());

    // Verify reschedule email was attempted
    const rescheduleEmail = interceptedEmails.find(
      (e) => e.to === patientA.email && e.subject.includes('Appointment Rescheduled')
    );
    assert('M8-T10', 'Reschedule email was attempted to patient email', !!rescheduleEmail);
    assert(
      'M8-T11',
      'Email contains previous and new schedule timestamps',
      rescheduleEmail?.text.includes('10:00') && rescheduleEmail?.text.includes('11:00')
    );

    // ==========================================
    // 3. CANCELLATION NOTIFICATION & EMAIL ATTEMPT
    // ==========================================
    console.log('\n--- 3. Cancellation Notification & Email Delivery ---');
    interceptedEmails.length = 0;

    const cancelRes = await makeRequest(`/api/appointments/${aptRefId}/cancel`, {
      method: 'PATCH',
      token: patientAToken,
      body: {
        cancellationReason: 'Doctor conflict resolved elsewhere'
      }
    });

    assert('M8-T12', 'Appointment cancelled successfully (200 OK)', cancelRes.status === 200);
    // Wait for async notification/email dispatch
    let cancelNotif = null;
    let cancelEmail = null;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (!cancelNotif) {
        cancelNotif = await Notification.findOne({
          userId: patientA._id,
          appointmentId: aptRefId,
          type: 'APPOINTMENT_CANCELLED'
        });
      }
      if (!cancelEmail) {
        cancelEmail = interceptedEmails.find(
          (e) => e.to === patientA.email && e.subject.includes('Appointment Cancelled')
        );
      }
      if (cancelNotif && cancelEmail) break;
    }

    assert('M8-T13', 'Cancellation created in-app notification in database', !!cancelNotif);
    assert('M8-T14', 'Notification mentions provider and appointment cancellation', cancelNotif?.message.includes('cancelled'));
    if (cancelNotif?._id) createdTestNotificationIds.add(cancelNotif._id.toString());

    // Verify cancellation email was attempted
    assert('M8-T15', 'Cancellation email was attempted to patient email', !!cancelEmail);
    assert(
      'M8-T16',
      'Cancellation email includes the cancellation reason',
      cancelEmail?.text.includes('Doctor conflict resolved elsewhere')
    );

    // ==========================================
    // 4. NOTIFICATION API & RBAC ENFORCEMENT
    // ==========================================
    console.log('\n--- 4. Notification API & Security Ownership ---');

    // Unauthenticated request
    const unauthNotifRes = await makeRequest('/api/notifications');
    assert('M8-T17', 'Unauthenticated GET /api/notifications rejected with 401', unauthNotifRes.status === 401);

    // Provider role request
    const providerNotifRes = await makeRequest('/api/notifications', { token: providerToken });
    assert('M8-T18', 'Provider role rejected with 403 on patient notifications', providerNotifRes.status === 403);

    // Patient A retrieves own notifications
    const patientANotifRes = await makeRequest('/api/notifications', { token: patientAToken });
    assert('M8-T19', 'Patient A can retrieve own notifications (200 OK)', patientANotifRes.status === 200);
    const patientANotifs = patientANotifRes.data?.data?.notifications || [];
    assert(
      'M8-T20',
      'Patient A notifications belong strictly to Patient A',
      patientANotifs.every((n) => n.userId.toString() === patientA._id.toString())
    );

    // Patient B retrieves own notifications and CANNOT see Patient A's notifications
    const patientBNotifRes = await makeRequest('/api/notifications', { token: patientBToken });
    assert('M8-T21', 'Patient B receives 200 for own notifications', patientBNotifRes.status === 200);
    const patientBNotifs = patientBNotifRes.data?.data?.notifications || [];
    const patientBHasAptRef = patientBNotifs.some((n) => n.appointmentId === aptRefId);
    assert('M8-T22', 'Patient B CANNOT see Patient A notifications (Zero data leakage)', !patientBHasAptRef);

    // Mark single notification as read
    if (confirmNotif) {
      // Patient B tries to mark Patient A's notification as read
      const bMarksARes = await makeRequest(`/api/notifications/${confirmNotif._id}/read`, {
        method: 'PATCH',
        token: patientBToken
      });
      assert('M8-T23', 'Patient B cannot mark Patient A notification as read (404/403)', bMarksARes.status === 404);

      // Patient A marks own notification as read
      const aMarksARes = await makeRequest(`/api/notifications/${confirmNotif._id}/read`, {
        method: 'PATCH',
        token: patientAToken
      });
      assert('M8-T24', 'Patient A can mark own notification as read (200 OK)', aMarksARes.status === 200);
      assert('M8-T25', 'Notification document updated with read: true', aMarksARes.data?.data?.notification?.read === true);
    }

    // Mark all notifications as read
    const markAllRes = await makeRequest('/api/notifications/read-all', {
      method: 'PATCH',
      token: patientAToken
    });
    assert('M8-T26', 'Patient A can mark all notifications as read (200 OK)', markAllRes.status === 200);
    assert('M8-T27', 'Unread count is 0 after mark-all-read', markAllRes.data?.data?.unreadCount === 0);

    // ==========================================
    // 5. EMAIL SERVICE RESILIENCE & FAILURE ISOLATION
    // ==========================================
    console.log('\n--- 5. Email Service Resilience & Failure Isolation ---');

    // Scenario A: Missing configuration gracefully handled
    resetTransporter();
    const missingConfigResult = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      text: 'Test',
      emailType: 'TEST_NO_CONFIG'
    });
    assert(
      'M8-T28',
      'Email service handles missing SMTP configuration without throwing',
      typeof missingConfigResult === 'object' && missingConfigResult !== null
    );

    // Scenario B: Transporter throwing connection/network error
    const failingTransporter = {
      sendMail: async () => {
        const error = new Error('getaddrinfo ENOTFOUND smtp.example.com');
        error.code = 'ECONNREFUSED';
        throw error;
      }
    };
    setTransporter(failingTransporter);

    const failingResult = await sendEmail({
      to: 'test@example.com',
      subject: 'Test Failing',
      text: 'Test Failing',
      emailType: 'TEST_FAILING'
    });
    assert(
      'M8-T29',
      'Email service catches network errors gracefully without crashing',
      typeof failingResult === 'object' && failingResult !== null
    );

    // Scenario C: Booking succeeds even when email delivery throws!
    const bookWithFailingEmailRes = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      headers: { 'Idempotency-Key': `m8-fail-email-${Date.now()}` },
      body: {
        providerId: providerDoc._id.toString(),
        serviceId: serviceDoc._id.toString(),
        appointmentDate: targetDate,
        startTime: '14:00',
        reason: 'Testing Email Failure Isolation'
      }
    });

    assert(
      'M8-T30',
      'Appointment creation succeeds (201 Created) even when email delivery fails completely',
      bookWithFailingEmailRes.status === 201
    );
    const failEmailApt = bookWithFailingEmailRes.data?.data?.appointment;
    const failEmailAptId = failEmailApt?._id || failEmailApt?.id;
    if (failEmailAptId) createdTestAppointmentIds.add(failEmailAptId);

    // Scenario D: Cancellation succeeds even when email delivery throws!
    const cancelWithFailingEmailRes = await makeRequest(`/api/appointments/${failEmailApt.appointmentId}/cancel`, {
      method: 'PATCH',
      token: patientAToken,
      body: { cancellationReason: 'Test failure isolation' }
    });
    assert(
      'M8-T31',
      'Appointment cancellation succeeds (200 OK) even when email delivery fails completely',
      cancelWithFailingEmailRes.status === 200
    );

    // Scenario E: Rescheduling succeeds even when email delivery throws!
    // Create new appointment for reschedule test
    const bookForRescheduleRes = await makeRequest('/api/appointments', {
      method: 'POST',
      token: patientAToken,
      headers: { 'Idempotency-Key': `m8-resched-fail-${Date.now()}` },
      body: {
        providerId: providerDoc._id.toString(),
        serviceId: serviceDoc._id.toString(),
        appointmentDate: targetDate,
        startTime: '15:00',
        reason: 'Reschedule Email Failure Test'
      }
    });
    const reschedApt = bookForRescheduleRes.data?.data?.appointment;
    if (reschedApt?._id) createdTestAppointmentIds.add(reschedApt._id);

    const rescheduleWithFailingEmailRes = await makeRequest(`/api/appointments/${reschedApt.appointmentId}/reschedule`, {
      method: 'PATCH',
      token: patientAToken,
      body: {
        appointmentDate: targetDate,
        startTime: '16:00'
      }
    });
    assert(
      'M8-T32',
      'Appointment rescheduling succeeds (200 OK) even when email delivery fails completely',
      rescheduleWithFailingEmailRes.status === 200
    );

    // ==========================================
    // 6. CLEANUP & BASELINE INTEGRITY RESTORATION
    // ==========================================
    console.log('\n--- 6. Cleanup & Baseline Dataset Restoration ---');

    for (const aptId of createdTestAppointmentIds) {
      await Appointment.findByIdAndDelete(aptId).catch(() => {});
    }
    // Delete any test notifications created
    for (const notifId of createdTestNotificationIds) {
      await Notification.findByIdAndDelete(notifId).catch(() => {});
    }
    await Notification.deleteMany({
      appointmentId: { $in: Array.from(createdTestAppointmentIds) }
    }).catch(() => {});

    const finalBaselineCount = await Appointment.countDocuments();
    assert(
      'M8-Cleanup-1',
      'Database restored precisely to initial baseline appointments',
      finalBaselineCount === initialBaselineCount,
      `Count: ${finalBaselineCount}, Baseline: ${initialBaselineCount}`
    );

  } catch (err) {
    console.error('Fatal error during Milestone 8 test execution:', err);
    failCount++;
  } finally {
    resetTransporter();
    for (const aptId of createdTestAppointmentIds) {
      await Appointment.findByIdAndDelete(aptId).catch(() => {});
    }
    for (const notifId of createdTestNotificationIds) {
      await Notification.findByIdAndDelete(notifId).catch(() => {});
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.connection.close();
  }

  console.log('\n====================================================');
  console.log(`  Milestone 8 Test Summary: ${passCount}/${testCount} Passed (${failCount} Failed)`);
  console.log('====================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
};

runMilestone8Tests();
