import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, RefreshCw, Mail, ArrowRight } from 'lucide-react';
import Card from '../components/common/Card';
import api from '../services/api';

export const VerifyEmailPage = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [updatedEmail, setUpdatedEmail] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setLoading(false);
        setErrorMessage('Verification token is missing from the link. Please check the URL in your email.');
        return;
      }

      try {
        const res = await api.post('/profile/verify-email', { token });
        const data = res.data?.data?.profile;
        if (data?.email) {
          setUpdatedEmail(data.email);
          // Update stored user if logged in
          const storedUser = localStorage.getItem('appointease_user');
          if (storedUser) {
            try {
              const parsed = JSON.parse(storedUser);
              parsed.email = data.email;
              parsed.pendingEmail = null;
              localStorage.setItem('appointease_user', JSON.stringify(parsed));
            } catch (e) {}
          }
        }
        setSuccess(true);
      } catch (err) {
        setErrorMessage(err.message || 'Email verification failed. The link may have expired or already been used.');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="max-w-md mx-auto my-12 px-4">
      <Card className="p-6 sm:p-8 space-y-6 shadow-xl border-slate-200 text-center">
        {loading ? (
          <div className="py-8 space-y-4">
            <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
            <h2 className="text-lg font-bold text-slate-900">Verifying your email...</h2>
            <p className="text-xs text-slate-500">Please wait while we confirm your email address update.</p>
          </div>
        ) : success ? (
          <div className="space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Email Verified!
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your AppointEase primary account email has been successfully updated to:
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold">
                <Mail className="w-3.5 h-3.5 text-teal-600" />
                {updatedEmail}
              </div>
            </div>

            <Link
              to="/profile"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-colors"
            >
              Go to Profile
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Verification Failed
              </h1>
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl font-medium">
                {errorMessage}
              </p>
            </div>

            <Link
              to="/profile"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-colors"
            >
              Return to Profile
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
};

export default VerifyEmailPage;
