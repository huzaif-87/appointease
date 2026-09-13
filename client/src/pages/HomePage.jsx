import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  CalendarCheck,
  Clock,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  Award,
  Sparkles,
  HeartPulse
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingState from '../components/common/LoadingState';
import { getServices, getProviders } from '../services/api';
import SmartSchedulingWidget from '../components/home/SmartSchedulingWidget';

export const HomePage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadHomeData = async () => {
      try {
        const [servicesData, providersData] = await Promise.all([
          getServices({ limit: 6, status: 'ACTIVE' }),
          getProviders({ limit: 4, status: 'ACTIVE' })
        ]);
        if (isMounted) {
          setServices(servicesData?.data?.services || []);
          setProviders(providersData?.data?.providers || []);
        }
      } catch (err) {
        console.error('Failed to load home page data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadHomeData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/providers?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate('/providers');
    }
  };

  const quickSpecialties = [
    'General Medicine',
    'Cardiology',
    'Dermatology',
    'Dental Surgery',
    'Orthopedics',
    'Physiotherapy'
  ];

  return (
    <div className="space-y-16 pb-12">
      {/* 1. HERO SECTION */}
      <section className="text-center max-w-4xl mx-auto pt-6 space-y-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Verified Healthcare Specialists • Zero Double-Booking Guarantee</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Find and Book Consultations with <br className="hidden sm:inline" />
          <span className="text-teal-600">Top Healthcare Specialists</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Access verified physicians, dentists, and physiotherapists across India.
          View recurring clinic hours and book consultations with confidence.
        </p>

        {/* Hero Search Box */}
        <form
          onSubmit={handleSearchSubmit}
          className="max-w-2xl mx-auto bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-300/80 shadow-md flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1 flex items-center">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by doctor name, specialty, or clinic location..."
              className="w-full pl-11 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <Button type="submit" variant="primary" size="md" className="sm:px-6">
            Find Providers
          </Button>
        </form>

        {/* Quick Filter Specialty Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs text-slate-500">
          <span className="font-medium text-slate-600 mr-1">Popular Specialties:</span>
          {quickSpecialties.map((spec) => (
            <Link
              key={spec}
              to={`/providers?specialty=${encodeURIComponent(spec)}`}
              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 font-medium transition-colors border border-slate-200/60"
            >
              {spec}
            </Link>
          ))}
        </div>

        {/* Dual Primary CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link to="/providers">
            <Button variant="primary" size="lg" icon={UserCheck}>
              Find a Provider
            </Button>
          </Link>
          <Link to="/services">
            <Button variant="outline" size="lg" icon={HeartPulse}>
              Browse Services
            </Button>
          </Link>
        </div>
      </section>

      {/* 1.5 SMART TIME RECOMMENDATION (AI POWERED) */}
      <SmartSchedulingWidget />

      {/* 2. POPULAR SERVICES (REAL DATA FROM MONGODB) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600">Clinical Specialties</span>
            <h2 className="text-2xl font-bold text-slate-900 mt-0.5">Popular Services</h2>
            <p className="text-xs text-slate-500">Comprehensive consultations across specialized healthcare departments</p>
          </div>
          <Link
            to="/services"
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center"
          >
            <span>View all 18 services</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        {loading ? (
          <Card className="py-12">
            <LoadingState message="Loading clinical services catalog..." />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((service) => (
              <Card
                key={service._id}
                hover
                className="flex flex-col justify-between p-5 border-slate-200/90"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/60">
                      {service.category}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      ₹{service.price}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 line-clamp-1 mb-1.5">
                    {service.name}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                    {service.description || 'Professional healthcare consultation and clinical examination.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center">
                    <Clock className="w-3.5 h-3.5 text-slate-400 mr-1" />
                    {service.durationMinutes} mins
                  </span>

                  <div className="flex items-center space-x-2">
                    <Link
                      to={`/services/${service._id}`}
                      className="font-medium text-slate-600 hover:text-slate-900 text-[11px]"
                    >
                      Details
                    </Link>
                    <Link
                      to={`/providers?serviceId=${service._id}`}
                      className="font-semibold text-teal-600 hover:text-teal-700 text-[11px] flex items-center"
                    >
                      <span>Providers</span>
                      <ArrowRight className="w-3 h-3 ml-0.5" />
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 3. FEATURED SPECIALISTS (REAL DATA FROM MONGODB) */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600">Verified Practitioners</span>
            <h2 className="text-2xl font-bold text-slate-900 mt-0.5">Featured Healthcare Providers</h2>
            <p className="text-xs text-slate-500">Board-certified doctors with verified clinic locations across India</p>
          </div>
          <Link
            to="/providers"
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center"
          >
            <span>Explore all 35 providers</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        {loading ? (
          <Card className="py-12">
            <LoadingState message="Loading verified practitioners..." />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {providers.map((provider) => (
              <Card
                key={provider._id}
                hover
                className="flex flex-col justify-between p-5 border-slate-200/90 text-left"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm">
                      {provider.name.replace('Dr. ', '').split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Verified
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 line-clamp-1">
                    {provider.name}
                  </h3>

                  <p className="text-xs font-semibold text-teal-600 mb-1">
                    {provider.specialty}
                  </p>

                  <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">
                    {provider.qualification}
                  </p>

                  <div className="flex items-center text-xs text-slate-500 space-x-3 mb-4">
                    <span className="flex items-center text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 mr-1" />
                      {provider.location}
                    </span>
                    <span className="flex items-center text-[11px]">
                      <Award className="w-3.5 h-3.5 text-slate-400 mr-1" />
                      {provider.experienceYears}+ yrs exp
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {provider.consultationDuration} min session
                  </span>
                  <Link
                    to={`/providers/${provider._id}`}
                    className="inline-flex items-center text-xs font-semibold text-teal-600 hover:text-teal-700"
                  >
                    <span>View Profile</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 4. HOW IT WORKS */}
      <section className="bg-slate-100/70 border border-slate-200 rounded-2xl p-8 sm:p-10 space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-600">Simplicity & Transparency</span>
          <h2 className="text-2xl font-bold text-slate-900">How AppointEase Works</h2>
          <p className="text-xs text-slate-500">Book consultations in three streamlined, conflict-free steps</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl bg-white border border-slate-200 text-left space-y-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 font-bold text-base flex items-center justify-center border border-teal-100">
              1
            </div>
            <h4 className="text-sm font-bold text-slate-900">Find the Right Specialist</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Filter by specialty, qualifications, experience, and city location across major healthcare hubs.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 text-left space-y-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-700 font-bold text-base flex items-center justify-center border border-sky-100">
              2
            </div>
            <h4 className="text-sm font-bold text-slate-900">Inspect Real-Time Working Hours</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Check weekly clinic shifts and verified availability schedules for your chosen practitioner.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 text-left space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-base flex items-center justify-center border border-emerald-100">
              3
            </div>
            <h4 className="text-sm font-bold text-slate-900">Conflict-Free Confirmation</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Select date and time with database-level concurrency protection guaranteeing zero double-booking.
            </p>
          </div>
        </div>
      </section>

      {/* 5. TRUST & REASSURANCE */}
      <section className="border-t border-slate-200 pt-10 text-center">
        <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-slate-700">
          <div>
            <div className="text-2xl font-extrabold text-teal-600">35+</div>
            <p className="text-xs text-slate-500 mt-1">Verified Doctors</p>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-teal-600">18</div>
            <p className="text-xs text-slate-500 mt-1">Clinical Specialties</p>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-teal-600">7</div>
            <p className="text-xs text-slate-500 mt-1">Metropolitan Cities</p>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-teal-600">100%</div>
            <p className="text-xs text-slate-500 mt-1">Conflict-Free Sync</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
