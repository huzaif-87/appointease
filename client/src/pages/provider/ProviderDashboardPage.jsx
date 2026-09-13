import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope,
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowRight,
  Briefcase
} from 'lucide-react';
import Card, { CardHeader } from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { getProviderDashboard } from '../../services/api';

const format12Hour = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

export const ProviderDashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getProviderDashboard();
      setData(res?.data || null);
    } catch (err) {
      setError(err.message || 'Failed to load doctor dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-800/80 text-blue-200 text-xs font-bold uppercase tracking-wider border border-blue-500/60">
            <Stethoscope className="w-3.5 h-3.5 text-blue-300" />
            <span>Healthcare Practitioner Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {data?.provider?.name ? `Welcome, ${data.provider.name}` : 'Doctor Operational Console'}
          </h1>
          <p className="text-xs sm:text-sm text-blue-100">
            {data?.provider?.specialty ? `${data.provider.specialty} • ${data.provider.location}` : 'Clinical schedule & patient consultation portal'}
          </p>
        </div>
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchDashboard} isLoading={loading} className="text-white border-white/30 hover:bg-white/10 self-start sm:self-auto">
          Refresh Dashboard
        </Button>
      </div>

      {/* Quick Action Navigation Buttons (Part 13 requirement) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/provider/appointments?timeframe=today">
          <Button variant="primary" size="sm" icon={Calendar} className="w-full justify-center bg-blue-600 hover:bg-blue-700">
            Today's Visits
          </Button>
        </Link>
        <Link to="/provider/availability">
          <Button variant="secondary" size="sm" icon={Clock} className="w-full justify-center">
            Manage Availability
          </Button>
        </Link>
        <Link to="/provider/services">
          <Button variant="secondary" size="sm" icon={Briefcase} className="w-full justify-center">
            View Services
          </Button>
        </Link>
        <Link to="/provider/profile">
          <Button variant="secondary" size="sm" icon={User} className="w-full justify-center">
            Edit Profile
          </Button>
        </Link>
      </div>

      {loading ? (
        <Card className="py-16">
          <LoadingState message="Loading clinician metrics & appointments..." />
        </Card>
      ) : error ? (
        <ErrorState title="Dashboard Load Notice" message={error} onRetry={fetchDashboard} />
      ) : data ? (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/provider/appointments?timeframe=today">
              <Card className="bg-white hover:border-blue-400 transition-all cursor-pointer shadow-2xs hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Visits</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">
                      {data.stats?.todayCount ?? 0}
                    </p>
                    <p className="text-[11px] text-blue-600 mt-1 font-semibold flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      Scheduled for today
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>
              </Card>
            </Link>

            <Link to="/provider/appointments?timeframe=upcoming">
              <Card className="bg-white hover:border-teal-400 transition-all cursor-pointer shadow-2xs hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Upcoming Visits</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">
                      {data.stats?.upcomingCount ?? 0}
                    </p>
                    <p className="text-[11px] text-teal-600 mt-1 font-semibold">Future consultations</p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
              </Card>
            </Link>

            <Card className="bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Patients</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">
                    {data.stats?.patientCount ?? 0}
                  </p>
                  <p className="text-[11px] text-indigo-600 mt-1 font-semibold">Unique patient count</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
              </div>
            </Card>

            <Card className="bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Consultations</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1">
                    {data.stats?.completedCount ?? 0}
                  </p>
                  <p className="text-[11px] text-emerald-600 mt-1 font-semibold">Fulfilled visits</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </div>

          {/* Today's Schedule & Appointments List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Today's Appointment Schedule</h3>
                  <p className="text-xs text-slate-500">Live patient appointments for today</p>
                </div>
                <Link to="/provider/appointments" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center">
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>

              {data.todayAppointments?.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center italic">No appointments scheduled for today.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.todayAppointments.map((apt) => (
                    <div key={apt._id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-extrabold text-slate-900 text-sm">{apt.userId?.name || 'Patient'}</div>
                        <div className="text-slate-500 font-medium">{apt.serviceId?.name} • ₹{apt.serviceId?.price}</div>
                        {apt.reason && <div className="text-slate-600 italic">"Reason: {apt.reason}"</div>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-mono font-bold text-blue-800 text-sm">{format12Hour(apt.startTime)}</div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 mt-1 inline-block">
                          {apt.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-sm font-bold text-slate-900">Today's Shift Hours</h3>
                <p className="text-xs text-slate-500">Active clinic working windows</p>
              </div>

              {data.todaySchedule?.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center italic">No working shift active today.</p>
              ) : (
                <div className="space-y-2">
                  {data.todaySchedule.map((shift) => (
                    <div key={shift._id} className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs font-mono font-bold flex items-center justify-between">
                      <span>{format12Hour(shift.startTime)} — {format12Hour(shift.endTime)}</span>
                      <span className="text-[10px] font-sans font-semibold text-blue-700">{shift.slotDurationMinutes}m slots</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-slate-100">
                <Link to="/provider/availability" className="w-full">
                  <Button variant="outline" size="sm" icon={Clock} className="w-full justify-center text-xs">
                    Manage Shift Schedule
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ProviderDashboardPage;
