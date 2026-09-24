/**
 * Appointees — Email Service (Resend HTTP API)
 *
 * Uses the Resend HTTP API instead of SMTP — works reliably on Render
 * because it's outbound HTTPS (port 443), never blocked like SMTP 587/465.
 *
 * Required environment variables:
 *   RESEND_API_KEY  - API key from resend.com (starts with "re_")
 *   EMAIL_FROM      - Verified sender address, e.g. "Appointees <you@yourdomain.com>"
 *                     For testing without a custom domain, use Resend's shared domain:
 *                     "Appointees <onboarding@resend.dev>"
 *                     NOTE: onboarding@resend.dev can only send to the account owner's
 *                     email. Verify a custom domain at resend.com/domains for
 *                     unrestricted sending.
 *
 * Optional:
 *   ALLOW_TEST_EMAIL_FALLBACK - "true" for local dev. Falls back to Ethereal (nodemailer)
 *                               if Resend send fails. Leave unset in production.
 */

const { Resend } = require('resend');
const nodemailer = require('nodemailer'); // kept only for ALLOW_TEST_EMAIL_FALLBACK

let _resend = null;

function getResend() {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY must be set in environment variables');
  }
  _resend = new Resend(apiKey);
  return _resend;
}

/**
 * Call this ONCE when your server boots to surface config problems early.
 * Uses domains.list() to confirm the full-access API key is valid and active.
 */
async function verifyEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[Email Service] Resend verification FAILED: RESEND_API_KEY is not set');
    return false;
  }
  try {
    const resend = getResend();
    const { data, error } = await resend.domains.list();
    if (error) {
      console.error('[Email Service] Resend API key validation FAILED:', {
        name: error.name,
        message: error.message,
      });
      return false;
    }
    const domains = (data?.data || []).map(d => d.name);
    const from = process.env.EMAIL_FROM || 'Appointees <onboarding@resend.dev>';
    console.log(`[Email Service] Resend verified — ready to send. Sender: ${from}. Verified domains: [${domains.join(', ') || 'none'}]`);
    return true;
  } catch (err) {
    console.error('[Email Service] Resend verification FAILED:', {
      code: err.code,
      message: err.message,
    });
    return false;
  }
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return '[invalid-email]';
  const [name, domain] = email.split('@');
  return name.length <= 2 ? `${name[0]}*@${domain}` : `${name[0]}***${name.slice(-1)}@${domain}`;
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Shared HTML template for all three email types.
 * status: 'confirmed' | 'rescheduled' | 'cancelled'
 */
