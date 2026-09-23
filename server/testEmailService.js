const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config();

const {
  verifyEmailConfig,
  sendBookingConfirmationEmail,
  sendRescheduleConfirmationEmail,
  sendCancellationEmail,
} = require('./src/services/emailService');

const targetEmail = process.argv[2] || 'sharukshaik631@gmail.com';

async function main() {
  console.log('====================================================');
  console.log(`  Appointees — Testing Email Service to: ${targetEmail}`);
  console.log('====================================================\n');

  console.log('[1/4] Verifying Gmail SMTP configuration...');
  const isVerified = await verifyEmailConfig();
  if (!isVerified) {
    console.error('\n✗ SMTP verification failed. Check EMAIL_USER and EMAIL_APP_PASSWORD in server/.env');
    process.exit(1);
  }

  console.log('\n[2/4] Sending test Booking Confirmation email...');
  const confirmResult = await sendBookingConfirmationEmail({
    userEmail: targetEmail,
    patientName: 'Sharuk Shaik',
    doctorName: 'Dr. Suresh Varma',
    appointmentDate: new Date().toISOString(),
    time: '10:00 AM – 10:30 AM',
    bookingId: 'APT-TEST-BOOKING-001',
  });
  console.log('Result:', confirmResult);

  console.log('\n[3/4] Sending test Reschedule Confirmation email...');
  const rescheduleResult = await sendRescheduleConfirmationEmail({
    userEmail: targetEmail,
    patientName: 'Sharuk Shaik',
    doctorName: 'Dr. Suresh Varma',
    appointmentDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    time: '02:00 PM – 02:30 PM',
    bookingId: 'APT-TEST-BOOKING-001',
  });
  console.log('Result:', rescheduleResult);

  console.log('\n[4/4] Sending test Cancellation email...');
  const cancelResult = await sendCancellationEmail({
    userEmail: targetEmail,
    patientName: 'Sharuk Shaik',
    doctorName: 'Dr. Suresh Varma',
    appointmentDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    time: '02:00 PM – 02:30 PM',
    bookingId: 'APT-TEST-BOOKING-001',
    cancellationReason: 'Doctor schedule emergency',
  });
  console.log('Result:', cancelResult);

  console.log('\n====================================================');
  console.log('  Email Service Test Completed Successfully!');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Fatal error during testEmailService execution:', err);
  process.exit(1);
});
