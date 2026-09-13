import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Plus,
  UserCheck,
  Calendar as CalendarIcon,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import {
  getAdminAvailabilities,
  createAdminAvailability,
  updateAdminAvailability,
  deleteAdminAvailability,
  getProviders
} from '../../services/api';

const format12Hour = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

export const AdminAvailabilityPage = () => {
  const [providersList, setProvidersList] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Shift Form
  const [formData, setFormData] = useState({
    providerId: '',
    dayOfWeek: 'Monday',
    startTime: '09:00',
    endTime: '13:00',
    slotDurationMinutes: 30,
    isActive: true
  });

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    const fetchProvidersList = async () => {
      try {
        const res = await getProviders();
        const provs = res?.data?.providers || [];
        setProvidersList(provs);
        if (provs.length > 0 && !selectedProviderId) {
          setSelectedProviderId(provs[0]._id);
        }
      } catch (err) {
        console.warn('Could not load providers list:', err);
      }
    };
    fetchProvidersList();
  }, []);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminAvailabilities({
        providerId: selectedProviderId || undefined
      });
      setAvailabilities(res?.data?.availabilities || []);
    } catch (err) {
      setError(err.message || 'Failed to load availability schedule');
    } finally {
      setLoading(false);
    }
  }, [selectedProviderId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleOpenAddModal = () => {
    setFormData({
      providerId: selectedProviderId || (providersList[0]?._id || ''),
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '13:00',
      slotDurationMinutes: 30,
      isActive: true
    });
    setModalError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (shift) => {
    setEditingShift(shift);
    setFormData({
      providerId: shift.providerId?._id || shift.providerId,
      dayOfWeek: shift.dayOfWeek || 'Monday',
      startTime: shift.startTime || '09:00',
      endTime: shift.endTime || '13:00',
      slotDurationMinutes: shift.slotDurationMinutes || 30,
      isActive: shift.isActive !== false
    });
    setModalError(null);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.providerId || !formData.dayOfWeek || !formData.startTime || !formData.endTime) {
      setModalError('Please fill out all required fields.');
      return;
    }

    if (formData.startTime >= formData.endTime) {
      setModalError('Start time must be strictly before End time.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      if (editingShift) {
        await updateAdminAvailability(editingShift._id, formData);
        setEditingShift(null);
      } else {
        await createAdminAvailability(formData);
        setIsAddModalOpen(false);
      }
      fetchSchedule();
    } catch (err) {
      setModalError(err.message || 'Failed to save shift.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShift = async (shiftId) => {
    if (!window.confirm('Are you sure you want to remove this working shift?')) return;
    try {
      await deleteAdminAvailability(shiftId);
      fetchSchedule();
    } catch (err) {
      alert(err.message || 'Failed to delete shift');
    }
  };

  const handleToggleActive = async (shift) => {
    try {
      await updateAdminAvailability(shift._id, { isActive: !shift.isActive });
      fetchSchedule();
    } catch (err) {
      alert(err.message || 'Failed to update shift status');
    }
  };

  const activeProviderObj = providersList.find((p) => p._id === selectedProviderId);

  // Group availabilities by day
  const groupedByDay = daysOfWeek.reduce((acc, day) => {
    acc[day] = availabilities.filter((a) => a.dayOfWeek === day);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Availability & Shift Schedule</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage provider recurring working shifts, morning/evening consultation windows, and slot granularity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchSchedule} isLoading={loading}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenAddModal} className="bg-teal-600 hover:bg-teal-700">
            Add Working Shift
          </Button>
        </div>
      </div>

      {/* Provider Select Bar */}
      <Card className="p-4 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <UserCheck className="w-4 h-4 text-teal-600 flex-shrink-0" />
            <span className="font-bold text-slate-700 uppercase tracking-wider">Select Doctor / Specialist:</span>
            <select
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-bold text-slate-900"
            >
              <option value="">All Providers Combined</option>
              {providersList.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.specialty} - {p.location})
                </option>
              ))}
            </select>
          </div>

          {activeProviderObj && (
            <div className="text-slate-500 text-right">
              <span className="font-semibold">Consultation Duration: </span>
              <strong className="text-teal-800 font-mono">{activeProviderObj.consultationDuration || 30} Mins</strong>
            </div>
          )}
        </div>
      </Card>

      {/* Visual Weekly Schedule Grid (Part 8 requirement) */}
      {loading ? (
        <Card className="py-16">
          <LoadingState message="Loading recurring shifts schedule..." />
        </Card>
      ) : error ? (
        <ErrorState title="Schedule Load Failure" message={error} onRetry={fetchSchedule} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {daysOfWeek.map((day) => {
            const dayShifts = groupedByDay[day] || [];
            const hasActive = dayShifts.some((s) => s.isActive);

            return (
              <Card key={day} className={`p-4 space-y-3 ${hasActive ? 'bg-white border-slate-200' : 'bg-slate-50/70 border-slate-200'}`}>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">{day}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${hasActive ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-600'}`}>
                    {dayShifts.length} Shift{dayShifts.length === 1 ? '' : 's'}
                  </span>
                </div>

                {dayShifts.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-4 text-center">No active shifts</p>
                ) : (
                  <div className="space-y-2">
                    {dayShifts.map((shift) => (
                      <div
                        key={shift._id}
                        className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                          shift.isActive
                            ? 'bg-teal-50/70 border-teal-200 text-teal-950'
                            : 'bg-slate-100 border-slate-200 text-slate-500 line-through'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono font-bold">
                          <span>
                            {format12Hour(shift.startTime)} — {format12Hour(shift.endTime)}
                          </span>
                        </div>

                        {!selectedProviderId && shift.providerId && (
                          <p className="text-[10px] font-bold text-slate-700 truncate">
                            {shift.providerId.name}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-teal-200/50 text-[10px]">
                          <span className="font-semibold">{shift.slotDurationMinutes || 30}m slots</span>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleOpenEditModal(shift)}
                              title="Edit Shift"
                              className="text-slate-600 hover:text-teal-700 p-0.5"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteShift(shift._id)}
                              title="Delete Shift"
                              className="text-slate-400 hover:text-rose-600 p-0.5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Shift Modal */}
      {(isAddModalOpen || editingShift) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-white shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingShift ? 'Edit Working Shift' : 'Add New Working Shift'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set recurring day of week, consultation window, and slot duration
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingShift(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p>{modalError}</p>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Doctor / Provider *</label>
                <select
                  value={formData.providerId}
                  onChange={(e) => setFormData({ ...formData, providerId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  {providersList.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Day of Week *</label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  {daysOfWeek.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Start Time (HH:MM) *</label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">End Time (HH:MM) *</label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Slot Duration (Minutes)</label>
                <input
                  type="number"
                  min="10"
                  step="5"
                  value={formData.slotDurationMinutes}
                  onChange={(e) => setFormData({ ...formData, slotDurationMinutes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingShift(null);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" variant="primary" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
                  {editingShift ? 'Save Shift Changes' : 'Create Working Shift'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminAvailabilityPage;
