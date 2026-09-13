const { Service } = require('../models');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @route   GET /api/services
 * @desc    Get all healthcare services with filtering, search, and pagination
 */
const getServices = asyncHandler(async (req, res) => {
  const { category, status, search, page = 1, limit = 50 } = req.query;

  const query = {};

  if (category) {
    query.category = { $regex: category, $options: 'i' };
  }

  if (status) {
    query.status = status.toUpperCase();
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } }
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [services, total] = await Promise.all([
    Service.find(query).sort({ category: 1, name: 1 }).skip(skip).limit(limitNum).lean(),
    Service.countDocuments(query)
  ]);

  return ApiResponse.success(res, {
    services,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  }, 'Services retrieved successfully');
});

/**
 * @route   GET /api/services/:id
 * @desc    Get a single service by ID
 */
const getServiceById = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id).lean();

  if (!service) {
    return ApiResponse.error(res, 'Service not found', 404);
  }

  return ApiResponse.success(res, service, 'Service retrieved successfully');
});

module.exports = {
  getServices,
  getServiceById
};
