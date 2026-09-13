const { Appointment, Provider, Service, Availability, User } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { timeToMinutes } = require('../services/slotService');

/**
 * Helper to resolve Provider document from authenticated JWT user
 */
const getProviderDocFromUser = async (user) => {
  if (!user || !user.email) return null;
  // Match provider by email address
  return Provider.findOne({ email: user.email.toLowerCase() });
};

/**
 * @route   GET /api/provider/console/dashboard
 * @desc    Get operational dashboard metrics for the authenticated doctor
 * @access  Private (PROVIDER role required)
 */
const getProviderDashboard = asyncHandler(async (req, res) => {
  const provider = await getProviderDocFromUser(req.user);
  if (!provider) {
    return ApiResponse.error(res, 'Provider profile not found for this account.', 404);
  }

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setUTCHours(23, 59, 59, 999);

  const [
    todayAppointments,
    upcomingAppointments,
    completedAppointments,
    cancelledAppointments,
    totalAppointments,
    todaySchedule
  ] = await Promise.all([
    Appointment.find({
      providerId: provider._id,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'CANCELLED' }
    })
      .populate('userId', 'name email phone')
      .populate('serviceId', 'name category durationMinutes price')
      .sort({ startTime: 1 })
      .lean(),

    Appointment.countDocuments({
      providerId: provider._id,
      appointmentDate: { $gt: endOfDay },
      status: 'CONFIRMED'
    }),

    Appointment.countDocuments({
      providerId: provider._id,
      status: 'COMPLETED'
    }),

    Appointment.countDocuments({
      providerId: provider._id,
      status: 'CANCELLED'
    }),

    Appointment.countDocuments({
      providerId: provider._id
    }),

    // Get today's day name (e.g. 'Monday')
    Availability.find({
      providerId: provider._id,
      dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }),
      isActive: true
    }).lean()
  ]);

  // Count unique patients seen
  const patientIds = await Appointment.distinct('userId', { providerId: provider._id });

  return ApiResponse.success(
    res,
    {
      provider: {
        id: provider._id,
        name: provider.name,
        specialty: provider.specialty,
        location: provider.location
      },
      stats: {
        todayCount: todayAppointments.length,
        upcomingCount: upcomingAppointments,
        completedCount: completedAppointments,
        cancelledCount: cancelledAppointments,
        totalCount: totalAppointments,
        patientCount: patientIds.length
      },
      todayAppointments,
      todaySchedule
    },
    'Provider dashboard loaded successfully'
  );
});

/**
 * @route   GET /api/provider/console/appointments
 * @desc    Get appointments scoped strictly to authenticated provider
 * @access  Private (PROVIDER role required)
 */
