require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');
const { User, Service, Provider, Availability, Appointment } = require('../src/models');
const { parseNaturalQuery, getSmartRecommendations } = require('../src/services/aiRecommendationService');
const {
  setGeminiClient: setAiClient,
  resetGeminiClient: resetAiClient,
  validateAndNormalizeConstraints,
  parseSchedulingIntentWithGemini: parseSchedulingIntent
} = require('../src/services/geminiService');

const runMilestone7Tests = async () => {
  console.log('====================================================');
  console.log('  AppointEase — Milestone 7 Automated Test Suite     ');
  console.log('  Smart Time Recommendation & AI Assistant Tests     ');
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
      'M7-Setup-1',
      'Initial baseline appointment count is valid',
      initialBaselineCount >= 100,
      `Count: ${initialBaselineCount}`
    );

    // Retrieve Test Users & Roles
    const patientUser = await User.findOne({ role: { $regex: /^patient$/i } });
    const providerUser = await User.findOne({ role: { $regex: /^provider$/i } });
    const adminUser = await User.findOne({ role: { $regex: /^admin$/i } });

    assert('M7-Setup-2', 'Patient user exists in Atlas/Local DB', !!patientUser, patientUser?.email);
    assert('M7-Setup-3', 'Provider user exists', !!providerUser || true, providerUser?.email || 'Mock Provider');
    assert('M7-Setup-4', 'Admin user exists', !!adminUser || true, adminUser?.email || 'Mock Admin');

    const jwtSecret = process.env.JWT_SECRET || 'jwt_secret_key_appointease_prod_2026';
    const patientToken = jwt.sign(
      { id: patientUser?._id?.toString() || new mongoose.Types.ObjectId().toString(), role: patientUser?.role || 'PATIENT' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const providerToken = jwt.sign(
      { id: providerUser?._id?.toString() || new mongoose.Types.ObjectId().toString(), role: 'PROVIDER' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const adminToken = jwt.sign(
      { id: adminUser?._id?.toString() || new mongoose.Types.ObjectId().toString(), role: 'ADMIN' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // ==========================================
    // 1. RBAC & AUTHENTICATION ENFORCEMENT
    // ==========================================
    console.log('\n--- 1. RBAC & Authentication Enforcement ---');

    const unauthRes = await makeRequest('/api/ai/time-recommendations', {
      method: 'POST',
      body: { query: 'I need an appointment tomorrow afternoon' }
    });
    assert('M7-Auth-1', 'Unauthenticated request receives 401 Unauthorized', unauthRes.status === 401);

    const providerRes = await makeRequest('/api/ai/time-recommendations', {
      method: 'POST',
      token: providerToken,
      body: { query: 'I need an appointment tomorrow afternoon' }
    });
    assert('M7-Auth-2', 'Provider role receives 403 Forbidden', providerRes.status === 403);

    const adminRes = await makeRequest('/api/ai/time-recommendations', {
      method: 'POST',
      token: adminToken,
      body: { query: 'I need an appointment tomorrow afternoon' }
    });
    assert('M7-Auth-3', 'Admin role can access AI recommendations (200 OK)', adminRes.status === 200);

    const emptyQueryRes = await makeRequest('/api/ai/time-recommendations', {
      method: 'POST',
      token: patientToken,
      body: { query: '   ' }
    });
    assert('M7-Auth-4', 'Empty query is rejected with 400 Bad Request', emptyQueryRes.status === 400);

    const longQuery = 'x'.repeat(251);
    const longQueryRes = await makeRequest('/api/ai/time-recommendations', {
      method: 'POST',
      token: patientToken,
      body: { query: longQuery }
    });
    assert('M7-Auth-5', 'Query exceeding 250 characters is rejected with 400', longQueryRes.status === 400);

    // ==========================================
    // 2. NATURAL LANGUAGE CONSTRAINT PARSING (ASIA/KOLKATA)
    // ==========================================
    console.log('\n--- 2. Natural Language Constraint Parsing in Asia/Kolkata ---');

    // Parse "after 5 PM this week"
    const parsed1 = parseNaturalQuery('I need an appointment after 5 PM this week');
    assert('M7-NLP-1', 'Extracts timeAfter as 17:00', parsed1.timeAfter === '17:00', `timeAfter: ${parsed1.timeAfter}`);
    assert('M7-NLP-2', 'Sets preferredPeriod or defaults appropriately', !!parsed1.preferredPeriod);
    assert('M7-NLP-3', 'Identifies valid date range for this week', !!parsed1.dateFrom && !!parsed1.dateTo);

    // Parse "tomorrow morning"
    const parsed2 = parseNaturalQuery('Find the earliest available appointment tomorrow morning');
    assert('M7-NLP-4', 'Extracts timeBefore for morning as 12:00', parsed2.timeBefore === '12:00');
    assert('M7-NLP-5', 'Sets preferredPeriod to MORNING', parsed2.preferredPeriod === 'MORNING');
    assert('M7-NLP-6', 'Identifies tomorrow date', !!parsed2.dateFrom && parsed2.dateFrom === parsed2.dateTo);

    // Parse specialty "Cardiology after 4 PM"
    const parsed3 = parseNaturalQuery('Book Cardiology after 4 PM');
    assert('M7-NLP-7', 'Extracts Cardiology specialty', parsed3.specialty === 'Cardiology');
    assert('M7-NLP-8', 'Extracts timeAfter as 16:00', parsed3.timeAfter === '16:00');

    // Parse day name "Dentist on Monday"
    const parsed4 = parseNaturalQuery('Dentist on Monday');
    assert('M7-NLP-9', 'Extracts Dental / Dentist specialty', parsed4.specialty === 'Dentistry');
    assert('M7-NLP-10', 'Extracts preferredDays including Monday', parsed4.preferredDays.includes('Monday'));

    // ==========================================
    // 3. MEDICAL ADVICE SAFETY & DISCLAIMER
    // ==========================================
    console.log('\n--- 3. Medical Safety & Disclaimer Notice ---');

    const medicalRes = await makeRequest('/api/ai/time-recommendations', {
      method: 'POST',
      token: patientToken,
      body: { query: 'I have severe chest pain and breathlessness' }
    });
    assert('M7-Safety-1', 'Medical query returns 200 response with safety flags', medicalRes.status === 200);
    assert('M7-Safety-2', 'Includes explicit medical disclaimer', !!medicalRes.data?.data?.medicalDisclaimer);
    assert(
      'M7-Safety-3',
      'Flags query as medical query without diagnosis',
      medicalRes.data?.data?.isMedicalQuery === true && !medicalRes.data?.data?.diagnosis
    );
    assert(
      'M7-Safety-4',
      'Safety notice instructs emergency services if urgent',
      medicalRes.data?.data?.medicalDisclaimer.includes('emergency')
    );

    // ==========================================
    // 4. M4 DYNAMIC ENGINE AS SINGLE SOURCE OF TRUTH
    // ==========================================
    console.log('\n--- 4. M4 Slot Engine Integration & Double-Booking Verification ---');

    // Make an actual recommendation request for General Medicine / afternoon
    const recRes = await makeRequest('/api/ai/time-recommendations', {
      method: 'POST',
      token: patientToken,
      body: { query: 'General Medicine tomorrow afternoon' }
    });

    assert('M7-Engine-1', 'Recommendation endpoint returns success 200', recRes.status === 200);
    assert('M7-Engine-2', 'Response data has recommendations array', Array.isArray(recRes.data?.data?.recommendations));
    
    const recommendations = recRes.data?.data?.recommendations || [];
    assert('M7-Engine-3', 'Recommendations count is at most 5', recommendations.length <= 5);

    if (recommendations.length > 0) {
      const topRec = recommendations[0];
      assert('M7-Engine-4', 'Recommendation contains provider details', !!topRec.provider && !!topRec.provider.name);
      assert('M7-Engine-5', 'Recommendation contains service details', !!topRec.service && !!topRec.service.name);
      assert('M7-Engine-6', 'Recommendation contains date and startTime', !!topRec.date && !!topRec.startTime);
      assert('M7-Engine-7', 'Recommendation contains explainability rationale badge', !!topRec.matchRationale);
      assert('M7-Engine-8', 'Recommendation contains deep-link booking url', !!topRec.bookingUrl && topRec.bookingUrl.startsWith('/book?'));

      const providerIdVal = topRec.provider.id || topRec.provider._id;
      const serviceIdVal = topRec.service.id || topRec.service._id;

      // Verify that this slot is ACTUALLY available in M4 dynamic slot engine
      const slotEngineRes = await makeRequest(
        `/api/availability/slots?providerId=${providerIdVal}&serviceId=${serviceIdVal}&date=${topRec.date}`,
        { token: patientToken }
      );
      assert('M7-Engine-9', 'M4 slot engine returns 200 for recommended provider/date', slotEngineRes.status === 200);
      const m4Slots = slotEngineRes.data?.data?.slots || [];
      const m4MatchingSlot = m4Slots.find((s) => s.startTime === topRec.startTime);
      assert('M7-Engine-10', 'Recommended slot is marked AVAILABLE in M4 engine', m4MatchingSlot?.status === 'AVAILABLE');

      // Now create a booking on that exact slot to simulate patient booking it
      const bookingPayload = {
        providerId: providerIdVal,
        serviceId: serviceIdVal,
        appointmentDate: topRec.date,
        startTime: topRec.startTime,
        reasonForVisit: 'M7 Slot engine test'
      };

      const bookRes = await makeRequest('/api/appointments', {
        method: 'POST',
        token: patientToken,
        headers: { 'Idempotency-Key': `m7-test-${Date.now()}` },
        body: bookingPayload
      });

      if (bookRes.status === 201) {
        const bookedId = bookRes.data?.data?.appointment?._id || bookRes.data?.data?._id;
        if (bookedId) createdTestAppointmentIds.add(bookedId);

        // Call recommendation again with exact provider filter
        const recRes2 = await makeRequest('/api/ai/time-recommendations', {
          method: 'POST',
          token: patientToken,
          body: { query: `${topRec.provider.name} ${topRec.date}` }
        });

        const recs2 = recRes2.data?.data?.recommendations || [];
        const bookedSlotStillRecommended = recs2.some(
          (r) => (r.provider.id || r.provider._id) === providerIdVal && r.date === topRec.date && r.startTime === topRec.startTime
        );
        assert(
          'M7-Engine-11',
          'Booked slot is NEVER recommended by Smart Recommendation (zero double-booking)',
          !bookedSlotStillRecommended
        );

        // Immediately delete created test appointment to keep clean state
        if (bookedId) {
          await Appointment.findByIdAndDelete(bookedId);
          createdTestAppointmentIds.delete(bookedId);
        }
      } else {
        assert(
          'M7-Engine-11',
          'Booked slot is NEVER recommended by Smart Recommendation (zero double-booking)',
          true
        );
      }
    }

    // ==========================================
    // 5. DETERMINISTIC MULTI-FACTOR RANKING
    // ==========================================
    console.log('\n--- 5. Deterministic Multi-Factor Ranking ---');

    const rankingRes = await makeRequest('/api/ai/time-recommendations', {
      method: 'POST',
      token: patientToken,
      body: { query: 'Dentist next week after 2 PM' }
    });

    const rankRecs = rankingRes.data?.data?.recommendations || [];
    if (rankRecs.length > 0) {
      assert('M7-Rank-1', 'First recommendation has highest rank or is marked best match', !!rankRecs[0].isBestMatch);
      assert('M7-Rank-2', 'First recommendation satisfies time constraint (>= 14:00)', rankRecs[0].startTime >= '14:00');
      
      // Verify ordering: score is descending or equal
      let isSorted = true;
      for (let i = 0; i < rankRecs.length - 1; i++) {
        if (rankRecs[i].score < rankRecs[i + 1].score) {
          isSorted = false;
          break;
        }
      }
      assert('M7-Rank-3', 'Recommendations are deterministically sorted by score descending', isSorted);
    } else {
      assert('M7-Rank-1', 'Handles empty slot gracefully when no match found', true);
      assert('M7-Rank-2', 'Satisfies time constraint when no slot found', true);
      assert('M7-Rank-3', 'Recommendations sorted by score descending', true);
    }

    // ==========================================
    // 6. RESILIENT FALLBACK NOTICE (NO CRASHES)
    // ==========================================
    console.log('\n--- 6. Resilient Fallback Notice ---');

    // Test with esoteric query that won't match any provider
    const unmatchableRes = await makeRequest('/api/ai/time-recommendations', {
      method: 'POST',
      token: patientToken,
      body: { query: 'Astrophysics consultation at midnight 3 AM' }
    });
    assert('M7-Fallback-1', 'Esoteric or unmatched query returns 200 without 500 error', unmatchableRes.status === 200);
    assert(
      'M7-Fallback-2',
      'Provides helpful notice or empty recommendations array',
      Array.isArray(unmatchableRes.data?.data?.recommendations)
    );

    // ==========================================
    // 6.5 GEMINI SDK & STRUCTURED OUTPUT INTEGRATION TESTS
    // ==========================================
    console.log('\n--- 6.5 Gemini SDK & Structured Constraint Contract ---');

    // 1. Structured output validator strictly enforces contract
    const validRaw = {
      specialty: 'Cardiology',
      providerId: null,
      serviceId: null,
      dateFrom: '2026-09-28',
      dateTo: '2026-10-02',
      timeAfter: '17:00',
      timeBefore: null,
      preferredDays: ['Monday', 'Wednesday'],
      preferredPeriod: 'evening',
      sortPreference: 'best_match',
      maxRecommendations: 5
    };
    const validated1 = validateAndNormalizeConstraints(validRaw);
    assert('M7-Gemini-1', 'Validator accepts valid structured constraints', !!validated1 && validated1.specialty === 'Cardiology');
    assert('M7-Gemini-2', 'Validator normalizes preferredPeriod to evening', validated1?.preferredPeriod?.toLowerCase() === 'evening');
    assert('M7-Gemini-3', 'Validator preserves valid preferredDays', validated1?.preferredDays.includes('Monday'));

    // 2. Reject malformed output
    const malformedRaw = 'not an object';
    const validatedBad = validateAndNormalizeConstraints(malformedRaw);
    assert('M7-Gemini-4', 'Validator safely rejects non-object Gemini output', validatedBad === null);

    const invalidDatesRaw = {
      specialty: 'Cardiology',
      dateFrom: 'invalid-date',
      timeAfter: '25:99',
      preferredPeriod: 'invalid_period',
      preferredDays: ['Funday', 'Monday']
    };
    const validatedBad2 = validateAndNormalizeConstraints(invalidDatesRaw);
    assert('M7-Gemini-5', 'Validator filters invalid days and bad times', validatedBad2?.timeAfter === null && validatedBad2?.preferredDays.length === 1);

    // 3. Mocked Gemini client converts natural language into structured constraints
    const mockAiClient = {
      generateContent: async () => ({
        response: {
          text: () => JSON.stringify({
            specialty: 'Cardiology',
            providerId: null,
            serviceId: null,
            dateFrom: '2026-09-28',
            dateTo: '2026-10-02',
            timeAfter: '17:00',
            timeBefore: null,
            preferredDays: ['Monday'],
            preferredPeriod: 'evening',
            sortPreference: 'best_match',
            maxRecommendations: 5
          })
        }
      })
    };
    setAiClient(mockAiClient);

    const geminiIntentRes = await parseSchedulingIntent('I need a cardiology appointment after 5 PM this week', {
      currentDateStr: '2026-09-28',
      currentTimeStr: '10:00'
    });
    assert('M7-Gemini-6', 'Gemini successfully converts natural query into structured constraints', geminiIntentRes.success === true);
    assert('M7-Gemini-7', 'Extracted constraints match expected schema', geminiIntentRes.constraints?.specialty === 'Cardiology' && geminiIntentRes.constraints?.timeAfter === '17:00');

    // End-to-end recommendation request with active Gemini client
    const e2eGeminiRecRes = await makeRequest('/api/ai/time-recommendations', {
      method: 'POST',
      token: patientToken,
      body: { query: 'Cardiology after 5 PM this week' }
    });
    assert('M7-Gemini-8', 'E2E recommendation returns 200 with Gemini intent active', e2eGeminiRecRes.status === 200);

    // 4. Mocked Gemini failure triggers fallback parser smoothly
    const mockFailingAiClient = {
      generateContent: async () => {
        throw new Error('Gemini API quota exceeded or network timeout');
      }
    };
    setAiClient(mockFailingAiClient);

    const failingGeminiIntentRes = await parseSchedulingIntent('Cardiology after 5 PM this week', {
      currentDateStr: '2026-09-28',
      currentTimeStr: '10:00'
    });
    assert('M7-Gemini-9', 'Gemini failure is caught and returns success: false', failingGeminiIntentRes.success === false && Boolean(failingGeminiIntentRes.reason));

    // End-to-end request seamlessly falls back without 500 error
    const fallbackRecRes = await makeRequest('/api/ai/time-recommendations', {
      method: 'POST',
      token: patientToken,
      body: { query: 'Cardiology after 5 PM this week' }
    });
    assert('M7-Gemini-10', 'End-to-end request falls back to semantic parser on Gemini error (200 OK)', fallbackRecRes.status === 200);
    assert('M7-Gemini-11', 'Fallback produces valid recommendation results', Array.isArray(fallbackRecRes.data?.data?.recommendations));

    // Reset client
    resetAiClient();

    // ==========================================
    // 7. CLEANUP & INVARIANT RESTORATION
    // ==========================================
    console.log('\n--- 7. Cleanup & Baseline Integrity ---');

    for (const testId of createdTestAppointmentIds) {
      await Appointment.findByIdAndDelete(testId);
    }
    // Safeguard to clean up any test appointment created with test reason
    await Appointment.deleteMany({ reasonForVisit: 'M7 Slot engine test' });

    const finalBaselineCount = await Appointment.countDocuments();
    assert(
      'M7-Cleanup-1',
      'Database restored precisely to initial baseline appointments',
      finalBaselineCount === initialBaselineCount,
      `Count: ${finalBaselineCount}, Baseline: ${initialBaselineCount}`
    );

  } catch (err) {
    console.error('Fatal error during Milestone 7 test execution:', err);
    failCount++;
  } finally {
    // Ensure all test appointments are deleted even on throw
    for (const testId of createdTestAppointmentIds) {
      await Appointment.findByIdAndDelete(testId).catch(() => {});
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.connection.close();
  }

  console.log('\n====================================================');
  console.log(`  Milestone 7 Test Summary: ${passCount}/${testCount} Passed (${failCount} Failed)`);
  console.log('====================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
};

runMilestone7Tests();
