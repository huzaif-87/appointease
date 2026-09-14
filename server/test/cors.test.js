const http = require('http');
const assert = require('assert');
const { app } = require('../src/server');

/**
 * AppointEase Production CORS & Preflight Verification Suite
 */
async function runCorsTests() {
  console.log('====================================================');
  console.log('  AppointEase Production CORS & Preflight Tests    ');
  console.log('====================================================\n');

  // Start HTTP server on ephemeral port for testing
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const testOrigin = 'https://appointease-gamma.vercel.app';
  process.env.CLIENT_URL = testOrigin;

  try {
    // 1. Verify OPTIONS Preflight for POST /api/appointments
    console.log('[1/7] Testing OPTIONS Preflight for POST /api/appointments...');
    const preflightRes = await fetch(`${baseUrl}/api/appointments`, {
      method: 'OPTIONS',
      headers: {
        'Origin': testOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type, authorization, idempotency-key'
      }
    });

    console.log(`Preflight Status: ${preflightRes.status}`);
    const allowOrigin = preflightRes.headers.get('access-control-allow-origin');
    const allowHeaders = preflightRes.headers.get('access-control-allow-headers');
    const allowMethods = preflightRes.headers.get('access-control-allow-methods');
    const allowCredentials = preflightRes.headers.get('access-control-allow-credentials');

    console.log(`Access-Control-Allow-Origin: ${allowOrigin}`);
    console.log(`Access-Control-Allow-Headers: ${allowHeaders}`);
    console.log(`Access-Control-Allow-Methods: ${allowMethods}`);

    assert.strictEqual(preflightRes.status === 204 || preflightRes.status === 200, true, 'Preflight status must be 204 or 200');
    assert.strictEqual(allowOrigin, testOrigin, 'Access-Control-Allow-Origin must match request origin');
    assert.strictEqual(allowCredentials, 'true', 'Access-Control-Allow-Credentials must be true');
    assert(allowHeaders.toLowerCase().includes('idempotency-key'), 'Access-Control-Allow-Headers must include idempotency-key');
    assert(allowHeaders.toLowerCase().includes('authorization'), 'Access-Control-Allow-Headers must include authorization');
    assert(allowHeaders.toLowerCase().includes('content-type'), 'Access-Control-Allow-Headers must include content-type');
    console.log('✓ OPTIONS Preflight for POST /api/appointments passed.\n');

    // 2. Verify GET /api/providers CORS
    console.log('[2/7] Testing GET /api/providers CORS...');
    const providersRes = await fetch(`${baseUrl}/api/providers`, {
      method: 'GET',
      headers: { 'Origin': testOrigin }
    });
    assert.strictEqual(providersRes.headers.get('access-control-allow-origin'), testOrigin);
    console.log('✓ GET /api/providers CORS passed.\n');

    // 3. Verify GET /api/services CORS
    console.log('[3/7] Testing GET /api/services CORS...');
    const servicesRes = await fetch(`${baseUrl}/api/services`, {
      method: 'GET',
      headers: { 'Origin': testOrigin }
    });
    assert.strictEqual(servicesRes.headers.get('access-control-allow-origin'), testOrigin);
    console.log('✓ GET /api/services CORS passed.\n');

    // 4. Verify POST /api/auth/register CORS
    console.log('[4/7] Testing OPTIONS & POST /api/auth/register CORS...');
    const registerPreflight = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'OPTIONS',
      headers: {
        'Origin': testOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    });
    assert.strictEqual(registerPreflight.headers.get('access-control-allow-origin'), testOrigin);
    console.log('✓ POST /api/auth/register CORS passed.\n');

    // 5. Verify PATCH /api/appointments/507f1f77bcf86cd799439011/cancel CORS
    console.log('[5/7] Testing OPTIONS & PATCH /api/appointments/:id/cancel CORS...');
    const cancelPreflight = await fetch(`${baseUrl}/api/appointments/507f1f77bcf86cd799439011/cancel`, {
      method: 'OPTIONS',
      headers: {
        'Origin': testOrigin,
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'content-type, authorization'
      }
    });
    assert.strictEqual(cancelPreflight.headers.get('access-control-allow-origin'), testOrigin);
    assert(cancelPreflight.headers.get('access-control-allow-methods').includes('PATCH'));
    console.log('✓ PATCH /api/appointments/:id/cancel CORS passed.\n');

    // 6. Verify PATCH /api/appointments/507f1f77bcf86cd799439011/reschedule CORS
    console.log('[6/7] Testing OPTIONS & PATCH /api/appointments/:id/reschedule CORS...');
    const reschedulePreflight = await fetch(`${baseUrl}/api/appointments/507f1f77bcf86cd799439011/reschedule`, {
      method: 'OPTIONS',
      headers: {
        'Origin': testOrigin,
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'content-type, authorization'
      }
    });
    assert.strictEqual(reschedulePreflight.headers.get('access-control-allow-origin'), testOrigin);
    console.log('✓ PATCH /api/appointments/:id/reschedule CORS passed.\n');

    // 7. Verify Disallowed Origin gets blocked in production mode
    console.log('[7/7] Testing Unauthorized Origin blocking...');
    process.env.NODE_ENV = 'production';
    const unauthorizedRes = await fetch(`${baseUrl}/api/appointments`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://evil-hacker-site.com',
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert.notStrictEqual(unauthorizedRes.headers.get('access-control-allow-origin'), 'https://evil-hacker-site.com');
    console.log('✓ Unauthorized origin blocked successfully.\n');

    console.log('====================================================');
    console.log('  ALL CORS & PREFLIGHT TESTS PASSED SUCCESSFULLY!   ');
    console.log('====================================================');
  } catch (err) {
    console.error('CORS Test Failure:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runCorsTests();
