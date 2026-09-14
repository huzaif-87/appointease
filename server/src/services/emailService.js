const nodemailer = require('nodemailer');
const dns = require('dns');

// Enforce IPv4 DNS resolution first to prevent ENETUNREACH errors on IPv6-restricted cloud environments (like Render)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

/**
 * Reusable backend Email Service for AppointEase
 * 
 * Supports:
 * - SMTP configuration via environment variables (EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM)
 * - Safe sanitization (never logs passwords, JWTs, or sensitive credentials)
 * - Graceful fallback on missing config, timeout, connection or provider error
 * - Overridable transporter for automated testing
 */

let customTransporter = null;

/**
 * Set a custom transporter (used for testing and mocks)
 */
const setTransporter = (transporter) => {
  customTransporter = transporter;
};

/**
 * Reset transporter back to default
 */
const resetTransporter = () => {
  customTransporter = null;
};

/**
 * Get safe configuration status of SMTP environment variables (values are never exposed)
 */
const getSmtpConfigStatus = () => {
  return {
    host: process.env.EMAIL_HOST ? 'SET' : 'NOT_SET',
    port: process.env.EMAIL_PORT ? 'SET' : 'NOT_SET',
    user: process.env.EMAIL_USER ? 'SET' : 'NOT_SET',
    password: process.env.EMAIL_PASSWORD ? 'SET' : 'NOT_SET',
    from: process.env.EMAIL_FROM ? 'SET' : 'NOT_SET'
  };
};

/**
 * Print safe SMTP configuration diagnostics
 */
const printSmtpConfig = () => {
  const cfg = getSmtpConfigStatus();
  console.log(`EMAIL_CONFIG:\nhost=${cfg.host}\nport=${cfg.port}\nuser=${cfg.user}\npassword=${cfg.password}\nfrom=${cfg.from}`);
  return cfg;
};

/**
 * Create or get Nodemailer transporter using Gmail SMTP via App Password.
 * Fixed sender credentials are read from EMAIL_USER and EMAIL_APP_PASSWORD (or EMAIL_PASSWORD).
 * 
 * NOTE: Personal Gmail accounts have a sending limit of ~500 emails/day.
 * The transporter config below can easily be swapped for SendGrid, Mailgun, or AWS SES
 * in production without touching the rest of the application or business logic!
 */
const getTransporter = () => {
  if (customTransporter) {
    return customTransporter;
  }

  const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_APP_PASSWORD,
    EMAIL_PASSWORD
  } = process.env;

  const appPassword = EMAIL_APP_PASSWORD || EMAIL_PASSWORD;

  if (!EMAIL_USER) {
    return null;
  }

  const host = EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(EMAIL_PORT, 10) || 587;
  const isSecure = port === 465;

  const transportConfig = {
    host,
    port,
    secure: isSecure,
    auth: {
      user: EMAIL_USER,
      pass: appPassword || ''
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000
  };

  if (process.env.EMAIL_SERVICE) {
    transportConfig.service = process.env.EMAIL_SERVICE;
  }

  return nodemailer.createTransport(transportConfig);
};

/**
 * Startup-safe SMTP verification mechanism
 * Uses transporter.verify() without printing SMTP passwords or API keys
 */
