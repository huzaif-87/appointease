const mongoose = require('mongoose');
require('dotenv').config();

const { bookAppointment } = require('../src/services/bookingService');
const { User, Provider, Service } = require('../src/models');

async function testBooking() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  try {
    const patient = await User.findOne({ role: 'PATIENT' });
    const provider = await Provider.findOne({ status: 'ACTIVE' });
    const service = await Service.findById(provider.serviceIds[0]);

    console.log('Patient:', patient.email);
    console.log('Provider:', provider.name);
    console.log('Service:', service.name);

    // Try booking for tomorrow Monday or upcoming day at 10:00 AM
    const res = await bookAppointment({
      patientId: patient._id.toString(),
      providerId: provider._id.toString(),
      serviceId: service._id.toString(),
      appointmentDate: '2026-09-15',
      startTime: '10:00',
      reason: 'General test checkup'
    });

    console.log('Booking Result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Booking Error:', err.statusCode, err.errorCode, err.message);
  } finally {
    await mongoose.disconnect();
  }
}

testBooking();
