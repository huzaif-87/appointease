const express = require('express');
const router = express.Router();
const { getAvailableSlots } = require('../controllers/availabilityController');

// GET /api/availability/slots
router.get('/slots', getAvailableSlots);

module.exports = router;
