const mongoose = require('mongoose');

/**
 * Service Schema
 * Represents healthcare services and consultations offered by providers
 */
const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      minlength: [3, 'Service name must be at least 3 characters long']
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      required: [true, 'Service category is required'],
      trim: true
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Service duration in minutes is required'],
      min: [10, 'Duration must be at least 10 minutes'],
      default: 30
    },
    price: {
      type: Number,
      required: [true, 'Service fee/price is required'],
      min: [0, 'Price cannot be negative'],
      default: 0
    },
    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'INACTIVE'],
        message: '{VALUE} is not a supported status'
      },
      default: 'ACTIVE'
    }
  },
  {
    timestamps: true
  }
);

// Indexes
serviceSchema.index({ category: 1 });
serviceSchema.index({ status: 1 });
serviceSchema.index({ name: 1 });

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;
