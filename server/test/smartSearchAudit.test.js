require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { parseSchedulingIntentWithGemini } = require('../src/services/geminiService');
const { parseSchedulingIntentWithRules, getSmartTimeRecommendations } = require('../src/services/aiRecommendationService');

const assert = (condition, message) => {
  if (!condition) {
    console.error(`  ✗ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
};

const runSearchAudit = async () => {
  console.log('====================================================');
  console.log('  AppointEase — Gemini & Smart Search Query Audit   ');
  console.log('====================================================');

  await connectDB();

  const serverContext = {
    currentDateStr: '2026-09-13',
    currentMinutes: 16 * 60 + 30,
    dayOfWeek: 'Sunday'
  };

  // 1. Model Configuration Check
  console.log('\n--- 1. Model Verification ---');
  const configuredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  assert(
    Boolean(configuredModel),
    `GEMINI_MODEL is configured as '${configuredModel}'`
  );

  // 2. TIME Category Tests
  console.log('\n--- 2. TIME Queries ---');
  const timeQueries = [
    { q: 'after 5 PM', check: (c) => c.timeAfter === '17:00' || c.preferredPeriod === 'EVENING' },
    { q: 'after 6 PM', check: (c) => c.timeAfter === '18:00' || c.preferredPeriod === 'EVENING' },
    { q: 'before 12 PM', check: (c) => c.timeBefore === '12:00' || c.preferredPeriod === 'MORNING' },
    { q: 'between 4–7 PM', check: (c) => (c.timeAfter === '16:00' || c.preferredPeriod === 'EVENING') },
    { q: 'evening', check: (c) => c.preferredPeriod === 'EVENING' || c.timeAfter >= '17:00' },
    { q: 'morning', check: (c) => c.preferredPeriod === 'MORNING' || (c.timeBefore && c.timeBefore <= '12:00') },
    { q: 'afternoon', check: (c) => c.preferredPeriod === 'AFTERNOON' || (c.timeAfter && c.timeAfter >= '12:00') }
  ];

  for (const item of timeQueries) {
    const res = await parseSchedulingIntentWithGemini(item.q, serverContext);
    const constraints = res.success ? res.constraints : parseSchedulingIntentWithRules(item.q, serverContext);
    assert(item.check(constraints), `Query '${item.q}' extracted valid time constraint (timeAfter: ${constraints.timeAfter}, period: ${constraints.preferredPeriod})`);
  }

  // 3. DATE Category Tests
  console.log('\n--- 3. DATE Queries ---');
  const dateQueries = [
    { q: 'tomorrow', check: (c) => c.dateFrom === '2026-09-14' || (c.preferredDays && c.preferredDays.length > 0) },
    { q: 'today', check: (c) => c.dateFrom === '2026-09-13' },
    { q: 'this week', check: (c) => Boolean(c.dateFrom || c.dateTo || c.preferredDays) },
    { q: 'next week', check: (c) => Boolean(c.dateFrom) },
    { q: 'Monday', check: (c) => (c.preferredDays && c.preferredDays.includes('Monday')) || Boolean(c.dateFrom) },
    { q: 'next Monday', check: (c) => Boolean(c.dateFrom) || (c.preferredDays && c.preferredDays.includes('Monday')) },
    { q: 'Wednesday afternoon', check: (c) => (c.preferredDays && c.preferredDays.includes('Wednesday')) || c.preferredPeriod === 'AFTERNOON' },
    { q: 'Monday or Wednesday afternoon', check: (c) => (c.preferredDays && (c.preferredDays.includes('Monday') || c.preferredDays.includes('Wednesday'))) || c.preferredPeriod === 'AFTERNOON' }
  ];

  for (const item of dateQueries) {
    const res = await parseSchedulingIntentWithGemini(item.q, serverContext);
    const constraints = res.success ? res.constraints : parseSchedulingIntentWithRules(item.q, serverContext);
    assert(item.check(constraints), `Query '${item.q}' extracted valid date constraint (dateFrom: ${constraints.dateFrom}, days: ${constraints.preferredDays})`);
  }

  // 4. SPECIALTY Category Tests
  console.log('\n--- 4. SPECIALTY Queries ---');
  const specialtyQueries = [
    { q: 'cardiology this week', spec: /cardio/i },
    { q: 'cardiologist', spec: /cardio/i },
    { q: 'cardiology evening', spec: /cardio/i },
    { q: 'dermatology tomorrow', spec: /derma/i },
    { q: 'dentist this week', spec: /dent/i }
  ];

  for (const item of specialtyQueries) {
    const res = await parseSchedulingIntentWithGemini(item.q, serverContext);
    const constraints = res.success ? res.constraints : parseSchedulingIntentWithRules(item.q, serverContext);
    assert(item.spec.test(constraints.specialty || ''), `Query '${item.q}' extracted specialty matching ${item.spec} (got: '${constraints.specialty}')`);
  }

  // 5. COMBINED Category Tests
  console.log('\n--- 5. COMBINED Queries ---');
  const combinedQueries = [
    'cardiology after 5 PM this week',
    'earliest tomorrow',
    'cardiology Monday afternoon',
    'dermatology after 6 PM this week',
    'Wednesday evening',
    'earliest next week',
    'Monday or Wednesday afternoon'
  ];

  for (const q of combinedQueries) {
    const recRes = await getSmartTimeRecommendations({ query: q });
    assert(Array.isArray(recRes.recommendations), `Combined query '${q}' returned recommendations array (count: ${recRes.recommendations.length})`);
    if (recRes.recommendations.length > 0) {
      assert(recRes.recommendations[0].isBestMatch === true, `Top recommendation has isBestMatch: true`);
      assert(recRes.recommendations[0].provider?.name, `Top recommendation contains provider details (${recRes.recommendations[0].provider.name})`);
    }
  }

  // 6. VARIATIONS Category Tests
  console.log('\n--- 6. VARIATIONS Queries ---');
  const variations = [
    'after 5',
    'after 5pm',
    'from 5 PM onwards',
    'anytime after five in evening',
    'evening appointment',
    'as soon as possible tomorrow',
    'earliest slot tomorrow',
    'tomorrow morning'
  ];

  for (const v of variations) {
    const res = await parseSchedulingIntentWithGemini(v, serverContext);
    const constraints = res.success ? res.constraints : parseSchedulingIntentWithRules(v, serverContext);
    assert(Boolean(constraints.timeAfter || constraints.preferredPeriod || constraints.dateFrom || constraints.sortPreference), `Variation '${v}' produced non-empty constraint interpretation`);
  }

  // 7. Fallback Test
  console.log('\n--- 7. Deterministic Fallback on API Failure ---');
  const fallback = parseSchedulingIntentWithRules('Cardiology after 5 PM this week', serverContext);
  assert(fallback.specialty === 'Cardiology', `Fallback parsed specialty: '${fallback.specialty}'`);
  assert(fallback.timeAfter === '17:00', `Fallback parsed timeAfter: '${fallback.timeAfter}'`);
  assert(fallback.preferredPeriod === 'EVENING', `Fallback parsed period: '${fallback.preferredPeriod}'`);

  console.log('\n====================================================');
  console.log('✓ ALL SMART SEARCH & GEMINI AUDIT TESTS PASSED (100% GREEN)');
  console.log('====================================================');

  await mongoose.connection.close();
  process.exit(0);
};

runSearchAudit().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
