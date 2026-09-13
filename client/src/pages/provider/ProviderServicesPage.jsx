import React, { useState, useEffect } from 'react';
import { Stethoscope, DollarSign, Clock, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { getProviderConsoleServices } from '../../services/api';

export default function ProviderServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getProviderConsoleServices();
      if (res.data && res.data.success) {
        setServices(res.data.data.services || []);
      }
    } catch (err) {
      console.error('Failed to fetch provider services:', err);
      setError(err.response?.data?.message || 'Failed to load assigned services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Assigned Services</h1>
        <p className="text-sm text-slate-500 mt-1">
          View clinical services and procedures assigned to your profile in the system catalog.
        </p>
      </div>

      {/* Info Notice */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-sm flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-semibold text-blue-900">Global Catalog Governance</h4>
          <p className="mt-0.5 text-blue-700">
            System-wide medical service definitions, prices, and durations are managed centrally by the Administrator. Contact Admin to adjust clinical pricing or register new procedures.
          </p>
        </div>
      </div>

      {/* Services List */}
      {loading ? (
        <div className="flex justify-center items-center py-20 bg-white rounded-xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : services.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No Services Assigned</h3>
          <p className="text-sm text-slate-500 mt-1">You currently have no services explicitly assigned in your profile.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((service) => (
            <div key={service._id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-emerald-200 transition-colors">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                  {service.category || 'General'}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-base">{service.name}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{service.description || 'No description provided.'}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-slate-600">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>{service.durationMinutes || service.duration || 30} mins</span>
                </div>
                <div className="flex items-center gap-1 font-bold text-slate-900 text-sm">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>{service.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
