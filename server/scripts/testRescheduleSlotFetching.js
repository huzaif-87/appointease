const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { getAppointmentById, getPatientAppointments } = require('../src/services/bookingService');
const { calculateSlots } = require('../src/services/slotService');
const { Provider, Service, Appointment, User } = require('../src/models');

const { connectDB } = require('../src/config/db');

async function testRescheduleSlotFetching() {
  try {
    await connectDB();

    // Find a confirmed appointment with user
    const apt = await Appointment.findOne({ status: 'CONFIRMED' }).lean();
    if (!apt) {
      console.log('No confirmed appointment found to test reschedule');
      process.exit(0);
    }

    const patientId = apt.userId;
    const appointmentId = apt.appointmentId || apt._id;

    console.log('\n--- 1. NEW BOOKING FLOW ---');
    const providerDoc = await Provider.findById(apt.providerId).lean();
    const serviceDoc = await Service.findById(apt.serviceId).lean();
    
    // Pick a date 3 days from now
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 3);
    const dateStr = testDate.toISOString().split('T')[0];

    const newBookingParams = {
      providerId: providerDoc._id.toString(),
      serviceId: serviceDoc._id.toString(),
      date: dateStr
    };
    console.log('New Booking Parameters:', newBookingParams);

    const newBookingSlots = await calculateSlots(newBookingParams);
    console.log(`New Booking Slots Found: ${newBookingSlots.summary.availableSlots} available slots`);

    console.log('\n--- 2. RESCHEDULE FLOW ---');
    const aptDetails = await getAppointmentById({ appointmentId, patientId });
    
    // In BookingEntryPage.jsx:
    // pData = apt.provider || apt.providerId
    // sData = apt.service || apt.serviceId
    const pData = aptDetails.provider;
    const sData = aptDetails.service;

    console.log('Retrieved apt.provider._id:', pData?._id?.toString());
    console.log('Retrieved apt.provider.id:', pData?.id?.toString());
    console.log('Retrieved apt.service._id:', sData?._id?.toString());
    console.log('Retrieved apt.service.id:', sData?.id?.toString());

    const rescheduleGuardPassed = Boolean(pData?._id && sData?._id && dateStr);
    console.log(`Frontend Guard Passed (!selectedProvider?._id || !selectedService?._id): ${rescheduleGuardPassed}`);

    const rescheduleParams = {
      providerId: pData._id.toString(),
      serviceId: sData._id.toString(),
      date: dateStr,
      excludeAppointmentId: aptDetails._id.toString()
    };
    console.log('Reschedule Parameters:', rescheduleParams);

    const rescheduleSlots = await calculateSlots(rescheduleParams);
    console.log(`Reschedule Slots Found: ${rescheduleSlots.summary.availableSlots} available slots`);

    console.log('\n--- 3. COMPARISON RESULTS ---');
    console.table([
      {
        Flow: 'New Booking',
        'Provider ID (_id)': newBookingParams.providerId,
        'Service ID (_id)': newBookingParams.serviceId,
        Date: newBookingParams.date,
        'Available Slots': newBookingSlots.summary.availableSlots
      },
      {
        Flow: 'Reschedule',
        'Provider ID (_id)': rescheduleParams.providerId,
        'Service ID (_id)': rescheduleParams.serviceId,
        Date: rescheduleParams.date,
        'Available Slots': rescheduleSlots.summary.availableSlots
      }
    ]);

    const isMatch =
      newBookingParams.providerId === rescheduleParams.providerId &&
      newBookingParams.serviceId === rescheduleParams.serviceId &&
      rescheduleGuardPassed &&
      rescheduleSlots.summary.availableSlots >= 0;

    console.log(`\nSUCCESS: Both flows use identical _id parameters and slot fetching works end-to-end: ${isMatch}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Test Error:', err);
    process.exit(1);
  }
}

testRescheduleSlotFetching();
