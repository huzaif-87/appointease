const mongoose = require('mongoose');
const { Notification, User } = require('../models');
const {
  sendAppointmentConfirmationEmail,
  sendAppointmentCancellationEmail,
  sendAppointmentRescheduleEmail
} = require('./emailService');

/**
 * Helper to format date nicely
 */
const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata'
  });
};

/**
 * Create an in-app notification document
 */
const createInAppNotification = async ({
  userId,
  type,
  title,
  message,
  appointmentId
}) => {
  try {
    const doc = await Notification.create({
      userId,
      type,
      title,
      message,
      appointmentId,
      read: false
    });
    return doc;
  } catch (err) {
    console.error('[Notification Service] In-app notification creation notice:', err.message);
    return null;
  }
};

/**
 * Central appointment notification dispatcher
 * Guarantees:
 * 1. Notification and email delivery failure NEVER throws or causes an unhandled rejection.
 * 2. In-app notification is persisted to database.
 * 3. Email is dispatched asynchronously via EmailService.
 */
const notifyAppointmentConfirmed = async ({
  appointment,
  patient,
  provider,
  service
}) => {
  try {
    // 1. Strictly resolve patient details from MongoDB (never trust frontend patient object or email)
    const recipientUserId = appointment.userId || (patient && patient._id);
    const patientDoc = recipientUserId ? await User.findById(recipientUserId).select('name email').lean() : null;

    const patientName = patientDoc?.name || 'Patient';
    const patientEmail = patientDoc?.email || null;
    const providerName = provider?.name || 'Doctor';
    const providerSpecialty = provider?.specialty || 'Specialist';
    const providerLocation = provider?.location || '';
    const serviceName = service?.name || 'Medical Consultation';
    const serviceDuration = service?.durationMinutes || 30;
    const servicePrice = service?.price || 500;
    const appointmentDate = appointment.appointmentDate;
    const startTime = appointment.startTime;
    const endTime = appointment.endTime;
    const appointmentId = appointment.appointmentId;

    const formattedDate = formatDisplayDate(appointmentDate);

    // 2. Create in-app notification
    const title = 'Appointment Confirmed';
    const message = `Appointment confirmed with ${providerName} for ${formattedDate} at ${startTime}.`;

    const inAppNotification = await createInAppNotification({
      userId: appointment.userId,
      type: 'APPOINTMENT_CONFIRMED',
      title,
      message,
      appointmentId
    });

    // 3. Attempt email delivery (swallow errors so appointment remains intact)
    let emailResult = null;
    if (patientEmail) {
      try {
        emailResult = await sendAppointmentConfirmationEmail({
          patientName,
          patientEmail,
          providerName,
          providerSpecialty,
          providerLocation,
          serviceName,
          serviceDuration,
          servicePrice,
          appointmentDate,
          startTime,
          endTime,
          appointmentId
        });
      } catch (emailErr) {
        console.error('[Notification Service] Confirmation email failed:', emailErr.message);
        emailResult = { success: false, code: 'EMAIL_DELIVERY_FAILED', reason: emailErr.message };
      }
    }

    return { inAppNotification, emailResult };
  } catch (err) {
    console.error('[Notification Service] notifyAppointmentConfirmed notice:', err.message);
    return null;
  }
};

/**
 * Cancellation notification dispatcher
 */
const notifyAppointmentCancelled = async ({
  appointment,
  patient,
  provider,
  service,
  cancellationReason
}) => {
  try {
    // Strictly resolve patient details from MongoDB (never trust frontend patient object or email)
    const recipientUserId = appointment.userId || (patient && patient._id);
    const patientDoc = recipientUserId ? await User.findById(recipientUserId).select('name email').lean() : null;

    const patientName = patientDoc?.name || 'Patient';
    const patientEmail = patientDoc?.email || null;
    const providerName = provider?.name || appointment.provider?.name || 'Doctor';
    const serviceName = service?.name || appointment.service?.name || 'Consultation';
    const appointmentDate = appointment.appointmentDate || appointment.date;
    const startTime = appointment.startTime;
    const appointmentId = appointment.appointmentId;

    const formattedDate = formatDisplayDate(appointmentDate);

    // 1. Create in-app notification
    const title = 'Appointment Cancelled';
    const message = `Your appointment with ${providerName} on ${formattedDate} at ${startTime} has been cancelled.`;

    const inAppNotification = await createInAppNotification({
      userId: appointment.userId || patientDoc?._id,
      type: 'APPOINTMENT_CANCELLED',
      title,
      message,
      appointmentId
    });

    // 2. Attempt email delivery
    let emailResult = null;
    if (patientEmail) {
      try {
        emailResult = await sendAppointmentCancellationEmail({
          patientName,
          patientEmail,
          providerName,
          serviceName,
          appointmentDate,
          startTime,
          appointmentId,
          cancellationReason
        });
      } catch (err) {
        console.error('[Notification Service] Cancellation email failed:', err.message);
        emailResult = { success: false, code: 'EMAIL_DELIVERY_FAILED', reason: err.message };
      }
    }

    return { inAppNotification, emailResult };
  } catch (err) {
    console.error('[Notification Service] notifyAppointmentCancelled notice:', err.message);
    return null;
  }
};

