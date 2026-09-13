const asyncHandler = require('../utils/asyncHandler');
const { getSmartTimeRecommendations } = require('../services/aiRecommendationService');

/**
 * @route   POST /api/ai/time-recommendations
 * @desc    Convert patient natural-language scheduling request into real available slot recommendations
 * @access  Private (PATIENT role required)
 */
const getTimeRecommendationsHandler = asyncHandler(async (req, res) => {
  const patientId = req.user?.id;
  if (!patientId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required prior to requesting smart recommendations.',
      errorCode: 'UNAUTHENTICATED'
    });
  }

  const { query } = req.body || {};

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid scheduling preference description (e.g. "after 5 PM this week").',
      errorCode: 'INVALID_QUERY'
    });
  }

  // Length guard to prevent prompt injection / resource abuse
  if (query.length > 250) {
    return res.status(400).json({
      success: false,
      message: 'Scheduling query exceeds maximum length of 250 characters.',
      errorCode: 'QUERY_TOO_LONG'
    });
  }

  try {
    console.log('[AI Recommendation] AI_REQUEST_STARTED - Query length:', query.trim().length);
    const result = await getSmartTimeRecommendations({
      query: query.trim(),
      patientId
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('[AI Recommendation] AI_REQUEST_FAILED - Reason:', err.message);

    // Resilient Fallback per Milestone 7 Requirement 8:
    // Never expose raw technical/Gemini errors to the patient. Return a friendly fallback notice.
    return res.status(200).json({
      success: true,
      data: {
        interpretedRequest: null,
        recommendations: [],
        notice:
          'Smart recommendations are temporarily unavailable. You can still choose a provider, date, and time manually.'
      }
    });
  }
});

module.exports = {
  getTimeRecommendationsHandler
};
