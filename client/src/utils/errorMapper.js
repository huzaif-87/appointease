/**
 * AppointEase Centralized Error Mapping Strategy
 *
 * Converts technical HTTP status codes, structured backend errorCodes, and
 * network exceptions into compassionate, human-readable patient messages.
 *
 * CRITICAL RULE:
 * Absolutely NEVER expose raw technical error messages, Axios exceptions,
 * MongoDB errors, ObjectIds, server paths, or stack traces to the patient UI.
 */

/**
 * Checks if a string contains technical jargon that must never be shown to users
 */
export const containsTechnicalDetails = (text) => {
  if (!text || typeof text !== 'string') return false;
  const technicalPatterns = [
    /ObjectId/i,
    /MongoDB/i,
    /MongoServerError/i,
    /E11000/i,
    /status code \d{3}/i,
    /Cast to/i,
    /syntaxerror/i,
    /typeerror/i,
    /stack trace/i,
    /at \w+ \(/i,
    /node_modules/i,
    /JWT/i,
    /Bearer/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i
  ];
  return technicalPatterns.some((pattern) => pattern.test(text));
};

/**
 * Maps any error object to a clean patient-facing error representation
 * @param {Object} error Error object from API call or catch block
 * @returns {Object} { title, message, type, isSlotConflict, isSessionExpired, isNetworkError, primaryAction, secondaryAction }
 */
export const mapBookingError = (error) => {
  const statusCode = error?.statusCode || (error?.response?.status ?? null);
  const errorCode = error?.errorCode || error?.response?.data?.errorCode;
  const isNetwork = Boolean(error?.isNetworkError || statusCode === 0 || error?.code === 'ERR_NETWORK');

  // 1. Network Connectivity Errors
  if (isNetwork) {
    return {
      title: 'Connection Issue',
      message: "We couldn't connect to the booking service. Please check your connection and try again.",
      type: 'network',
      isSlotConflict: false,
      isSessionExpired: false,
      isNetworkError: true,
      canRetry: true,
      primaryAction: 'Try Again'
    };
  }

  // 2. Double-Booking Slot Conflicts (HTTP 409 or SLOT_NO_LONGER_AVAILABLE)
  if (statusCode === 409 || errorCode === 'SLOT_NO_LONGER_AVAILABLE') {
    if (errorCode === 'IDEMPOTENCY_CONFLICT') {
      return {
        title: 'Booking Already Processed',
        message: 'Your booking request was already processed.',
        type: 'idempotent',
        isSlotConflict: false,
        isSessionExpired: false,
        canRetry: false
      };
    }

    return {
      title: 'Time slot no longer available',
      message: 'This time slot was just booked by another patient. Please choose another available time.',
      type: 'conflict',
      isSlotConflict: true,
      isSessionExpired: false,
      canRetry: true,
      primaryAction: 'Refresh Availability',
      secondaryAction: 'Choose Another Time'
    };
  }

  // 3. Session Expiration & Authentication (HTTP 401)
  if (statusCode === 401 || errorCode === 'SESSION_EXPIRED' || errorCode === 'UNAUTHENTICATED') {
    return {
      title: 'Session Expired',
      message: 'Your session has expired. Please sign in again.',
      type: 'session',
      isSlotConflict: false,
      isSessionExpired: true,
      canRetry: true,
      primaryAction: 'Sign In'
    };
  }

  // 4. Role & Permissions (HTTP 403)
  if (statusCode === 403 || errorCode === 'FORBIDDEN_ROLE' || errorCode === 'FORBIDDEN_RESOURCE') {
    return {
      title: 'Access Restricted',
      message:
        errorCode === 'FORBIDDEN_RESOURCE'
          ? 'You do not have permission to modify this appointment.'
          : "You don't have permission to perform this action.",
      type: 'permission',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: false
    };
  }

  // 4b. Milestone 6: Cancellation & Rescheduling Policy Windows
  if (errorCode === 'CANCELLATION_WINDOW_EXPIRED') {
    return {
      title: 'Cancellation Window Passed',
      message:
        'Appointments cannot be cancelled less than 2 hours before the scheduled time. Please contact the clinic directly.',
      type: 'policy',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: false
    };
  }

  if (errorCode === 'RESCHEDULE_WINDOW_EXPIRED') {
    return {
      title: 'Rescheduling Window Passed',
      message:
        'Appointments cannot be rescheduled less than 2 hours before the scheduled time. Please contact the clinic directly.',
      type: 'policy',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: false
    };
  }

  // 4c. Milestone 6: Status Restrictions
  if (errorCode === 'APPOINTMENT_ALREADY_CANCELLED') {
    return {
      title: 'Already Cancelled',
      message: 'This appointment has already been cancelled.',
      type: 'status',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: false
    };
  }

  if (errorCode === 'APPOINTMENT_ALREADY_COMPLETED') {
    return {
      title: 'Appointment Completed',
      message: 'Completed appointments cannot be cancelled or rescheduled.',
      type: 'status',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: false
    };
  }

  if (errorCode === 'APPOINTMENT_MARKED_NO_SHOW') {
    return {
      title: 'Appointment Marked No-Show',
      message: 'No-show appointments cannot be cancelled or rescheduled.',
      type: 'status',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: false
    };
  }

  if (errorCode === 'APPOINTMENT_NOT_FOUND') {
    return {
      title: 'Appointment Not Found',
      message: 'The requested appointment record could not be found.',
      type: 'notFound',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: false
    };
  }


  // 5. Missing / Inactive Specialist (HTTP 404 or specific code)
  if (errorCode === 'PROVIDER_NOT_FOUND' || errorCode === 'PROVIDER_NOT_ACTIVE') {
    return {
      title: 'Specialist Unavailable',
      message: 'This provider is no longer available.',
      type: 'notFound',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: false
    };
  }

  // 6. Missing / Inactive Clinical Service (HTTP 404 or specific code)
  if (errorCode === 'SERVICE_NOT_FOUND' || errorCode === 'SERVICE_NOT_ACTIVE') {
    return {
      title: 'Service Unavailable',
      message: 'This service is no longer available.',
      type: 'notFound',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: false
    };
  }

  // 7. Specialist does not offer selected service
  if (errorCode === 'SERVICE_NOT_OFFERED') {
    return {
      title: 'Service Not Offered',
      message: 'This provider does not offer the selected service.',
      type: 'validation',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: true
    };
  }

  // 8. Working Hours & Shift Constraints
  if (errorCode === 'PROVIDER_UNAVAILABLE_ON_DAY' || errorCode === 'OUTSIDE_WORKING_HOURS') {
    return {
      title: 'Outside Working Hours',
      message: 'This provider is not available on the selected day.',
      type: 'validation',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: true
    };
  }

  // 9. Calendar Date & Time Validation
  if (
    errorCode === 'INVALID_DATE' ||
    errorCode === 'INVALID_DATE_FORMAT' ||
    errorCode === 'INVALID_CALENDAR_DATE' ||
    errorCode === 'PAST_DATE' ||
    errorCode === 'PAST_TIME' ||
    errorCode === 'INVALID_TIME_FORMAT' ||
    errorCode === 'BOOKING_BUFFER_RESTRICTION'
  ) {
    return {
      title: 'Invalid Schedule',
      message: 'Please choose a valid appointment date and time.',
      type: 'validation',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: true
    };
  }

  // 8b. Mobile / Phone Validation (Part 5)
  if (errorCode === 'INVALID_PHONE_NUMBER') {
    return {
      title: 'Invalid mobile number',
      message: 'Please enter a valid 10-digit Indian mobile number.',
      type: 'validation',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: true
    };
  }

  // 10. General 404 Catch-all
  if (statusCode === 404) {
    return {
      title: 'Resource Not Found',
      message: 'The requested healthcare specialist or consultation service could not be found.',
      type: 'notFound',
      isSlotConflict: false,
      isSessionExpired: false,
      canRetry: false
    };
  }

  // 11. Fallback for 500 / Unexpected / Technical errors
  // NEVER render raw error.message if it contains code or database traces
  return {
    title: 'Booking Notice',
    message: 'Something went wrong while confirming your appointment. Please try again.',
    type: 'server',
    isSlotConflict: false,
    isSessionExpired: false,
    canRetry: true,
    primaryAction: 'Try Again'
  };
};

/**
 * Map general API errors (e.g. profile updates, auth) to user-friendly messages
 * Completely strips technical error codes, Mongoose validation errors, and stack traces.
 */
export const mapFriendlyError = (error) => {
  const errorCode =
    error?.response?.data?.errorCode ||
    error?.response?.data?.error?.code ||
    error?.errorCode ||
    error?.code;

  if (errorCode === 'INVALID_PHONE_NUMBER') {
    return {
      title: 'Invalid mobile number',
      message: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  if (errorCode === 'EMAIL_ALREADY_IN_USE' || error?.response?.status === 409) {
    return {
      title: 'Email Already In Use',
      message: 'This email address is already registered to another account.'
    };
  }

  if (errorCode === 'INVALID_NAME') {
    return {
      title: 'Invalid Name',
      message: 'Name must be between 2 and 100 characters long.'
    };
  }

  if (errorCode === 'INVALID_EMAIL_FORMAT' || errorCode === 'INVALID_EMAIL') {
    return {
      title: 'Invalid Email',
      message: 'Please enter a valid email address.'
    };
  }

  const rawMsg = error?.response?.data?.message || error?.message || '';

  // Suppress technical jargon, raw statuses, or validation exception names
  if (
    !rawMsg ||
    containsTechnicalDetails(rawMsg) ||
    /validationerror|casterror|400 bad request|invalid_phone_number/i.test(rawMsg)
  ) {
    return {
      title: 'Validation Notice',
      message: 'Please check your information and try again.'
    };
  }

  return {
    title: 'Notice',
    message: rawMsg
  };
};

export default mapBookingError;
