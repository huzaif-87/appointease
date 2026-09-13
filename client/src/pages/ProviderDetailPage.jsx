import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Award,
  Clock,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import Card, { CardHeader } from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import { getProviderById, getProviderAvailability } from '../services/api';

export const ProviderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [provider, setProvider] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper to format "HH:MM" 24h string into readable "hh:mm AM/PM"
  const formatTime12h = (time24) => {
    if (!time24 || !time24.includes(':')) return time24;
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${mStr} ${ampm}`;
  };

  useEffect(() => {
    let isMounted = true;
    const fetchProviderProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const [providerData, availData] = await Promise.all([
          getProviderById(id),
          getProviderAvailability(id)
        ]);

        if (isMounted) {
          setProvider(providerData?.data || null);
          setAvailability(availData?.data?.weeklySchedule || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Provider profile not found');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProviderProfile();
    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <Card className="py-20 max-w-4xl mx-auto">
        <LoadingState message="Loading practitioner profile and clinic schedule..." />
      </Card>
    );
  }

  if (error || !provider) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <ErrorState
          title="Practitioner Not Found"
          message={error || 'The requested doctor or clinic profile does not exist.'}
          onRetry={() => navigate('/providers')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Back to Directory Link */}
      <div>
        <Link
          to="/providers"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          <span>Back to All Specialists</span>
        </Link>
      </div>

      {/* Profile Overview Card */}
      <Card className="p-8 border-teal-100 bg-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="w-20 h-20 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-extrabold text-2xl shadow-xs flex-shrink-0">
              {provider.name.replace('Dr. ', '').split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Verified Doctor
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-medium text-slate-500">{provider.qualification}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {provider.name}
              </h1>

              <p className="text-sm font-bold text-teal-700">
                {provider.specialty}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                <span className="flex items-center">
                  <MapPin className="w-4 h-4 text-slate-400 mr-1" />
                  {provider.location}, India
                </span>
                <span className="flex items-center">
                  <Award className="w-4 h-4 text-slate-400 mr-1" />
                  {provider.experienceYears}+ Years Clinical Experience
                </span>
                <span className="flex items-center">
                  <Clock className="w-4 h-4 text-slate-400 mr-1" />
                  {provider.consultationDuration} min standard session
                </span>
              </div>
            </div>
          </div>

          {/* Direct Booking CTA Header */}
          <div className="flex-shrink-0 flex flex-col justify-center space-y-2">
            <Link to={`/book?provider=${provider._id}`}>
              <Button variant="primary" size="lg" className="w-full sm:w-auto" icon={CalendarCheck}>
                Book Appointment
              </Button>
            </Link>
            <p className="text-[11px] text-center text-slate-400">
              Verified availability • No double-booking
            </p>
          </div>
        </div>
      </Card>

      {/* Biography & Credentials */}
      <Card>
        <CardHeader
          title="Practitioner Biography & Overview"
          subtitle="Clinical background, patient care methodology, and practice focus"
        />
        <div className="mt-4 text-sm text-slate-600 leading-relaxed space-y-3">
          <p>
            {provider.bio || `${provider.name} is an esteemed specialist in ${provider.specialty} with ${provider.experienceYears} years of dedicated practice in ${provider.location}. Known for clinical precision and attentive care.`}
          </p>
        </div>
      </Card>

      {/* 2-Column Grid: Weekly Availability + Services Offered */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Weekly Availability Schedule */}
        <div className="lg:col-span-6 space-y-4">
          <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Weekly Clinic Hours</h2>
              <p className="text-xs text-slate-500">Recurring consultation shifts from verified database schedule</p>
            </div>
            <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200/60">
              {availability.length} Active Days
            </span>
          </div>

          {availability.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
              No recurring clinic hours registered for this practitioner.
            </div>
          ) : (
            <div className="space-y-2.5">
              {availability.map((shift) => (
                <div
                  key={shift._id}
                  className="p-3.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between shadow-2xs hover:border-teal-200 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{shift.dayOfWeek}</h4>
                      <p className="text-[11px] text-slate-500">{shift.slotDurationMinutes} min consultations</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900 block">
                      {formatTime12h(shift.startTime)} – {formatTime12h(shift.endTime)}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium">Regular Shift</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Services Offered */}
        <div className="lg:col-span-6 space-y-4">
          <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Services & Consultations</h2>
              <p className="text-xs text-slate-500">Specialized treatments and consultation fees</p>
            </div>
            <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
              {provider.serviceIds?.length || 0} Services
            </span>
          </div>

          {(!provider.serviceIds || provider.serviceIds.length === 0) ? (
            <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
              General consultation provided by default.
            </div>
          ) : (
            <div className="space-y-3">
              {provider.serviceIds.map((srv) => (
                <div
                  key={srv._id}
                  className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between hover:border-slate-300 transition-colors shadow-2xs"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                      {srv.category}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{srv.name}</h4>
                    <p className="text-[11px] text-slate-500 flex items-center">
                      <Clock className="w-3 h-3 mr-1 text-slate-400" />
                      {srv.durationMinutes || provider.consultationDuration} Minutes Consultation
                    </p>
                  </div>

                  <div className="text-right flex flex-col items-end space-y-2">
                    <span className="text-sm font-extrabold text-slate-900">
                      ₹{srv.price}
                    </span>
                    <Link
                      to={`/book?provider=${provider._id}&service=${srv._id}`}
                      className="inline-flex items-center text-[11px] font-semibold text-teal-600 hover:text-teal-700"
                    >
                      <span>Book</span>
                      <ArrowRight className="w-3 h-3 ml-0.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProviderDetailPage;