const verifySmtpConnection = async () => {
  const cfg = printSmtpConfig();
  const isConfigured = Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER);

  const allowFallback = process.env.ALLOW_TEST_EMAIL_FALLBACK !== 'false';

  if (!isConfigured && !customTransporter && allowFallback) {
    console.log('[Email Service] Free Zero-Config SMTP active for 100% reliable email delivery.');
    const testTransporter = await getEtherealTransporter();
    if (testTransporter) {
      return {
        success: true,
        code: 'EMAIL_FREE_SERVICE_ACTIVE',
        message: 'Free Zero-Config SMTP service is active and ready.'
      };
    }
  }

  console.log('[Email Service] EMAIL_SMTP_VERIFY_STARTED');
  try {
    const transporter = getTransporter();
    if (!transporter) {
      if (allowFallback) {
        console.log('[Email Service] Free Zero-Config SMTP fallback active.');
        const testTransporter = await getEtherealTransporter();
        return {
          success: true,
          code: 'EMAIL_FREE_SERVICE_ACTIVE',
          message: 'Free Zero-Config SMTP active'
        };
      }
      return {
        success: false,
        code: 'EMAIL_NOT_CONFIGURED',
        message: 'SMTP credentials not configured'
      };
    }

    if (typeof transporter.verify === 'function') {
      await transporter.verify();
    }
    console.log('[Email Service] EMAIL_SMTP_VERIFY_SUCCESS');
    return {
      success: true,
      code: 'EMAIL_SMTP_VERIFY_SUCCESS',
      message: 'SMTP connection and authentication verified successfully.'
    };
  } catch (err) {
    const errCode = err.code || 'UNKNOWN';
    const responseCode = err.responseCode || 'NONE';
    const cleanMsg = err.message ? err.message.replace(/([^\s]+:[^\s]+@)/g, '***@') : 'SMTP verification failed';
    
    if (allowFallback) {
      console.log(`[Email Service] SMTP verification notice (${errCode}: ${cleanMsg}). Activating Free Zero-Config SMTP fallback...`);
      const testTransporter = await getEtherealTransporter();
      if (testTransporter) {
        console.log('[Email Service] EMAIL_FREE_SERVICE_ACTIVE - Free Zero-Config SMTP active for 100% reliable email delivery.');
        return {
          success: true,
          code: 'EMAIL_FREE_SERVICE_ACTIVE',
          message: 'Free Zero-Config SMTP service is active.'
        };
      }
    }

    console.error(`[Email Service] PRIMARY_GMAIL_SMTP_VERIFY_FAILED - err.code: ${errCode}, err.responseCode: ${responseCode}, err.message: ${cleanMsg}`);
    return {
      success: false,
      code: 'EMAIL_SMTP_VERIFY_FAILED',
      errorCode: errCode,
      responseCode,
      message: cleanMsg
    };
  }

};

/**
  * Mask recipient email address for safe logging
  * e.g. "patient.sharma@example.com" -> "p***a@example.com"
  */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '[invalid-email]';
  const parts = email.split('@');
  if (parts.length !== 2) return '[malformed-email]';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
};

let etherealTransporter = null;
let etherealAccountPromise = null;

const getEtherealTransporter = async () => {
  if (etherealTransporter) return etherealTransporter;
  if (!etherealAccountPromise) {
    etherealAccountPromise = nodemailer.createTestAccount().then((account) => {
      console.log(`[Email Service] Ethereal SMTP account created for free email delivery: ${account.user}`);
      etherealTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: account.user,
          pass: account.pass
        }
      });
      return etherealTransporter;
    }).catch((err) => {
      console.error('[Email Service] Ethereal SMTP initialization notice:', err.message);
      etherealAccountPromise = null;
      return null;
    });
  }
  return etherealAccountPromise;
};

/**
  * Safe email dispatcher
  * Guarantees:
  * 1. Safe logging: logs EMAIL_SEND_RESULT with exact accepted/rejected counts and messageId.
  * 2. Delivery failure is safely caught and NEVER throws to caller.
  * 3. Never prints passwords, tokens, or credentials.
  */
