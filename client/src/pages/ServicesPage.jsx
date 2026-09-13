import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Clock,
  ArrowRight,
  Briefcase,
  X,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import { getServices } from '../services/api';

export const ServicesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states initialized from URL params
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'ALL');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const categories = [
    'ALL',
    'General Consultation',
    'Cardiology Consultation',
    'Dermatology Consultation',
    'Dental Consultation',
    'Orthopedic Consultation',
    'Physiotherapy',
    'Nutrition Consultation',
    'Mental Wellness Consultation',
    'Pediatric Consultation',
    'Ophthalmology Consultation'
  ];

  // Debounced search query
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
    if (selectedCategory && selectedCategory !== 'ALL') params.category = selectedCategory;
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, selectedCategory, setSearchParams]);

  // Fetch services when search or category changes
  const fetchServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = { status: 'ACTIVE' };
      if (debouncedSearch.trim()) query.search = debouncedSearch.trim();
      if (selectedCategory && selectedCategory !== 'ALL') query.category = selectedCategory;

      const response = await getServices(query);
      setServices(response?.data?.services || []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve healthcare services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [debouncedSearch, selectedCategory]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('ALL');
  };

  const hasActiveFilters = Boolean(searchTerm.trim()) || selectedCategory !== 'ALL';

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Clinical Services</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse specialized outpatient consultations, diagnostic reviews, and wellness therapies
          </p>
        </div>
        <div className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 self-start sm:self-auto">
          Showing <strong className="text-slate-800">{services.length}</strong> available services
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search services by keyword, category, or specialty..."
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

          {/* Filter Trigger on Mobile */}
          <Button
            variant="outline"
            className="sm:hidden flex items-center justify-center"
            icon={SlidersHorizontal}
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
          >
            Filters {selectedCategory !== 'ALL' && `(1)`}
          </Button>

          {/* Reset Action */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="md"
              onClick={handleClearFilters}
              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Category Pills (Desktop & Mobile Dropdown) */}
        <div className={`flex flex-wrap gap-2 ${mobileFilterOpen ? 'block' : 'hidden sm:flex'}`}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setMobileFilterOpen(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-teal-600 text-white shadow-xs font-semibold'
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {cat === 'ALL' ? 'All Categories' : cat.replace(' Consultation', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Services Grid Content */}
      {loading ? (
        <Card className="py-16">
          <LoadingState message="Loading specialized services..." />
        </Card>
      ) : error ? (
        <ErrorState
          title="Error Loading Services"
          message={error}
          onRetry={fetchServices}
        />
      ) : services.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No Matching Services Found"
          description="We could not find any services matching your search or category filter. Try clearing your filters."
          actionLabel="Clear Filters"
          onAction={handleClearFilters}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <Card
              key={service._id}
              hover
              className="flex flex-col justify-between p-6 border-slate-200/90"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/70">
                    {service.category}
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    ₹{service.price}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 mb-2 leading-snug">
                  {service.name}
                </h3>

                <p className="text-xs text-slate-500 line-clamp-3 mb-4 leading-relaxed">
                  {service.description || 'Specialized clinical assessment with customized treatment plan and follow-up guidance.'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center">
                    <Clock className="w-3.5 h-3.5 text-slate-400 mr-1" />
                    Estimated {service.durationMinutes} mins
                  </span>
                  <span className="text-emerald-700 font-medium text-[11px] bg-emerald-50 px-2 py-0.5 rounded">
                    Active Service
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to={`/services/${service._id}`}
                    className="w-full inline-flex items-center justify-center text-xs font-semibold py-2 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    View Details
                  </Link>
                  <Link
                    to={`/providers?serviceId=${service._id}`}
                    className="w-full inline-flex items-center justify-center text-xs font-semibold py-2 px-3 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-xs"
                  >
                    <span>Providers</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServicesPage;