function buildEmailHtml({ status, patientName, doctorName, date, time, bookingId, reason }) {
  const statusConfig = {
    confirmed: { label: '✓ Confirmed Booking', color: '#16a34a', bg: '#f0fdf4', heading: 'has been successfully confirmed' },
    rescheduled: { label: '↻ Rescheduled', color: '#2563eb', bg: '#eff6ff', heading: 'has been rescheduled' },
    cancelled: { label: '✕ Cancelled', color: '#dc2626', bg: '#fef2f2', heading: 'has been cancelled' },
  }[status];

  const reasonRow = status === 'cancelled' && reason
    ? `<tr><td style="padding:10px 0;color:#64748b;">Reason</td><td style="padding:10px 0;color:#0f172a;">${reason}</td></tr>`
    : '';

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b;background-color:#f8fafc;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#0d9488;margin:0;font-size:24px;font-weight:800;">Appointees</h1>
        <p style="color:#64748b;margin:4px 0 0 0;font-size:13px;">Doctor Appointment Booking Platform</p>
      </div>
      <div style="background-color:#ffffff;padding:24px;border-radius:10px;border:1px solid #e2e8f0;">
        <div style="display:inline-block;padding:4px 12px;background-color:${statusConfig.bg};color:${statusConfig.color};border-radius:9999px;font-size:12px;font-weight:700;margin-bottom:12px;">
          ${statusConfig.label}
        </div>
        <h2 style="color:#0f172a;margin:0 0 8px 0;font-size:18px;">Hello ${patientName},</h2>
        <p style="color:#475569;font-size:14px;line-height:1.5;margin:0 0 20px 0;">
          Your appointment ${statusConfig.heading}. Details:
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 0;color:#64748b;width:40%;">Booking ID</td><td style="padding:10px 0;color:#0f172a;font-weight:700;font-family:monospace;">${bookingId}</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 0;color:#64748b;">Doctor</td><td style="padding:10px 0;color:#0d9488;font-weight:600;">${doctorName}</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 0;color:#64748b;">Date</td><td style="padding:10px 0;color:#0f172a;font-weight:600;">${date}</td></tr>
          <tr><td style="padding:10px 0;color:#64748b;">Time</td><td style="padding:10px 0;color:#0d9488;font-weight:700;font-family:monospace;">${time}</td></tr>
          ${reasonRow}
        </table>
      </div>
      <div style="text-align:center;margin-top:20px;font-size:11px;color:#94a3b8;">Appointees • Doctor Appointment Booking Platform</div>
    </div>
  `;
}

/**
 * Core sender via Resend HTTP API.
 * Never throws — always returns { success, messageId } or { success: false, error }.
 * A failed send never blocks booking/reschedule/cancel operations.
 */
async function sendEmail({ to, subject, html, text }) {
  console.log('[DEBUG] Raw recipient email:', JSON.stringify(to));
  const maskedTo = maskEmail(to);
  const from = process.env.EMAIL_FROM || 'Appointees <onboarding@resend.dev>';

  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      html,
      text,
    });

    if (error) {
      // Resend returns errors in the response body (not thrown), handle as failure
      console.error(`[Email Service] SEND FAILED — To: ${maskedTo}`, {
        name: error.name,
        message: error.message,
      });

      if (process.env.ALLOW_TEST_EMAIL_FALLBACK === 'true') {
        return await etherealFallback({ to, subject, html, text });
      }

      return { success: false, error: error.message, code: error.name };
    }

    console.log(`[Email Service] Sent OK via Resend — To: ${maskedTo}, MessageID: ${data.id}`);
    return { success: true, messageId: data.id };
  } catch (err) {
    console.error(`[Email Service] SEND FAILED — To: ${maskedTo}`, {
      code: err.code,
      message: err.message,
    });

    if (process.env.ALLOW_TEST_EMAIL_FALLBACK === 'true') {
      return await etherealFallback({ to, subject, html, text });
    }

    return { success: false, error: err.message, code: err.code };
  }
}

/**
 * Ethereal (Nodemailer) dev fallback.
 * Only invoked when ALLOW_TEST_EMAIL_FALLBACK=true and Resend send fails.
 * Always clearly labeled in logs — never silently reports as a real success.
 */
async function etherealFallback({ to, subject, html, text }) {
  try {
    const testAccount = await nodemailer.createTestAccount();
    const testTransport = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    const info = await testTransport.sendMail({ from: testAccount.user, to, subject, text, html });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.warn(`[Email Service] DEV FALLBACK used (Ethereal, not real delivery) — Preview: ${previewUrl}`);
    return { success: true, isFallback: true, previewUrl };
  } catch (fallbackErr) {
    console.error('[Email Service] Ethereal fallback also failed:', fallbackErr.message);
    return { success: false, error: fallbackErr.message, code: 'FALLBACK_FAILED' };
  }
}

async function sendBookingConfirmationEmail(booking) {
  const { userEmail, patientName, doctorName, appointmentDate, time, bookingId } = booking;
  if (!userEmail) return { success: false, error: 'NO_RECIPIENT_EMAIL' };

  return sendEmail({
    to: userEmail,
    subject: 'Appointment Booking Confirmation — Appointees',
    html: buildEmailHtml({ status: 'confirmed', patientName, doctorName, date: formatDate(appointmentDate), time, bookingId }),
    text: `Hello ${patientName}, your appointment with ${doctorName} on ${formatDate(appointmentDate)} at ${time} is confirmed. Booking ID: ${bookingId}`,
  });
}

async function sendRescheduleConfirmationEmail(booking) {
  const { userEmail, patientName, doctorName, appointmentDate, time, bookingId } = booking;
  if (!userEmail) return { success: false, error: 'NO_RECIPIENT_EMAIL' };

  return sendEmail({
    to: userEmail,
    subject: 'Appointment Rescheduled — Appointees',
    html: buildEmailHtml({ status: 'rescheduled', patientName, doctorName, date: formatDate(appointmentDate), time, bookingId }),
    text: `Hello ${patientName}, your appointment with ${doctorName} has been rescheduled to ${formatDate(appointmentDate)} at ${time}. Booking ID: ${bookingId}`,
  });
}

async function sendCancellationEmail(booking) {
  const { userEmail, patientName, doctorName, appointmentDate, time, bookingId, cancellationReason } = booking;
  if (!userEmail) return { success: false, error: 'NO_RECIPIENT_EMAIL' };

  return sendEmail({
    to: userEmail,
    subject: 'Appointment Cancelled — Appointees',
    html: buildEmailHtml({ status: 'cancelled', patientName, doctorName, date: formatDate(appointmentDate), time, bookingId, reason: cancellationReason }),
    text: `Hello ${patientName}, your appointment with ${doctorName} on ${formatDate(appointmentDate)} has been cancelled. Reason: ${cancellationReason || 'N/A'}`,
  });
}

// Test/dev hooks — used by the test suite to inject a mock transporter.
// Note: setTransporter/resetTransporter are no longer used for Resend,
// but kept in the exports so existing test files don't break at import time.
function setTransporter(t) { /* no-op for Resend — mocking is done at the Resend SDK level */ }
function resetTransporter() { /* no-op for Resend */ }

module.exports = {
  verifyEmailConfig,
  sendBookingConfirmationEmail,
  sendRescheduleConfirmationEmail,
  sendCancellationEmail,
  sendEmail,
  setTransporter,
  resetTransporter,
};