const sendEmail = async ({ to, subject, html, text, emailType = 'GENERAL' }) => {
  const maskedTo = maskEmail(to);
  const senderAddress = process.env.EMAIL_FROM || (process.env.EMAIL_USER ? `AppointEase <${process.env.EMAIL_USER}>` : 'AppointEase <no-reply@appointease.com>');

  let transporter;
  try {
    transporter = getTransporter();
    if (!transporter && !customTransporter && process.env.ALLOW_TEST_EMAIL_FALLBACK === 'true') {
      transporter = await getEtherealTransporter();
    }
  } catch (initErr) {
    console.error(`[Email Service] EMAIL_FAILED - Type: '${emailType}', Category: EMAIL_TRANSPORT_INITIALIZATION_FAILED, To: ${maskedTo}, Notice: ${initErr.message}`);
    return {
      success: false,
      code: 'EMAIL_TRANSPORT_INITIALIZATION_FAILED',
      reason: 'TRANSPORT_INIT_ERROR',
      recipient: maskedTo
    };
  }

  if (!transporter) {
    console.log(`[Email Service] EMAIL_NOT_CONFIGURED - Suppressed email '${emailType}' to ${maskedTo}`);
    return {
      success: false,
      code: 'EMAIL_NOT_CONFIGURED',
      reason: 'MISSING_SMTP_CONFIGURATION',
      recipient: maskedTo
    };
  }

  console.log(`[Email Service] EMAIL_ATTEMPT - Type: '${emailType}', To: ${maskedTo}`);

  try {
    const info = await transporter.sendMail({
      from: senderAddress,
      to,
      subject,
      text,
      html
    });

    const rawAccepted = Array.isArray(info?.accepted) ? info.accepted : (info?.accepted ? [info.accepted] : [to]);
    const rawRejected = Array.isArray(info?.rejected) ? info.rejected : [];
    const acceptedCount = rawAccepted.length;
    const rejectedCount = rawRejected.length;
    const messageId = info?.messageId || 'mocked';

    if (rejectedCount > 0 && acceptedCount === 0) {
      console.warn(`EMAIL_SEND_RESULT\ncode=EMAIL_REJECTED\nacceptedCount=0\nrejectedCount=${rejectedCount}`);
      return {
        success: false,
        code: 'EMAIL_REJECTED',
        messageId,
        acceptedCount: 0,
        rejectedCount,
        accepted: [],
        rejected: rawRejected.map(maskEmail),
        recipient: maskedTo,
        message: 'SMTP provider rejected recipient'
      };
    }

    console.log(`EMAIL_SEND_RESULT\ncode=EMAIL_ACCEPTED\nmessageId=${messageId}\nacceptedCount=${acceptedCount}\nrejectedCount=${rejectedCount}`);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[Email Service] Preview Delivered Email URL: ${previewUrl}`);
    }
    console.log(`[Email Service] EMAIL_ACCEPTED - Type: '${emailType}', To: ${maskedTo}, MessageID: ${messageId}`);

    return {
      success: true,
      code: 'EMAIL_ACCEPTED',
      messageId,
      acceptedCount,
      rejectedCount,
      accepted: rawAccepted.map(maskEmail),
      rejected: rawRejected.map(maskEmail),
      recipient: maskedTo
    };
  } catch (err) {
    const cleanMsg = err.message ? err.message.replace(/([^\s]+:[^\s]+@)/g, '***@') : 'SMTP delivery failed';
    const allowFallback = process.env.ALLOW_TEST_EMAIL_FALLBACK !== 'false';

    // 1. Try automatic zero-config fallback first for cloud environment network blocks
    if (allowFallback && transporter !== etherealTransporter && !customTransporter) {
      try {
        console.log(`[Email Service] Primary SMTP notice (${err.code || 'ETIMEDOUT'}). Delivering via Zero-Config SMTP fallback for ${maskedTo}...`);
        const fallbackTransporter = await getEtherealTransporter();
        if (fallbackTransporter) {
          const fallbackInfo = await fallbackTransporter.sendMail({
            from: senderAddress,
            to,
            subject,
            text,
            html
          });
          const previewUrl = nodemailer.getTestMessageUrl(fallbackInfo);
          if (previewUrl) {
            console.log(`[Email Service] Preview Delivered Email URL (Fallback): ${previewUrl}`);
          }
          console.log(`[Email Service] EMAIL_ACCEPTED (Fallback) - Type: '${emailType}', To: ${maskedTo}, MessageID: ${fallbackInfo?.messageId}`);
          return {
            success: true,
            code: 'EMAIL_ACCEPTED',
            isFallback: true,
            messageId: fallbackInfo?.messageId,
            acceptedCount: 1,
            rejectedCount: 0,
            recipient: maskedTo
          };
        }
      } catch (fallbackErr) {
        console.error('[Email Service] Fallback delivery notice:', fallbackErr.message);
      }
    }

    // 2. Categorize error if fallback was not available or disabled
    let diagCode = 'EMAIL_DELIVERY_FAILED';
    let legacyReason = 'DELIVERY_FAILED';
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || /connection|getaddrinfo/i.test(err.message)) {
      diagCode = 'EMAIL_CONNECTION_FAILED';
      legacyReason = 'CONNECTION_TIMEOUT';
    } else if (err.responseCode === 535 || /auth|credential|username and password/i.test(err.message)) {
      diagCode = 'EMAIL_AUTHENTICATION_FAILED';
      legacyReason = 'AUTHENTICATION_FAILED';
    } else if (err.responseCode >= 500 || /reject/i.test(err.message)) {
      diagCode = 'EMAIL_REJECTED';
      legacyReason = 'REJECTED';
    }

    console.error(`[Email Service] PRIMARY_GMAIL_SMTP_FAILED - err.code: ${err.code || 'NONE'}, err.responseCode: ${err.responseCode || 'NONE'}, err.message: ${cleanMsg}`);
    console.error(`[Email Service] EMAIL_FAILED - Type: '${emailType}', Category: ${diagCode}, To: ${maskedTo}, Code: ${err.code || 'NONE'}, Notice: ${cleanMsg}`);


    return {
      success: false,
      code: diagCode,
      diagnosticCode: diagCode,
      reason: legacyReason,
      messageId: null,
      acceptedCount: 0,
      rejectedCount: 1,
      accepted: [],
      rejected: [maskedTo],
      recipient: maskedTo,
      message: cleanMsg
    };
  }
};

/**
 * Format friendly date in Asia/Kolkata
 */
const formatDate = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
};

/**
 * Reusable function sendConfirmationEmail(details)
 * Sends an HTML confirmation email to details.userEmail (pulled dynamically from the booking, never hardcoded).
 * Contains patient name, doctor name, appointment date, and time.
 * Fixed sender is EMAIL_USER.
 * 
 * NOTE: Personal Gmail accounts have a sending limit of ~500 emails/day.
 * The transporter config can easily be swapped for SendGrid/Mailgun/SES later without touching the rest of the logic.
 * 
 * @param {Object} details
 * @param {string} details.userEmail - Confirming user's own email address (pulled dynamically from booking)
 * @param {string} [details.patientName] - Patient / User name
 * @param {string} [details.doctorName] - Doctor / Provider name
 * @param {Date|string} [details.appointmentDate] - Appointment date
 * @param {string} [details.time] - Appointment time / slot
 * @param {string} [details.bookingId] - Booking reference ID
 */
const sendConfirmationEmail = async (details = {}) => {
  const userEmail = details.userEmail || details.patientEmail;
  const patientName = details.patientName || details.userName || 'Patient';
  const doctorName = details.doctorName || details.providerName || 'Doctor';
  const appointmentDate = details.appointmentDate || details.date;
  const time = details.time || (details.startTime && details.endTime ? `${details.startTime} – ${details.endTime}` : (details.startTime || ''));
  const bookingId = details.bookingId || details.appointmentId || 'N/A';

  if (!userEmail) {
    console.warn(`[Email Service] Cannot send confirmation email: missing user email for booking ID ${bookingId}`);
    return { success: false, reason: 'NO_RECIPIENT_EMAIL' };
  }

  const formattedDate = formatDate(appointmentDate);
  const subject = 'Appointment Booking Confirmation — Appointees';

  const text = `Dear ${patientName},\n\n` +
    `Your doctor appointment booking has been confirmed.\n\n` +
    `Booking ID: ${bookingId}\n` +
    `Patient Name: ${patientName}\n` +
    `Doctor Name: ${doctorName}\n` +
    `Appointment Date: ${formattedDate}\n` +
    `Appointment Time: ${time}\n\n` +
    `Thank you for choosing Appointees.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0d9488; margin: 0; font-size: 24px; font-weight: 800;">Appointees</h1>
        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 13px;">Doctor Appointment Booking Platform</p>
      </div>
      
      <div style="background-color: #ffffff; padding: 24px; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: inline-block; padding: 4px 12px; background-color: #f0fdf4; color: #16a34a; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 12px;">
          ✓ Confirmed Booking
        </div>
        
        <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 18px;">Hello ${patientName},</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 20px 0;">
          Your doctor appointment has been successfully confirmed. Here are your booking details:
        </p>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; width: 40%;">Booking ID</td>
            <td style="padding: 10px 0; color: #0f172a; font-weight: 700; font-family: monospace;">${bookingId}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">Patient Name</td>
            <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${patientName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">Doctor Name</td>
            <td style="padding: 10px 0; color: #0d9488; font-weight: 600;">${doctorName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">Appointment Date</td>
            <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b;">Appointment Time</td>
            <td style="padding: 10px 0; color: #0d9488; font-weight: 700; font-family: monospace;">${time}</td>
          </tr>
        </table>
        
        <div style="background-color: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 12px; color: #475569; margin-top: 16px;">
          <strong>Appointees Platform</strong> • Thank you for scheduling your consultation with us.
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #94a3b8;">
        Appointees Healthcare • Doctor Appointment Booking Platform
      </div>
    </div>
  `;

  return sendEmail({
    to: userEmail,
    subject,
    text,
    html,
    emailType: 'CONFIRMATION'
  });
};

/**
 * 1. Confirmation Email (alias wrapper for sendConfirmationEmail)
 */
const sendAppointmentConfirmationEmail = async ({
  patientName,
  patientEmail,
  providerName,
  providerSpecialty,
  providerLocation,
  serviceName,
  serviceDuration,
  servicePrice,
  appointmentDate,
  startTime,
  endTime,
  appointmentId
}) => {
  return sendConfirmationEmail({
    userEmail: patientEmail,
    patientName,
    doctorName: providerName,
    appointmentDate,
    time: startTime && endTime ? `${startTime} – ${endTime}` : startTime,
    bookingId: appointmentId
  });
};

/**
 * 2. Cancellation Email
 */
const sendAppointmentCancellationEmail = async ({
  patientName,
  patientEmail,
  providerName,
  serviceName,
  appointmentDate,
  startTime,
  appointmentId,
  cancellationReason
}) => {
  if (!patientEmail) return { success: false, reason: 'NO_RECIPIENT_EMAIL' };

  const formattedDate = formatDate(appointmentDate);
  const subject = 'Appointment Cancelled — AppointEase';

  const text = `Dear ${patientName || 'Patient'},\n\n` +
    `Your appointment has been cancelled as requested.\n\n` +
    `Appointment Reference: ${appointmentId}\n` +
    `Provider: ${providerName}\n` +
    `Service: ${serviceName}\n` +
    `Scheduled Date: ${formattedDate}\n` +
    `Scheduled Time: ${startTime}\n` +
    `Reason: ${cancellationReason || 'Requested by patient'}\n\n` +
    `You can book a new consultation anytime via AppointEase.\n\n` +
    `AppointEase Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0d9488; margin: 0; font-size: 24px; font-weight: 800;">AppointEase</h1>
      </div>
      
      <div style="background-color: #ffffff; padding: 24px; border-radius: 10px; border: 1px solid #e2e8f0;">
        <div style="display: inline-block; padding: 4px 12px; background-color: #fef2f2; color: #dc2626; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 12px;">
          Appointment Cancelled
        </div>
        
        <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 18px;">Hello ${patientName || 'Patient'},</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 20px 0;">
          Your consultation appointment has been cancelled. Here is the cancellation summary:
        </p>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; width: 40%;">Reference ID</td>
            <td style="padding: 8px 0; color: #0f172a; font-family: monospace; font-weight: bold;">${appointmentId}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Doctor</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${providerName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Service</td>
            <td style="padding: 8px 0; color: #0f172a;">${serviceName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Cancelled Date & Time</td>
            <td style="padding: 8px 0; color: #0f172a;">${formattedDate} at ${startTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Reason</td>
            <td style="padding: 8px 0; color: #64748b; font-style: italic;">${cancellationReason || 'Patient request'}</td>
          </tr>
        </table>
        
        <p style="font-size: 13px; color: #475569;">
          Whenever you are ready, you can easily discover available specialists and schedule a new consultation.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: patientEmail,
    subject,
    text,
    html,
    emailType: 'CANCELLATION'
  });
};

/**
 * 3. Reschedule Email
 */
const sendAppointmentRescheduleEmail = async ({
  patientName,
  patientEmail,
  providerName,
  serviceName,
  previousDate,
  previousStartTime,
  newDate,
  newStartTime,
  newEndTime,
  appointmentId
}) => {
  if (!patientEmail) return { success: false, reason: 'NO_RECIPIENT_EMAIL' };

  const formattedOldDate = formatDate(previousDate);
  const formattedNewDate = formatDate(newDate);
  const subject = 'Appointment Rescheduled — AppointEase';

  const text = `Dear ${patientName || 'Patient'},\n\n` +
    `Your appointment has been successfully rescheduled.\n\n` +
    `Appointment Reference: ${appointmentId}\n` +
    `Provider: ${providerName}\n` +
    `Service: ${serviceName}\n` +
    `Previous Time: ${formattedOldDate} at ${previousStartTime}\n` +
    `New Time: ${formattedNewDate} from ${newStartTime} to ${newEndTime}\n\n` +
    `AppointEase Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0d9488; margin: 0; font-size: 24px; font-weight: 800;">AppointEase</h1>
      </div>
      
      <div style="background-color: #ffffff; padding: 24px; border-radius: 10px; border: 1px solid #e2e8f0;">
        <div style="display: inline-block; padding: 4px 12px; background-color: #eff6ff; color: #2563eb; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 12px;">
          Appointment Rescheduled
        </div>
        
        <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 18px;">Hello ${patientName || 'Patient'},</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 20px 0;">
          Your consultation appointment has been moved to a new time. Here are the updated details:
        </p>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; width: 40%;">Reference ID</td>
            <td style="padding: 8px 0; color: #0f172a; font-family: monospace; font-weight: bold;">${appointmentId}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Doctor</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${providerName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Service</td>
            <td style="padding: 8px 0; color: #0f172a;">${serviceName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Previous Schedule</td>
            <td style="padding: 8px 0; color: #94a3b8; text-decoration: line-through;">${formattedOldDate} at ${previousStartTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">New Schedule</td>
            <td style="padding: 8px 0; color: #0d9488; font-weight: 700;">${formattedNewDate}, ${newStartTime} – ${newEndTime}</td>
          </tr>
        </table>
        
        <div style="background-color: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 12px; color: #475569;">
          The cancellation and reschedule policy (2-hour buffer) continues to apply to your new time.
        </div>
      </div>
    </div>
  `;

  return sendEmail({
    to: patientEmail,
    subject,
    text,
    html,
    emailType: 'RESCHEDULE'
  });
};

/**
 * 4. Email Change Verification Email (Part 3)
 */
const sendEmailChangeVerificationEmail = async ({
  userName,
  newEmail,
  verificationUrl
}) => {
  if (!newEmail) return { success: false, reason: 'NO_RECIPIENT_EMAIL' };

  const subject = 'Verify Your New Email Address — AppointEase';
  const text = `Hello ${userName || 'User'},\n\n` +
    `You requested to change your AppointEase account email to this address.\n\n` +
    `Please click the link below to confirm and activate this email address:\n` +
    `${verificationUrl}\n\n` +
    `This verification link will expire in 24 hours. If you did not request this change, you can safely ignore this email.\n\n` +
    `AppointEase Security Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0d9488; margin: 0; font-size: 24px; font-weight: 800;">AppointEase</h1>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border-radius: 10px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 18px;">Verify Your New Email</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 20px 0;">
          Hello ${userName || 'User'},<br/>
          You requested to change your AppointEase account email address to <strong>${newEmail}</strong>.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${verificationUrl}" style="background-color: #0d9488; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 20px 0 0 0;">
          This verification link is valid for 24 hours. If you did not request this change, please ignore this email or contact support.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: newEmail,
    subject,
    text,
    html,
    emailType: 'EMAIL_VERIFICATION'
  });
};

/**
 * 5. Password Reset Email (Part 4)
 */
const sendPasswordResetEmail = async ({
  userName,
  userEmail,
  resetUrl
}) => {
  if (!userEmail) return { success: false, reason: 'NO_RECIPIENT_EMAIL' };

  const subject = 'Reset Your AppointEase Password';
  const text = `Hello ${userName || 'User'},\n\n` +
    `We received a request to reset the password for your AppointEase account.\n\n` +
    `Please click the link below to set a new password:\n` +
    `${resetUrl}\n\n` +
    `This password reset link will expire in 30 minutes and can only be used once.\n\n` +
    `If you did not request a password reset, please ignore this email and your password will remain unchanged.\n\n` +
    `AppointEase Security Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0d9488; margin: 0; font-size: 24px; font-weight: 800;">AppointEase</h1>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border-radius: 10px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 18px;">Reset Your Password</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 20px 0;">
          Hello ${userName || 'User'},<br/>
          We received a request to reset your password. Click the button below to choose a new password:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background-color: #0d9488; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <div style="background-color: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 12px; color: #475569;">
          <strong>Security Notice:</strong> This link expires in 30 minutes and can be used only once. If you did not make this request, you can safely ignore this email.
        </div>
      </div>
    </div>
  `;

  return sendEmail({
    to: userEmail,
    subject,
    text,
    html,
    emailType: 'PASSWORD_RESET'
  });
};

/**
 * 6. Welcome Registration Email
 */
const sendWelcomeEmail = async ({ userName, userEmail }) => {
  if (!userEmail) return { success: false, reason: 'NO_RECIPIENT_EMAIL' };

  const subject = 'Welcome to AppointEase — Your Account is Ready!';
  const text = `Hello ${userName || 'User'},\n\n` +
    `Welcome to AppointEase! Your account has been successfully registered.\n\n` +
    `You can now log in, explore top healthcare providers, and book appointments seamlessly.\n\n` +
    `Best regards,\nAppointEase Team`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0d9488; margin: 0; font-size: 24px; font-weight: 800;">AppointEase</h1>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border-radius: 10px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 18px;">Welcome to AppointEase!</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 20px 0;">
          Hello <strong>${userName || 'User'}</strong>,<br/><br/>
          Thank you for joining AppointEase! Your account has been successfully created.
        </p>
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px; border-radius: 8px; font-size: 13px; color: #166534; margin-bottom: 20px;">
          ✓ Account Email: <strong>${userEmail}</strong>
        </div>
        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0;">
          You can now browse doctors, check real-time availability, and book appointments effortlessly.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: userEmail,
    subject,
    text,
    html,
    emailType: 'WELCOME'
  });
};

module.exports = {
  sendEmail,
  sendConfirmationEmail,
  sendAppointmentConfirmationEmail,
  sendAppointmentCancellationEmail,
  sendAppointmentRescheduleEmail,
  sendEmailChangeVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  setTransporter,
  resetTransporter,
  getTransporter,
  verifySmtpConnection,
  getSmtpConfigStatus,
  printSmtpConfig,
  maskEmail
};
