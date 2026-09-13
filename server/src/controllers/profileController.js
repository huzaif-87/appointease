const crypto = require('crypto');
const { User, Appointment } = require('../models');
const { sendEmailChangeVerificationEmail } = require('../services/emailService');
const { validateIndianMobile } = require('../utils/phoneValidator');

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

/**
 * GET /api/profile
 * Returns authenticated user profile and appointment stats
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found'
        }
      });
    }

    // Appointment stats
    const totalAppointments = await Appointment.countDocuments({ userId: user._id });
    const upcomingAppointments = await Appointment.countDocuments({
      userId: user._id,
      status: 'CONFIRMED',
      appointmentDate: { $gte: new Date().toISOString().split('T')[0] }
    });

    return res.status(200).json({
      success: true,
      data: {
        profile: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          pendingEmail: user.pendingEmail || null,
          memberSince: user.createdAt,
          stats: {
            totalAppointments,
            upcomingAppointments
          }
        }
      }
    });
  } catch (err) {
    console.error('[Profile Controller] getProfile error:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve profile'
      }
    });
  }
};

/**
 * PATCH /api/profile
 * Updates authenticated user profile: Full Name, Phone Number, and requests Email Change
 * Disallows changing role, password, or _id
 */
const updateProfile = async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found'
        }
      });
    }

    let updated = false;
    let emailVerificationDispatched = false;

    // 1. Update Full Name
    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_NAME',
            message: 'Name must be between 2 and 100 characters long'
          }
        });
      }
      user.name = trimmedName;
      updated = true;
    }

    // 2. Update Phone Number
    if (phone !== undefined) {
      if (phone === '') {
        user.phone = '';
        updated = true;
      } else {
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
        // Normalize multiple spaces while preserving formatting
        const trimmedPhone = String(phone).trim().replace(/\s+/g, ' ');
        user.phone = trimmedPhone;
        updated = true;
      }
    }

    // 3. Request Email Change (Two-Step Verification)
    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_EMAIL_FORMAT',
            message: 'Please enter a valid email address'
          }
        });
      }

      // Only initiate change if email is actually different
      if (normalizedEmail !== user.email) {
        // Check if another user already owns this email
        const existingEmailUser = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: user._id }
        });

        if (existingEmailUser) {
          return res.status(409).json({
            success: false,
            error: {
              code: 'EMAIL_ALREADY_IN_USE',
              message: 'This email address is already registered to another account'
            }
          });
        }

        // Generate cryptographically secure one-time verification token
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        user.pendingEmail = normalizedEmail;
        user.emailVerificationToken = hashedToken;
        user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Send verification email to the NEW email address
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const verificationUrl = `${clientUrl}/verify-email?token=${rawToken}`;

        sendEmailChangeVerificationEmail({
          userName: user.name,
          newEmail: normalizedEmail,
          verificationUrl
        }).catch((err) => {
          console.error('[Profile Controller] Verification email send notice:', err.message);
        });

        emailVerificationDispatched = true;
        updated = true;
      }
    }

    if (updated) {
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: emailVerificationDispatched
        ? 'Profile updated. A verification link has been sent to your new email address to complete the change.'
        : 'Profile updated successfully',
      data: {
        profile: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          pendingEmail: user.pendingEmail || null
        },
        emailVerificationPending: emailVerificationDispatched || !!user.pendingEmail
      }
    });
  } catch (err) {
    console.error('[Profile Controller] updateProfile error:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update profile'
      }
    });
  }
};

/**
 * POST /api/profile/verify-email
 * Verifies email change token and updates user.email to pendingEmail
 */
const verifyEmailChange = async (req, res) => {
  try {
    const token = req.body?.token || req.query?.token;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_REQUIRED',
          message: 'Verification token is required'
        }
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user || !user.pendingEmail) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OR_EXPIRED_TOKEN',
          message: 'Verification link is invalid or has expired. Please request a new email change.'
        }
      });
    }

    // Check if pendingEmail was claimed by someone else in the meantime
    const conflictUser = await User.findOne({
      email: user.pendingEmail,
      _id: { $ne: user._id }
    });

    if (conflictUser) {
      user.pendingEmail = null;
      user.emailVerificationToken = null;
      user.emailVerificationExpires = null;
      await user.save();

      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_TAKEN',
          message: 'This email address has already been claimed by another account'
        }
      });
    }

    // Successfully verify and promote pendingEmail to primary email
    const verifiedEmail = user.pendingEmail;
    user.email = verifiedEmail;
    user.pendingEmail = null;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    console.log(`[Profile Controller] Successfully verified and updated email for user ${user._id} to ${verifiedEmail}`);

    return res.status(200).json({
      success: true,
      message: 'Email address successfully verified and updated.',
      data: {
        profile: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          role: user.role
        }
      }
    });
  } catch (err) {
    console.error('[Profile Controller] verifyEmailChange error:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to verify email'
      }
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  verifyEmailChange
};
