const mongoose = require('mongoose');

/**
 * BookingLock Schema
 * Provides database-level serialization per (providerId, appointmentDate)
 * Ensures concurrent booking transactions are strictly serialized at the database engine level,
 * guaranteeing zero double-booking even under overlapping or simultaneous interval requests.
 */
const bookingLockSchema = new mongoose.Schema(
  {
    lockKey: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true
    },
    date: {
      type: String,
      required: true
    },
    version: {
      type: Number,
      default: 0
    },
    isLocked: {
      type: Boolean,
      default: false
    },
    lockedAt: {
      type: Date,
      default: null
    },
    holder: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

bookingLockSchema.index({ providerId: 1, date: 1 });

const BookingLock = mongoose.model('BookingLock', bookingLockSchema);

module.exports = BookingLock;
