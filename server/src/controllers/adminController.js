const { Appointment, Provider, User, Service, Availability } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { timeToMinutes } = require('../services/slotService');

/**
 * @route   GET /api/admin/overview
 * @desc    Get aggregated KPI metrics for the Admin Dashboard
 * @access  Private (ADMIN only)
 */
const getAdminOverview = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setUTCHours(23, 59, 59, 999);

  const [
    totalAppointments,
    todayAppointments,
    activeProviders,
    totalProviders,
    registeredPatients,
    totalServices,
    appointmentsByStatus
  ] = await Promise.all([
    Appointment.countDocuments(),
    Appointment.countDocuments({
      appointmentDate: { $gte: startOfDay, $lte: endOfDay }
    }),
    Provider.countDocuments({ status: 'ACTIVE' }),
    Provider.countDocuments(),
    User.countDocuments({ role: 'PATIENT' }),
    Service.countDocuments(),
    Appointment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  const statusMap = {
    CONFIRMED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 0
  };

  appointmentsByStatus.forEach((item) => {
    if (item._id) {
      statusMap[item._id] = item.count;
    }
  });

  return ApiResponse.success(
    res,
    {
      kpis: {
        totalAppointments,
        todayAppointments,
        activeProviders,
        totalProviders,
        registeredPatients,
        totalServices
      },
      appointmentsByStatus: statusMap,
      generatedAt: new Date().toISOString()
    },
    'Admin overview metrics retrieved successfully'
  );
});

/**
 * @route   GET /api/admin/appointments
 * @desc    Get paginated appointment list for admin monitoring with search & filters
 * @access  Private (ADMIN only)
 */
const getAdminAppointments = asyncHandler(async (req, res) => {
  const { status, providerId, serviceId, date, search, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status) {
    query.status = status.toUpperCase();
  }
  if (providerId) {
    query.providerId = providerId;
  }
  if (serviceId) {
    query.serviceId = serviceId;
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
    .populate('providerId', 'name specialty location')
    .populate('serviceId', 'name category price durationMinutes')
    .sort({ appointmentDate: -1, startTime: -1 })
    .lean();

  // Search filter by patient name, email, or appointmentId
  if (search && search.trim()) {
    const sLower = search.trim().toLowerCase();
    appointments = appointments.filter((apt) => {
      const matchAptId = (apt.appointmentId || '').toLowerCase().includes(sLower);
      const matchPatientName = apt.userId?.name ? apt.userId.name.toLowerCase().includes(sLower) : false;
      const matchPatientEmail = apt.userId?.email ? apt.userId.email.toLowerCase().includes(sLower) : false;
      const matchProviderName = apt.providerId?.name ? apt.providerId.name.toLowerCase().includes(sLower) : false;
      return matchAptId || matchPatientName || matchPatientEmail || matchProviderName;
    });
  }

  const total = appointments.length;
  const paginatedAppointments = appointments.slice(skip, skip + limitNum);

  return ApiResponse.success(
    res,
    {
      appointments: paginatedAppointments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      }
    },
    'Admin appointments retrieved successfully'
  );
});

const { sendConfirmationEmail } = require('../services/emailService');

/**
 * @route   PATCH /api/admin/appointments/:id/status
 * @desc    Update appointment status (CONFIRMED, COMPLETED, NO_SHOW, CANCELLED) with audit logging
 * @access  Private (ADMIN only)
 */
const updateAdminAppointmentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, cancellationReason } = req.body || {};

  const validStatuses = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
  if (!status || !validStatuses.includes(status.toUpperCase())) {
    return ApiResponse.error(res, `Invalid status. Allowed values: ${validStatuses.join(', ')}`, 400);
  }

  const targetStatus = status.toUpperCase();
  const appointment = await Appointment.findById(id);

  if (!appointment) {
    return ApiResponse.error(res, 'Appointment not found', 404);
  }

  if (targetStatus === 'CANCELLED') {
    appointment.status = 'CANCELLED';
    appointment.cancellationReason = (cancellationReason || 'Cancelled by System Administrator').trim();
    appointment.cancelledAt = new Date();
  } else {
    appointment.status = targetStatus;
  }

  await appointment.save();

  const updated = await Appointment.findById(id)
    .populate('userId', 'name email phone')
    .populate('providerId', 'name specialty location')
    .populate('serviceId', 'name category price durationMinutes')
    .lean();

  // If status is updated to CONFIRMED, send automatic confirmation email to linked user
  if (targetStatus === 'CONFIRMED') {
    try {
      if (updated?.userId?.email) {
        await sendConfirmationEmail({
          userEmail: updated.userId.email,
          patientName: updated.userId.name || 'Patient',
          doctorName: updated.providerId?.name || 'Doctor',
          appointmentDate: updated.appointmentDate,
          time: `${updated.startTime} – ${updated.endTime}`,
          bookingId: updated.appointmentId || updated._id.toString()
        });
      } else {
        console.warn(`[Booking Confirmation] No email found for linked user in booking ${updated.appointmentId || id}`);
      }
    } catch (emailErr) {
      console.error(`[Booking Confirmation] Failed to send confirmation email for booking ${updated.appointmentId || id}:`, emailErr.message);
    }
  }

  return ApiResponse.success(
    res,
    { appointment: updated },
    `Appointment status updated to ${targetStatus} successfully`
  );
});

