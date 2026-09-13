require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');
const { User, Service, Provider, Availability, Appointment } = require('../src/models');

/**
 * AppointEase Automated Test Suite
 * Milestone 2.5 (Persistence & RBAC) + Milestone 3 (Discovery Experience)
 */
const runTests = async () => {
  console.log('====================================================');
  console.log('  AppointEase — Comprehensive Automated Test Suite  ');
  console.log('  (Milestone 2.5 RBAC + Milestone 3 Discovery)     ');
  console.log('====================================================\n');

  let server;
  let baseUrl;
  let testCount = 0;
  let passCount = 0;
  let failCount = 0;

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
        method: options.method || 'GET'
      });
      const data = await res.json().catch(() => null);
      return { status: res.status, data };
    };

    const jwtSecret = process.env.JWT_SECRET || 'development_appointease_secret_key_change_in_prod';
    const patientToken = jwt.sign({ id: new mongoose.Types.ObjectId(), role: 'PATIENT', email: 'patient@test.com' }, jwtSecret, { expiresIn: '1h' });
    const providerToken = jwt.sign({ id: new mongoose.Types.ObjectId(), role: 'PROVIDER', email: 'provider@test.com' }, jwtSecret, { expiresIn: '1h' });
    const adminToken = jwt.sign({ id: new mongoose.Types.ObjectId(), role: 'ADMIN', email: 'admin@test.com' }, jwtSecret, { expiresIn: '1h' });

    console.log('--- MILESTONE 2.5: PERSISTENCE & RBAC FOUNDATION ---');

    // 1. MongoDB Seed Persistence
    const isDbConnected = mongoose.connection.readyState === 1;
    assert('M2.5-1', 'MongoDB seed persistence', isDbConnected, `State: ${mongoose.connection.readyState}, DB: ${mongoose.connection.name}`);

    // 2. Expected Document Counts
    const [userCount, providerCount, serviceCount, availCount, aptCount] = await Promise.all([
      User.countDocuments(),
      Provider.countDocuments(),
      Service.countDocuments(),
      Availability.countDocuments(),
      Appointment.countDocuments()
    ]);
    const countsMatch = userCount >= 35 && providerCount >= 30 && serviceCount >= 15 && availCount >= 100 && aptCount >= 100;
    assert('M2.5-2', 'Expected document counts', countsMatch, `U:${userCount}, P:${providerCount}, S:${serviceCount}, Av:${availCount}, Apt:${aptCount}`);

    // 3. Relationship Integrity
    const [allUserIds, allProviderIds, allServiceIds, allApts, allAvails] = await Promise.all([
      User.find({}, '_id').lean(),
      Provider.find({}, '_id').lean(),
      Service.find({}, '_id').lean(),
      Appointment.find({}, 'userId providerId serviceId').lean(),
      Availability.find({}, 'providerId').lean()
    ]);
    const userSet = new Set(allUserIds.map((u) => u._id.toString()));
    const providerSet = new Set(allProviderIds.map((p) => p._id.toString()));
    const serviceSet = new Set(allServiceIds.map((s) => s._id.toString()));
    const orphanUsers = allApts.filter((a) => !userSet.has(a.userId.toString())).length;
    const orphanProviders = allApts.filter((a) => !providerSet.has(a.providerId.toString())).length;
    const orphanServices = allApts.filter((a) => !serviceSet.has(a.serviceId.toString())).length;
    const orphanAvails = allAvails.filter((av) => !providerSet.has(av.providerId.toString())).length;
    assert('M2.5-3', 'Relationship integrity (zero orphans)', orphanUsers === 0 && orphanProviders === 0 && orphanServices === 0 && orphanAvails === 0);

    // 4. Admin Auth Requirements
    const unauthAdmin = await makeRequest('/api/admin/overview');
    assert('M2.5-4', 'Admin endpoint rejects unauthenticated request', unauthAdmin.status === 401, `Status: ${unauthAdmin.status}`);

    const patientAdmin = await makeRequest('/api/admin/overview', { token: patientToken });
    assert('M2.5-5', 'Patient role cannot access Admin endpoint (403)', patientAdmin.status === 403, `Status: ${patientAdmin.status}`);

    const providerAdmin = await makeRequest('/api/admin/overview', { token: providerToken });
    assert('M2.5-6', 'Provider role cannot access Admin endpoint (403)', providerAdmin.status === 403, `Status: ${providerAdmin.status}`);

    const adminAllowed = await makeRequest('/api/admin/overview', { token: adminToken });
    assert('M2.5-7', 'Admin role can access Admin endpoint and receives KPIs', adminAllowed.status === 200 && typeof adminAllowed.data?.data?.kpis?.totalAppointments === 'number');

    console.log('\n--- MILESTONE 3: PROVIDER & SERVICE DISCOVERY EXPERIENCE ---');

    // 1. Services List
    const servicesRes = await makeRequest('/api/services');
    assert('M3-1', 'Services list (GET /api/services)', servicesRes.status === 200 && servicesRes.data?.data?.services?.length >= 18, `Count: ${servicesRes.data?.data?.services?.length}`);

    // 2. Service Search
    const serviceSearchRes = await makeRequest('/api/services?search=cardio');
    const hasCardio = serviceSearchRes.status === 200 && serviceSearchRes.data?.data?.services?.some((s) => s.name.toLowerCase().includes('cardio') || s.category.toLowerCase().includes('cardio'));
    assert('M3-2', 'Service search (GET /api/services?search=cardio)', hasCardio, `Matches: ${serviceSearchRes.data?.data?.services?.length}`);

    // 3. Service Category Filtering
    const serviceCatRes = await makeRequest('/api/services?category=Dermatology');
    const allDerma = serviceCatRes.status === 200 && serviceCatRes.data?.data?.services?.every((s) => s.category.toLowerCase().includes('dermatology'));
    assert('M3-3', 'Service category filtering (GET /api/services?category=Dermatology)', allDerma && serviceCatRes.data?.data?.services?.length > 0, `Matches: ${serviceCatRes.data?.data?.services?.length}`);

    // Fetch sample service for detail tests
    const sampleService = await Service.findOne().lean();

    // 4. Service Detail
    const serviceDetailRes = await makeRequest(`/api/services/${sampleService._id}`);
    assert('M3-4', 'Service detail (GET /api/services/:id)', serviceDetailRes.status === 200 && serviceDetailRes.data?.data?.name === sampleService.name, `Service: ${sampleService.name}`);

    // 5. Providers List
    const providersRes = await makeRequest('/api/providers');
    assert('M3-5', 'Providers list (GET /api/providers)', providersRes.status === 200 && providersRes.data?.data?.providers?.length >= 35, `Count: ${providersRes.data?.data?.providers?.length}`);

    // 6. Provider Search
    const providerSearchRes = await makeRequest('/api/providers?search=suresh');
    const foundSuresh = providerSearchRes.status === 200 && providerSearchRes.data?.data?.providers?.some((p) => p.name.includes('Suresh'));
    assert('M3-6', 'Provider search (GET /api/providers?search=suresh)', foundSuresh, `Matches: ${providerSearchRes.data?.data?.providers?.length}`);

    // 7. Provider Specialty Filtering
    const providerSpecRes = await makeRequest('/api/providers?specialty=Cardiology');
    const allCardioProv = providerSpecRes.status === 200 && providerSpecRes.data?.data?.providers?.every((p) => p.specialty.toLowerCase().includes('cardio'));
    assert('M3-7', 'Provider specialty filtering (GET /api/providers?specialty=Cardiology)', allCardioProv && providerSpecRes.data?.data?.providers?.length > 0, `Matches: ${providerSpecRes.data?.data?.providers?.length}`);

    // 8. Provider Location Filtering
    const providerLocRes = await makeRequest('/api/providers?location=Chennai');
    const allChennaiProv = providerLocRes.status === 200 && providerLocRes.data?.data?.providers?.every((p) => p.location.toLowerCase() === 'chennai');
    assert('M3-8', 'Provider location filtering (GET /api/providers?location=Chennai)', allChennaiProv && providerLocRes.data?.data?.providers?.length > 0, `Matches: ${providerLocRes.data?.data?.providers?.length}`);

    // Fetch sample provider for detail tests
    const sampleProvider = await Provider.findOne({ status: 'ACTIVE' }).lean();

    // 9. Provider Detail
    const providerDetailRes = await makeRequest(`/api/providers/${sampleProvider._id}`);
    assert('M3-9', 'Provider detail (GET /api/providers/:id)', providerDetailRes.status === 200 && providerDetailRes.data?.data?.name === sampleProvider.name, `Provider: ${sampleProvider.name}`);

    // 10. Provider Availability
    const providerAvailRes = await makeRequest(`/api/providers/${sampleProvider._id}/availability`);
    const validAvail = providerAvailRes.status === 200 && Array.isArray(providerAvailRes.data?.data?.weeklySchedule) && providerAvailRes.data?.data?.weeklySchedule?.length > 0;
    assert('M3-10', 'Provider availability (GET /api/providers/:id/availability)', validAvail, `Weekly shifts: ${providerAvailRes.data?.data?.weeklySchedule?.length}`);

    // 11. Invalid Provider ID (400)
    const invalidProvRes = await makeRequest('/api/providers/invalid-id-xyz');
    assert('M3-11', 'Invalid provider ID returns 400 Bad Request', invalidProvRes.status === 400, `Status: ${invalidProvRes.status}`);

    // 12. Invalid Service ID (400)
    const invalidServRes = await makeRequest('/api/services/invalid-id-xyz');
    assert('M3-12', 'Invalid service ID returns 400 Bad Request', invalidServRes.status === 400, `Status: ${invalidServRes.status}`);

    // 13. Missing Provider (404)
    const nonExistentId1 = new mongoose.Types.ObjectId();
    const missingProvRes = await makeRequest(`/api/providers/${nonExistentId1}`);
    assert('M3-13', 'Missing provider returns 404 Not Found', missingProvRes.status === 404, `Status: ${missingProvRes.status}`);

    // 14. Missing Service (404)
    const nonExistentId2 = new mongoose.Types.ObjectId();
    const missingServRes = await makeRequest(`/api/services/${nonExistentId2}`);
    assert('M3-14', 'Missing service returns 404 Not Found', missingServRes.status === 404, `Status: ${missingServRes.status}`);

    console.log('\n====================================================');
    console.log(`Final Test Summary: ${passCount} Passed, ${failCount} Failed (Total: ${testCount})`);
    console.log('====================================================\n');

    server.close();
    await mongoose.connection.close();

    if (failCount > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('[Test Error] Unexpected error:', err);
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

runTests();
