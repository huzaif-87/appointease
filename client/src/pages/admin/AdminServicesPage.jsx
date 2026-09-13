import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Briefcase,
  Clock,
  DollarSign,
  UserCheck,
  Edit,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import {
  getAdminServices,
  createAdminService,
  updateAdminService
} from '../../services/api';

export const AdminServicesPage = () => {
  const [searchParams] = useSearchParams();
  const openAddOnLoad = searchParams.get('action') === 'add';

  const [services, setServices] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(openAddOnLoad);
  const [editingService, setEditingService] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'General Consultation',
    durationMinutes: 30,
    price: 500,
    status: 'ACTIVE'
  });

  const knownCategories = [
    'General Consultation',
    'Cardiology',
    'Dermatology',
    'Orthopedics',
    'Pediatrics',
    'Neurology',
    'Dentistry',
    'ENT',
    'Ophthalmology',
    'Gynecology'
  ];

  const fetchServicesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminServices({
        search: search || undefined,
        category: selectedCategory || undefined,
        status: selectedStatus || undefined,
        page,
        limit: 15
      });
      setServices(res?.data?.services || []);
      setPagination(res?.data?.pagination || { page: 1, limit: 15, total: 0, pages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to retrieve clinical services catalog');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedStatus, page]);

  useEffect(() => {
    fetchServicesData();
  }, [fetchServicesData]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'General Consultation',
      durationMinutes: 30,
      price: 500,
      status: 'ACTIVE'
    });
    setModalError(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name || '',
      description: service.description || '',
      category: service.category || 'General Consultation',
      durationMinutes: service.durationMinutes || 30,
      price: service.price !== undefined ? service.price : 500,
      status: service.status || 'ACTIVE'
    });
    setModalError(null);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.category.trim()) {
      setModalError('Service Name and Category are required.');
      return;
    }

    const duration = parseInt(formData.durationMinutes, 10);
    if (isNaN(duration) || duration <= 0) {
      setModalError('Duration must be a positive number of minutes.');
      return;
    }

    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum < 0) {
      setModalError('Price must be a valid non-negative number.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      if (editingService) {
        await updateAdminService(editingService._id, formData);
        setEditingService(null);
      } else {
        await createAdminService(formData);
        setIsAddModalOpen(false);
      }
      resetForm();
      fetchServicesData();
    } catch (err) {
      setModalError(err.message || 'Failed to save service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (service) => {
    const newStatus = service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateAdminService(service._id, { status: newStatus });
      fetchServicesData();
    } catch (err) {
      alert(err.message || 'Failed to update service status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Clinical Services Catalog</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure medical consultation categories, durations, consultation fees, and active catalog statuses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchServicesData} isLoading={loading}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenAddModal} className="bg-sky-600 hover:bg-sky-700">
            Add New Service
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-white space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search service name, category, description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="">All Categories</option>
              {knownCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Services Table */}
      {loading ? (
        <Card className="py-16">
          <LoadingState message="Loading clinical services catalog..." />
        </Card>
      ) : error ? (
        <ErrorState title="Services Load Failure" message={error} onRetry={fetchServicesData} />
      ) : services.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Clinical Services Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No clinical service entries match your search criteria.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0 border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Service Name</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Duration</th>
                  <th className="p-3.5">Consultation Fee</th>
                  <th className="p-3.5">Assigned Providers</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {services.map((srv) => (
                  <tr key={srv._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{srv.name}</div>
                      {srv.description && (
                        <div className="text-[11px] text-slate-500 line-clamp-1">{srv.description}</div>
                      )}
                    </td>
                    <td className="p-3.5 font-bold text-sky-800">{srv.category}</td>
                    <td className="p-3.5 font-semibold text-slate-700 font-mono">{srv.durationMinutes} Mins</td>
                    <td className="p-3.5 font-extrabold text-slate-900">₹{srv.price}</td>
                    <td className="p-3.5">
                      <span className="bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                        {srv.providerCount || 0} Doctor{(srv.providerCount || 0) === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {srv.status === 'ACTIVE' ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          INACTIVE
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEditModal(srv)}
                        title="Edit Service"
                        className="p-1.5 rounded bg-sky-50 hover:bg-sky-100 text-sky-700 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(srv)}
                        title={srv.status === 'ACTIVE' ? 'Deactivate Service' : 'Activate Service'}
                        className={`p-1.5 rounded font-bold text-[11px] px-2 transition-colors ${
                          srv.status === 'ACTIVE'
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {srv.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
              <span>
                Page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong> ({pagination.total} total)
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  icon={ChevronLeft}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                  icon={ChevronRight}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Add / Edit Service Modal */}
      {(isAddModalOpen || editingService) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-white shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingService ? 'Edit Clinical Service' : 'Add New Clinical Service'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set service name, duration, consultation fee, and category
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingService(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p>{modalError}</p>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Service Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. General Health Consultation"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  {knownCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Duration (Minutes) *</label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    required
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Clinical description of consultation scope..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingService(null);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" variant="primary" isLoading={isSubmitting} className="bg-sky-600 hover:bg-sky-700">
                  {editingService ? 'Save Service Changes' : 'Create Service'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminServicesPage;
