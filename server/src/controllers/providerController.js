const { Provider, Availability } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @route   GET /api/providers
 * @desc    Get all providers with specialty, location, status filters, search, and pagination
 */
const getProviders = asyncHandler(async (req, res) => {
  const { specialty, location, status, search, serviceId, page = 1, limit = 50 } = req.query;

  const query = {};

  if (serviceId) {
    query.serviceIds = serviceId;
  }

  if (specialty) {
    query.specialty = { $regex: specialty, $options: 'i' };
  }

  if (location) {
    query.location = { $regex: location, $options: 'i' };
  }

  if (status && status !== 'ALL') {
    query.status = status.toUpperCase();
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { specialty: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } },
      { qualification: { $regex: search, $options: 'i' } }
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [providers, total] = await Promise.all([
    Provider.find(query)
      .populate('serviceIds', 'name category price durationMinutes')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Provider.countDocuments(query)
  ]);

  return ApiResponse.success(res, {
    providers,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  }, 'Providers retrieved successfully');
});

/**
 * @route   GET /api/providers/:id
 * @desc    Get a single provider by ID with populated services
 */
const getProviderById = asyncHandler(async (req, res) => {
  const provider = await Provider.findById(req.params.id)
    .populate('serviceIds', 'name category description durationMinutes price status')
    .lean();

  if (!provider) {
    return ApiResponse.error(res, 'Provider not found', 404);
  }

  return ApiResponse.success(res, provider, 'Provider retrieved successfully');
});

/**
 * @route   GET /api/providers/:id/availability
 * @desc    Get recurring weekly availability schedule for a provider
 */
const getProviderAvailability = asyncHandler(async (req, res) => {
  const provider = await Provider.findById(req.params.id).select('_id name status consultationDuration').lean();

  if (!provider) {
    return ApiResponse.error(res, 'Provider not found', 404);
  }

  const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };

  const availabilityRecords = await Availability.find({
    providerId: req.params.id,
    isActive: true
  }).lean();

  // Sort by days of week logically
  availabilityRecords.sort((a, b) => (dayOrder[a.dayOfWeek] || 99) - (dayOrder[b.dayOfWeek] || 99));

  return ApiResponse.success(res, {
    provider: {
      id: provider._id,
      name: provider.name,
      status: provider.status,
      consultationDuration: provider.consultationDuration
    },
    weeklySchedule: availabilityRecords
  }, 'Provider availability retrieved successfully');
});

module.exports = {
  getProviders,
  getProviderById,
  getProviderAvailability
};
