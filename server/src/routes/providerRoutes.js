const express = require('express');
const router = express.Router();
const {
  getProviders,
  getProviderById,
  getProviderAvailability
} = require('../controllers/providerController');
const { validateIdParam } = require('../utils/validateObjectId');

// GET /api/providers
router.get('/', getProviders);

// GET /api/providers/:id
router.get('/:id', validateIdParam('id'), getProviderById);

// GET /api/providers/:id/availability
router.get('/:id/availability', validateIdParam('id'), getProviderAvailability);

module.exports = router;
