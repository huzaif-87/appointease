import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Briefcase,
  MapPin,
  Award,
  CalendarCheck,
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import Card, { CardHeader } from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import { getServiceById, getProviders } from '../services/api';

export const ServiceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [service, setService] = useState(null);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchServiceData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [serviceData, providersData] = await Promise.all([
          getServiceById(id),
          getProviders({ serviceId: id, status: 'ACTIVE' })
        ]);

        if (isMounted) {
          setService(serviceData?.data || null);
          setProviders(providersData?.data?.providers || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Service not found');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchServiceData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <Card className="py-20 max-w-4xl mx-auto">
        <LoadingState message="Loading service details and available practitioners..." />
      </Card>
    );
  }

  if (error || !service) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <ErrorState
          title="Service Not Found"
          message={error || 'The requested clinical service does not exist.'}
          onRetry={() => navigate('/services')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Back Link */}
      <div>
        <Link
          to="/services"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          <span>Back to All Services</span>
        </Link>
      </div>

      {/* Service Header Overview Card */}
      <Card className="p-8 border-teal-100 bg-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                {service.category}
              </span>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Active Consultation
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {service.name}
            </h1>

            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              {service.description || 'Comprehensive evaluation, diagnostic review, and personalized care plan.'}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
              <div className="flex items-center">
                <Clock className="w-4 h-4 text-slate-400 mr-1.5" />
                <span>Duration: <strong>{service.durationMinutes} Minutes</strong></span>
              </div>
              <div>•</div>
              <div className="flex items-center">
                <ShieldCheck className="w-4 h-4 text-teal-600 mr-1.5" />
                <span>Verified Practitioners: <strong>{providers.length} Available</strong></span>
              </div>
            </div>
          </div>

          {/* Pricing Box & CTA */}
          <div className="md:border-l md:border-slate-100 md:pl-8 flex flex-col justify-center space-y-4 flex-shrink-0">
            <div>
              <span className="text-xs text-slate-400 uppercase font-medium">Standard Consultation Fee</span>
              <div className="text-3xl font-extrabold text-slate-900 mt-0.5">
                ₹{service.price}
              </div>
            </div>

            <Link to={`/book?service=${service._id}`}>
              <Button variant="primary" size="lg" className="w-full sm:w-auto" icon={CalendarCheck}>
                Book this Service
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Providers Offering This Service */}
      <section className="space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-xl font-bold text-slate-900">
            Specialists Offering This Service ({providers.length})
          </h2>
          <p className="text-xs text-slate-500">
            Select a verified doctor to view their clinic hours and schedule your consultation
          </p>
        </div>

        {providers.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-sm text-slate-600">Currently, no providers are assigned to this service.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providers.map((provider) => (
              <Card
                key={provider._id}
                hover
                className="p-5 flex flex-col justify-between border-slate-200"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {provider.name}
                      </h3>
                      <p className="text-xs font-semibold text-teal-600">
                        {provider.specialty}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center bg-slate-100 px-2 py-0.5 rounded">
                      <MapPin className="w-3 h-3 mr-1 text-slate-400" />
                      {provider.location}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500">
                    {provider.qualification} • {provider.experienceYears}+ years experience
                  </p>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    to={`/providers/${provider._id}`}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    View Doctor Profile
                  </Link>

                  <Link
                    to={`/book?service=${service._id}&provider=${provider._id}`}
                    className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-xs"
                  >
                    <span>Select & Book</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ServiceDetailPage;
