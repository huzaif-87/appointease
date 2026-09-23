import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  UserCheck,
  Users,
  Briefcase,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  Plus,
  ArrowRight,
  ShieldCheck,
  Mail,
  Send,
  CheckCircle,
  XCircle
} from 'lucide-react';
import Card, { CardHeader } from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { getAdminOverview, sendAdminTestEmail } from '../../services/api';

export const AdminOverviewPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── TEMP: Email test state ───────────────────────────────────────────────────
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success, message }
  // ── END TEMP ─────────────────────────────────────────────────────────────────

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminOverview();
      setData(response?.data || response);
    } catch (err) {
      setError(err.message || 'Failed to retrieve admin overview metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Aggregated clinical metrics and live operational indicators queried from MongoDB
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOverview}
          isLoading={loading}
          icon={RefreshCw}
          className="self-start sm:self-auto"
        >
          Refresh Metrics
        </Button>
      </div>

      {/* Quick Action Navigation Buttons (Part 4 requirement) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/admin/providers?action=add">
          <Button variant="primary" size="sm" icon={Plus} className="w-full justify-center bg-teal-600 hover:bg-teal-700">
            Add Provider
          </Button>
        </Link>
        <Link to="/admin/services?action=add">
          <Button variant="primary" size="sm" icon={Plus} className="w-full justify-center bg-sky-600 hover:bg-sky-700">
            Add Service
          </Button>
        </Link>
        <Link to="/admin/availability">
          <Button variant="secondary" size="sm" icon={Clock} className="w-full justify-center">
            Manage Availability
          </Button>
        </Link>
        <Link to="/admin/appointments">
          <Button variant="secondary" size="sm" icon={Calendar} className="w-full justify-center">
            View Appointments
          </Button>
        </Link>
      </div>

      {loading ? (
        <Card className="py-16">
          <LoadingState message="Loading aggregated database metrics..." />
        </Card>
      ) : error ? (
        <ErrorState
          title="Overview Retrieval Notice"
          message={error}
          onRetry={fetchOverview}
        />
      ) : data ? (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/admin/appointments">
              <Card className="bg-white hover:border-teal-400 transition-all cursor-pointer shadow-2xs hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Appointments</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">
                      {data.kpis?.totalAppointments ?? 0}
                    </p>
                    <p className="text-[11px] text-teal-600 mt-1 font-semibold flex items-center">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Historical & Upcoming
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>
              </Card>
            </Link>

            <Link to="/admin/appointments?date=today">
              <Card className="bg-white hover:border-sky-400 transition-all cursor-pointer shadow-2xs hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Appointments</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">
                      {data.kpis?.todayAppointments ?? 0}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 font-medium flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      Scheduled for today
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
              </Card>
            </Link>

            <Link to="/admin/providers">
              <Card className="bg-white hover:border-emerald-400 transition-all cursor-pointer shadow-2xs hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Providers</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">
                      {data.kpis?.activeProviders ?? 0}
                    </p>
                    <p className="text-[11px] text-emerald-600 mt-1 font-semibold flex items-center">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {data.kpis?.totalProviders ?? 0} Total Doctors
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <UserCheck className="w-5 h-5" />
                  </div>
                </div>
              </Card>
            </Link>

            <Link to="/admin/users?role=PATIENT">
              <Card className="bg-white hover:border-indigo-400 transition-all cursor-pointer shadow-2xs hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered Patients</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">
                      {data.kpis?.registeredPatients ?? 0}
                    </p>
                    <p className="text-[11px] text-indigo-600 mt-1 font-semibold flex items-center">
                      <Users className="w-3 h-3 mr-1" />
                      PATIENT Role Accounts
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
              </Card>
            </Link>
          </div>

          {/* Appointments Status & Service Catalog */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Appointment Status Distribution</h3>
                  <p className="text-xs text-slate-500">Live counts calculated from active appointment documents</p>
                </div>
                <Link to="/admin/appointments" className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center">
                  <span>Manage All</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Link to="/admin/appointments?status=CONFIRMED" className="p-4 rounded-xl bg-teal-50/70 border border-teal-200/80 hover:bg-teal-100/60 transition-colors">
                  <span className="text-xs text-teal-900 font-extrabold block">CONFIRMED</span>
                  <div className="text-2xl font-black text-teal-950 mt-1">
                    {data.appointmentsByStatus?.CONFIRMED ?? 0}
                  </div>
                  <span className="text-[10px] text-teal-700 font-medium">Upcoming visits</span>
                </Link>

                <Link to="/admin/appointments?status=COMPLETED" className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 hover:bg-blue-100/60 transition-colors">
                  <span className="text-xs text-blue-900 font-extrabold block">COMPLETED</span>
                  <div className="text-2xl font-black text-blue-950 mt-1">
                    {data.appointmentsByStatus?.COMPLETED ?? 0}
                  </div>
                  <span className="text-[10px] text-blue-700 font-medium">Past consultations</span>
                </Link>

                <Link to="/admin/appointments?status=CANCELLED" className="p-4 rounded-xl bg-rose-50/70 border border-rose-200/80 hover:bg-rose-100/60 transition-colors">
                  <span className="text-xs text-rose-900 font-extrabold block">CANCELLED</span>
                  <div className="text-2xl font-black text-rose-950 mt-1">
                    {data.appointmentsByStatus?.CANCELLED ?? 0}
                  </div>
                  <span className="text-[10px] text-rose-700 font-medium">With audit reasons</span>
                </Link>

                <Link to="/admin/appointments?status=NO_SHOW" className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 hover:bg-amber-100/60 transition-colors">
                  <span className="text-xs text-amber-900 font-extrabold block">NO_SHOW</span>
                  <div className="text-2xl font-black text-amber-950 mt-1">
                    {data.appointmentsByStatus?.NO_SHOW ?? 0}
                  </div>
                  <span className="text-[10px] text-amber-700 font-medium">Missed appointments</span>
                </Link>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Clinical Service Catalog</h3>
                  <p className="text-xs text-slate-500">Configured medical services</p>
                </div>
                <Link to="/admin/services" className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center">
                  <span>Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center space-x-2.5">
                    <Briefcase className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-bold text-slate-800">Total Services</span>
                  </div>
                  <span className="text-xl font-extrabold text-slate-900">
                    {data.kpis?.totalServices ?? 0}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200/70 text-xs text-slate-600 space-y-1">
                  <div className="font-bold text-teal-950 flex items-center">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1 text-teal-600" />
                    Authoritative Backend RBAC
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    All administrative operations enforce strict JWT verification (`protect` + `requireRole('ADMIN')`) at database layer.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {/* ── TEMP: Email Delivery Test Card ────────────────────────────────────────── */}
      <Card className="border-2 border-dashed border-amber-300 bg-amber-50/40">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-5 h-5 text-amber-600" />
            <h2 className="text-sm font-bold text-amber-800">Email Delivery Test</h2>
            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-700 uppercase tracking-wide">Temporary</span>
          </div>
          <p className="text-xs text-amber-700 mb-4">
            Sends a real booking-confirmation email via Resend to verify the email integration is working on Render.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="test-email-input"
              type="email"
              value={testEmail}
              onChange={e => { setTestEmail(e.target.value); setTestResult(null); }}
              placeholder="Enter recipient email address..."
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder-slate-400"
            />
            <button
              id="send-test-email-btn"
              disabled={testSending || !testEmail}
              onClick={async () => {
                setTestSending(true);
                setTestResult(null);
                try {
                  const res = await sendAdminTestEmail({ to: testEmail });
                  setTestResult({ success: true, message: res.message || 'Email sent successfully!' });
                } catch (err) {
                  setTestResult({ success: false, message: err.response?.data?.message || err.message || 'Send failed' });
                } finally {
                  setTestSending(false);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {testSending ? 'Sending...' : 'Send Test'}
            </button>
          </div>

          {testResult && (
            <div className={`mt-3 flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
              testResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {testResult.success
                ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      </Card>
      {/* ── END TEMP ─────────────────────────────────────────────────────────────── */}

    </div>
  );
};

export default AdminOverviewPage;
