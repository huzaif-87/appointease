import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Calendar as CalendarIcon,
  Clock,
  User,
  UserCheck,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import {
  getAdminAppointments,
  updateAdminAppointmentStatus,
  getProviders,
  getServices
} from '../../services/api';

const format12Hour = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

const formatFriendlyDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const AdminAppointmentsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialStatus = searchParams.get('status') || '';
  const initialDate = searchParams.get('date') === 'today' ? new Date().toISOString().split('T')[0] : (searchParams.get('date') || '');

  const [appointments, setAppointments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [page, setPage] = useState(1);

  // Filter Catalog Data
  const [providersList, setProvidersList] = useState([]);
  const [servicesList, setServicesList] = useState([]);

  // Modals
  const [selectedAppointmentDetails, setSelectedAppointmentDetails] = useState(null);
  const [cancellingAppointment, setCancellingAppointment] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        const [pRes, sRes] = await Promise.all([getProviders(), getServices()]);
        setProvidersList(pRes?.data?.providers || []);
        setServicesList(sRes?.data?.services || []);
      } catch (err) {
        console.warn('Could not load provider/service filter catalogs:', err);
      }
    };
    fetchCatalogs();
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminAppointments({
        status: selectedStatus || undefined,
        providerId: selectedProvider || undefined,
        serviceId: selectedService || undefined,
        date: selectedDate || undefined,
        search: search || undefined,
        page,
        limit: 15
      });
      setAppointments(res?.data?.appointments || []);
      setPagination(res?.data?.pagination || { page: 1, limit: 15, total: 0, pages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to retrieve admin appointments');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedProvider, selectedService, selectedDate, search, page]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Status Action Handlers
  const handleUpdateStatus = async (appointmentId, newStatus, reason = '') => {
    setIsUpdatingStatus(true);
    try {
      await updateAdminAppointmentStatus(appointmentId, {
        status: newStatus,
        cancellationReason: reason
      });
      setCancellingAppointment(null);
      setCancellationReason('');
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Failed to update appointment status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">CONFIRMED</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">COMPLETED</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">CANCELLED</span>;
      case 'NO_SHOW':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">NO_SHOW</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Appointments Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time clinical appointments monitoring, status modifications, and cancellation audit logs
          </p>
        </div>
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchAppointments} isLoading={loading}>
          Refresh List
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-white space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by ID, Patient Name/Email, Doctor..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Status Select */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="NO_SHOW">NO_SHOW</option>
            </select>
          </div>

          {/* Provider Select */}
          <div>
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="">All Providers</option>
              {providersList.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Service Select */}
          <div>
            <select
              value={selectedService}
              onChange={(e) => {
                setSelectedService(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="">All Services</option>
              {servicesList.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filter & Clear */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">Scheduled Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          {(selectedStatus || selectedProvider || selectedService || selectedDate || search) && (
            <button
              onClick={() => {
                setSelectedStatus('');
                setSelectedProvider('');
                setSelectedService('');
                setSelectedDate('');
                setSearch('');
                setPage(1);
              }}
              className="text-xs text-rose-600 font-semibold hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </Card>

      {/* Appointments Data Table */}
      {loading ? (
        <Card className="py-16">
          <LoadingState message="Fetching appointment records from MongoDB..." />
        </Card>
      ) : error ? (
        <ErrorState title="Appointments Load Failure" message={error} onRetry={fetchAppointments} />
      ) : appointments.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Appointments Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No clinical appointments match your selected search criteria and filters.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0 border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Appointment ID</th>
                  <th className="p-3.5">Patient</th>
                  <th className="p-3.5">Provider</th>
                  <th className="p-3.5">Service</th>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {appointments.map((apt) => (
                  <tr key={apt._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-teal-800">{apt.appointmentId}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{apt.userId?.name || 'Patient'}</div>
                      <div className="text-[11px] text-slate-500">{apt.userId?.email || apt.userId?.phone}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">{apt.providerId?.name || 'Doctor'}</div>
                      <div className="text-[11px] text-slate-500">{apt.providerId?.specialty}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-medium text-slate-800">{apt.serviceId?.name}</div>
                      <div className="text-[11px] text-slate-500">₹{apt.serviceId?.price || 500}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{formatFriendlyDate(apt.appointmentDate)}</div>
                      <div className="font-mono text-[11px] text-teal-700">
                        {format12Hour(apt.startTime)} – {format12Hour(apt.endTime)}
                      </div>
                    </td>
                    <td className="p-3.5">{getStatusBadge(apt.status)}</td>
                    <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedAppointmentDetails(apt)}
                        title="View Details"
                        className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {apt.status === 'CONFIRMED' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(apt._id, 'COMPLETED')}
                            title="Mark Completed"
                            className="p-1.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors font-bold text-[11px] px-2"
                          >
                            Complete
                          </button>

                          <button
                            onClick={() => handleUpdateStatus(apt._id, 'NO_SHOW')}
                            title="Mark No-Show"
                            className="p-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors font-bold text-[11px] px-2"
                          >
                            No-Show
                          </button>

                          <button
                            onClick={() => setCancellingAppointment(apt)}
                            title="Cancel Appointment"
                            className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors font-bold text-[11px] px-2"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
              <span>
                Page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong> ({pagination.total} total)
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  icon={ChevronLeft}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                  icon={ChevronRight}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Appointment Details Modal */}
      {selectedAppointmentDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-white shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {selectedAppointmentDetails.appointmentId}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">Appointment Details</h3>
              </div>
              <button
                onClick={() => setSelectedAppointmentDetails(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Patient:</span>
                <span className="font-bold text-slate-900">{selectedAppointmentDetails.userId?.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Patient Email:</span>
                <span className="font-medium text-slate-800">{selectedAppointmentDetails.userId?.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Doctor/Provider:</span>
                <span className="font-bold text-slate-900">{selectedAppointmentDetails.providerId?.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Service:</span>
                <span className="font-medium text-slate-900">{selectedAppointmentDetails.serviceId?.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Scheduled Date:</span>
                <span className="font-bold text-slate-900">{formatFriendlyDate(selectedAppointmentDetails.appointmentDate)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Interval:</span>
                <span className="font-mono font-bold text-teal-800">
                  {format12Hour(selectedAppointmentDetails.startTime)} – {format12Hour(selectedAppointmentDetails.endTime)}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Status:</span>
                <div>{getStatusBadge(selectedAppointmentDetails.status)}</div>
              </div>
              {selectedAppointmentDetails.cancellationReason && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-900 space-y-0.5">
                  <span className="font-bold block text-[11px]">Cancellation Audit Reason:</span>
                  <p className="italic">{selectedAppointmentDetails.cancellationReason}</p>
                </div>
              )}
              {selectedAppointmentDetails.reason && (
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="font-bold block text-[11px] text-slate-600">Patient Reason for Visit:</span>
                  <p>{selectedAppointmentDetails.reason}</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setSelectedAppointmentDetails(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Cancellation Audit Confirmation Modal */}
      {cancellingAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-white shadow-2xl border-rose-200">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-extrabold text-slate-900">Confirm Admin Cancellation</h3>
            </div>

            <p className="text-xs text-slate-600">
              You are about to cancel appointment <strong className="font-mono">{cancellingAppointment.appointmentId}</strong> for patient{' '}
              <strong>{cancellingAppointment.userId?.name}</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Reason for Cancellation (Audit Log)
              </label>
              <textarea
                rows={3}
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Specify clinical or administrative reason for cancellation..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCancellingAppointment(null);
                  setCancellationReason('');
                }}
                disabled={isUpdatingStatus}
              >
                Keep Appointment
              </Button>
              <Button
                size="sm"
                variant="danger"
                isLoading={isUpdatingStatus}
                onClick={() => handleUpdateStatus(cancellingAppointment._id, 'CANCELLED', cancellationReason)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Confirm Cancellation
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminAppointmentsPage;
