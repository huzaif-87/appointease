const mongoose = require('mongoose');

/**
 * Availability Schema
 * Represents recurring weekly provider working hours
 */
const availabilitySchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: [true, 'Provider reference is required']
    },
    dayOfWeek: {
      type: String,
      enum: {
        values: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        message: '{VALUE} is not a valid day of the week'
      },
      required: [true, 'Day of the week is required']
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required (e.g. 09:00)'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:MM 24-hour format']
    },
    endTime: {
      type: String,
      required: [true, 'End time is required (e.g. 17:00)'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be in HH:MM 24-hour format']
    },
    slotDurationMinutes: {
      type: Number,
      required: [true, 'Slot duration is required'],
      min: [10, 'Slot duration must be at least 10 minutes'],
      default: 30
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
availabilitySchema.index({ providerId: 1, dayOfWeek: 1 });
availabilitySchema.index({ providerId: 1, isActive: 1 });

const Availability = mongoose.model('Availability', availabilitySchema);

module.exports = Availability;
