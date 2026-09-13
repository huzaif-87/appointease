require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { User, Service, Provider, Availability, Appointment } = require('../models');

/**
 * Data Quality and Relational Integrity Verification Suite
 */
const verifyData = async () => {
  console.log('====================================================');
  console.log('  AppointEase — Data Quality Verification Suite     ');
  console.log('====================================================');

  const issues = [];
  const checks = [];

  const recordCheck = (name, passed, detail = '') => {
    checks.push({ name, passed, detail });
    if (!passed) {
      issues.push(`FAILED: [${name}] - ${detail}`);
      console.log(`  ✗ ${name}: FAILED (${detail})`);
    } else {
      console.log(`  ✓ ${name}: PASSED ${detail ? `(${detail})` : ''}`);
    }
  };

  try {
    const conn = await connectDB();
    if (!conn) {
      throw new Error('Database connection failed.');
    }

    // 1. Fetch all collections
    const [users, services, providers, availabilities, appointments] = await Promise.all([
      User.find({}).lean(),
      Service.find({}).lean(),
      Provider.find({}).lean(),
      Availability.find({}).lean(),
      Appointment.find({}).lean()
    ]);

    console.log(`[Verify] Inspecting ${users.length} users, ${services.length} services, ${providers.length} providers, ${availabilities.length} availabilities, ${appointments.length} appointments.\n`);

    // -----------------------------------------------------------------
    // Check 1: User count & Unique user emails
    // -----------------------------------------------------------------
    const userEmails = users.map((u) => u.email.toLowerCase());
    const uniqueUserEmails = new Set(userEmails);
    recordCheck(
      'Unique User Emails',
      userEmails.length === uniqueUserEmails.size && users.length >= 5,
      `Total: ${users.length}, Unique: ${uniqueUserEmails.size}`
    );

    // -----------------------------------------------------------------
    // Check 2: Provider count & Unique provider emails
    // -----------------------------------------------------------------
    const providerEmails = providers.map((p) => p.email.toLowerCase());
    const uniqueProviderEmails = new Set(providerEmails);
    recordCheck(
      'Unique Provider Emails',
      providerEmails.length === uniqueProviderEmails.size && providers.length >= 30 && providers.length <= 40,
      `Total: ${providers.length}, Unique: ${uniqueProviderEmails.size}`
    );

    // -----------------------------------------------------------------
    // Check 3: Unique Appointment IDs
    // -----------------------------------------------------------------
    const appointmentIds = appointments.map((a) => a.appointmentId);
    const uniqueAptIds = new Set(appointmentIds);
    recordCheck(
      'Unique Appointment IDs',
      appointmentIds.length === uniqueAptIds.size && appointments.length >= 100 && appointments.length <= 200,
      `Total: ${appointments.length}, Unique: ${uniqueAptIds.size}`
    );

    // -----------------------------------------------------------------
    // Check 4: Service count & categories
    // -----------------------------------------------------------------
    const serviceCategories = new Set(services.map((s) => s.category));
    recordCheck(
      'Service Count & Categories',
      services.length >= 15 && services.length <= 20 && serviceCategories.size >= 6,
      `Services: ${services.length}, Distinct Categories: ${serviceCategories.size}`
    );

    // -----------------------------------------------------------------
    // Check 5: No orphan provider references in Availabilities
    // -----------------------------------------------------------------
    const providerIdSet = new Set(providers.map((p) => p._id.toString()));
    const orphanAvailProviders = availabilities.filter(
      (a) => !providerIdSet.has(a.providerId.toString())
    );
    recordCheck(
      'No Orphan Provider References in Availabilities',
      orphanAvailProviders.length === 0,
      orphanAvailProviders.length === 0 ? 'All providerId references valid' : `Found ${orphanAvailProviders.length} orphan records`
    );

    // -----------------------------------------------------------------
    // Check 6: No orphan references in Appointments (User, Provider, Service)
    // -----------------------------------------------------------------
    const userIdSet = new Set(users.map((u) => u._id.toString()));
    const serviceIdSet = new Set(services.map((s) => s._id.toString()));

    const orphanAptUsers = appointments.filter((a) => !userIdSet.has(a.userId.toString()));
    const orphanAptProviders = appointments.filter((a) => !providerIdSet.has(a.providerId.toString()));
    const orphanAptServices = appointments.filter((a) => !serviceIdSet.has(a.serviceId.toString()));

    recordCheck(
      'No Orphan User References in Appointments',
      orphanAptUsers.length === 0,
      orphanAptUsers.length === 0 ? 'All userId references valid' : `Found ${orphanAptUsers.length} orphan users`
    );
    recordCheck(
      'No Orphan Provider References in Appointments',
      orphanAptProviders.length === 0,
      orphanAptProviders.length === 0 ? 'All providerId references valid' : `Found ${orphanAptProviders.length} orphan providers`
    );
    recordCheck(
      'No Orphan Service References in Appointments',
      orphanAptServices.length === 0,
      orphanAptServices.length === 0 ? 'All serviceId references valid' : `Found ${orphanAptServices.length} orphan services`
    );

    // -----------------------------------------------------------------
    // Check 7: No orphan service references in Provider.serviceIds
    // -----------------------------------------------------------------
    let orphanProviderServicesCount = 0;
    providers.forEach((p) => {
      (p.serviceIds || []).forEach((sId) => {
        if (!serviceIdSet.has(sId.toString())) {
          orphanProviderServicesCount++;
        }
      });
    });
    recordCheck(
      'No Orphan Service References in Providers',
      orphanProviderServicesCount === 0,
      orphanProviderServicesCount === 0 ? 'All serviceIds valid' : `Found ${orphanProviderServicesCount} invalid service references`
    );

    // -----------------------------------------------------------------
    // Check 8: Valid Appointment Times & Durations (startTime < endTime)
    // -----------------------------------------------------------------
    const timeToMinutes = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    let invalidTimeRangeCount = 0;
    appointments.forEach((a) => {
      const sMin = timeToMinutes(a.startTime);
      const eMin = timeToMinutes(a.endTime);
      if (sMin >= eMin || isNaN(sMin) || isNaN(eMin)) {
        invalidTimeRangeCount++;
      }
    });

    recordCheck(
      'Valid Appointment Time Ranges (startTime < endTime)',
      invalidTimeRangeCount === 0,
      invalidTimeRangeCount === 0 ? 'All 100% valid HH:MM ranges' : `Found ${invalidTimeRangeCount} invalid ranges`
    );

    // -----------------------------------------------------------------
    // Check 9: No Duplicate Provider Appointments (Double-Booking Prevention)
    // -----------------------------------------------------------------
    const providerSlotKeys = new Set();
    let duplicateSlotCount = 0;

    appointments.forEach((a) => {
      const dateStr = new Date(a.appointmentDate).toISOString().split('T')[0];
      const key = `${a.providerId.toString()}_${dateStr}_${a.startTime}`;
      if (providerSlotKeys.has(key)) {
        duplicateSlotCount++;
      }
      providerSlotKeys.add(key);
    });

    recordCheck(
      'Zero Duplicate Provider/Date/Time Appointments',
      duplicateSlotCount === 0,
      duplicateSlotCount === 0 ? 'No conflicting provider bookings found' : `Found ${duplicateSlotCount} collisions`
    );

    // -----------------------------------------------------------------
    // Check 10: Appointment Times Fall Within Provider Working Hours
    // -----------------------------------------------------------------
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let outOfAvailabilityCount = 0;

    appointments.forEach((a) => {
      const aptDate = new Date(a.appointmentDate);
      const dayName = dayNames[aptDate.getUTCDay()];
      const aptStartMin = timeToMinutes(a.startTime);
      const aptEndMin = timeToMinutes(a.endTime);

      // Find if provider has active availability covering this day and time
      const matchingAvail = availabilities.find(
        (av) =>
          av.providerId.toString() === a.providerId.toString() &&
          av.dayOfWeek === dayName &&
          av.isActive &&
          timeToMinutes(av.startTime) <= aptStartMin &&
          timeToMinutes(av.endTime) >= aptEndMin
      );

      if (!matchingAvail) {
        outOfAvailabilityCount++;
      }
    });

    recordCheck(
      'Appointment Times Match Provider Availability Windows',
      outOfAvailabilityCount === 0,
      outOfAvailabilityCount === 0 ? 'All appointments within provider shifts' : `Found ${outOfAvailabilityCount} out-of-schedule bookings`
    );

    // -----------------------------------------------------------------
    // Check 11: Historical Dates Consistency (No historical CONFIRMED)
    // -----------------------------------------------------------------
    const now = new Date('2026-09-12T12:00:00.000Z');
    let historicalConfirmedCount = 0;
    let missingCancelReasonCount = 0;

    appointments.forEach((a) => {
      const aptDate = new Date(a.appointmentDate);
      if (aptDate < now && a.status === 'CONFIRMED') {
        historicalConfirmedCount++;
      }
      if (a.status === 'CANCELLED' && !a.cancellationReason) {
        missingCancelReasonCount++;
      }
    });

    recordCheck(
      'Temporal Consistency (Historical appointments not CONFIRMED)',
      historicalConfirmedCount === 0,
      historicalConfirmedCount === 0 ? 'Past appointments marked COMPLETED, NO_SHOW, or CANCELLED' : `Found ${historicalConfirmedCount} invalid historical CONFIRMED`
    );

    recordCheck(
      'Cancellation Audit Metadata (Reason present on cancelled appointments)',
      missingCancelReasonCount === 0,
      missingCancelReasonCount === 0 ? 'All cancelled appointments have reasons' : `Found ${missingCancelReasonCount} missing reasons`
    );

    // -----------------------------------------------------------------
    // Final Summary
    // -----------------------------------------------------------------
    console.log('\n====================================================');
    if (issues.length === 0) {
      console.log('✓ DATA QUALITY AUDIT: 100% PASSED (All checks green)');
      console.log('====================================================');
      await mongoose.connection.close();
      process.exit(0);
    } else {
      console.error(`✗ DATA QUALITY AUDIT FAILED with ${issues.length} errors:`);
      issues.forEach((i) => console.error(`  - ${i}`));
      console.log('====================================================');
      await mongoose.connection.close();
      process.exit(1);
    }
  } catch (error) {
    console.error('[Verify Error] Verification suite crashed:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

verifyData();
