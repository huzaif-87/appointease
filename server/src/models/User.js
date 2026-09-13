const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema
 * Roles: PATIENT, PROVIDER, ADMIN
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false // Exclude from normal query results for security
    },
    role: {
      type: String,
      enum: {
        values: ['PATIENT', 'PROVIDER', 'ADMIN'],
        message: '{VALUE} is not a supported role'
      },
      default: 'PATIENT'
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    // Email change verification (Part 3)
    pendingEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null
    },
    emailVerificationToken: {
      type: String,
      default: null
    },
    emailVerificationExpires: {
      type: Date,
      default: null
    },
    // Password reset flow (Part 4)
    passwordResetToken: {
      type: String,
      default: null
    },
    passwordResetExpires: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes
userSchema.index({ role: 1 });

// Pre-save hook: Hash password with bcrypt before persisting
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Instance method: Verify candidate password against hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