const getProviderAppointments = asyncHandler(async (req, res) => {
  const provider = await getProviderDocFromUser(req.user);
  if (!provider) {
    return ApiResponse.error(res, 'Provider profile not found for this account.', 404);
  }

  const { status, date, timeframe, search, page = 1, limit = 20 } = req.query;

  const query = { providerId: provider._id };

  if (status) {
    query.status = status.toUpperCase();
  }

  if (date) {
    const dStart = new Date(`${date}T00:00:00.000Z`);
    const dEnd = new Date(`${date}T23:59:59.999Z`);
    query.appointmentDate = { $gte: dStart, $lte: dEnd };
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  let appointments = await Appointment.find(query)
    .populate('userId', 'name email phone')
    .populate('serviceId', 'name category price durationMinutes')
    .sort({ appointmentDate: -1, startTime: -1 })
    .lean();

  if (search && search.trim()) {
    const sLower = search.trim().toLowerCase();
    appointments = appointments.filter((apt) => {
      const matchAptId = (apt.appointmentId || '').toLowerCase().includes(sLower);
      const matchName = apt.userId?.name ? apt.userId.name.toLowerCase().includes(sLower) : false;
      const matchEmail = apt.userId?.email ? apt.userId.email.toLowerCase().includes(sLower) : false;
      return matchAptId || matchName || matchEmail;
    });
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (timeframe === 'upcoming') {
    appointments = appointments.filter((apt) => {
      const aptDate = new Date(apt.appointmentDate).toISOString().split('T')[0];
      return aptDate >= todayStr && apt.status === 'CONFIRMED';
    });
  } else if (timeframe === 'past') {
    appointments = appointments.filter((apt) => {
      const aptDate = new Date(apt.appointmentDate).toISOString().split('T')[0];
      return aptDate < todayStr || apt.status !== 'CONFIRMED';
    });
  }

  const total = appointments.length;
  const paginated = appointments.slice(skip, skip + limitNum);

  return ApiResponse.success(
    res,
    {
      appointments: paginated,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      }
    },
    'Provider appointments retrieved successfully'
  );
});

/**
 * @route   PATCH /api/provider/console/appointments/:id/status
 * @desc    Update appointment status (COMPLETED or NO_SHOW) for provider's own patient
 * @access  Private (PROVIDER role required)
 */
const updateProviderAppointmentStatus = asyncHandler(async (req, res) => {
  const provider = await getProviderDocFromUser(req.user);
  if (!provider) {
    return ApiResponse.error(res, 'Provider profile not found for this account.', 404);
  }

  const { id } = req.params;
  const { status } = req.body || {};

  if (!status || !['COMPLETED', 'NO_SHOW'].includes(status.toUpperCase())) {
    return ApiResponse.error(res, 'Status must be COMPLETED or NO_SHOW.', 400);
  }

  const appointment = await Appointment.findOne({ _id: id, providerId: provider._id });
  if (!appointment) {
    return ApiResponse.error(res, 'Appointment not found or not assigned to you.', 404);
  }

  appointment.status = status.toUpperCase();
  await appointment.save();

  const updated = await Appointment.findById(id)
    .populate('userId', 'name email phone')
    .populate('serviceId', 'name category price durationMinutes')
    .lean();

  return ApiResponse.success(res, { appointment: updated }, `Appointment marked as ${status.toUpperCase()}`);
});

/**
 * @route   GET /api/provider/console/availability
 * @desc    Get recurring availability shifts for authenticated provider
 * @access  Private (PROVIDER role required)
 */
const getProviderOwnAvailability = asyncHandler(async (req, res) => {
  const provider = await getProviderDocFromUser(req.user);
  if (!provider) {
    return ApiResponse.error(res, 'Provider profile not found for this account.', 404);
  }

  const availabilities = await Availability.find({ providerId: provider._id })
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean();

  return ApiResponse.success(res, { availabilities }, 'Provider availability shifts retrieved successfully');
});

/**
 * @route   POST /api/provider/console/availability
 * @desc    Add a recurring working shift for authenticated provider
 * @access  Private (PROVIDER role required)
 */
const createProviderOwnAvailability = asyncHandler(async (req, res) => {
  const provider = await getProviderDocFromUser(req.user);
  if (!provider) {
    return ApiResponse.error(res, 'Provider profile not found for this account.', 404);
  }

  const { dayOfWeek, startTime, endTime, slotDurationMinutes } = req.body || {};

  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  if (!dayOfWeek || !validDays.includes(dayOfWeek)) {
    return ApiResponse.error(res, 'Valid dayOfWeek (Monday-Sunday) is required.', 400);
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!startTime || !timeRegex.test(startTime) || !endTime || !timeRegex.test(endTime)) {
    return ApiResponse.error(res, 'Start and End time must be in HH:MM format.', 400);
  }

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  if (startMin >= endMin) {
    return ApiResponse.error(res, 'Start time must be strictly before End time.', 400);
  }

  const availability = await Availability.create({
    providerId: provider._id,
    dayOfWeek,
    startTime,
    endTime,
    slotDurationMinutes: parseInt(slotDurationMinutes, 10) || provider.consultationDuration || 30,
    isActive: true
  });

  return ApiResponse.success(res, { availability }, 'Availability shift created successfully', 201);
});

/**
 * @route   DELETE /api/provider/console/availability/:id
 * @desc    Delete/deactivate provider's own availability shift
 * @access  Private (PROVIDER role required)
 */
const deleteProviderOwnAvailability = asyncHandler(async (req, res) => {
  const provider = await getProviderDocFromUser(req.user);
  if (!provider) {
    return ApiResponse.error(res, 'Provider profile not found.', 404);
  }

  const { id } = req.params;
  const shift = await Availability.findOne({ _id: id, providerId: provider._id });
  if (!shift) {
    return ApiResponse.error(res, 'Shift not found or access denied.', 404);
  }

  await Availability.findByIdAndDelete(id);

  return ApiResponse.success(res, null, 'Shift removed successfully');
});

/**
 * @route   GET /api/provider/console/services
 * @desc    Get services offered by authenticated provider
 * @access  Private (PROVIDER role required)
 */
const getProviderOwnServices = asyncHandler(async (req, res) => {
  const provider = await getProviderDocFromUser(req.user);
  if (!provider) {
    return ApiResponse.error(res, 'Provider profile not found.', 404);
  }

  const populated = await Provider.findById(provider._id).populate('serviceIds').lean();

  return ApiResponse.success(res, { services: populated?.serviceIds || [] }, 'Provider services retrieved');
});

/**
 * @route   GET /api/provider/console/profile
 * @desc    Get authenticated provider profile details
 * @access  Private (PROVIDER role required)
 */
const getProviderOwnProfile = asyncHandler(async (req, res) => {
  const provider = await getProviderDocFromUser(req.user);
  if (!provider) {
    return ApiResponse.error(res, 'Provider profile not found.', 404);
  }

  return ApiResponse.success(res, { provider }, 'Provider profile retrieved successfully');
});

/**
 * @route   PATCH /api/provider/console/profile
 * @desc    Update authenticated provider profile fields (phone, bio, qualification, experience, location)
 * @access  Private (PROVIDER role required)
 */
const updateProviderOwnProfile = asyncHandler(async (req, res) => {
  const provider = await getProviderDocFromUser(req.user);
  if (!provider) {
    return ApiResponse.error(res, 'Provider profile not found.', 404);
  }

  const { phone, bio, qualification, experienceYears, location } = req.body || {};

  if (phone !== undefined) provider.phone = String(phone).trim();
  if (bio !== undefined) provider.bio = String(bio).trim();
  if (qualification !== undefined) provider.qualification = String(qualification).trim();
  if (experienceYears !== undefined) provider.experienceYears = parseInt(experienceYears, 10) || 0;
  if (location !== undefined) provider.location = String(location).trim();

  await provider.save();

  return ApiResponse.success(res, { provider }, 'Provider profile updated successfully');
});

module.exports = {
  getProviderDashboard,
  getProviderAppointments,
  updateProviderAppointmentStatus,
  getProviderOwnAvailability,
  createProviderOwnAvailability,
  deleteProviderOwnAvailability,
  getProviderOwnServices,
  getProviderOwnProfile,
  updateProviderOwnProfile
};
