require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { User, Service, Provider, Availability, Appointment } = require('../models');

/**
 * AppointEase Database Persistence & Relationship Integrity Verifier
 */
const verifyDatabase = async () => {
  console.log('====================================================');
  console.log('  AppointEase — Real Database Persistence Auditor   ');
  console.log('====================================================');

  try {
    const conn = await connectDB();
    if (!conn) {
      throw new Error('Database connection failed.');
    }

    const dbName = mongoose.connection.name;

    // 1. Query Real Database Document Counts directly from MongoDB
    const [userCount, providerCount, serviceCount, availCount, aptCount] = await Promise.all([
      User.countDocuments(),
      Provider.countDocuments(),
      Service.countDocuments(),
      Availability.countDocuments(),
      Appointment.countDocuments()
    ]);

    console.log('\nAppointEase Seed Verification');
    console.log('-----------------------------');
    console.log(`Database Name:  ${dbName}`);
    console.log(`Users:          ${userCount}`);
    console.log(`Providers:      ${providerCount}`);
    console.log(`Services:       ${serviceCount}`);
    console.log(`Availabilities: ${availCount}`);
    console.log(`Appointments:   ${aptCount}`);

    // 2. Query Provider Breakdown (Active vs Inactive)
    const [activeProviders, inactiveProviders] = await Promise.all([
      Provider.countDocuments({ status: 'ACTIVE' }),
      Provider.countDocuments({ status: 'INACTIVE' })
    ]);
    console.log('\nProvider Status Breakdown:');
    console.log(`  • Active:     ${activeProviders}`);
    console.log(`  • Inactive:   ${inactiveProviders}`);

    // 3. Query Service Categories
    const serviceCategoryBreakdown = await Service.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('\nService Categories Breakdown:');
    serviceCategoryBreakdown.forEach((cat) => {
      console.log(`  • ${cat._id.padEnd(32)}: ${cat.count}`);
    });

    // 4. Query Appointment Status Breakdown
    const appointmentStatusBreakdown = await Appointment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('\nAppointment Status Breakdown:');
    appointmentStatusBreakdown.forEach((stat) => {
      console.log(`  • ${stat._id.padEnd(12)}: ${stat.count}`);
    });

    // 5. Relationship Integrity Checks
    console.log('\nRelationships Integrity:');

    // Fetch IDs
    const [allUserIds, allProviderIds, allServiceIds, appointments, availabilities, providers] = await Promise.all([
      User.find({}, '_id').lean(),
      Provider.find({}, '_id').lean(),
      Service.find({}, '_id').lean(),
      Appointment.find({}, 'appointmentId userId providerId serviceId').lean(),
      Availability.find({}, 'providerId').lean(),
      Provider.find({}, 'serviceIds').lean()
    ]);

    const userSet = new Set(allUserIds.map((u) => u._id.toString()));
    const providerSet = new Set(allProviderIds.map((p) => p._id.toString()));
    const serviceSet = new Set(allServiceIds.map((s) => s._id.toString()));

    const orphanUsers = appointments.filter((a) => !userSet.has(a.userId.toString())).length;
    const orphanProviders = appointments.filter((a) => !providerSet.has(a.providerId.toString())).length;
    const orphanServices = appointments.filter((a) => !serviceSet.has(a.serviceId.toString())).length;
    const orphanAvailabilities = availabilities.filter((av) => !providerSet.has(av.providerId.toString())).length;

    let orphanProviderServices = 0;
    providers.forEach((p) => {
      (p.serviceIds || []).forEach((sId) => {
        if (!serviceSet.has(sId.toString())) {
          orphanProviderServices++;
        }
      });
    });

    console.log(`  • orphanUsers          = ${orphanUsers}`);
    console.log(`  • orphanProviders      = ${orphanProviders}`);
    console.log(`  • orphanServices       = ${orphanServices}`);
    console.log(`  • orphanAvailabilities = ${orphanAvailabilities}`);
    console.log(`  • orphanProviderServices = ${orphanProviderServices}`);

    const isAllValid =
      orphanUsers === 0 &&
      orphanProviders === 0 &&
      orphanServices === 0 &&
      orphanAvailabilities === 0 &&
      orphanProviderServices === 0;

    console.log(`\nIntegrity Status: ${isAllValid ? 'ALL VALID (100%)' : 'ERRORS DETECTED'}`);
    console.log('====================================================\n');

    await mongoose.connection.close();

    if (!isAllValid) {
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error('[Verification Error] Suite encountered an error:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

verifyDatabase();
