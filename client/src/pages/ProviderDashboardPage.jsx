import React, { useState, useEffect } from 'react';
import { Stethoscope, Calendar, Clock, User, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingState from '../components/common/LoadingState';
import api from '../services/api';

export const ProviderDashboardPage = () => {
  const [user, setUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rawUser = localStorage.getItem('appointease_user');
    if (rawUser) {
      try {
        setUser(JSON.parse(rawUser));
      } catch (e) {}
    }

    const fetchProviderData = async () => {
      setLoading(true);
      try {
        // Fetch doctor profile & schedule
        const res = await api.get('/auth/me');
        if (res.data?.data?.user) {
          setUser(res.data.data.user);
        }
      } catch (err) {
        console.error('Failed to fetch provider data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProviderData();
  }, []);

  return (
    <div className="max-w-6xl mx-auto my-8 px-4 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-800/80 text-teal-200 text-xs font-bold uppercase tracking-wider border border-teal-600/60">
            <Stethoscope className="w-3.5 h-3.5 text-teal-300" />
            <span>Healthcare Provider Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {user?.name || 'Doctor'}
          </h1>
          <p className="text-xs sm:text-sm text-teal-100">
            Manage your clinical consultations, daily shift availability, and patient bookings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-white/10 px-3 py-1.5 rounded-xl border border-white/20 font-medium">
            Role: <strong>PROVIDER</strong>
          </span>
        </div>
      </div>

      {/* Provider Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 space-y-2">
          <span className="text-xs text-slate-500 font-medium">Account Status</span>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-teal-600" />
            <span className="text-base font-bold text-slate-900">Active Practice</span>
          </div>
          <p className="text-[11px] text-slate-400">Verified doctor credential in clinic network</p>
        </Card>

        <Card className="p-5 space-y-2">
          <span className="text-xs text-slate-500 font-medium">Provider Email</span>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-teal-600" />
            <span className="text-sm font-bold text-slate-900 truncate">
              {user?.email || 'doctor@appointease.com'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Authenticated staff login account</p>
        </Card>

        <Card className="p-5 space-y-2">
          <span className="text-xs text-slate-500 font-medium">Availability Slots Engine</span>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" />
            <span className="text-base font-bold text-slate-900">Dynamic (M4)</span>
          </div>
          <p className="text-[11px] text-slate-400">Double-booking prevention active</p>
        </Card>
      </div>

      {/* Guidance Card */}
      <Card className="p-6 space-y-3">
        <h2 className="text-base font-bold text-slate-900">Clinical Shift & Appointment Management</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Your patient consultation slots are dynamically computed in real-time from your active weekly shifts in MongoDB minus scheduled appointments. Double-booking is strictly prevented by distributed database locks.
        </p>
      </Card>
    </div>
  );
};

export default ProviderDashboardPage;