/**
 * @route   GET /api/admin/providers
 * @desc    Get paginated provider list with search and filters
 * @access  Private (ADMIN only)
 */
const getAdminProviders = asyncHandler(async (req, res) => {
  const { search, specialty, location, status, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status) {
    query.status = status.toUpperCase();
  }
  if (specialty) {
    query.specialty = new RegExp(specialty.trim(), 'i');
  }
  if (location) {
    query.location = new RegExp(location.trim(), 'i');
  }
  if (search && search.trim()) {
    const sRegex = new RegExp(search.trim(), 'i');
    query.$or = [{ name: sRegex }, { email: sRegex }, { specialty: sRegex }, { location: sRegex }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [providers, total] = await Promise.all([
    Provider.find(query)
      .populate('serviceIds', 'name category price durationMinutes')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Provider.countDocuments(query)
  ]);

  return ApiResponse.success(
    res,
    {
      providers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      }
    },
    'Admin providers retrieved successfully'
  );
});

/**
 * @route   POST /api/admin/providers
 * @desc    Create a new healthcare provider & associated user account
 * @access  Private (ADMIN only)
 */
const createAdminProvider = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    specialty,
    qualification,
    experienceYears,
    bio,
    location,
    serviceIds,
    consultationDuration,
    status
  } = req.body || {};

  if (!name || !email || !specialty || !qualification || !location) {
    return ApiResponse.error(
      res,
      'Name, Email, Specialty, Qualification, and Location are required fields.',
      400
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingProvider = await Provider.findOne({ email: normalizedEmail }).lean();
  if (existingProvider) {
    return ApiResponse.error(res, 'A provider with this email address already exists.', 409);
  }

  // Create Provider doc
  const provider = await Provider.create({
    name: name.trim(),
    email: normalizedEmail,
    phone: (phone || '').trim(),
    specialty: specialty.trim(),
    qualification: qualification.trim(),
    experienceYears: parseInt(experienceYears, 10) || 0,
    bio: (bio || '').trim(),
    location: location.trim(),
    serviceIds: Array.isArray(serviceIds) ? serviceIds : [],
    consultationDuration: parseInt(consultationDuration, 10) || 30,
    status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
  });

  // Ensure linked User account exists for provider login
  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: 'Pala@1234', // Default temporary password
      role: 'PROVIDER',
      phone: (phone || '').trim()
    });
  } else if (user.role !== 'PROVIDER' && user.role !== 'ADMIN') {
    user.role = 'PROVIDER';
    await user.save();
  }

  const populated = await Provider.findById(provider._id).populate('serviceIds').lean();

  return ApiResponse.success(res, { provider: populated }, 'Provider created successfully', 201);
});

/**
 * @route   PATCH /api/admin/providers/:id
 * @desc    Update provider profile details or status (ACTIVE/INACTIVE)
 * @access  Private (ADMIN only)
 */
const updateAdminProvider = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  const provider = await Provider.findById(id);
  if (!provider) {
    return ApiResponse.error(res, 'Provider not found', 404);
  }

  const allowedFields = [
    'name',
    'phone',
    'specialty',
    'qualification',
    'experienceYears',
    'bio',
    'location',
    'serviceIds',
    'consultationDuration',
    'status'
  ];

  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      provider[field] = updates[field];
    }
  });

  await provider.save();

  const populated = await Provider.findById(provider._id).populate('serviceIds').lean();

  return ApiResponse.success(res, { provider: populated }, 'Provider updated successfully');
});

/**
 * @route   GET /api/admin/services
 * @desc    Get paginated clinical services list with provider counts
 * @access  Private (ADMIN only)
 */
