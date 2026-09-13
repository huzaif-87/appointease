require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const { app } = require('../src/server');
const { User, Appointment, Provider, Service } = require('../src/models');
const { sendEmail, setTransporter, resetTransporter } = require('../src/services/emailService');
const { setGeminiClient: setAiClient, resetGeminiClient: resetAiClient } = require('../src/services/geminiService');

let BASELINE_APPOINTMENTS;
let serverInstance = null;
let serverPort = null;
let cleanupUserIds = [];
let cleanupAppointmentIds = [];

const makeRequest = ({ method, path, headers = {}, body = null }) => {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port: serverPort,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
};

const assert = (condition, message) => {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
};

async function runTests() {
  console.log('====================================================');
  console.log('  AppointEase — Critical Production Fixes Test Suite');
  console.log('  Auth Gate, RBAC, Rate Limiting, AI & Email Audit  ');
  console.log('====================================================\n');

  // Connect to DB
  await mongoose.connect(
    process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/appointease',
    { dbName: 'appointease', serverSelectionTimeoutMS: 5000 }
  );

  // Clean any leftover test records from previous aborted runs
  await Appointment.deleteMany({ reason: 'Regular Health Checkup' });
  await User.deleteMany({ email: { $regex: '^audit\\.patient' } });

  const initialApptCount = await Appointment.countDocuments();
  BASELINE_APPOINTMENTS = initialApptCount;
  console.log(`Initial baseline appointments in DB: ${initialApptCount}`);

  // Start HTTP test server
  await new Promise((resolve) => {
    serverInstance = app.listen(0, '127.0.0.1', () => {
      serverPort = serverInstance.address().port;
      console.log(`Test server running on port ${serverPort}\n`);
      resolve();
    });
  });

  let testPatientToken = null;
  let testPatientEmail = `audit.patient.${Date.now()}@example.com`;
  let testPatientId = null;

  try {
    // -------------------------------------------------------------------------
    // 1. Issue 4 & 6: Registration Lifecycle
    // -------------------------------------------------------------------------
    console.log('--- 1. Registration & Authentication Lifecycle ---');

    const regRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Audit Patient',
        email: testPatientEmail,
        password: 'Password@123',
        phone: '+91 99999 88888'
      }
    });

    assert(regRes.status === 201, `POST /api/auth/register returns 201 Created (got ${regRes.status})`);
    assert(regRes.data?.data?.token, 'Registration returns valid JWT bearer token');
    assert(regRes.data?.data?.user?.email === testPatientEmail, 'Returned user email matches registration');
    assert(regRes.data?.data?.user?.role === 'PATIENT', 'Registered user defaults to PATIENT role');

    testPatientToken = regRes.data.data.token;
    testPatientId = regRes.data.data.user.id;
    cleanupUserIds.push(testPatientId);

    // Verify duplicate email is rejected with 409
    const dupRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Duplicate Patient',
        email: testPatientEmail,
        password: 'Password@123'
      }
    });
    assert(dupRes.status === 409, `Duplicate registration rejected with 409 Conflict (got ${dupRes.status})`);

    // Verify login with correct credentials returns 200
    const loginRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: testPatientEmail,
        password: 'Password@123'
      }
    });
    assert(loginRes.status === 200, `POST /api/auth/login returns 200 OK (got ${loginRes.status})`);
    assert(loginRes.data?.data?.token, 'Login returns signed JWT token');

    // Verify login with wrong password returns 401
    const badLoginRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: testPatientEmail,
        password: 'WrongPassword999'
      }
    });
    assert(badLoginRes.status === 401, `Invalid credentials rejected with 401 Unauthorized (got ${badLoginRes.status})`);

    // Verify GET /api/auth/me returns authenticated user
    const meRes = await makeRequest({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${testPatientToken}` }
    });
    assert(meRes.status === 200, `GET /api/auth/me returns 200 OK (got ${meRes.status})`);
    assert(meRes.data?.data?.user?.email === testPatientEmail, 'GET /api/auth/me returns authenticated user doc');

    // -------------------------------------------------------------------------
    // 2. Issue 4: Authentication Gate (Unauthenticated access blocked)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Authentication Gate: Anonymous Access Blocked ---');

    const anonAppts = await makeRequest({ method: 'GET', path: '/api/appointments' });
    assert(anonAppts.status === 401, `Anonymous GET /api/appointments returns 401 (got ${anonAppts.status})`);

    const anonNotifs = await makeRequest({ method: 'GET', path: '/api/notifications' });
    assert(anonNotifs.status === 401, `Anonymous GET /api/notifications returns 401 (got ${anonNotifs.status})`);

    const anonMe = await makeRequest({ method: 'GET', path: '/api/auth/me' });
    assert(anonMe.status === 401, `Anonymous GET /api/auth/me returns 401 (got ${anonMe.status})`);

    const anonAI = await makeRequest({
      method: 'POST',
      path: '/api/ai/time-recommendations',
      body: { query: 'Cardiology tomorrow' }
    });
    assert(anonAI.status === 401, `Anonymous POST /api/ai/time-recommendations returns 401 (got ${anonAI.status})`);

    // Public endpoints remain accessible
    const publicServices = await makeRequest({ method: 'GET', path: '/api/services' });
    assert(publicServices.status === 200, `Public GET /api/services returns 200 (got ${publicServices.status})`);

    const publicProviders = await makeRequest({ method: 'GET', path: '/api/providers' });
    assert(publicProviders.status === 200, `Public GET /api/providers returns 200 (got ${publicProviders.status})`);

    // -------------------------------------------------------------------------
    // 3. Issue 2: Role Separation & RBAC Enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Role Separation & RBAC Authorization ---');

    // Patient cannot access Admin endpoints
    const patientAdminRes = await makeRequest({
      method: 'GET',
      path: '/api/admin/overview',
      headers: { Authorization: `Bearer ${testPatientToken}` }
    });
    assert(
      patientAdminRes.status === 403,
      `Patient accessing /api/admin/overview receives 403 Forbidden (got ${patientAdminRes.status})`
    );

    // Admin token can access Admin overview
    const adminTokenRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/demo-token',
      body: { role: 'ADMIN' }
    });
    const adminToken = adminTokenRes.data?.data?.token;

    const adminOverviewRes = await makeRequest({
      method: 'GET',
      path: '/api/admin/overview',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminOverviewRes.status === 200, `Admin accessing /api/admin/overview receives 200 OK (got ${adminOverviewRes.status})`);

    // Provider cannot access Admin overview
    const provTokenRes = await makeRequest({
      method: 'POST',
      path: '/api/auth/demo-token',
      body: { role: 'PROVIDER' }
    });
    const provToken = provTokenRes.data?.data?.token;

    const provAdminRes = await makeRequest({
      method: 'GET',
      path: '/api/admin/overview',
      headers: { Authorization: `Bearer ${provToken}` }
    });
    assert(provAdminRes.status === 403, `Provider accessing /api/admin/overview receives 403 Forbidden (got ${provAdminRes.status})`);

    // -------------------------------------------------------------------------
    // 4. Issue 3: Rate Limiter Architecture
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Categorized Rate Limiter Protection ---');

    // Public catalog permits repeated queries without premature 429
    let catalogSuccessCount = 0;
    for (let i = 0; i < 20; i++) {
      const res = await makeRequest({ method: 'GET', path: '/api/services' });
      if (res.status === 200) catalogSuccessCount++;
    }
    assert(catalogSuccessCount === 20, `Public catalog processed 20 sequential requests without 429 (count: ${catalogSuccessCount})`);

    // -------------------------------------------------------------------------
    // 5. Issue 1: Smart Time Recommendation for Authenticated Patient
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Smart Time Recommendation for Authenticated Patient ---');

    // Mock Gemini for hermetic test execution
    setAiClient({
      generateContent: async () => ({
        response: {
          text: () => JSON.stringify({
            specialty: 'Cardiology',
            providerId: null,
            serviceId: null,
            dateFrom: null,
            dateTo: null,
            timeAfter: '17:00',
            timeBefore: null,
            preferredDays: [],
            preferredPeriod: 'evening',
            sortPreference: 'best_match',
            maxRecommendations: 3
          })
        }
      })
    });

    const smartRes = await makeRequest({
      method: 'POST',
      path: '/api/ai/time-recommendations',
      headers: { Authorization: `Bearer ${testPatientToken}` },
      body: { query: 'I need a cardiology appointment after 5 PM this week' }
    });

    assert(smartRes.status === 200, `POST /api/ai/time-recommendations returns 200 OK (got ${smartRes.status})`);
    assert(smartRes.data?.data?.interpretedRequest?.specialty === 'Cardiology', 'Interpreted constraints extracted Cardiology');
    assert(Array.isArray(smartRes.data?.data?.recommendations), 'Recommendations array returned');

    resetAiClient();

    // -------------------------------------------------------------------------
    // 6. Issue 5: Email Service & Registered User Email Delivery Flow
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Email Service Reliability & Registered Recipient Binding ---');

    // Test emailService returns structured status when unconfigured
    const unconfiguredEmail = await sendEmail({
      to: testPatientEmail,
      subject: 'Test Unconfigured',
      text: 'Test',
      emailType: 'TEST_UNCONFIGURED'
    });
    assert(
      unconfiguredEmail.code === 'EMAIL_NOT_CONFIGURED' || unconfiguredEmail.success === true,
      `Email service returns structured code (${unconfiguredEmail.code || 'EMAIL_SENT'})`
    );

    // Book an appointment and verify the email recipient strictly matches registered patient
    const activeProvider = await Provider.findOne({ status: 'ACTIVE' }).lean();
    const activeService = await Service.findOne({ _id: { $in: activeProvider.serviceIds } }).lean();

    // Mock transporter to capture email recipient
    let capturedRecipient = null;
    let capturedSubject = null;
    setTransporter({
      sendMail: async (opts) => {
        capturedRecipient = opts.to;
        capturedSubject = opts.subject;
        return { messageId: 'mock-audit-12345' };
      }
    });

    const bookRes = await makeRequest({
      method: 'POST',
      path: '/api/appointments',
      headers: { Authorization: `Bearer ${testPatientToken}` },
      body: {
        providerId: activeProvider._id.toString(),
        serviceId: activeService._id.toString(),
        appointmentDate: '2026-10-15',
        startTime: '10:00',
        reason: 'Regular Health Checkup'
      }
    });

    assert(bookRes.status === 201, `Appointment booking returns 201 Created (got ${bookRes.status})`);
    const createdApptId = bookRes.data?.data?.appointment?._id;
    if (createdApptId) cleanupAppointmentIds.push(createdApptId);

    // Allow non-blocking background notification & email dispatch to complete
    for (let i = 0; i < 20; i++) {
      if (capturedRecipient) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    assert(
      capturedRecipient === testPatientEmail,
      `Email was dispatched to registered patient's DB email address (${capturedRecipient})`
    );
    assert(
      capturedSubject && capturedSubject.includes('Confirmed'),
      `Email subject contains confirmation notice (${capturedSubject})`
    );

    // Verify in-app notification was created
    const notifsRes = await makeRequest({
      method: 'GET',
      path: '/api/notifications',
      headers: { Authorization: `Bearer ${testPatientToken}` }
    });
    assert(notifsRes.status === 200, `GET /api/notifications returns 200 OK (got ${notifsRes.status})`);
    assert(
      notifsRes.data?.data?.notifications?.length > 0,
      'In-app notification created for confirmed appointment'
    );

    resetTransporter();

    // -------------------------------------------------------------------------
    // 7. Cleanup & Baseline Dataset Restoration
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Cleanup & Baseline Dataset Integrity ---');

    if (cleanupAppointmentIds.length > 0) {
      await Appointment.deleteMany({ _id: { $in: cleanupAppointmentIds } });
      console.log(`Cleaned up ${cleanupAppointmentIds.length} test appointment(s)`);
    }

    if (cleanupUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: cleanupUserIds } });
      console.log(`Cleaned up ${cleanupUserIds.length} test user(s)`);
    }

    const finalApptCount = await Appointment.countDocuments();
    assert(
      finalApptCount === BASELINE_APPOINTMENTS,
      `Database appointment count restored to exact baseline: ${finalApptCount} == ${BASELINE_APPOINTMENTS}`
    );

    console.log('\n====================================================');
    console.log('✓ ALL CRITICAL PRODUCTION FIX TESTS PASSED (100% GREEN)');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\nTest execution failed:', err);
    process.exitCode = 1;
  } finally {
    if (cleanupAppointmentIds.length > 0) {
      await Appointment.deleteMany({ _id: { $in: cleanupAppointmentIds } }).catch(() => {});
    }
    if (cleanupUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: cleanupUserIds } }).catch(() => {});
    }
    if (serverInstance) {
      await new Promise((r) => serverInstance.close(r));
    }
    await mongoose.disconnect();
  }
}

runTests();
