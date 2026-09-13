const mongoose = require('mongoose');

/**
 * IdempotencyKey Schema
 * Caches booking responses against unique client-provided idempotency keys
 * to protect against duplicate submissions (e.g. double-click, browser retry, network replay).
 */
const idempotencyKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    requestHash: {
      type: String,
      required: true
    },
    responseStatus: {
      type: Number,
      required: true
    },
    responseData: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400 // 24-hour TTL automatic cleanup
    }
  },
  {
    timestamps: false
  }
);

const IdempotencyKey = mongoose.model('IdempotencyKey', idempotencyKeySchema);

module.exports = IdempotencyKey;
