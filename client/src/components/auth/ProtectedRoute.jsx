import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, LogIn, ArrowLeft } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';

/**
 * ProtectedRoute Guard
 * 
 * Enforces:
 * 1. Authentication: Redirects unauthenticated visitors to /login with redirect query param.
 * 2. Role-Based Access Control: Validates user role against allowedRoles array.
 */
export const ProtectedRoute = ({ children, allowedRoles = null }) => {
  const location = useLocation();
  const token = localStorage.getItem('appointease_token');
  const role = (localStorage.getItem('appointease_role') || '').toUpperCase();

  // 1. Not Authenticated -> Redirect to role-appropriate Login portal with return path
  if (!token) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to={`/admin/login?redirect=${redirectPath}`} replace />;
    }
    if (location.pathname.startsWith('/provider')) {
      return <Navigate to={`/provider/login?redirect=${redirectPath}`} replace />;
    }
    return <Navigate to={`/login?redirect=${redirectPath}`} replace />;
  }

  // 2. Role check if specified
  if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());
    if (!normalizedAllowed.includes(role)) {
      return (
        <div className="max-w-xl mx-auto my-16 px-4">
          <Card className="p-8 text-center space-y-4 border-rose-200 bg-rose-50/40">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Your current account role (<strong>{role || 'ANONYMOUS'}</strong>) does not have permission to access this area.
              </p>
            </div>
            <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
              <Link to="/">
                <Button variant="outline" size="sm" icon={ArrowLeft}>
                  Return Home
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="primary" size="sm" icon={LogIn}>
                  Sign in with Different Account
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;
