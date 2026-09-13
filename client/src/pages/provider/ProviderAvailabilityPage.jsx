import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { 
  getProviderConsoleAvailability, 
  createProviderConsoleAvailability, 
  updateProviderConsoleAvailability, 
  deleteProviderConsoleAvailability 
} from '../../services/api';

const DAYS_OF_WEEK = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
];

export default function ProviderAvailabilityPage() {
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '17:00',
    slotDurationMinutes: 30,
    isActive: true
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAvailability = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getProviderConsoleAvailability();
      if (res.data && res.data.success) {
        setAvailabilities(res.data.data.availability || []);
      }
    } catch (err) {
      console.error('Failed to fetch provider availability:', err);
      setError(err.response?.data?.message || 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability();
  }, []);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      dayOfWeek: 'MONDAY',
      startTime: '09:00',
      endTime: '17:00',
      slotDurationMinutes: 30,
      isActive: true
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      dayOfWeek: item.dayOfWeek,
      startTime: item.startTime,
      endTime: item.endTime,
      slotDurationMinutes: item.slotDurationMinutes || 30,
      isActive: item.isActive !== false
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (formData.startTime >= formData.endTime) {
      setFormError('Start time must be before end time');
      return;
    }
    if (formData.slotDurationMinutes < 5 || formData.slotDurationMinutes > 180) {
      setFormError('Slot duration must be between 5 and 180 minutes');
      return;
    }

    setSubmitting(true);
    try {
      if (editingItem) {
        await updateProviderConsoleAvailability(editingItem._id, formData);
      } else {
        await createProviderConsoleAvailability(formData);
      }
      setModalOpen(false);
      fetchAvailability();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save shift');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteShift = async (id) => {
    if (!window.confirm('Are you sure you want to remove this availability shift?')) return;
    try {
      await deleteProviderConsoleAvailability(id);
      fetchAvailability();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove shift');
    }
  };

  // Group availabilities by day
  const groupedByDay = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day] = availabilities.filter(
      (item) => item.dayOfWeek.toUpperCase() === day.toUpperCase()
    );
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Weekly Schedule & Availability</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure your recurring working hours and slot durations.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Working Hours
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 bg-white rounded-xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DAYS_OF_WEEK.map((day) => {
            const dayShifts = groupedByDay[day] || [];
            return (
              <div key={day} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-800 tracking-wide text-sm">{day}</h3>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dayShifts.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    {dayShifts.length} {dayShifts.length === 1 ? 'Shift' : 'Shifts'}
                  </span>
                </div>

                {dayShifts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No working hours scheduled.</p>
                ) : (
                  <div className="space-y-3">
                    {dayShifts.map((shift) => (
                      <div
                        key={shift._id}
                        className={`p-3 rounded-lg border text-xs space-y-2 transition-all ${
                          shift.isActive
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-amber-50 border-amber-200 opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{shift.startTime} – {shift.endTime}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditModal(shift)}
                              className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900"
                              title="Edit Shift"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteShift(shift._id)}
                              className="p-1 hover:bg-rose-100 rounded text-slate-400 hover:text-rose-600"
                              title="Remove Shift"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-200/60">
                          <span>Slot: {shift.slotDurationMinutes || 30} mins</span>
                          <span className={`font-semibold ${shift.isActive ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {shift.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Shift Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingItem ? 'Edit Working Hours' : 'Add Working Hours'}
            </h3>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Day of Week</label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Slot Duration (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="180"
                  value={formData.slotDurationMinutes}
                  onChange={(e) => setFormData({ ...formData, slotDurationMinutes: parseInt(e.target.value) || 30 })}
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="isActive" className="text-slate-700 font-medium cursor-pointer">
                  Shift is Active
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                >
                  {submitting ? 'Saving...' : 'Save Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
