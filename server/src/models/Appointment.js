const mongoose = require('mongoose');

/**
 * Appointment Schema
 * Represents scheduled appointments with explicit relational references
 */
const appointmentSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: String,
      required: [true, 'Appointment ID is required'],
      unique: true,
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: [true, 'Provider reference is required']
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service reference is required']
    },
    appointmentDate: {
      type: Date,
      required: [true, 'Appointment date is required']
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required (e.g. 10:00)'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be in HH:MM format']
    },
    endTime: {
      type: String,
      required: [true, 'End time is required (e.g. 10:30)'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time must be in HH:MM format']
    },
    status: {
      type: String,
      enum: {
        values: ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'],
        message: '{VALUE} is not a valid appointment status'
      },
      default: 'CONFIRMED'
    },
    reason: {
      type: String,
      trim: true,
      default: ''
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: null
    },
    cancelledAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes defined per specification
appointmentSchema.index({ providerId: 1, appointmentDate: 1 });
appointmentSchema.index({ providerId: 1, appointmentDate: 1, startTime: 1 });
appointmentSchema.index({ userId: 1, appointmentDate: 1 });
appointmentSchema.index({ appointmentDate: 1, status: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
