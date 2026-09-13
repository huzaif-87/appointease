import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { CalendarCheck, Lock, Mail, User, Phone, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import api from '../services/api';
import { validateIndianMobileNumber } from '../utils/phoneValidator';
import { mapFriendlyError } from '../utils/errorMapper';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const redirectPath = queryParams.get('redirect') || '/';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handlePhoneChange = (val) => {
    setPhone(val);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setErrorMessage('Please fill in all required fields (Name, Email, and Password).');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    // Inline phone validation: prevent submit if invalid
    if (phone && phone.trim() !== '') {
      const phoneCheck = validateIndianMobileNumber(phone, false);
      if (!phoneCheck.isValid) {
        setPhoneError(phoneCheck.error);
        return;
      }
    } else if (phone && phone.trim() === '' && phone.length > 0) {
      setPhoneError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (phoneError) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.post('/auth/register', {
        name,
        email,
        password,
        phone
      });

      const payload = res.data?.data || res.data;
      const token = payload?.token;
      const user = payload?.user;

      if (token && user) {
        localStorage.setItem('appointease_token', token);
        localStorage.setItem('appointease_role', user.role);
        localStorage.setItem('appointease_user', JSON.stringify(user));

        if (redirectPath && redirectPath !== '/') {
          navigate(decodeURIComponent(redirectPath));
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      const friendly = mapFriendlyError(err);
      if (err?.response?.data?.errorCode === 'INVALID_PHONE_NUMBER' || err?.response?.data?.error?.code === 'INVALID_PHONE_NUMBER') {
        setPhoneError('Please enter a valid 10-digit Indian mobile number.');
      }
      setErrorMessage(friendly.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 px-4">
      <Card className="p-6 sm:p-8 space-y-6 shadow-xl border-slate-200">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center mx-auto shadow-sm">
            <CalendarCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Create Patient Account
          </h1>
          <p className="text-xs text-slate-500">
            Register to book verified consultations and manage appointments
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name *"
            type="text"
            placeholder="Aarav Sharma"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={User}
            required
            autoComplete="name"
          />

          <Input
            label="Email Address *"
            type="email"
            placeholder="patient@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={Mail}
            required
            autoComplete="email"
          />

          <Input
            label="Phone Number (Optional)"
            type="tel"
            placeholder="Enter mobile number"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            onBlur={() => {
              if (phone && phone.trim() !== '') {
                const check = validateIndianMobileNumber(phone, false);
                if (!check.isValid) setPhoneError(check.error);
                else setPhoneError(null);
              }
            }}
            icon={Phone}
            error={phoneError}
            helperText={!phoneError ? "10-digit Indian mobile number (optional)" : undefined}
            autoComplete="tel"
          />

          <Input
            label="Password (min 6 characters) *"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            Create Account
          </Button>
        </form>

        {/* Sign In Link */}
        <div className="text-center text-xs text-slate-600 border-t border-slate-100 pt-4">
          <span>Already have an account? </span>
          <Link
            to={`/login${location.search}`}
            className="font-bold text-teal-600 hover:text-teal-700 underline"
          >
            Sign In here
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
