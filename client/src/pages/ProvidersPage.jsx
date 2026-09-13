import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  MapPin,
  Award,
  Clock,
  ArrowRight,
  Filter,
  X,
  SlidersHorizontal,
  UserCheck,
  Briefcase
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import { getProviders } from '../services/api';

export const ProvidersPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states initialized from URL parameters
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedSpecialty, setSelectedSpecialty] = useState(searchParams.get('specialty') || 'ALL');
  const [selectedLocation, setSelectedLocation] = useState(searchParams.get('location') || 'ALL');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const specialties = [
    'ALL',
    'General Medicine',
    'Cardiology',
    'Dermatology',
    'Dental Surgery',
    'Orthopedics',
    'Physiotherapy',
    'Clinical Nutrition',
    'Psychiatry & Wellness',
    'Pediatrics',
    'Ophthalmology'
  ];

  const locations = [
    'ALL',
    'Chennai',
    'Bangalore',
    'Hyderabad',
    'Mumbai',
    'Pune',
    'Delhi',
    'Coimbatore'
  ];

  // Debounced search term
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Sync state to URL search parameters
  useEffect(() => {
    const params = {};
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (selectedSpecialty && selectedSpecialty !== 'ALL') params.specialty = selectedSpecialty;
    if (selectedLocation && selectedLocation !== 'ALL') params.location = selectedLocation;
    const serviceId = searchParams.get('serviceId');
    if (serviceId) params.serviceId = serviceId;
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, selectedSpecialty, selectedLocation, setSearchParams]);

  // Fetch active providers matching filters
  const fetchProviders = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = { status: 'ACTIVE' };
      if (debouncedSearch.trim()) query.search = debouncedSearch.trim();
      if (selectedSpecialty && selectedSpecialty !== 'ALL') query.specialty = selectedSpecialty;
      if (selectedLocation && selectedLocation !== 'ALL') query.location = selectedLocation;
      const serviceId = searchParams.get('serviceId');
      if (serviceId) query.serviceId = serviceId;

      const response = await getProviders(query);
      setProviders(response?.data?.providers || []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve healthcare providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, [debouncedSearch, selectedSpecialty, selectedLocation, searchParams.get('serviceId')]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedSpecialty('ALL');
    setSelectedLocation('ALL');
  };

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    selectedSpecialty !== 'ALL' ||
    selectedLocation !== 'ALL' ||
    Boolean(searchParams.get('serviceId'));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Verified Specialists</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse certified doctors and healthcare practitioners with transparent clinic schedules
          </p>
        </div>
        <div className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 self-start sm:self-auto">
          Found <strong className="text-slate-800">{providers.length}</strong> active practitioners
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by doctor name, qualification, or clinic..."
              className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Specialty Select */}
          <div className="sm:col-span-3">
            <select
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            >
              {specialties.map((spec) => (
                <option key={spec} value={spec}>
                  {spec === 'ALL' ? 'All Medical Specialties' : spec}
                </option>
              ))}
            </select>
          </div>

          {/* Location Select */}
          <div className="sm:col-span-3">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            >
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc === 'ALL' ? 'All Practice Cities' : loc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filter Chips & Clear Action */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-slate-400 font-medium">Applied Filters:</span>
            {debouncedSearch && (
              <span className="inline-flex items-center text-xs px-2.5 py-1 bg-teal-50 text-teal-800 rounded-md border border-teal-200">
                Keyword: "{debouncedSearch}"
                <X
                  className="w-3 h-3 ml-1.5 cursor-pointer"
                  onClick={() => setSearchTerm('')}
                />
              </span>
            )}
            {selectedSpecialty !== 'ALL' && (
              <span className="inline-flex items-center text-xs px-2.5 py-1 bg-teal-50 text-teal-800 rounded-md border border-teal-200">
                {selectedSpecialty}
                <X
                  className="w-3 h-3 ml-1.5 cursor-pointer"
                  onClick={() => setSelectedSpecialty('ALL')}
                />
              </span>
            )}
            {selectedLocation !== 'ALL' && (
              <span className="inline-flex items-center text-xs px-2.5 py-1 bg-teal-50 text-teal-800 rounded-md border border-teal-200">
                {selectedLocation}
                <X
                  className="w-3 h-3 ml-1.5 cursor-pointer"
                  onClick={() => setSelectedLocation('ALL')}
                />
              </span>
            )}
            <button
              onClick={handleClearFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium ml-2"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Providers Grid */}
      {loading ? (
        <Card className="py-16">
          <LoadingState message="Loading verified healthcare specialists..." />
        </Card>
      ) : error ? (
        <ErrorState
          title="Error Loading Providers"
          message={error}
          onRetry={fetchProviders}
        />
      ) : providers.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No Specialists Matching Your Filters"
          description="Try broadening your search criteria or resetting your city and specialty filters."
          actionLabel="Reset All Filters"
          onAction={handleClearFilters}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((provider) => (
            <Card
              key={provider._id}
              hover
              className="flex flex-col justify-between p-6 border-slate-200/90"
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

                <h3 className="text-base font-bold text-slate-900 mb-0.5">
                  {provider.name}
                </h3>

                <p className="text-xs font-semibold text-teal-600 mb-1">
                  {provider.specialty}
                </p>

                <p className="text-xs text-slate-500 mb-3">
                  {provider.qualification}
                </p>

                <div className="flex items-center space-x-4 text-xs text-slate-500 mb-4">
                  <span className="flex items-center">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mr-1" />
                    {provider.location}
                  </span>
                  <span className="flex items-center">
                    <Award className="w-3.5 h-3.5 text-slate-400 mr-1" />
                    {provider.experienceYears}+ years
                  </span>
                </div>

                {/* Services List Preview */}
                {provider.serviceIds && provider.serviceIds.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1.5">
                      Offered Consultations:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {provider.serviceIds.slice(0, 2).map((srv) => (
                        <span
                          key={srv._id || srv}
                          className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium truncate max-w-[180px]"
                        >
                          {srv.name || 'General Consultation'}
                        </span>
                      ))}
                      {provider.serviceIds.length > 2 && (
                        <span className="text-[10px] px-1.5 py-0.5 text-slate-400 font-medium">
                          +{provider.serviceIds.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <Link
                  to={`/providers/${provider._id}`}
                  className="flex-1 text-center py-2 px-3 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  View Profile
                </Link>
                <Link
                  to={`/book?provider=${provider._id}`}
                  className="flex-1 text-center py-2 px-3 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-xs"
                >
                  Book Visit
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProvidersPage;
