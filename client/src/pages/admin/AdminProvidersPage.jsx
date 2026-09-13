import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  UserCheck,
  Building,
  Award,
  Clock,
  Briefcase,
  CheckCircle2,
  XCircle,
  Edit,
  Eye,
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
  getAdminProviders,
  createAdminProvider,
  updateAdminProvider,
  getServices
} from '../../services/api';

export const AdminProvidersPage = () => {
  const [searchParams] = useSearchParams();
  const openAddOnLoad = searchParams.get('action') === 'add';

  const [providers, setProviders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);

  // Available Services Catalog for Provider creation
  const [servicesCatalog, setServicesCatalog] = useState([]);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(openAddOnLoad);
  const [editingProvider, setEditingProvider] = useState(null);
  const [viewingProvider, setViewingProvider] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialty: 'General Medicine',
    qualification: 'MBBS, MD',
    experienceYears: 5,
    bio: '',
    location: 'Bangalore',
    serviceIds: [],
    consultationDuration: 30,
    status: 'ACTIVE'
  });

  const knownSpecialties = [
    'General Medicine',
    'Cardiology',
    'Dermatology',
    'Orthopedics',
    'Pediatrics',
    'Neurology',
    'Dental Surgery',
    'ENT',
    'Ophthalmology',
    'Gynecology'
  ];

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await getServices();
        setServicesCatalog(res?.data?.services || []);
      } catch (err) {
        console.warn('Could not load services catalog:', err);
      }
    };
    fetchServices();
  }, []);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminProviders({
        search: search || undefined,
        specialty: selectedSpecialty || undefined,
        location: selectedLocation || undefined,
        status: selectedStatus || undefined,
        page,
        limit: 15
      });
      setProviders(res?.data?.providers || []);
      setPagination(res?.data?.pagination || { page: 1, limit: 15, total: 0, pages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to retrieve providers');
    } finally {
      setLoading(false);
    }
  }, [search, selectedSpecialty, selectedLocation, selectedStatus, page]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      specialty: 'General Medicine',
      qualification: 'MBBS, MD',
      experienceYears: 5,
      bio: '',
      location: 'Bangalore',
      serviceIds: [],
      consultationDuration: 30,
      status: 'ACTIVE'
    });
    setModalError(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (provider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name || '',
      email: provider.email || '',
      phone: provider.phone || '',
      specialty: provider.specialty || 'General Medicine',
      qualification: provider.qualification || '',
      experienceYears: provider.experienceYears || 0,
      bio: provider.bio || '',
      location: provider.location || '',
      serviceIds: (provider.serviceIds || []).map((s) => (typeof s === 'object' ? s._id : s)),
      consultationDuration: provider.consultationDuration || 30,
      status: provider.status || 'ACTIVE'
    });
    setModalError(null);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.specialty.trim() || !formData.qualification.trim() || !formData.location.trim()) {
      setModalError('Please fill out all required fields (Name, Email, Specialty, Qualification, Location).');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      if (editingProvider) {
        await updateAdminProvider(editingProvider._id, formData);
        setEditingProvider(null);
      } else {
        await createAdminProvider(formData);
        setIsAddModalOpen(false);
      }
      resetForm();
      fetchProviders();
    } catch (err) {
      setModalError(err.message || 'Failed to save provider details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (provider) => {
    const newStatus = provider.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateAdminProvider(provider._id, { status: newStatus });
      fetchProviders();
    } catch (err) {
      alert(err.message || 'Failed to update provider status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Healthcare Providers Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Register new medical practitioners, manage clinical specialties, location assignments, and active statuses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchProviders} isLoading={loading}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenAddModal} className="bg-teal-600 hover:bg-teal-700">
            Add New Provider
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
              placeholder="Search provider name, email, specialty, city..."
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
              value={selectedSpecialty}
              onChange={(e) => {
                setSelectedSpecialty(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="">All Specialties</option>
              {knownSpecialties.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
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

      {/* Providers Data Table */}
      {loading ? (
        <Card className="py-16">
          <LoadingState message="Loading healthcare providers catalog..." />
        </Card>
      ) : error ? (
        <ErrorState title="Providers Load Failure" message={error} onRetry={fetchProviders} />
      ) : providers.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <UserCheck className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Providers Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No healthcare practitioners match your search filters.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0 border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Provider Name</th>
                  <th className="p-3.5">Specialty & Qualification</th>
                  <th className="p-3.5">Experience</th>
                  <th className="p-3.5">Location</th>
                  <th className="p-3.5">Services Offered</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {providers.map((prov) => (
                  <tr key={prov._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{prov.name}</div>
                      <div className="text-[11px] text-slate-500">{prov.email}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-teal-800">{prov.specialty}</div>
                      <div className="text-[11px] text-slate-500">{prov.qualification}</div>
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">{prov.experienceYears} Years</td>
                    <td className="p-3.5 font-semibold text-slate-700">{prov.location}</td>
                    <td className="p-3.5">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-bold">
                        {prov.serviceIds?.length || 0} Service{(prov.serviceIds?.length || 0) === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {prov.status === 'ACTIVE' ? (
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
                        onClick={() => setViewingProvider(prov)}
                        title="View Details"
                        className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(prov)}
                        title="Edit Provider"
                        className="p-1.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(prov)}
                        title={prov.status === 'ACTIVE' ? 'Deactivate Provider' : 'Activate Provider'}
                        className={`p-1.5 rounded font-bold text-[11px] px-2 transition-colors ${
                          prov.status === 'ACTIVE'
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {prov.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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

      {/* Add / Edit Provider Modal */}
      {(isAddModalOpen || editingProvider) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <Card className="max-w-xl w-full p-6 space-y-4 bg-white shadow-2xl my-8">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingProvider ? 'Edit Healthcare Provider' : 'Register New Healthcare Provider'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingProvider ? 'Update practitioner qualifications, location, and offered services' : 'Fill out practitioner credentials to generate linked Provider and User accounts'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingProvider(null);
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

            <form onSubmit={handleSubmitForm} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Sharuk Shaik"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    disabled={!!editingProvider}
                    placeholder="dr.sharuk@appointease.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Medical Specialty *</label>
                  <select
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {knownSpecialties.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Qualifications *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MBBS, MD (Cardiology)"
                    value={formData.qualification}
                    onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Years of Experience</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.experienceYears}
                    onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Location / City *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bangalore, Chennai, Delhi"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Consultation Duration (Mins)</label>
                  <input
                    type="number"
                    min="10"
                    step="5"
                    value={formData.consultationDuration}
                    onChange={(e) => setFormData({ ...formData, consultationDuration: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Assigned Services</label>
                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50 max-h-32 overflow-y-auto space-y-1.5">
                  {servicesCatalog.map((srv) => (
                    <label key={srv._id} className="flex items-center space-x-2 text-slate-800">
                      <input
                        type="checkbox"
                        checked={formData.serviceIds.includes(srv._id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          let ids = [...formData.serviceIds];
                          if (checked) ids.push(srv._id);
                          else ids = ids.filter((id) => id !== srv._id);
                          setFormData({ ...formData, serviceIds: ids });
                        }}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span>{srv.name} ({srv.category}) — ₹{srv.price}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Professional Bio</label>
                <textarea
                  rows={2}
                  placeholder="Brief practitioner profile background..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingProvider(null);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" variant="primary" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
                  {editingProvider ? 'Save Provider Changes' : 'Create Provider'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Provider Details View Modal */}
      {viewingProvider && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-white shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{viewingProvider.name}</h3>
                <p className="text-xs text-teal-700 font-bold">{viewingProvider.specialty}</p>
              </div>
              <button onClick={() => setViewingProvider(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Email Address:</span>
                <span className="font-medium text-slate-900">{viewingProvider.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Phone:</span>
                <span className="font-medium text-slate-900">{viewingProvider.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Qualification:</span>
                <span className="font-bold text-slate-900">{viewingProvider.qualification}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Experience:</span>
                <span className="font-bold text-slate-900">{viewingProvider.experienceYears} Years</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Location:</span>
                <span className="font-bold text-slate-900">{viewingProvider.location}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Status:</span>
                <span className={`font-bold ${viewingProvider.status === 'ACTIVE' ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {viewingProvider.status}
                </span>
              </div>

              {viewingProvider.bio && (
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="font-bold block text-[11px] text-slate-600">Bio / Overview:</span>
                  <p>{viewingProvider.bio}</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setViewingProvider(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminProvidersPage;
