const express = require('express');
const router = express.Router();
const { getServices, getServiceById } = require('../controllers/serviceController');
const { validateIdParam } = require('../utils/validateObjectId');

// GET /api/services
router.get('/', getServices);

// GET /api/services/:id
router.get('/:id', validateIdParam('id'), getServiceById);

module.exports = router;