/**
 * Reschedule notification dispatcher
 */
const notifyAppointmentRescheduled = async ({
  appointment,
  patient,
  provider,
  service,
  previousDate,
  previousStartTime
}) => {
  try {
    // Strictly resolve patient details from MongoDB (never trust frontend patient object or email)
    const recipientUserId = appointment.userId || (patient && patient._id);
    const patientDoc = recipientUserId ? await User.findById(recipientUserId).select('name email').lean() : null;

    const patientName = patientDoc?.name || 'Patient';
    const patientEmail = patientDoc?.email || null;
    const providerName = provider?.name || appointment.provider?.name || 'Doctor';
    const serviceName = service?.name || appointment.service?.name || 'Consultation';
    const newDate = appointment.appointmentDate || appointment.date;
    const newStartTime = appointment.startTime;
    const newEndTime = appointment.endTime;
    const appointmentId = appointment.appointmentId;

    const oldDateFormatted = formatDisplayDate(previousDate);
    const newDateFormatted = formatDisplayDate(newDate);

    // 1. Create in-app notification
    const title = 'Appointment Rescheduled';
    const message = `Your appointment has been rescheduled from ${oldDateFormatted} ${previousStartTime} to ${newDateFormatted} ${newStartTime}.`;

    const inAppNotification = await createInAppNotification({
      userId: appointment.userId || patientDoc?._id,
      type: 'APPOINTMENT_RESCHEDULED',
      title,
      message,
      appointmentId
    });

    // 2. Attempt email delivery
    let emailResult = null;
    if (patientEmail) {
      try {
        emailResult = await sendAppointmentRescheduleEmail({
          patientName,
          patientEmail,
          providerName,
          serviceName,
          previousDate,
          previousStartTime,
          newDate,
          newStartTime,
          newEndTime,
          appointmentId
        });
      } catch (err) {
        console.error('[Notification Service] Reschedule email failed:', err.message);
        emailResult = { success: false, code: 'EMAIL_DELIVERY_FAILED', reason: err.message };
      }
    }

    return { inAppNotification, emailResult };
  } catch (err) {
    console.error('[Notification Service] notifyAppointmentRescheduled notice:', err.message);
    return null;
  }
};

/**
 * Fetch patient notifications
 */
const getPatientNotifications = async ({ userId, unreadOnly = false, limit = 20 }) => {
  const query = { userId };
  if (unreadOnly) {
    query.read = false;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit, 10) || 20)
    .lean();

  const unreadCount = await Notification.countDocuments({ userId, read: false });

  return {
    notifications,
    unreadCount,
    totalCount: notifications.length
  };
};

/**
 * Mark a single notification as read (scoped to userId)
 */
const markNotificationRead = async ({ userId, notificationId }) => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    const error = new Error('Invalid notification ID format');
    error.statusCode = 400;
    throw error;
  }

  const notification = await Notification.findOne({
    _id: notificationId,
    userId
  });

  if (!notification) {
    const error = new Error('Notification not found or access denied');
    error.statusCode = 404;
    throw error;
  }

  notification.read = true;
  await notification.save();

  const unreadCount = await Notification.countDocuments({ userId, read: false });

  return {
    notification,
    unreadCount
  };
};

/**
 * Mark all notifications as read for a user
 */
const markAllNotificationsRead = async ({ userId }) => {
  const result = await Notification.updateMany(
    { userId, read: false },
    { $set: { read: true } }
  );

  return {
    modifiedCount: result.modifiedCount,
    unreadCount: 0
  };
};

module.exports = {
  createInAppNotification,
  notifyAppointmentConfirmed,
  notifyAppointmentCancelled,
  notifyAppointmentRescheduled,
  getPatientNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
