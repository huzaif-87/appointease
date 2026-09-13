const mongoose = require('mongoose');

/**
 * Notification Schema
 * In-app notifications for patient users regarding appointment state changes
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID reference is required'],
      index: true
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: {
        values: [
          'APPOINTMENT_CONFIRMED',
          'APPOINTMENT_CANCELLED',
          'APPOINTMENT_RESCHEDULED'
        ],
        message: '{VALUE} is not a valid notification type'
      }
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters']
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters']
    },
    appointmentId: {
      type: String,
      required: [true, 'Appointment reference ID is required'],
      trim: true
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for performant query patterns
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
