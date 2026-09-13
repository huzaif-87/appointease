import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { CalendarCheck, Lock, Mail, AlertCircle, ArrowRight, UserCheck, ShieldCheck, Stethoscope } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import api from '../services/api';

export const LoginPage = ({ portalRole = 'PATIENT' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const redirectPath = queryParams.get('redirect') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const portalConfig = {
    PATIENT: {
      title: 'Patient Portal Sign In',
      subtitle: 'Access your appointments, consultations, and health records',
      icon: CalendarCheck,
      iconBg: 'bg-teal-600',
      emailPlaceholder: 'patient@example.com'
    },
    PROVIDER: {
      title: 'Healthcare Provider Portal',
      subtitle: 'Restricted to registered clinicians, doctors, and specialists',
      icon: Stethoscope,
      iconBg: 'bg-blue-600',
      emailPlaceholder: 'dr.name@appointease.com'
    },
    ADMIN: {
      title: 'System Administration Portal',
      subtitle: 'Restricted to authorized system administrators and operations managers',
      icon: ShieldCheck,
      iconBg: 'bg-slate-800',
      emailPlaceholder: 'admin.support@appointease.com'
    }
  };

  const currentConfig = portalConfig[portalRole] || portalConfig.PATIENT;
  const HeaderIcon = currentConfig.icon;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.post('/auth/login', {
        email,
        password,
        portal: portalRole
      });
      const payload = res.data?.data || res.data;
      const token = payload?.token;
      const user = payload?.user;

      if (token && user) {
        localStorage.setItem('appointease_token', token);
        localStorage.setItem('appointease_role', user.role);
        localStorage.setItem('appointease_user', JSON.stringify(user));

        // Strict role-based destination routing
        if (user.role === 'ADMIN') {
          navigate('/admin');
        } else if (user.role === 'PROVIDER') {
          navigate('/provider');
        } else {
          // Patient destination
          if (redirectPath && redirectPath !== '/' && !redirectPath.startsWith('/admin') && !redirectPath.startsWith('/provider')) {
            navigate(decodeURIComponent(redirectPath));
          } else {
            navigate('/');
          }
        }
      } else {
        setErrorMessage('Failed to process login token. Please try again.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid email or password. Please verify your credentials.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 px-4">
      <Card className="p-6 sm:p-8 space-y-6 shadow-xl border-slate-200">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className={`w-12 h-12 rounded-2xl ${currentConfig.iconBg} text-white flex items-center justify-center mx-auto shadow-sm`}>
            <HeaderIcon className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {currentConfig.title}
          </h1>
          <p className="text-xs text-slate-500">
            {currentConfig.subtitle}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder={currentConfig.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={Mail}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={Lock}
            required
            autoComplete="current-password"
          />

          <div className="flex justify-end -mt-2">
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full justify-center py-2.5 shadow-md text-sm font-bold mt-2"
            isLoading={loading}
            icon={ArrowRight}
          >
            Sign In to {portalRole === 'ADMIN' ? 'Admin Portal' : portalRole === 'PROVIDER' ? 'Doctor Portal' : 'AppointEase'}
          </Button>
        </form>

        {/* Registration Link */}
        <div className="space-y-2 pt-2 border-t border-slate-100 text-center text-xs text-slate-500">
          {portalRole === 'PATIENT' ? (
            <div>
              <span>New patient? </span>
              <Link to="/register" className="font-bold text-teal-600 hover:underline">
                Create Account
              </Link>
            </div>
          ) : (
            <div className="flex justify-center gap-3 pt-1 text-[11px] text-slate-500">
              <Link to="/login" className="hover:text-teal-600 hover:underline font-medium">
                Patient Portal
              </Link>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
