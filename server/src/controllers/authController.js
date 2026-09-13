const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { User, Appointment } = require('../models');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../services/emailService');
const { validateIndianMobile } = require('../utils/phoneValidator');
const ApiResponse = require('../utils/apiResponse');

const getJwtSecret = () =>
  process.env.JWT_SECRET || 'development_appointease_secret_key_change_in_prod';

/**
 * Sign JWT token with consistent payload
 */
const signToken = (user) => {
  return jwt.sign(
    {
      id: user._id ? user._id.toString() : user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new patient account
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name is required and must be at least 2 characters long.',
        errorCode: 'INVALID_NAME'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.',
        errorCode: 'INVALID_EMAIL'
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
        errorCode: 'INVALID_PASSWORD'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.',
        errorCode: 'EMAIL_ALREADY_EXISTS'
      });
    }

    let normalizedPhone = '';
    if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
      const phoneCheck = validateIndianMobile(phone, false);
      if (!phoneCheck.isValid) {
        return res.status(400).json({
          success: false,
          errorCode: 'INVALID_PHONE_NUMBER',
          message: 'Please enter a valid 10-digit Indian mobile number.',
          error: {
            code: 'INVALID_PHONE_NUMBER',
            message: 'Please enter a valid 10-digit Indian mobile number.'
          }
        });
      }
      normalizedPhone = String(phone).trim().replace(/\s+/g, ' ');
    }

    // Create user doc (password hashed via pre-save hook)
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone: normalizedPhone,
      role: 'PATIENT'
    });

    // Send welcome email to registered user
    sendWelcomeEmail({ userName: user.name, userEmail: user.email }).catch((emailErr) => {
      console.error('[Auth Controller] Welcome email delivery notice:', emailErr.message);
    });

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Welcome to AppointEase!',
      data: {
        token,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone
        }
      }
    });
  } catch (err) {
    console.error('[Auth Controller] Registration error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create account. Please try again.',
      errorCode: 'REGISTRATION_FAILED'
    });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate registered user with email & password
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
        errorCode: 'MISSING_CREDENTIALS'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Look up user with password field
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password. Please verify your credentials.',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password. Please verify your credentials.',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    // Portal authorization check: prevent unauthorized role entry to admin/provider portals
    const { portal } = req.body || {};
    if (portal) {
      const normalizedPortal = String(portal).toUpperCase();
      if (normalizedPortal === 'ADMIN' && user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access denied: System Administrator privileges required for this portal.',
          errorCode: 'ADMIN_PORTAL_FORBIDDEN'
        });
      }
      if (normalizedPortal === 'PROVIDER' && user.role !== 'PROVIDER' && user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Healthcare Provider credentials required for this portal.',
          errorCode: 'PROVIDER_PORTAL_FORBIDDEN'
        });
      }
    }

    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      data: {
        token,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone
        }
      }
    });
  } catch (err) {
    console.error('[Auth Controller] Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed due to a server error. Please try again.',
      errorCode: 'LOGIN_FAILED'
    });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user details
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        errorCode: 'UNAUTHENTICATED'
      });
    }

    const user = await User.findById(userId).select('-password').lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone || '',
          createdAt: user.createdAt
        }
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile.',
      errorCode: 'PROFILE_FETCH_FAILED'
    });
  }
};

/**
 * @route   GET /api/auth/profile
 * @desc    Get profile metrics and account info
 * @access  Private
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        errorCode: 'UNAUTHENTICATED'
      });
    }

    const user = await User.findById(userId).select('-password').lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    const totalAppointments = await Appointment.countDocuments({ userId });
    const upcomingAppointments = await Appointment.countDocuments({
      userId,
      status: 'CONFIRMED'
    });

    return res.status(200).json({
      success: true,
      data: {
        profile: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone || '',
          memberSince: user.createdAt,
          stats: {
            totalAppointments,
            upcomingAppointments
          }
        }
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile data.',
      errorCode: 'PROFILE_FETCH_FAILED'
    });
  }
};

/**
 * @route   POST /api/auth/demo-token
 * @desc    Issue a signed JWT token for role-based testing (ADMIN, PATIENT, PROVIDER)
 * @access  Public (Used for automated testing & development)
 */
const getDemoToken = async (req, res) => {
  const { role = 'ADMIN' } = req.body;
  const normalizedRole = role.toUpperCase();

  if (!['ADMIN', 'PATIENT', 'PROVIDER'].includes(normalizedRole)) {
    return ApiResponse.error(res, 'Role must be ADMIN, PATIENT, or PROVIDER', 400);
  }

  let userId;
  let userEmail = `${normalizedRole.toLowerCase()}.demo@appointease.com`;
  let userName = `Demo ${normalizedRole.charAt(0) + normalizedRole.slice(1).toLowerCase()} User`;

  try {
    const existingUser = await User.findOne({ role: normalizedRole }).lean();
    if (existingUser) {
      userId = existingUser._id.toString();
      userEmail = existingUser.email;
      userName = existingUser.name;
    } else {
      userId = new mongoose.Types.ObjectId().toString();
    }
  } catch (err) {
    userId = new mongoose.Types.ObjectId().toString();
  }

  const token = signToken({
    id: userId,
    email: userEmail,
    name: userName,
    role: normalizedRole
  });

  return ApiResponse.success(
    res,
    {
      token,
      user: {
        id: userId,
        email: userEmail,
        name: userName,
        role: normalizedRole
      }
    },
    `Demo ${normalizedRole} session token generated`
  );
};

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request a password reset link (anti-enumeration generic response)
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};

    // Always return a generic response to prevent account enumeration
    const genericResponse = {
      success: true,
      message: 'If an account exists for this email, a password reset link has been sent.'
    };

    if (!email || typeof email !== 'string') {
      return res.status(200).json(genericResponse);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Return 200 generic message even if user does not exist
      return res.status(200).json(genericResponse);
    }

    // Generate single-use cryptographically secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await user.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password/${rawToken}`;

    sendPasswordResetEmail({
      userName: user.name,
      userEmail: user.email,
      resetUrl
    }).catch((err) => {
      console.error('[Auth Controller] Password reset email send notice:', err.message);
    });

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error('[Auth Controller] forgotPassword error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to process password reset request. Please try again.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using cryptographically hashed one-time token
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is required.',
        errorCode: 'TOKEN_REQUIRED'
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
        errorCode: 'INVALID_PASSWORD'
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset link is invalid or has expired. Please request a new one.',
        errorCode: 'INVALID_OR_EXPIRED_TOKEN'
      });
    }

    // Set new password (pre-save hook hashes with bcrypt)
    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    console.log(`[Auth Controller] Password successfully reset for user ${user._id}`);

    return res.status(200).json({
      success: true,
      message: 'Your password has been reset successfully. Please sign in with your new password.'
    });
  } catch (err) {
    console.error('[Auth Controller] resetPassword error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password. Please try again.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  getProfile,
  getDemoToken,
  forgotPassword,
  resetPassword
};
