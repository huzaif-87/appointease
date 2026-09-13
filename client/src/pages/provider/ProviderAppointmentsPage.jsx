import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, User, CheckCircle2, XCircle, AlertCircle, 
  Search, Filter, Eye, AlertTriangle 
} from 'lucide-react';
import { getProviderConsoleAppointments, updateProviderConsoleAppointmentStatus } from '../../services/api';

export default function ProviderAppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [timeFilter, setTimeFilter] = useState('all'); // all, today, upcoming, past
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Selected appointment for detail view
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [statusModal, setStatusModal] = useState({ open: false, appt: null, targetStatus: '' });

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (timeFilter && timeFilter !== 'all') params.timeRange = timeFilter;
      if (dateFilter) params.date = dateFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await getProviderConsoleAppointments(params);
      if (res.data && res.data.success) {
        setAppointments(res.data.data.appointments || []);
      } else {
        setAppointments([]);
      }
    } catch (err) {
      console.error('Failed to fetch provider appointments:', err);
      setError(err.response?.data?.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [statusFilter, timeFilter, dateFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAppointments();
  };

  const handleUpdateStatus = async () => {
    if (!statusModal.appt || !statusModal.targetStatus) return;
    setActionLoading(true);
    try {
      await updateProviderConsoleAppointmentStatus(statusModal.appt._id, { status: statusModal.targetStatus });
      setStatusModal({ open: false, appt: null, targetStatus: '' });
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
      case 'BOOKED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Confirmed</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">Completed</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800">Cancelled</span>;
      case 'NO_SHOW':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">No Show</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Appointments</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage patient consultations assigned strictly to your schedule.
        </p>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 md:space-y-0 md:flex md:items-center md:justify-between gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </form>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Filter */}
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Dates</option>
            <option value="today">Today's Visits</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past History</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No Show</option>
          </select>

          {/* Specific Date */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-xs text-rose-600 hover:underline"
            >
              Clear Date
            </button>
          )}
        </div>
      </div>

      {/* Appointments List */}
      {loading ? (
        <div className="flex justify-center items-center py-20 bg-white rounded-xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No appointments found</h3>
          <p className="text-sm text-slate-500 mt-1">Try resetting your filters or search query.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-200">
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Service</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {appointments.map((appt) => (
                  <tr key={appt._id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{appt.patientName || appt.patientId?.name || 'Patient'}</div>
                      <div className="text-xs text-slate-500">{appt.patientEmail || appt.patientId?.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {appt.serviceId?.name || 'General Consultation'}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-slate-900 font-medium">{appt.appointmentDate ? appt.appointmentDate.split('T')[0] : 'N/A'}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {appt.startTime} - {appt.endTime}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(appt.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedAppointment(appt)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(appt.status === 'CONFIRMED' || appt.status === 'BOOKED') && (
                          <>
                            <button
                              onClick={() => setStatusModal({ open: true, appt, targetStatus: 'COMPLETED' })}
                              className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors border border-emerald-200 flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Complete
                            </button>
                            <button
                              onClick={() => setStatusModal({ open: true, appt, targetStatus: 'NO_SHOW' })}
                              className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md transition-colors border border-amber-200 flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              No Show
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Appointment Detail Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Appointment Details</h3>
            <div className="space-y-3 text-sm">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase">Patient Information</span>
                <p className="font-semibold text-slate-800">{selectedAppointment.patientName || selectedAppointment.patientId?.name}</p>
                <p className="text-slate-600">{selectedAppointment.patientEmail || selectedAppointment.patientId?.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Service</span>
                  <p className="font-semibold text-slate-800">{selectedAppointment.serviceId?.name || 'General'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedAppointment.status)}</div>
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-xs font-semibold text-slate-400 uppercase">Date & Time</span>
                <p className="font-medium text-slate-800 mt-0.5">
                  {selectedAppointment.appointmentDate ? selectedAppointment.appointmentDate.split('T')[0] : 'N/A'} ({selectedAppointment.startTime} - {selectedAppointment.endTime})
                </p>
              </div>
              {selectedAppointment.reasonForVisit && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Reason for Visit</span>
                  <p className="text-slate-700 mt-0.5">{selectedAppointment.reasonForVisit}</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedAppointment(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Confirmation Modal */}
      {statusModal.open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Status Update</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to mark this appointment with{' '}
              <strong className="text-slate-900">{statusModal.appt?.patientName || 'Patient'}</strong> as{' '}
              <strong className="text-emerald-700">{statusModal.targetStatus}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setStatusModal({ open: false, appt: null, targetStatus: '' })}
                disabled={actionLoading}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {actionLoading ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
