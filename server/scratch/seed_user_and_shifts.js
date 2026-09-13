require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('../src/config/db');
const { User, Provider, Service, Availability } = require('../src/models');

async function seedUserAndShifts() {
  await connectDB();

  console.log('\n====================================================');
  console.log('  Seeding Admin & Provider for sharukshaik631@gmail.com');
  console.log('  And Expanding Availability Shifts to All 7 Days');
  console.log('====================================================\n');

  const email = 'sharukshaik631@gmail.com';
  const rawPassword = 'Pala@1234';

  // 1. Create or Update Admin / Provider User in DB
  let user = await User.findOne({ email });
  if (!user) {
    console.log(`Creating new Admin & Provider user: ${email}...`);
    user = await User.create({
      name: 'Sharuk Shaik',
      email,
      password: rawPassword,
      role: 'ADMIN',
      phone: '9876543210'
    });
  } else {
    console.log(`Updating existing user password & role for: ${email}...`);
    user.name = 'Sharuk Shaik';
    user.password = rawPassword;
    user.role = 'ADMIN';
    user.phone = '9876543210';
    await user.save();
  }
  console.log(`✓ User saved: ${user.name} (${user.email}) - Role: ${user.role}`);

  // 2. Ensure Provider Record exists for sharukshaik631@gmail.com
  let providerDoc = await Provider.findOne({ email });
  const allServices = await Service.find({ status: 'ACTIVE' });
  const serviceIds = allServices.map((s) => s._id);

  if (!providerDoc) {
    console.log(`Creating Provider profile record for: ${email}...`);
    providerDoc = await Provider.create({
      name: 'Dr. Sharuk Shaik',
      email,
      specialty: 'Cardiology',
      qualification: 'MBBS, MD (Cardiology)',
      experienceYears: 12,
      bio: 'Senior Specialist & Chief Medical Officer at AppointEase.',
      location: 'Chennai',
      consultationDuration: 30,
      status: 'ACTIVE',
      serviceIds
    });
  } else {
    console.log(`Updating Provider profile record for: ${email}...`);
    providerDoc.name = 'Dr. Sharuk Shaik';
    providerDoc.specialty = 'Cardiology';
    providerDoc.status = 'ACTIVE';
    providerDoc.serviceIds = serviceIds;
    await providerDoc.save();
  }
  console.log(`✓ Provider profile saved: ${providerDoc.name} (${providerDoc.email})`);

  // 3. Ensure Shifts exist for ALL Providers across ALL 7 Days (Monday - Sunday)
  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const allActiveProviders = await Provider.find({ status: 'ACTIVE' });

  let newShiftsCreated = 0;
  for (const prov of allActiveProviders) {
    for (const dayOfWeek of allDays) {
      const existingShift = await Availability.findOne({ providerId: prov._id, dayOfWeek });
      if (!existingShift) {
        // Create Morning shift (09:00 - 13:00) and Afternoon shift (14:00 - 18:00)
        await Availability.create([
          {
            providerId: prov._id,
            dayOfWeek,
            startTime: '09:00',
            endTime: '13:00',
            slotDurationMinutes: prov.consultationDuration || 30,
            isRecurring: true,
            isActive: true
          },
          {
            providerId: prov._id,
            dayOfWeek,
            startTime: '14:00',
            endTime: '18:00',
            slotDurationMinutes: prov.consultationDuration || 30,
            isRecurring: true,
            isActive: true
          }
        ]);
        newShiftsCreated += 2;
      }
    }
  }

  console.log(`✓ Created ${newShiftsCreated} new working shifts across all 7 days for providers.`);

  // 4. Verify Total Available Days across database
  const totalShifts = await Availability.countDocuments({ isActive: true });
  const distinctDays = await Availability.distinct('dayOfWeek', { isActive: true });
  console.log(`✓ Total Active Shifts in DB: ${totalShifts}`);
  console.log(`✓ Covered Shift Days: ${distinctDays.join(', ')}`);

  console.log('\n====================================================');
  console.log('✓ Seeding & All-Day Availability Setup Completed!');
  console.log('====================================================\n');

  await mongoose.disconnect();
}

seedUserAndShifts();
