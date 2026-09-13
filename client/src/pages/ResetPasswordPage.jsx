import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import api from '../services/api';

export const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setErrorMessage('Reset token is missing. Please use the exact link sent to your email.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to reset password. Link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 px-4">
      <Card className="p-6 sm:p-8 space-y-6 shadow-xl border-slate-200">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center mx-auto shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Create New Password
          </h1>
          <p className="text-xs text-slate-500">
            Enter and confirm your new secure account password below.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}

        {success ? (
          <div className="space-y-5 text-center">
            <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs space-y-2 text-left">
              <div className="flex items-center gap-2 font-bold text-teal-800">
                <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                Password Reset Successfully
              </div>
              <p className="text-teal-700 leading-relaxed">
                Your account password has been updated securely. You can now sign in using your new password.
              </p>
            </div>

            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-colors"
            >
              Sign In Now
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New Password"
              type="password"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={Lock}
              required
              autoComplete="new-password"
            />

            <Input
              label="Confirm New Password"
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={Lock}
              required
              autoComplete="new-password"
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center py-2.5 shadow-md text-sm font-bold mt-2"
              isLoading={loading}
              icon={ArrowRight}
            >
              Set New Password
            </Button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
