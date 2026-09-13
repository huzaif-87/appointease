import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, MapPin, Award, BookOpen, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { getProviderConsoleProfile, updateProviderConsoleProfile } from '../../services/api';

export default function ProviderProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    specialty: '',
    qualification: '',
    experienceYears: 0,
    bio: '',
    location: ''
  });

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getProviderConsoleProfile();
      if (res.data && res.data.success) {
        const p = res.data.data.provider;
        setProfile(p);
        setFormData({
          name: p.name || '',
          phone: p.phone || '',
          specialty: p.specialty || '',
          qualification: p.qualification || '',
          experienceYears: p.experienceYears || 0,
          bio: p.bio || '',
          location: p.location || ''
        });
      }
    } catch (err) {
      console.error('Failed to fetch provider profile:', err);
      setError(err.response?.data?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setError(null);

    try {
      const res = await updateProviderConsoleProfile(formData);
      if (res.data && res.data.success) {
        setSuccessMsg('Profile details updated successfully!');
        setTimeout(() => setSuccessMsg(''), 4000);
        fetchProfile();
      }
    } catch (err) {
      console.error('Failed to update provider profile:', err);
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Clinician Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your public clinician details, contact information, and medical background.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20 bg-white rounded-xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          {/* Readonly Account Info */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase">Account Email (Verified)</label>
              <div className="flex items-center gap-2 mt-1 font-medium text-slate-800 text-sm">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{profile?.email || 'N/A'}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase">Role Authorization</label>
              <div className="mt-1">
                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                  HEALTHCARE PROVIDER
                </span>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Specialty</label>
              <input
                type="text"
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., Cardiology, General Practice"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Qualification</label>
              <input
                type="text"
                value={formData.qualification}
                onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., MD, MBBS, FACC"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Years of Experience</label>
              <input
                type="number"
                min="0"
                value={formData.experienceYears}
                onChange={(e) => setFormData({ ...formData, experienceYears: parseInt(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Primary Location / Clinic</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., Downtown Medical Center, Building A"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Biography / Clinical Overview</label>
            <textarea
              rows="4"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
              placeholder="Describe your background, patient care philosophy, and special interests..."
            ></textarea>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
