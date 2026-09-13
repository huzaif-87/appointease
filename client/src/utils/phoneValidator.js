/**
 * Client-Side Indian Mobile Number Validation
 *
 * Rules:
 * - 10-digit Indian mobile number
 * - Must start with 6, 7, 8, or 9
 * - Normalizes +91 country code, spaces, hyphens, and parentheses
 * - Rejects non-digits, leading 0-5, all-identical repeated numbers, dummy ascending sequences, and whitespace-only
 */

export const validateIndianMobileNumber = (phone, allowEmpty = true) => {
  if (phone === undefined || phone === null) {
    if (allowEmpty) return { isValid: true, error: null, normalized: '' };
    return {
      isValid: false,
      error: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  const rawStr = String(phone);

  if (rawStr.trim() === '') {
    if (allowEmpty && rawStr === '') {
      return { isValid: true, error: null, normalized: '' };
    }
    return {
      isValid: false,
      error: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  const trimmed = rawStr.trim();

  // Reject alphabetic characters
  if (/[a-zA-Z]/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  // Reject invalid symbols outside formatting
  if (/[^\d\s+\-()]/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  const rawDigits = trimmed.replace(/\D/g, '');
  let digits = rawDigits;

  if (trimmed.startsWith('+91')) {
    digits = rawDigits.slice(2);
  } else if (rawDigits.length === 12 && rawDigits.startsWith('91')) {
    digits = rawDigits.slice(2);
  }

  if (digits.length !== 10) {
    return {
      isValid: false,
      error: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  if (!/^[6-9]/.test(digits)) {
    return {
      isValid: false,
      error: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  // Reject all identical repeated digits (e.g. 0000000000, 1111111111, 2222222222, ..., 9999999999)
  if (/^(\d)\1{9}$/.test(digits)) {
    return {
      isValid: false,
      error: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  // Reject obvious dummy ascending sequences (0123456789, 1234567890)
  if (digits === '0123456789' || digits === '1234567890') {
    return {
      isValid: false,
      error: 'Please enter a valid 10-digit Indian mobile number.'
    };
  }

  return {
    isValid: true,
    error: null,
    normalized: digits
  };
};

export default validateIndianMobileNumber;
