const express = require('express');
const router = express.Router();
const {
  getProviderDashboard,
  getProviderAppointments,
  updateProviderAppointmentStatus,
  getProviderOwnAvailability,
  createProviderOwnAvailability,
  deleteProviderOwnAvailability,
  getProviderOwnServices,
  getProviderOwnProfile,
  updateProviderOwnProfile
} = require('../controllers/providerConsoleController');
const { protect, requireRole } = require('../middleware/authMiddleware');

// All provider console routes require authentication and PROVIDER role (or ADMIN testing as PROVIDER)
router.use(protect());
router.use(requireRole('PROVIDER', 'ADMIN'));

// Provider Dashboard & Overview
router.get('/dashboard', getProviderDashboard);

// Provider Appointments Management
router.get('/appointments', getProviderAppointments);
router.patch('/appointments/:id/status', updateProviderAppointmentStatus);

// Provider Availability Shifts
router.get('/availability', getProviderOwnAvailability);
router.post('/availability', createProviderOwnAvailability);
router.delete('/availability/:id', deleteProviderOwnAvailability);

// Provider Services
router.get('/services', getProviderOwnServices);

// Provider Profile
router.get('/profile', getProviderOwnProfile);
router.patch('/profile', updateProviderOwnProfile);

module.exports = router;
