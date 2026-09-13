require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { User, Service, Provider, Availability, Appointment } = require('../models');
const { generateSyntheticDataset } = require('./seedData');

/**
 * AppointEase Seeding Script
 * Safely clears ONLY AppointEase collections and inserts relational synthetic data.
 */
const runSeed = async () => {
  console.log('====================================================');
  console.log('  AppointEase — Synthetic Data Seeding Pipeline     ');
  console.log('====================================================');

  try {
    // 1. Establish Database Connection
    console.log('[Seed] Connecting to MongoDB...');
    const conn = await connectDB();
    if (!conn) {
      throw new Error('Database connection failed. Please check MONGODB_URI in .env');
    }

    // 2. Generate In-Memory Dataset
    const dataset = await generateSyntheticDataset();

    // 3. Safely Clear ONLY AppointEase Project Collections
    console.log('[Seed] Safely clearing existing AppointEase collections...');
    await Promise.all([
      Appointment.deleteMany({}),
      Availability.deleteMany({}),
      Provider.deleteMany({}),
      Service.deleteMany({}),
      User.deleteMany({})
    ]);
    console.log('[Seed] Existing collections cleared.');

    // 4. Batch Insert Entities Preserving ObjectIds and References
    console.log('[Seed] Inserting Services...');
    await Service.insertMany(dataset.services);

    console.log('[Seed] Inserting Users...');
    await User.insertMany(dataset.users);

    console.log('[Seed] Inserting Providers...');
    await Provider.insertMany(dataset.providers);

    console.log('[Seed] Inserting Availabilities...');
    await Availability.insertMany(dataset.availabilities);

    console.log('[Seed] Inserting Appointments...');
    await Appointment.insertMany(dataset.appointments);

    // 5. Query Actual Database Counts to Verify
    const [userCount, serviceCount, providerCount, availCount, aptCount] = await Promise.all([
      User.countDocuments(),
      Service.countDocuments(),
      Provider.countDocuments(),
      Availability.countDocuments(),
      Appointment.countDocuments()
    ]);

    console.log('====================================================');
    console.log('✓ Seeding Completed Successfully! Summary Counts:   ');
    console.log('====================================================');
    console.log(`  • Users in DB:          ${userCount}`);
    console.log(`  • Services in DB:       ${serviceCount}`);
    console.log(`  • Providers in DB:      ${providerCount}`);
    console.log(`  • Availabilities in DB: ${availCount}`);
    console.log(`  • Appointments in DB:   ${aptCount}`);
    console.log('====================================================');

    await mongoose.connection.close();
    console.log('[Seed] Database connection closed cleanly.');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error] Seeding pipeline failed:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

runSeed();
