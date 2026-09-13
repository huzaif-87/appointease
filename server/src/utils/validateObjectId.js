const mongoose = require('mongoose');

/**
 * Validates whether a given string is a valid MongoDB ObjectId
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
};

/**
 * Express middleware to validate :id parameter as a valid MongoDB ObjectId
 */
const validateIdParam = (paramName = 'id') => (req, res, next) => {
  const id = req.params[paramName];
  if (!isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: `Invalid ID format: '${id}' is not a valid ObjectId`,
      statusCode: 400,
      timestamp: new Date().toISOString()
    });
  }
  next();
};

module.exports = {
  isValidObjectId,
  validateIdParam
};
