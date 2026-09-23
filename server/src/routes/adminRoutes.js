const express = require('express');
const router = express.Router();
const {
  getAdminOverview,
  getAdminAppointments,
  updateAdminAppointmentStatus,
  getAdminProviders,
  createAdminProvider,
  updateAdminProvider,
  getAdminServices,
  createAdminService,
  updateAdminService,
  getAdminAvailabilities,
  createAdminAvailability,
  updateAdminAvailability,
  deleteAdminAvailability,
  getAdminUsers,
  updateAdminUser
} = require('../controllers/adminController');
const { protect, requireRole } = require('../middleware/authMiddleware');

// All admin routes strictly require authentication and ADMIN role
router.use(protect());
router.use(requireRole('ADMIN'));

// Overview
router.get('/overview', getAdminOverview);

// Appointments Management
router.get('/appointments', getAdminAppointments);
router.patch('/appointments/:id/status', updateAdminAppointmentStatus);

// Providers Management
router.get('/providers', getAdminProviders);
router.post('/providers', createAdminProvider);
router.patch('/providers/:id', updateAdminProvider);

// Services Catalog Management
router.get('/services', getAdminServices);
router.post('/services', createAdminService);
router.patch('/services/:id', updateAdminService);

// Availability & Schedule Management
router.get('/availabilities', getAdminAvailabilities);
router.post('/availabilities', createAdminAvailability);
router.patch('/availabilities/:id', updateAdminAvailability);
router.delete('/availabilities/:id', deleteAdminAvailability);

// Users Management
router.get('/users', getAdminUsers);
router.patch('/users/:id', updateAdminUser);

module.exports = router;
