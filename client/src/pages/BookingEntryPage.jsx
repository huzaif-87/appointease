import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  UserCheck,
  Briefcase,
  Clock,
  ArrowLeft,
  ShieldCheck,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Info,
  MapPin,
  Check,
  RefreshCw,
  FileText,
  User,
  ArrowRight,
  RotateCcw,
  LogIn
} from 'lucide-react';
import Card, { CardHeader } from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import api, {
  getProviderById,
  getServiceById,
  getProviders,
  getServices,
  getAvailableSlots,
  createAppointment,
  rescheduleAppointment,
  getAppointmentById
} from '../services/api';

import mapBookingError from '../utils/errorMapper';

// Helper: Get today's date in YYYY-MM-DD
const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Generate next N days for quick navigation pills around selected date
const getUpcomingDays = (count = 7, startDateStr = null) => {
  const days = [];
  const todayStr = getTodayDateStr();
  let base = new Date();
  if (startDateStr && startDateStr > todayStr) {
    const [y, m, d] = startDateStr.split('-').map(Number);
    base = new Date(y, m - 1, d);
  }
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const weekdayShort = d.toLocaleDateString('en-US', { weekday: 'short' });
    const monthShort = d.toLocaleDateString('en-US', { month: 'short' });
    const dayNum = d.getDate();

    days.push({
      dateStr,
      dayNum,
      weekdayShort,
      monthShort,
      isToday: dateStr === todayStr,
      label: dateStr === todayStr ? 'Today' : `${weekdayShort}, ${monthShort} ${dayNum}`
    });
  }
  return days;
};

// Helper: Convert 24-hour time "14:30" to 12-hour "2:30 PM"
const format12Hour = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

// Module-level today string used across date checks
const todayStr = getTodayDateStr();

// Helper: Format YYYY-MM-DD into friendly readable date
const formatFriendlyDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
};