const getAdminServices = asyncHandler(async (req, res) => {
  const { search, category, status, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status) {
    query.status = status.toUpperCase();
  }
  if (category) {
    query.category = new RegExp(category.trim(), 'i');
  }
  if (search && search.trim()) {
    const sRegex = new RegExp(search.trim(), 'i');
    query.$or = [{ name: sRegex }, { category: sRegex }, { description: sRegex }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [services, total] = await Promise.all([
    Service.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Service.countDocuments(query)
  ]);

  // Compute active provider count per service
  const servicesWithCounts = await Promise.all(
    services.map(async (srv) => {
      const providerCount = await Provider.countDocuments({
        serviceIds: srv._id,
        status: 'ACTIVE'
      });
      return {
        ...srv,
        providerCount
      };
    })
  );

  return ApiResponse.success(
    res,
    {
      services: servicesWithCounts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      }
    },
    'Admin services retrieved successfully'
  );
});

/**
 * @route   POST /api/admin/services
 * @desc    Create a new clinical service
 * @access  Private (ADMIN only)
 */
const createAdminService = asyncHandler(async (req, res) => {
  const { name, description, category, durationMinutes, price, status } = req.body || {};

  if (!name || !category) {
    return ApiResponse.error(res, 'Service name and category are required fields.', 400);
  }

  const duration = parseInt(durationMinutes, 10);
  if (isNaN(duration) || duration <= 0) {
    return ApiResponse.error(res, 'Duration must be a positive number of minutes.', 400);
  }

  const numericPrice = parseFloat(price);
  if (isNaN(numericPrice) || numericPrice < 0) {
    return ApiResponse.error(res, 'Price must be a valid non-negative number.', 400);
  }

  const service = await Service.create({
    name: name.trim(),
    description: (description || '').trim(),
    category: category.trim(),
    durationMinutes: duration,
    price: numericPrice,
    status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
  });

  return ApiResponse.success(res, { service }, 'Service created successfully', 201);
});

/**
 * @route   PATCH /api/admin/services/:id
 * @desc    Update clinical service details or status
 * @access  Private (ADMIN only)
 */
const updateAdminService = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  const service = await Service.findById(id);
  if (!service) {
    return ApiResponse.error(res, 'Service not found', 404);
  }

  if (updates.durationMinutes !== undefined) {
    const d = parseInt(updates.durationMinutes, 10);
    if (isNaN(d) || d <= 0) {
      return ApiResponse.error(res, 'Duration must be a positive number of minutes.', 400);
    }
    service.durationMinutes = d;
  }

  if (updates.price !== undefined) {
    const p = parseFloat(updates.price);
    if (isNaN(p) || p < 0) {
      return ApiResponse.error(res, 'Price must be a valid non-negative number.', 400);
    }
    service.price = p;
  }

  const allowedFields = ['name', 'description', 'category', 'status'];
  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      service[field] = updates[field];
    }
  });

  await service.save();

  return ApiResponse.success(res, { service }, 'Service updated successfully');
});

/**
 * @route   GET /api/admin/availabilities
 * @desc    Get working availability shifts by provider
 * @access  Private (ADMIN only)
 */
const getAdminAvailabilities = asyncHandler(async (req, res) => {
  const { providerId } = req.query;

  const query = {};
  if (providerId) {
    query.providerId = providerId;
  }

  const availabilities = await Availability.find(query)
    .populate('providerId', 'name specialty location status')
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean();

  return ApiResponse.success(
    res,
    { availabilities },
    'Admin availabilities retrieved successfully'
  );
});

/**
 * @route   POST /api/admin/availabilities
 * @desc    Create a new provider working shift
 * @access  Private (ADMIN only)
 */
const createAdminAvailability = asyncHandler(async (req, res) => {
  const { providerId, dayOfWeek, startTime, endTime, slotDurationMinutes, isActive } = req.body || {};

  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  if (!dayOfWeek || !validDays.includes(dayOfWeek)) {
    return ApiResponse.error(res, 'Valid dayOfWeek (Monday-Sunday) is required.', 400);
  }

  if (!providerId) {
    return ApiResponse.error(res, 'Provider ID is required.', 400);
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!startTime || !timeRegex.test(startTime) || !endTime || !timeRegex.test(endTime)) {
    return ApiResponse.error(res, 'Start and End time must be in HH:MM 24-hour format.', 400);
  }

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  if (startMin >= endMin) {
    return ApiResponse.error(res, 'Start time must be strictly before End time.', 400);
  }

  // Check overlap with existing active shifts for same provider and day
  const existingShifts = await Availability.find({
    providerId,
    dayOfWeek,
    isActive: true
  }).lean();

  const hasOverlap = existingShifts.some((s) => {
    const sStart = timeToMinutes(s.startTime);
    const sEnd = timeToMinutes(s.endTime);
    return startMin < sEnd && endMin > sStart;
  });

  if (hasOverlap) {
    return ApiResponse.error(
      res,
      `Shift ${startTime}-${endTime} overlaps with an existing active shift on ${dayOfWeek}.`,
      409
    );
  }

  const availability = await Availability.create({
    providerId,
    dayOfWeek,
    startTime,
    endTime,
    slotDurationMinutes: parseInt(slotDurationMinutes, 10) || 30,
    isActive: isActive !== false
  });

  const populated = await Availability.findById(availability._id)
    .populate('providerId', 'name specialty location')
    .lean();

  return ApiResponse.success(res, { availability: populated }, 'Shift created successfully', 201);
});

