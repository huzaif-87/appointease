/**
 * Indian Mobile Number Validation and Normalization Utility
 *
 * Rules:
 * - Accepted format: 10-digit Indian mobile number
 * - Starting digit: Must start with 6, 7, 8, or 9
 * - Rejects:
 *   - Fewer than 10 digits
 *   - More than 10 digits
 *   - Alphabetic characters
 *   - Prohibited special characters
 *   - Numbers starting with 0-5
 *   - Obvious invalid repeated numbers (e.g. 0000000000, 1111111111, 2222222222, etc.)
 *   - Obvious sequential numbers (e.g. 0123456789, 1234567890)
 *   - Whitespace-only values
 * - Normalization:
 *   - Strips leading +91 / 91 prefix when provided
 *   - Strips formatting spaces, hyphens, and parentheses
 */

/**
 * Normalizes and validates an Indian mobile number
 * @param {string} phone Raw phone input
 * @param {boolean} [allowEmpty=false] Whether empty/blank string is allowed (e.g. optional fields)
 * @returns {{ isValid: boolean, errorCode?: string, message?: string, normalized?: string }}
 */
const validateIndianMobile = (phone, allowEmpty = false) => {
  if (phone === undefined || phone === null) {
    if (allowEmpty) return { isValid: true, normalized: '' };
    return {
      isValid: false,
      errorCode: 'INVALID_PHONE_NUMBER',
      message: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  const rawStr = String(phone);

  // Reject whitespace-only input
  if (rawStr.trim() === '') {
    if (allowEmpty && rawStr === '') {
      return { isValid: true, normalized: '' };
    }
    return {
      isValid: false,
      errorCode: 'INVALID_PHONE_NUMBER',
      message: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  const trimmed = rawStr.trim();

  // Reject alphabetic characters
  if (/[a-zA-Z]/.test(trimmed)) {
    return {
      isValid: false,
      errorCode: 'INVALID_PHONE_NUMBER',
      message: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  // Reject characters that are neither digits nor standard formatting symbols (+, -, space, parens)
  if (/[^\d\s+\-()]/.test(trimmed)) {
    return {
      isValid: false,
      errorCode: 'INVALID_PHONE_NUMBER',
      message: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  // Extract all digits
  const rawDigits = trimmed.replace(/\D/g, '');

  let digits = rawDigits;

  // Handle +91 or 91 country code prefix for India
  if (trimmed.startsWith('+91')) {
    digits = rawDigits.slice(2);
  } else if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
    digits = rawDigits.slice(2);
  }

  // Must be exactly 10 digits
  if (digits.length !== 10) {
    return {
      isValid: false,
      errorCode: 'INVALID_PHONE_NUMBER',
      message: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  // Must start with 6, 7, 8, or 9 (rejects 0, 1, 2, 3, 4, 5)
  if (!/^[6-9]/.test(digits)) {
    return {
      isValid: false,
      errorCode: 'INVALID_PHONE_NUMBER',
      message: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  // Reject obvious repeated numbers: all 10 digits identical (e.g. 0000000000, 1111111111, 2222222222, ..., 9999999999)
  if (/^(\d)\1{9}$/.test(digits)) {
    return {
      isValid: false,
      errorCode: 'INVALID_PHONE_NUMBER',
      message: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  // Reject obvious dummy ascending sequences (0123456789, 1234567890)
  if (digits === '0123456789' || digits === '1234567890') {
    return {
      isValid: false,
      errorCode: 'INVALID_PHONE_NUMBER',
      message: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  return {
    isValid: true,
    normalized: digits
  };
};

module.exports = {
  validateIndianMobile
};
