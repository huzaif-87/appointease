const mongoose = require('mongoose');

/**
 * Provider Schema
 * Represents healthcare practitioners and doctors
 */
const providerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Provider name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Provider email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Please provide a valid email address']
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    specialty: {
      type: String,
      required: [true, 'Medical specialty is required'],
      trim: true
    },
    qualification: {
      type: String,
      required: [true, 'Professional qualification is required'],
      trim: true
    },
    experienceYears: {
      type: Number,
      required: [true, 'Years of experience is required'],
      min: [0, 'Experience cannot be negative'],
      default: 0
    },
    bio: {
      type: String,
      trim: true,
      default: ''
    },
    location: {
      type: String,
      required: [true, 'Practice location/city is required'],
      trim: true
    },
    serviceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
      }
    ],
    consultationDuration: {
      type: Number,
      default: 30,
      min: [10, 'Consultation duration must be at least 10 minutes']
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
providerSchema.index({ specialty: 1 });
providerSchema.index({ location: 1 });
providerSchema.index({ status: 1 });
providerSchema.index({ specialty: 1, location: 1 });

const Provider = mongoose.model('Provider', providerSchema);

module.exports = Provider;
