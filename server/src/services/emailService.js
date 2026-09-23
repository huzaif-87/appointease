/**
 * Appointees — Email Service (Gmail SMTP via Nodemailer)
 * Clean, production-ready version — built from scratch to replace fragile setups.
 *
 * Required environment variables:
 *   EMAIL_USER          - your Gmail address (the sender)
 *   EMAIL_APP_PASSWORD  - 16-character Gmail App Password (NOT your login password)
 *                          Generate at: myaccount.google.com/apppasswords
 *                          (requires 2-Step Verification enabled)
 *
 * Optional:
 *   EMAIL_FROM                  - display name, e.g. "Appointees <you@gmail.com>"
 *   ALLOW_TEST_EMAIL_FALLBACK   - "true" only for local dev. If the real Gmail
 *                                 send fails, falls back to Ethereal and logs
 *                                 it CLEARLY as a fallback (never silently).
 *                                 Leave unset/false in production.
 */

const nodemailer = require('nodemailer');
const dns = require('dns');

// Force IPv4 DNS resolution — avoids ENETUNREACH on hosts with no outbound IPv6 route
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

// Custom IPv4-only lookup function for Nodemailer to guarantee IPv4 on Linux/Render containers
function ipv4Lookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  return dns.lookup(hostname, Object.assign({}, options, { family: 4 }), callback);
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const { EMAIL_USER, EMAIL_APP_PASSWORD } = process.env;

  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
    throw new Error('EMAIL_USER and EMAIL_APP_PASSWORD must be set in environment variables');
  }

  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure, // false for 587
    requireTLS: !secure,
    lookup: ipv4Lookup,
    family: 4, // force IPv4 — avoids ENETUNREACH / timeouts on cloud hosts
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return transporter;
}

/**
 * Call this ONCE when your server boots (e.g. in server.js / app.js after
 * dotenv loads). Surfaces config problems immediately instead of on the
 * first real booking.
 */
async function verifyEmailConfig() {
  try {
    await getTransporter().verify();
    console.log('[Email Service] Gmail SMTP verified — ready to send.');
    return true;
  } catch (err) {
    console.error('[Email Service] Gmail SMTP verification FAILED:', {
      code: err.code,
      responseCode: err.responseCode,
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
 * Core sender. Never throws — always returns a result object so a failed
 * email never breaks the booking/reschedule/cancel flow that called it.
 * Real errors are always logged; fallback (if enabled) is always labeled
 * clearly and never reported as a normal success.
 */
async function sendEmail({ to, subject, html, text }) {
  const maskedTo = maskEmail(to);

  try {
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || `Appointees <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`[Email Service] Sent OK — To: ${maskedTo}, MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email Service] SEND FAILED — To: ${maskedTo}`, {
      code: err.code,
      responseCode: err.responseCode,
      message: err.message,
    });

    if (process.env.ALLOW_TEST_EMAIL_FALLBACK === 'true') {
      try {
        const testAccount = await nodemailer.createTestAccount();
        const testTransport = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: { user: testAccount.user, pass: testAccount.pass },
        });
        const info = await testTransport.sendMail({ from: testAccount.user, to, subject, text, html });
        console.warn(`[Email Service] DEV FALLBACK used (Ethereal, not real delivery) — Preview: ${nodemailer.getTestMessageUrl(info)}`);
        return { success: true, isFallback: true, previewUrl: nodemailer.getTestMessageUrl(info) };
      } catch (fallbackErr) {
        console.error('[Email Service] Fallback also failed:', fallbackErr.message);
      }
    }

    return { success: false, error: err.message, code: err.code };
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

function setTransporter(t) {
  transporter = t;
}

function resetTransporter() {
  transporter = null;
}

module.exports = {
  verifyEmailConfig,
  sendBookingConfirmationEmail,
  sendRescheduleConfirmationEmail,
  sendCancellationEmail,
  sendEmail,
  setTransporter,
  resetTransporter,
};