/**
 * @route   PATCH /api/admin/availabilities/:id
 * @desc    Update an availability shift
 * @access  Private (ADMIN only)
 */
const updateAdminAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  const shift = await Availability.findById(id);
  if (!shift) {
    return ApiResponse.error(res, 'Availability shift not found', 404);
  }

  const allowed = ['dayOfWeek', 'startTime', 'endTime', 'slotDurationMinutes', 'isActive'];
  allowed.forEach((f) => {
    if (updates[f] !== undefined) {
      shift[f] = updates[f];
    }
  });

  await shift.save();

  const populated = await Availability.findById(shift._id)
    .populate('providerId', 'name specialty location')
    .lean();

  return ApiResponse.success(res, { availability: populated }, 'Shift updated successfully');
});

/**
 * @route   DELETE /api/admin/availabilities/:id
 * @desc    Deactivate or delete an availability shift
 * @access  Private (ADMIN only)
 */
const deleteAdminAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const shift = await Availability.findById(id);
  if (!shift) {
    return ApiResponse.error(res, 'Availability shift not found', 404);
  }

  await Availability.findByIdAndDelete(id);

  return ApiResponse.success(res, null, 'Shift deleted successfully');
});

/**
 * @route   GET /api/admin/users
 * @desc    Get paginated user list with role & search filtering
 * @access  Private (ADMIN only)
 */
const getAdminUsers = asyncHandler(async (req, res) => {
  const { role, search, page = 1, limit = 20 } = req.query;

  const query = {};
  if (role && ['PATIENT', 'PROVIDER', 'ADMIN'].includes(role.toUpperCase())) {
    query.role = role.toUpperCase();
  }

  if (search && search.trim()) {
    const sRegex = new RegExp(search.trim(), 'i');
    query.$or = [{ name: sRegex }, { email: sRegex }, { phone: sRegex }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [users, total] = await Promise.all([
    User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    User.countDocuments(query)
  ]);

  return ApiResponse.success(
    res,
    {
      users,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      }
    },
    'Admin users retrieved successfully'
  );
});

/**
 * @route   PATCH /api/admin/users/:id
 * @desc    Update user profile or role (with last Admin protection)
 * @access  Private (ADMIN only)
 */
const updateAdminUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, role } = req.body || {};

  const user = await User.findById(id);
  if (!user) {
    return ApiResponse.error(res, 'User account not found', 404);
  }

  // Last ADMIN Protection Rule (Part 9 requirement)
  if (user.role === 'ADMIN' && role && role.toUpperCase() !== 'ADMIN') {
    const adminCount = await User.countDocuments({ role: 'ADMIN' });
    if (adminCount <= 1) {
      return ApiResponse.error(
        res,
        'Operation denied: Cannot demote or remove the last active System Administrator account.',
        403
      );
    }
  }

  if (name && typeof name === 'string' && name.trim()) {
    user.name = name.trim();
  }
  if (phone !== undefined) {
    user.phone = String(phone).trim();
  }
  if (role && ['PATIENT', 'PROVIDER', 'ADMIN'].includes(role.toUpperCase())) {
    user.role = role.toUpperCase();
  }

  await user.save();

  const updated = await User.findById(id).select('-password').lean();

  return ApiResponse.success(res, { user: updated }, 'User updated successfully');
});

module.exports = {
  getAdminOverview,
  getAdminAppointments,
  updateAdminAppointmentStatus,
  getAdminProviders,
  createAdminProvider,
  updateAdminProvider,
  getAdminServices,
  createAdminService,
  updateAdminService,
  getAdminAvailabilities,
  createAdminAvailability,
  updateAdminAvailability,
  deleteAdminAvailability,
  getAdminUsers,
  updateAdminUser
};
