const { calculateSlots } = require('../services/slotService');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @route   GET /api/availability/slots
 * @desc    Calculate real-time appointment slots from provider schedule, service duration, and bookings
 */
const getAvailableSlots = asyncHandler(async (req, res) => {
  const { providerId, serviceId, date, excludeAppointmentId } = req.query;

  if (!providerId || !serviceId || !date) {
    return ApiResponse.error(
      res,
      "Missing required query parameters: 'providerId', 'serviceId', and 'date' (YYYY-MM-DD) are required",
      400
    );
  }

  const result = await calculateSlots({ providerId, serviceId, date, excludeAppointmentId });

  return ApiResponse.success(
    res,
    result,
    result.reason === 'PROVIDER_NOT_AVAILABLE'
      ? result.message
      : 'Available slots calculated successfully'
  );
});

module.exports = {
  getAvailableSlots
};
