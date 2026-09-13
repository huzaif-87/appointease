import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, ShieldCheck, Calendar, LogOut, Edit3, CheckCircle2, AlertCircle, RefreshCw, X, Save, Clock } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import api, { logout } from '../services/api';
import { validateIndianMobileNumber } from '../utils/phoneValidator';
import { mapFriendlyError } from '../utils/errorMapper';

export const ProfilePage = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [phoneError, setPhoneError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try /profile first, fallback to /auth/profile
      let res;
      try {
        res = await api.get('/profile');
      } catch (err) {
        res = await api.get('/auth/profile');
      }

      if (res.data?.data?.profile) {
        const p = res.data.data.profile;
        setProfile(p);
        setEditName(p.name || '');
        setEditEmail(p.email || '');
        setEditPhone(p.phone || '');
        setPhoneError(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleStartEdit = () => {
    if (profile) {
      setEditName(profile.name || '');
      setEditEmail(profile.email || '');
      setEditPhone(profile.phone || '');
    }
    setPhoneError(null);
    setSaveError(null);
    setSaveSuccess(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (profile) {
      setEditName(profile.name || '');
      setEditEmail(profile.email || '');
      setEditPhone(profile.phone || '');
    }
    setPhoneError(null);
    setSaveError(null);
    setIsEditing(false);
  };

  const handlePhoneChange = (val) => {
    setEditPhone(val);
    if (!val || val.trim() === '') {
      setPhoneError(null);
      return;
    }
    const check = validateIndianMobileNumber(val, true);
    if (!check.isValid) {
      setPhoneError(check.error);
    } else {
      setPhoneError(null);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    // Basic frontend validation
    if (!editName || editName.trim().length < 2) {
      setSaveError('Full Name must be at least 2 characters long.');
      setSaving(false);
      return;
    }

    if (!editEmail || !editEmail.includes('@')) {
      setSaveError('Please enter a valid email address.');
      setSaving(false);
      return;
    }

    // Inline phone validation before submitting: prevent API request if invalid
    if (editPhone && editPhone.trim() !== '') {
      const phoneCheck = validateIndianMobileNumber(editPhone, false);
      if (!phoneCheck.isValid) {
        setPhoneError(phoneCheck.error);
        setSaving(false);
        return;
      }
    } else if (editPhone && editPhone.trim() === '' && editPhone.length > 0) {
      // Whitespace only
      setPhoneError('Please enter a valid 10-digit Indian mobile number.');
      setSaving(false);
      return;
    }

    if (phoneError) {
      setSaving(false);
      return;
    }

    try {
      const payload = {
        name: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim()
      };

      const res = await api.patch('/profile', payload);
      const updatedProfile = res.data?.data?.profile;
      const emailPending = res.data?.data?.emailVerificationPending;

      if (updatedProfile) {
        setProfile(updatedProfile);

        // Update stored user in localStorage
        const storedUser = localStorage.getItem('appointease_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            parsed.name = updatedProfile.name;
            parsed.phone = updatedProfile.phone;
            if (updatedProfile.email) parsed.email = updatedProfile.email;
            localStorage.setItem('appointease_user', JSON.stringify(parsed));
          } catch (e) {}
        }
      }

      setSaveSuccess(
        emailPending
          ? 'Profile details updated! A verification link was sent to your new email address. Please click the link to confirm.'
          : 'Profile updated successfully!'
      );
      setIsEditing(false);
    } catch (err) {
      const friendly = mapFriendlyError(err);
      if (err?.response?.data?.errorCode === 'INVALID_PHONE_NUMBER' || err?.response?.data?.error?.code === 'INVALID_PHONE_NUMBER') {
        setPhoneError('Please enter a valid 10-digit Indian mobile number.');
      }
      setSaveError(friendly.message);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 px-4">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Account Profile
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your personal healthcare account, registration details, and security
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {!isEditing && profile && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartEdit}
              icon={Edit3}
              className="text-teal-700 hover:text-teal-800 hover:bg-teal-50 border-teal-200"
            >
              Edit Profile
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout()}
            icon={LogOut}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
          >
            Sign Out
          </Button>
        </div>
      </div>

      {/* Global Success Banner */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs flex items-start gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-teal-800">Changes Saved</p>
            <p className="text-teal-700">{saveSuccess}</p>
          </div>
        </div>
      )}

      {/* Pending Email Verification Notice Banner */}
      {profile?.pendingEmail && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 shadow-xs">
          <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-amber-800">Email Verification Pending</p>
            <p className="text-amber-700">
              A verification link was sent to <strong>{profile.pendingEmail}</strong>. Please check your inbox and click the link to activate your new email address. Your current login email remains <strong>{profile.email}</strong> until confirmed.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <Card className="py-16">
          <LoadingState message="Loading your account profile..." />
        </Card>
      ) : error ? (
        <ErrorState
          title="Unable to Load Profile"
          message={error}
          onRetry={fetchProfile}
        />
      ) : profile ? (
        <div className="space-y-6">
          {/* Edit Mode Card */}
          {isEditing ? (
            <Card className="p-6 border-teal-200/80 shadow-md">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Edit Profile Information</h2>
                  <p className="text-xs text-slate-500">Update your name, contact phone, or request an email address update.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {saveError && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <p className="font-medium">{saveError}</p>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <Input
                  label="Full Name"
                  type="text"
                  placeholder="Your full name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  icon={User}
                  required
                />

                <Input
                  label="Mobile / Phone Number"
                  type="tel"
                  placeholder="Enter mobile number"
                  value={editPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onBlur={() => {
                    if (editPhone && editPhone.trim() !== '') {
                      const check = validateIndianMobileNumber(editPhone, false);
                      if (!check.isValid) setPhoneError(check.error);
                      else setPhoneError(null);
                    }
                  }}
                  icon={Phone}
                  error={phoneError}
                  helperText={!phoneError ? "Enter a valid 10-digit Indian mobile number." : undefined}
                />

                <div>
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="name@example.com"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    icon={Mail}
                    required
                    helperText="Changing your email requires email verification. A confirmation link will be sent to the new address."
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={saving}
                    icon={Save}
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            /* View Mode Card */
            <Card className="p-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-teal-600 text-white font-bold text-xl flex items-center justify-center shadow-xs">
                  {getInitials(profile.name)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{profile.name}</h2>
                  <p className="text-xs text-slate-500 flex items-center mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600 mr-1" />
                    Verified {profile.role} Account
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border-t border-slate-100 pt-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                  <span className="text-slate-400 font-medium block mb-1">Registered Email</span>
                  <span className="text-slate-900 font-semibold flex items-center truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 mr-1.5 flex-shrink-0" />
                    {profile.email}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                  <span className="text-slate-400 font-medium block mb-1">Mobile / Phone Number</span>
                  <span className="text-slate-900 font-semibold flex items-center">
                    <Phone className="w-3.5 h-3.5 text-slate-400 mr-1.5 flex-shrink-0" />
                    {profile.phone || 'Not provided'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                  <span className="text-slate-400 font-medium block mb-1">System Role</span>
                  <span className="text-slate-900 font-semibold flex items-center">
                    <User className="w-3.5 h-3.5 text-teal-600 mr-1.5 flex-shrink-0" />
                    {profile.role} (Healthcare Member)
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70">
                  <span className="text-slate-400 font-medium block mb-1">Member Since</span>
                  <span className="text-slate-900 font-semibold flex items-center">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5 flex-shrink-0" />
                    {profile.memberSince
                      ? new Date(profile.memberSince).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })
                      : 'Recent'}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Quick Appointment Stats */}
          {profile.stats && (
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 text-center">
                <p className="text-xs text-slate-500 font-medium">Total Bookings</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {profile.stats.totalAppointments ?? 0}
                </p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-xs text-slate-500 font-medium">Active / Upcoming</p>
                <p className="text-2xl font-bold text-teal-600 mt-1">
                  {profile.stats.upcomingAppointments ?? 0}
                </p>
              </Card>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default ProfilePage;
