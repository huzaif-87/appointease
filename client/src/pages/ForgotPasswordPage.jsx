import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail, AlertCircle, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import api from '../services/api';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      setErrorMessage(err.message || 'Unable to process your request. Please try again.');
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
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Forgot Password?
          </h1>
          <p className="text-xs text-slate-500">
            Enter your registered email address and we will send you a secure password reset link.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}

        {submitted ? (
          <div className="space-y-5 text-center">
            <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs space-y-2 text-left">
              <div className="flex items-center gap-2 font-bold text-teal-800">
                <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                Reset Request Dispatched
              </div>
              <p className="text-teal-700 leading-relaxed">
                If an account exists for <strong>{email}</strong>, a secure password reset link has been sent to your email address.
              </p>
              <p className="text-teal-600 text-[11px]">
                Please check your inbox and spam folder. The link will expire in 30 minutes.
              </p>
            </div>

            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs shadow-md transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Registered Email Address"
              type="email"
              placeholder="patient@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={Mail}
              required
              autoComplete="email"
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center py-2.5 shadow-md text-sm font-bold mt-2"
              isLoading={loading}
              icon={ArrowRight}
            >
              Send Reset Link
            </Button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