export const BookingEntryPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const providerId = searchParams.get('provider');
  const serviceId = searchParams.get('service');
  const queryDate = searchParams.get('date');
  const rescheduleId = searchParams.get('reschedule');

  // Selections
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(queryDate || todayStr);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const upcomingDays = getUpcomingDays(7, selectedDate);

  // Milestone 6: Reschedule Mode State
  const [reschedulingAppointment, setReschedulingAppointment] = useState(null);

  // Step Management: 'SLOTS' -> 'DETAILS' -> 'REVIEW' -> 'CONFIRMED'
  const [currentStep, setCurrentStep] = useState('SLOTS');

  // Patient Booking Details
  const [patientReason, setPatientReason] = useState('');
  const [patientNotes, setPatientNotes] = useState('');
  const [currentPatientUser, setCurrentPatientUser] = useState(null);

  // Booking Execution State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mappedError, setMappedError] = useState(null);
  const [refreshError, setRefreshError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(null);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // Lists for switching
  const [availableServices, setAvailableServices] = useState([]);
  const [availableProviders, setAvailableProviders] = useState([]);

  // Loading & State
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState(null);

  // Dynamic Slot State
  const [slotData, setSlotData] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState(null);

  // Ensure authenticated token exists
  const ensurePatientAuth = async () => {
    try {
      const currentRole = localStorage.getItem('appointease_role');
      const token = localStorage.getItem('appointease_token');

      if (token && ['PATIENT', 'ADMIN'].includes(currentRole)) {
        return token;
      }

      if (!token) {
        const res = await api.post('/auth/demo-token', { role: 'PATIENT' });
        if (res.data?.data?.token) {
          localStorage.setItem('appointease_token', res.data.data.token);
          localStorage.setItem('appointease_role', 'PATIENT');
          setCurrentPatientUser(res.data.data.user);
          return res.data.data.token;
        }
      }
    } catch (err) {
      console.warn('Could not auto-renew patient session:', err);
    }
  };

  useEffect(() => {
    ensurePatientAuth();
  }, []);

  // 1. Fetch Provider & Service Context
  useEffect(() => {
    let isMounted = true;
    const fetchBookingContext = async () => {
      setLoadingContext(true);
      setContextError(null);
      try {
        let pData = null;
        let sData = null;

        // Milestone 6: If in reschedule mode, load existing appointment details first
        if (rescheduleId) {
          try {
            const aptRes = await getAppointmentById(rescheduleId);
            const apt = aptRes?.data?.appointment;
            if (apt) {
              setReschedulingAppointment(apt);
              pData = apt.provider || apt.providerId;
              sData = apt.service || apt.serviceId;
              if (apt.reason) setPatientReason(apt.reason);
              if (apt.notes) setPatientNotes(apt.notes);
            }
          } catch (aptErr) {
            console.error('Failed to load reschedule appointment context:', aptErr);
          }
        }

        if (!pData && providerId) {
          const pRes = await getProviderById(providerId);
          pData = pRes?.data || null;
        }

        if (!sData && serviceId) {
          const sRes = await getServiceById(serviceId);
          sData = sRes?.data || null;
        }

        // If provider chosen, find their offered services
        if (pData && pData.serviceIds) {
          setAvailableServices(pData.serviceIds);
          if (!sData && pData.serviceIds.length > 0) {
            sData = pData.serviceIds[0];
          }
        }

        // If service chosen without provider, fetch providers offering this service
        if (sData && !pData) {
          const provListRes = await getProviders({ serviceId: sData._id, status: 'ACTIVE' });
          const provs = provListRes?.data?.providers || [];
          setAvailableProviders(provs);
          if (provs.length > 0) {
            pData = provs[0];
          }
        }

        if (isMounted) {
          setSelectedProvider(pData);
          setSelectedService(sData);
        }
      } catch (err) {
        if (isMounted) {
          const mapped = mapBookingError(err);
          setContextError(mapped.message);
        }
      } finally {
        if (isMounted) setLoadingContext(false);
      }
    };

    fetchBookingContext();
    return () => {
      isMounted = false;
    };
  }, [providerId, serviceId, rescheduleId]);


  // 2. Fetch Dynamic Slots
  const fetchSlots = useCallback(async () => {
    if (!selectedProvider?._id || !selectedService?._id || !selectedDate) {
      setSlotData(null);
      return;
    }

    setLoadingSlots(true);
    setSlotError(null);

    try {
      const res = await getAvailableSlots({
        providerId: selectedProvider._id,
        serviceId: selectedService._id,
        date: selectedDate,
        ...(rescheduleId && { excludeAppointmentId: rescheduleId })
      });
      const data = res?.data || null;
      setSlotData(data);

      // Milestone 7: Auto-select slot if startTime is provided in searchParams (from Smart Recommendation)
      const targetStartTime = searchParams.get('startTime');
      if (targetStartTime && data && Array.isArray(data.slots)) {
        const matchingSlot = data.slots.find(
          (s) => s.startTime === targetStartTime && s.status === 'AVAILABLE'
        );
        if (matchingSlot) {
          setSelectedSlot(matchingSlot);
        }
      }
    } catch (err) {
      const mapped = mapBookingError(err);
      setSlotError(mapped.message);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedProvider?._id, selectedService?._id, selectedDate, searchParams]);

  useEffect(() => {
    setSelectedSlot(null);
    setMappedError(null);
    setRefreshError(null);
    fetchSlots();
  }, [fetchSlots]);

  // Handlers
  const handleSelectService = (srv) => {
    setSelectedService(srv);
    setCurrentStep('SLOTS');
    const newParams = new URLSearchParams(searchParams);
    newParams.set('service', srv._id);
    setSearchParams(newParams, { replace: true });
  };

  const handleSelectProvider = (prov) => {
    setSelectedProvider(prov);
    setCurrentStep('SLOTS');
    const newParams = new URLSearchParams(searchParams);
    newParams.set('provider', prov._id);
    setSearchParams(newParams, { replace: true });
  };

  const handleDateChange = (newDateStr) => {
    if (newDateStr < todayStr) return;
    setSelectedDate(newDateStr);
    setCurrentStep('SLOTS');
    const newParams = new URLSearchParams(searchParams);
    newParams.set('date', newDateStr);
    setSearchParams(newParams, { replace: true });
  };

  const handlePrevDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() - 1);
    const prevStr = current.toISOString().split('T')[0];
    if (prevStr >= todayStr) {
      handleDateChange(prevStr);
    }
  };

  const handleNextDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + 1);
    const nextStr = current.toISOString().split('T')[0];
    handleDateChange(nextStr);
  };

  // Step Transitions
  const handleProceedToDetails = () => {
    if (!selectedSlot) return;
    setMappedError(null);
    setCurrentStep('DETAILS');
  };

  const handleProceedToReview = () => {
    // Generate fresh idempotency key when entering review
    const newIdempKey = `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setIdempotencyKey(newIdempKey);
    setMappedError(null);
    setCurrentStep('REVIEW');
  };

  // Confirm Appointment Execution with double-click guard
  const handleConfirmBooking = async () => {
    if (isSubmitting) return; // Prevent multiple simultaneous submissions

    setIsSubmitting(true);
    setMappedError(null);
    setRefreshError(null);

    try {
      await ensurePatientAuth();

      if (rescheduleId) {
        // Milestone 6: Reschedule flow
        const res = await rescheduleAppointment(rescheduleId, {
          appointmentDate: selectedDate,
          startTime: selectedSlot.startTime
        });

        if (res?.data) {
          setConfirmedBooking({
            ...res.data,
            isRescheduled: true
          });
          setCurrentStep('CONFIRMED');
          fetchSlots();
        } else {
          throw new Error('Rescheduling completed without confirmation record');
        }
      } else {
        const payload = {
          providerId: selectedProvider._id,
          serviceId: selectedService._id,
          appointmentDate: selectedDate,
          startTime: selectedSlot.startTime,
          reason: patientReason,
          notes: patientNotes
        };

        const res = await createAppointment(payload, idempotencyKey);

        if (res?.data?.appointment) {
          setConfirmedBooking(res.data.appointment);
          setCurrentStep('CONFIRMED');
          fetchSlots(); // Re-fetch slot engine in background
        } else {
          throw new Error('Booking completed without appointment confirmation record');
        }
      }
    } catch (err) {
      console.error('Booking confirmation notice:', err);
      const mapped = mapBookingError(err);
      setMappedError(mapped);
    } finally {
      setIsSubmitting(false);
    }
  };


  // Conflict UX: Refresh Availability Action (Requirement 1 & 2)
  const handleRefreshAvailability = async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      // Re-fetch slot engine directly from backend
      await fetchSlots();
      // Keep provider, service, and date intact. Reset slot selection so patient picks a new one
      setSelectedSlot(null);
      setMappedError(null);
      setCurrentStep('SLOTS');
    } catch (err) {
      setRefreshError('Unable to refresh availability. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Conflict UX: Choose Another Time Action (Requirement 1 & 7)
  const handleChooseAnotherTime = () => {
    setSelectedSlot(null);
    setMappedError(null);
    setCurrentStep('SLOTS');
  };

  // Session Recovery: Sign In Action
  const handleSignInRecovery = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.post('/auth/demo-token', { role: 'PATIENT' });
      if (res.data?.data?.token) {
        localStorage.setItem('appointease_token', res.data.data.token);
        localStorage.setItem('appointease_role', 'PATIENT');
        setCurrentPatientUser(res.data.data.user);
        setMappedError(null);
      }
    } catch (e) {
      console.error('Failed to renew session:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Categorize slots by day part
  const slots = slotData?.slots || [];
  const morningSlots = slots.filter((s) => {
    const [h] = s.startTime.split(':').map(Number);
    return h < 12;
  });
  const afternoonSlots = slots.filter((s) => {
    const [h] = s.startTime.split(':').map(Number);
    return h >= 12 && h < 17;
  });
  const eveningSlots = slots.filter((s) => {
    const [h] = s.startTime.split(':').map(Number);
    return h >= 17;
  });

  if (loadingContext) {
    return (
      <Card className="py-20 max-w-3xl mx-auto">
        <LoadingState message="Configuring appointment booking session..." />
      </Card>
    );
  }

  if (contextError) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <ErrorState
          title="Booking Notice"
          message={contextError}
          actionLabel="Return to Specialist Directory"
          onAction={() => navigate('/providers')}
        />
      </div>
    );
  }

  // =========================================================================
  // STEP 4: SUCCESS CONFIRMATION SCREEN
  // =========================================================================
  if (currentStep === 'CONFIRMED' && confirmedBooking) {
    return (
      <div className="max-w-2xl mx-auto py-6 space-y-6">
        <Card className="p-8 border-teal-200 bg-gradient-to-b from-teal-50/40 to-white shadow-xl">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-teal-600 text-white flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {confirmedBooking.isRescheduled ? 'Appointment Rescheduled Successfully!' : 'Appointment Confirmed!'}
            </h1>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {confirmedBooking.isRescheduled
                ? 'Your appointment has been successfully updated and moved to the new slot in the clinical calendar.'
                : 'Your consultation has been successfully scheduled and confirmed in the clinical calendar.'}
            </p>
            <div className="inline-flex items-center space-x-2 bg-teal-100/70 text-teal-900 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold border border-teal-300/60">
              <span>Appointment ID:</span>
              <span className="text-teal-950 font-extrabold">{confirmedBooking.appointmentId}</span>
            </div>
          </div>


          <div className="mt-8 border-t border-b border-slate-200 py-6 space-y-4 text-sm">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-medium">Healthcare Specialist</span>
              <span className="font-bold text-slate-900">{confirmedBooking.provider?.name}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-medium">Clinical Service</span>
              <span className="font-bold text-slate-900">{confirmedBooking.service?.name}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-medium">Scheduled Date</span>
              <span className="font-bold text-slate-900">{formatFriendlyDate(confirmedBooking.date)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-medium">Appointment Interval</span>
              <span className="font-bold text-teal-700 font-mono">
                {format12Hour(confirmedBooking.startTime)} – {format12Hour(confirmedBooking.endTime)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-medium">Consultation Duration</span>
              <span className="font-bold text-slate-900">{confirmedBooking.service?.durationMinutes} minutes</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-medium">Consultation Fee</span>
              <span className="font-extrabold text-slate-900">₹{confirmedBooking.service?.price || 500}</span>
            </div>
            {confirmedBooking.reason && (
              <div className="flex justify-between items-start py-1">
                <span className="text-slate-500 font-medium">Patient Reason</span>
                <span className="text-right text-slate-700 max-w-xs">{confirmedBooking.reason}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/appointments" className="flex-1">
              <Button variant="primary" className="w-full justify-center" icon={Calendar}>
                View My Appointments
              </Button>
            </Link>
            <Button
              variant="secondary"
              className="flex-1 justify-center"
              onClick={() => {
                setCurrentStep('SLOTS');
                setSelectedSlot(null);
                setConfirmedBooking(null);
                setMappedError(null);
              }}
            >
              Book Another Appointment
            </Button>
            <Link to="/" className="sm:w-auto">
              <Button variant="ghost" className="w-full justify-center">
                Return Home
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // STEP 3: BOOKING REVIEW SCREEN
  // =========================================================================
  if (currentStep === 'REVIEW' && selectedSlot) {
    const duration = selectedService?.durationMinutes || 30;
    const [h, m] = selectedSlot.startTime.split(':').map(Number);
    const endMinutes = h * 60 + m + duration;
    const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
    const endM = String(endMinutes % 60).padStart(2, '0');
    const calculatedEndTime = `${endH}:${endM}`;

    return (
      <div className="max-w-2xl mx-auto py-6 space-y-6">
        <button
          onClick={() => setCurrentStep('DETAILS')}
          className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-teal-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          <span>Back / Edit Details</span>
        </button>

        <Card className="p-8 border-teal-200 shadow-xl space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">Step 3 of 3</span>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              {rescheduleId ? 'Review & Confirm Rescheduling' : 'Review & Confirm Booking'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {rescheduleId
                ? 'Please inspect your new appointment slot details before confirming the schedule change.'
                : 'Please inspect consultation details before confirming your scheduled appointment.'}
            </p>
          </div>

          {/* Milestone 6: Reschedule Comparison Banner */}
          {rescheduleId && reschedulingAppointment && (
            <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-200 text-xs space-y-2.5">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-teal-600" />
                <span className="font-bold text-teal-950 uppercase tracking-wider text-[11px]">
                  Reschedule Comparison ({reschedulingAppointment.appointmentId})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-white p-3 rounded-lg border border-teal-100 shadow-2xs">
                  <p className="font-semibold text-slate-500 text-[11px]">Current appointment:</p>
                  <p className="font-bold text-slate-900 text-xs mt-0.5">
                    {formatFriendlyDate(reschedulingAppointment.date || reschedulingAppointment.appointmentDate)}
                  </p>
                  <p className="text-slate-600 font-medium">
                    {format12Hour(reschedulingAppointment.startTime)}
                  </p>
                </div>
                <div className="bg-teal-600 text-white p-3 rounded-lg shadow-2xs">
                  <p className="font-medium text-teal-100 text-[11px]">New appointment:</p>
                  <p className="font-bold text-white text-xs mt-0.5">
                    {formatFriendlyDate(selectedDate)}
                  </p>
                  <p className="text-teal-50 font-medium">
                    {format12Hour(selectedSlot?.startTime)}
                  </p>
                </div>
              </div>
            </div>
          )}


          {/* User-Friendly Double-Booking Conflict Alert (Requirements 1, 6, 11) */}
          {mappedError?.isSlotConflict && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-5 rounded-2xl bg-amber-50/95 border-2 border-amber-300 text-amber-950 space-y-3.5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-amber-950 tracking-tight">
                    {mappedError.title}
                  </h4>
                  <p className="text-xs text-amber-900 leading-relaxed font-medium">
                    {mappedError.message}
                  </p>
                </div>
              </div>

              {refreshError && (
                <p className="text-xs font-semibold text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                  {refreshError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  icon={RefreshCw}
                  onClick={handleRefreshAvailability}
                  disabled={isRefreshing}
                  className="bg-amber-600 hover:bg-amber-700 text-white border-transparent shadow-xs"
                >
                  {isRefreshing ? 'Refreshing Availability...' : 'Refresh Availability'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleChooseAnotherTime}
                  disabled={isRefreshing}
                  className="bg-white hover:bg-amber-100/60 text-amber-900 border-amber-300"
                >
                  Choose Another Time
                </Button>
              </div>
            </div>
          )}

          {/* Session Expiration Alert (Requirement 9) */}
          {mappedError?.isSessionExpired && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 space-y-2.5"
            >
              <div className="flex items-start gap-2.5">
                <LogIn className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-blue-950">{mappedError.title}</h4>
                  <p className="text-xs text-blue-800 mt-0.5">{mappedError.message}</p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSignInRecovery}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Sign In
              </Button>
            </div>
          )}

          {/* Other User-Friendly Error Notifications (Requirement 3 & 4) */}
          {mappedError && !mappedError.isSlotConflict && !mappedError.isSessionExpired && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-rose-950">{mappedError.title}</p>
                <p className="text-rose-800 font-medium">{mappedError.message}</p>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-100 text-sm">
            <div className="py-3 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Provider:</span>
              <span className="font-bold text-slate-900">{selectedProvider?.name}</span>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Service:</span>
              <span className="font-bold text-slate-900">{selectedService?.name}</span>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Date:</span>
              <span className="font-bold text-slate-900">{formatFriendlyDate(selectedDate)}</span>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Time:</span>
              <span className="font-bold text-teal-700 font-mono">
                {format12Hour(selectedSlot.startTime)} – {format12Hour(calculatedEndTime)}
              </span>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Duration:</span>
              <span className="font-bold text-slate-900">{duration} minutes</span>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Consultation Fee:</span>
              <span className="text-base font-extrabold text-slate-900">
                ₹{selectedService?.price || 500}
              </span>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Patient:</span>
              <span className="font-semibold text-slate-800">
                {currentPatientUser?.name || 'Verified Patient'}
              </span>
            </div>
            {patientReason && (
              <div className="py-3 flex justify-between items-start">
                <span className="text-slate-500 font-medium">Reason:</span>
                <span className="text-right text-slate-700 max-w-xs">{patientReason}</span>
              </div>
            )}
            {patientNotes && (
              <div className="py-3 flex justify-between items-start">
                <span className="text-slate-500 font-medium">Notes:</span>
                <span className="text-right text-slate-700 max-w-xs">{patientNotes}</span>
              </div>
            )}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button
              variant="secondary"
              className="flex-1 justify-center"
              onClick={() => setCurrentStep('SLOTS')}
              disabled={isSubmitting}
            >
              Back / Change Time
            </Button>
            {/* Confirm Appointment Button with Double-Click Protection (Requirement 5) */}
            <Button
              variant="primary"
              className="flex-1 justify-center shadow-md py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              icon={CheckCircle2}
              onClick={handleConfirmBooking}
              disabled={isSubmitting || Boolean(mappedError?.isSlotConflict)}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {rescheduleId ? 'Rescheduling appointment...' : 'Confirming appointment...'}
                </span>
              ) : rescheduleId ? (
                'Confirm Reschedule'
              ) : (
                'Confirm Appointment'
              )}

            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // STEP 2: PATIENT DETAILS & REASON SCREEN
  // =========================================================================
  if (currentStep === 'DETAILS' && selectedSlot) {
    return (
      <div className="max-w-2xl mx-auto py-6 space-y-6">
        <button
          onClick={() => setCurrentStep('SLOTS')}
          className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-teal-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          <span>Back to Slot Selection</span>
        </button>

        <Card className="p-8 border-teal-200 shadow-xl space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">Step 2 of 3</span>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              Patient Details & Reason
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Add consultation notes for {selectedProvider?.name}
            </p>
          </div>

          {/* Selected Summary Pill */}
          <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-bold text-slate-900">{selectedService?.name}</p>
              <p className="text-teal-700 font-medium">{selectedProvider?.name}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">{formatFriendlyDate(selectedDate)}</p>
              <p className="font-mono font-bold text-teal-800">{format12Hour(selectedSlot.startTime)}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Chief Complaint / Reason for Visit
              </label>
              <input
                type="text"
                value={patientReason}
                onChange={(e) => setPatientReason(e.target.value)}
                placeholder="e.g. Regular health review, recurring headaches, joint checkup"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Additional Notes / Past History (Optional)
              </label>
              <textarea
                rows={3}
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                placeholder="Any current medications, allergies, or questions for the doctor..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-between gap-3">
            <Button variant="secondary" onClick={() => setCurrentStep('SLOTS')}>
              Change Slot
            </Button>
            <Button
              variant="primary"
              icon={ArrowRight}
              onClick={handleProceedToReview}
            >
              Proceed to Review
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // STEP 1: DYNAMIC SLOT SELECTION SCREEN
  // =========================================================================
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Link
              to="/providers"
              className="text-xs font-semibold text-slate-500 hover:text-teal-700 flex items-center"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              <span>Specialists Directory</span>
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Book Specialist Consultation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a verified doctor, service, calendar date, and available time slot
          </p>
        </div>

        {selectedSlot && (
          <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 px-4 py-2 rounded-xl">
            <div className="text-xs">
              <span className="text-slate-500 font-medium">Selected Slot: </span>
              <span className="font-bold text-teal-800 font-mono">
                {format12Hour(selectedSlot.startTime)} – {format12Hour(selectedSlot.endTime)}
              </span>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={ArrowRight}
              onClick={handleProceedToDetails}
            >
              Proceed
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Context Card */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-5 border-slate-200/90 space-y-4">
            <CardHeader
              title="Consultation Details"
              subtitle="Specialist and service profile"
              icon={Briefcase}
            />

            {/* Provider Section */}
            {selectedProvider ? (
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                      {selectedProvider.name?.charAt(0) || 'D'}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{selectedProvider.name}</h4>
                      <p className="text-[11px] text-teal-700 font-medium">
                        {selectedProvider.specialty}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                    Active
                  </span>
                </div>
                {selectedProvider.location && (
                  <p className="text-[11px] text-slate-500 flex items-center">
                    <MapPin className="w-3 h-3 mr-1 text-slate-400" />
                    <span>{selectedProvider.location}</span>
                  </p>
                )}
              </div>
            ) : null}

            {/* Service Section */}
            {selectedService ? (
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{selectedService.name}</h4>
                    <p className="text-[11px] text-slate-500">{selectedService.category}</p>
                  </div>
                  <span className="text-xs font-extrabold text-slate-900">
                    ₹{selectedService.price || 500}
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-[11px] text-slate-500 pt-1">
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1 text-slate-400" />
                    <span>{selectedService.durationMinutes || 30} mins</span>
                  </span>
                </div>
              </div>
            ) : null}

            {/* Change Doctor or Service if available */}
            {availableServices.length > 1 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Select Offered Service
                </label>
                <select
                  value={selectedService?._id || ''}
                  onChange={(e) => {
                    const srv = availableServices.find((s) => s._id === e.target.value);
                    if (srv) handleSelectService(srv);
                  }}
                  className="w-full text-xs py-2 px-2.5 rounded-lg border border-slate-300 bg-white font-medium"
                >
                  {availableServices.map((srv) => (
                    <option key={srv._id} value={srv._id}>
                      {srv.name} ({srv.durationMinutes}m - ₹{srv.price})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Calendar & Dynamic Slot Engine */}
        <div className="lg:col-span-8 space-y-6">
          {/* Calendar Picker Bar */}
          <Card className="p-5 border-slate-200/90 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center">
                  <Calendar className="w-4 h-4 mr-1.5 text-teal-600" />
                  <span>Choose Consultation Date</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {formatFriendlyDate(selectedDate)}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={selectedDate}
                  min={todayStr}
                  onChange={(e) => e.target.value && handleDateChange(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
                <button
                  onClick={handlePrevDay}
                  disabled={selectedDate <= todayStr}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextDay}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                  title="Next Day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick 7-Day Navigation Pills */}
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {upcomingDays.map((day) => {
                const isSelected = selectedDate === day.dateStr;
                return (
                  <button
                    key={day.dateStr}
                    onClick={() => handleDateChange(day.dateStr)}
                    className={`py-2.5 px-1.5 rounded-xl text-center transition-all flex flex-col items-center justify-center border ${
                      isSelected
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm ring-2 ring-teal-300'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span className="text-[10px] font-semibold uppercase">{day.weekdayShort}</span>
                    <span className="text-base font-extrabold my-0.5">{day.dayNum}</span>
                    <span className="text-[9px] font-medium opacity-80">{day.monthShort}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Slots View */}
          <Card className="p-6 border-slate-200/90 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center">
                  <Sparkles className="w-4 h-4 mr-1.5 text-teal-600" />
                  <span>Available Time Slots</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedService?.durationMinutes || 30}-minute dynamic slots
                </p>
              </div>

              {slotData?.summary && (
                <div className="flex items-center space-x-3 text-xs">
                  <span className="flex items-center text-teal-700 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-teal-500 mr-1.5"></span>
                    {slotData.summary.availableSlots} Available
                  </span>
                  <span className="flex items-center text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-slate-300 mr-1.5"></span>
                    {slotData.summary.bookedSlots} Booked
                  </span>
                </div>
              )}
            </div>

            {/* Slot Content */}
            <div>
              {loadingSlots ? (
                <div className="py-12">
                  <LoadingState message="Calculating real-time availability slots..." />
                </div>
              ) : slotError ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <p className="font-bold">Slot Notice</p>
                  <p className="mt-0.5">{slotError}</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No Working Shifts</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    This provider does not have working hours on the selected day.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Morning Slots */}
                  {morningSlots.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold text-slate-700 flex items-center uppercase tracking-wider">
                        <Sun className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                        <span>Morning (Before 12:00 PM)</span>
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {morningSlots.map((slot) => (
                          <SlotButton
                            key={`${slot.startTime}-${slot.endTime}`}
                            slot={slot}
                            isSelected={selectedSlot?.startTime === slot.startTime}
                            onSelect={() => setSelectedSlot(slot)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Afternoon Slots */}
                  {afternoonSlots.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold text-slate-700 flex items-center uppercase tracking-wider">
                        <Sunset className="w-3.5 h-3.5 mr-1.5 text-orange-500" />
                        <span>Afternoon (12:00 PM - 5:00 PM)</span>
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {afternoonSlots.map((slot) => (
                          <SlotButton
                            key={`${slot.startTime}-${slot.endTime}`}
                            slot={slot}
                            isSelected={selectedSlot?.startTime === slot.startTime}
                            onSelect={() => setSelectedSlot(slot)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evening Slots */}
                  {eveningSlots.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold text-slate-700 flex items-center uppercase tracking-wider">
                        <Moon className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                        <span>Evening (After 5:00 PM)</span>
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {eveningSlots.map((slot) => (
                          <SlotButton
                            key={`${slot.startTime}-${slot.endTime}`}
                            slot={slot}
                            isSelected={selectedSlot?.startTime === slot.startTime}
                            onSelect={() => setSelectedSlot(slot)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Proceed Bar */}
            {selectedSlot && (
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-slate-500">Selected: </span>
                  <span className="font-bold text-teal-700 font-mono">
                    {format12Hour(selectedSlot.startTime)} – {format12Hour(selectedSlot.endTime)}
                  </span>
                </div>
                <Button
                  variant="primary"
                  icon={ArrowRight}
                  onClick={handleProceedToDetails}
                >
                  Proceed to Patient Details
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

// Slot Button Sub-component
const SlotButton = ({ slot, isSelected, onSelect }) => {
  const isAvailable = slot.status === 'AVAILABLE';
  const isBooked = slot.status === 'BOOKED';

  if (isAvailable) {
    return (
      <button
        onClick={onSelect}
        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center border focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
          isSelected
            ? 'bg-teal-600 text-white border-teal-600 shadow-md ring-2 ring-teal-400 ring-offset-2 scale-[1.02]'
            : 'bg-white text-slate-800 border-teal-200 hover:border-teal-500 hover:bg-teal-50/60 shadow-2xs'
        }`}
      >
        <span className="text-xs font-mono">{format12Hour(slot.startTime)}</span>
        <span className={`text-[10px] font-normal ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
          to {format12Hour(slot.endTime)}
        </span>
      </button>
    );
  }

  if (isBooked) {
    return (
      <div
        className="py-2.5 px-3 rounded-xl text-xs font-medium bg-slate-100/80 border border-slate-200 text-slate-400 cursor-not-allowed flex flex-col items-center justify-center select-none"
        title="Time slot no longer available. Booked by another patient."
        aria-disabled="true"
      >
        <span className="text-xs line-through font-mono text-slate-400">{format12Hour(slot.startTime)}</span>
        <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 not-italic no-underline">
          Booked
        </span>
      </div>
    );
  }

  // UNAVAILABLE (Past time or 30m buffer)
  return (
    <div
      className="py-2.5 px-3 rounded-xl text-xs font-medium bg-slate-50 border border-slate-200/60 text-slate-300 cursor-not-allowed flex flex-col items-center justify-center select-none"
      title={slot.reason === 'TIME_PASSED' ? 'Time has already passed' : 'Within 30-min advance booking buffer'}
      aria-disabled="true"
    >
      <span className="text-xs font-mono">{format12Hour(slot.startTime)}</span>
      <span className="text-[9px] uppercase tracking-wider font-medium text-slate-400">
        Passed
      </span>
    </div>
  );
};

export default BookingEntryPage;
