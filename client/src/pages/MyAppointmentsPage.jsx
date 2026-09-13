import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserCheck,
  Briefcase,
  ArrowRight,
  Sparkles,
  RefreshCw,
  RotateCcw,
  X
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingState from '../components/common/LoadingState';
import EmptyState from '../components/common/EmptyState';
import api, { getMyAppointments, cancelAppointment } from '../services/api';
import mapBookingError from '../utils/errorMapper';

// Helper: Format YYYY-MM-DD into friendly readable date
const formatFriendlyDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
};

export const MyAppointmentsPage = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'past'

  // Milestone 6: Cancellation Modal & Operation State
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('Schedule changed');
  const [customReason, setCustomReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  const fetchAppointments = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // Ensure we have a valid PATIENT session token
      const currentRole = localStorage.getItem('appointease_role');
      if (currentRole !== 'PATIENT') {
        const authRes = await api.post('/auth/demo-token', { role: 'PATIENT' });
        if (authRes.data?.data?.token) {
          localStorage.setItem('appointease_token', authRes.data.data.token);
          localStorage.setItem('appointease_role', 'PATIENT');
        }
      }

      const response = await getMyAppointments({ timeframe: activeTab });
      setAppointments(response?.data?.appointments || []);
    } catch (err) {
      console.error('Failed to load appointments:', err);
      if (err.statusCode === 403 || err.statusCode === 401) {
        try {
          const authRes = await api.post('/auth/demo-token', { role: 'PATIENT' });
          if (authRes.data?.data?.token) {
            localStorage.setItem('appointease_token', authRes.data.data.token);
            localStorage.setItem('appointease_role', 'PATIENT');
            const retryRes = await getMyAppointments({ timeframe: activeTab });
            setAppointments(retryRes?.data?.appointments || []);
            return;
          }
        } catch (retryErr) {
          // ignore retry failure
        }
      }
      const mapped = mapBookingError(err);
      setErrorMessage(mapped.message || 'Unable to retrieve your appointments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [activeTab]);

  // Open Cancel Confirmation Modal
  const handleOpenCancelModal = (appointment) => {
    setCancelTarget(appointment);
    setCancelReason('Schedule changed');
    setCustomReason('');
    setCancelError(null);
  };

  // Close Cancel Modal
  const handleCloseCancelModal = () => {
    if (isCancelling) return;
    setCancelTarget(null);
    setCancelError(null);
  };

  // Submit Cancellation
  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    setCancelError(null);

    const effectiveReason = cancelReason === 'Other' ? (customReason || 'Other reason') : cancelReason;

    try {
      const aptId = cancelTarget._id || cancelTarget.appointmentId;
      await cancelAppointment(aptId, { cancellationReason: effectiveReason });
      setCancelTarget(null);
      setSuccessNotice('Appointment cancelled successfully.');
      setTimeout(() => setSuccessNotice(null), 5000);
      await fetchAppointments();
    } catch (err) {
      console.error('Failed to cancel appointment:', err);
      const mapped = mapBookingError(err);
      setCancelError(mapped);
    } finally {
      setIsCancelling(false);
    }
  };

  // Navigate to Reschedule flow in BookingEntryPage
  const handleStartReschedule = (apt) => {
    const provId = apt.provider?.id || apt.provider?._id || apt.providerId?._id || apt.providerId;
    const servId = apt.service?.id || apt.service?._id || apt.serviceId?._id || apt.serviceId;
    const dateStr = apt.date || (apt.appointmentDate ? new Date(apt.appointmentDate).toISOString().split('T')[0] : '');
    const aptIdentifier = apt._id || apt.appointmentId;

    navigate(`/book?reschedule=${aptIdentifier}&provider=${provId}&service=${servId}&date=${dateStr}`);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-teal-600" />
            CONFIRMED
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
            COMPLETED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-500" />
            CANCELLED
          </span>
        );
      case 'NO_SHOW':
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            NO_SHOW
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Appointments
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your verified healthcare consultations, reschedule dates, or cancel visits
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={fetchAppointments}
            disabled={loading}
          >
            Refresh
          </Button>
          <Link to="/providers">
            <Button variant="primary" size="sm" icon={UserCheck}>
              Book Specialist
            </Button>
          </Link>
        </div>
      </div>

      {/* Success Banner */}
      {successNotice && (
        <div
          role="status"
          className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 flex items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-teal-600 flex-shrink-0" />
            <p className="text-sm font-semibold">{successNotice}</p>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-teal-600 hover:text-teal-800 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'upcoming'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Upcoming Appointments</span>
          {activeTab === 'upcoming' && !loading && (
            <span className="text-[10px] bg-teal-50 text-teal-800 px-1.5 py-0.2 rounded-full border border-teal-200">
              {appointments.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('past')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'past'
              ? 'border-teal-600 text-teal-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Past Visits & History</span>
          {activeTab === 'past' && !loading && (
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full">
              {appointments.length}
            </span>
          )}
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold">Notice</p>
            <p className="mt-0.5 text-rose-700">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* List Content */}
      {loading ? (
        <Card className="py-16">
          <LoadingState message="Loading your consultation records..." />
        </Card>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={activeTab === 'upcoming' ? 'No Upcoming Appointments' : 'No Past Consultations Found'}
          description={
            activeTab === 'upcoming'
              ? 'You have no active confirmed consultations. Find a specialist to schedule an appointment.'
              : 'Past consultations and completed records will appear here.'
          }
          actionLabel="Find a Doctor"
          onAction={() => window.location.assign('/providers')}
        />
      ) : (
        <div className="space-y-4">
          {appointments.map((apt) => {
            const provider = apt.provider || apt.providerId;
            const service = apt.service || apt.serviceId;
            const dateStr =
              apt.date || (apt.appointmentDate ? new Date(apt.appointmentDate).toISOString().split('T')[0] : '');
            const isConfirmedUpcoming = apt.status === 'CONFIRMED' && !apt.isPast;

            return (
              <Card
                key={apt._id || apt.appointmentId}
                hover
                className="p-5 border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(apt.status)}
                    <span className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {apt.appointmentId}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">
                    {service?.name || 'General Health Consultation'}
                  </h3>

                  <p className="text-xs font-semibold text-teal-700 flex items-center">
                    <UserCheck className="w-3.5 h-3.5 mr-1 text-teal-600" />
                    {provider?.name || 'Verified Specialist'} ({provider?.specialty || 'General Medicine'})
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                    <span className="flex items-center font-medium text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1" />
                      {formatFriendlyDate(dateStr) || dateStr}
                    </span>
                    <span>•</span>
                    <span className="flex items-center font-medium text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-slate-400 mr-1" />
                      {apt.startTime} – {apt.endTime}
                    </span>
                    {provider?.location && (
                      <>
                        <span>•</span>
                        <span className="flex items-center">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mr-1" />
                          {provider.location}
                        </span>
                      </>
                    )}
                  </div>

                  {apt.reason && (
                    <p className="text-xs text-slate-600 pt-1">
                      <span className="font-semibold text-slate-700">Reason:</span> {apt.reason}
                    </p>
                  )}

                  {apt.cancellationReason && (
                    <p className="text-[11px] text-rose-600 pt-1 bg-rose-50/70 px-2 py-1 rounded inline-block">
                      <strong>Reason for cancellation:</strong> {apt.cancellationReason}
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:items-end justify-between gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 flex-shrink-0">
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full">
                    <span className="text-sm font-extrabold text-slate-900">
                      ₹{service?.price || 500}
                    </span>

                    {provider?.id || provider?._id ? (
                      <Link
                        to={`/providers/${provider.id || provider._id}`}
                        className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                      >
                        Doctor Profile &rarr;
                      </Link>
                    ) : null}
                  </div>

                  {/* Milestone 6 Actions: Only for upcoming CONFIRMED appointments */}
                  {isConfirmedUpcoming && (
                    <div className="flex items-center gap-2 pt-1 w-full sm:w-auto">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={RotateCcw}
                        onClick={() => handleStartReschedule(apt)}
                      >
                        Reschedule
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                        icon={XCircle}
                        onClick={() => handleOpenCancelModal(apt)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Milestone 6: Cancel Confirmation Modal */}
      {cancelTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                  <XCircle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">Cancel Appointment?</h3>
              </div>
              <button
                onClick={handleCloseCancelModal}
                disabled={isCancelling}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Appointment Summary */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-xs text-slate-600 border border-slate-100">
              <p>
                <strong className="text-slate-900">Provider:</strong>{' '}
                {cancelTarget.provider?.name || cancelTarget.providerId?.name || 'Doctor'}
              </p>
              <p>
                <strong className="text-slate-900">Date:</strong>{' '}
                {formatFriendlyDate(
                  cancelTarget.date ||
                    (cancelTarget.appointmentDate
                      ? new Date(cancelTarget.appointmentDate).toISOString().split('T')[0]
                      : '')
                )}
              </p>
              <p>
                <strong className="text-slate-900">Time:</strong> {cancelTarget.startTime} – {cancelTarget.endTime}
              </p>
            </div>

            <p className="text-sm font-medium text-slate-700">
              Are you sure you want to cancel this appointment?
            </p>

            {/* Optional Reason Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Reason for cancellation (optional):
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                disabled={isCancelling}
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="Schedule changed">Schedule changed</option>
                <option value="Found another time">Found another time</option>
                <option value="No longer needed">No longer needed</option>
                <option value="Other">Other</option>
              </select>

              {cancelReason === 'Other' && (
                <input
                  type="text"
                  placeholder="Please specify reason..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  disabled={isCancelling}
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 mt-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              )}
            </div>

            {/* Error Message inside Modal */}
            {cancelError && (
              <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                <p className="font-bold">{cancelError.title}</p>
                <p>{cancelError.message}</p>
              </div>
            )}

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCloseCancelModal}
                disabled={isCancelling}
              >
                Keep Appointment
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Cancelling...
                  </span>
                ) : (
                  'Cancel Appointment'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyAppointmentsPage;

