import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  Search,
  ShieldCheck,
  UserCheck,
  User,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { getAdminUsers, updateAdminUser } from '../../services/api';

const formatFriendlyDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const AdminUsersPage = () => {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') || '';

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedRole, setSelectedRole] = useState(initialRole);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUserRole, setEditingUserRole] = useState(null);
  const [targetRole, setTargetRole] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminUsers({
        role: selectedRole || undefined,
        search: search || undefined,
        page,
        limit: 15
      });
      setUsers(res?.data?.users || []);
      setPagination(res?.data?.pagination || { page: 1, limit: 15, total: 0, pages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to retrieve system user accounts');
    } finally {
      setLoading(false);
    }
  }, [selectedRole, search, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenRoleModal = (user) => {
    setEditingUserRole(user);
    setTargetRole(user.role);
    setModalError(null);
  };

  const handleUpdateUserRole = async (e) => {
    e.preventDefault();
    if (!editingUserRole || !targetRole) return;

    setIsSubmitting(true);
    setModalError(null);

    try {
      await updateAdminUser(editingUserRole._id, { role: targetRole });
      setEditingUserRole(null);
      fetchUsers();
    } catch (err) {
      setModalError(err.message || 'Failed to update user role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 text-teal-400 border border-slate-700">ADMIN</span>;
      case 'PROVIDER':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">PROVIDER</span>;
      case 'PATIENT':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">PATIENT</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{role}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">System Users & Access Control</h1>
          <p className="text-xs text-slate-500 mt-1">
            Directory of registered patients, healthcare providers, and system administrators
          </p>
        </div>
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchUsers} isLoading={loading}>
          Refresh Users
        </Button>
      </div>

      {/* Filter Bar & Tabs */}
      <Card className="p-4 bg-white space-y-4">
        {/* Role Tabs (Part 9 requirement) */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          {[
            { label: 'All Accounts', value: '' },
            { label: 'Patients', value: 'PATIENT' },
            { label: 'Providers', value: 'PROVIDER' },
            { label: 'Administrators', value: 'ADMIN' }
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setSelectedRole(tab.value);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedRole === tab.value
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search users by name, email address, or phone number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>
      </Card>

      {/* Users Data Table */}
      {loading ? (
        <Card className="py-16">
          <LoadingState message="Loading system users directory..." />
        </Card>
      ) : error ? (
        <ErrorState title="Users Load Failure" message={error} onRetry={fetchUsers} />
      ) : users.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Users Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No user accounts match your selected role tab or search term.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0 border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">User Name</th>
                  <th className="p-3.5">Email Address</th>
                  <th className="p-3.5">Phone</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Registered Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">{u.name}</td>
                    <td className="p-3.5 font-medium text-slate-700">{u.email}</td>
                    <td className="p-3.5 font-mono text-slate-600">{u.phone || 'N/A'}</td>
                    <td className="p-3.5">{getRoleBadge(u.role)}</td>
                    <td className="p-3.5 font-medium text-slate-600">{formatFriendlyDate(u.createdAt)}</td>
                    <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedUser(u)}
                        title="View User Details"
                        className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenRoleModal(u)}
                        title="Modify Access Role"
                        className="p-1.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-[11px] px-2 transition-colors"
                      >
                        Edit Role
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

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-white shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{selectedUser.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">System User Profile & Access Info</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Email Address:</span>
                <span className="font-medium text-slate-900">{selectedUser.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Phone Number:</span>
                <span className="font-mono font-medium text-slate-900">{selectedUser.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Account Role:</span>
                <div>{getRoleBadge(selectedUser.role)}</div>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="font-semibold text-slate-500">Registration Date:</span>
                <span className="font-medium text-slate-900">{formatFriendlyDate(selectedUser.createdAt)}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setSelectedUser(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingUserRole && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-white shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Modify User Role</h3>
                <p className="text-xs text-slate-500 mt-0.5">Account: {editingUserRole.name} ({editingUserRole.email})</p>
              </div>
              <button onClick={() => setEditingUserRole(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p>{modalError}</p>
              </div>
            )}

            <form onSubmit={handleUpdateUserRole} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">Assign Access Role</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-bold"
                >
                  <option value="PATIENT">PATIENT (Standard Patient Account)</option>
                  <option value="PROVIDER">PROVIDER (Doctor / Specialist Account)</option>
                  <option value="ADMIN">ADMIN (System Administrator)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditingUserRole(null)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" variant="primary" isLoading={isSubmitting} className="bg-slate-900 hover:bg-slate-800 text-white font-bold">
                  Update Role
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
