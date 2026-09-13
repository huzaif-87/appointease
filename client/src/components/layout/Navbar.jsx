import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  UserCheck,
  Briefcase,
  Calendar,
  User,
  Menu,
  X,
  ShieldCheck,
  LogIn,
  UserPlus,
  LogOut,
  Stethoscope
} from 'lucide-react';
import NotificationBell from '../common/NotificationBell';
import { logout } from '../../services/api';

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const token = localStorage.getItem('appointease_token');
  const role = (localStorage.getItem('appointease_role') || '').toUpperCase();
  const isAuthenticated = Boolean(token);

  let rawUser = null;
  try {
    rawUser = JSON.parse(localStorage.getItem('appointease_user') || 'null');
  } catch (e) {}

  // Base navigation links for all visitors
  const baseLinks = [
    { name: 'Home', path: '/', icon: CalendarCheck },
    { name: 'Find Providers', path: '/providers', icon: UserCheck },
    { name: 'Services', path: '/services', icon: Briefcase }
  ];

  // Additional authenticated patient links
  const patientLinks = isAuthenticated && role === 'PATIENT' ? [
    { name: 'My Appointments', path: '/appointments', icon: Calendar },
    { name: 'Profile', path: '/profile', icon: User }
  ] : [];

  const navLinks = [...baseLinks, ...patientLinks];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm group-hover:bg-teal-700 transition-colors">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">AppointEase</span>
              <span className="hidden sm:inline-block ml-2 text-xs bg-teal-50 text-teal-700 font-medium px-2 py-0.5 rounded-full border border-teal-200/60">
                Healthcare
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 text-sm font-medium">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`px-3 py-2 rounded-lg transition-colors flex items-center space-x-1.5 ${
                    active
                      ? 'bg-teal-50 text-teal-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Authenticated Patient Actions */}
            {isAuthenticated ? (
              <>
                {/* Notification Bell (Patient only) */}
                {role === 'PATIENT' && <NotificationBell />}

                {/* Role Specific Shortcuts */}
                {role === 'ADMIN' && (
                  <Link
                    to="/admin"
                    className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1 text-teal-600" />
                    <span>Admin Dashboard</span>
                  </Link>
                )}

                {role === 'PROVIDER' && (
                  <Link
                    to="/provider"
                    className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition-colors"
                  >
                    <Stethoscope className="w-3.5 h-3.5 mr-1 text-teal-600" />
                    <span>Doctor Portal</span>
                  </Link>
                )}

                {/* User Name Badge & Logout */}
                <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-slate-200 text-xs">
                  <span className="font-semibold text-slate-700 max-w-[120px] truncate">
                    {rawUser?.name || role}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              /* Unauthenticated Visitor Actions */
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="inline-flex items-center text-xs font-bold text-slate-700 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 px-3.5 py-2 rounded-lg shadow-xs transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  <span>Register</span>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.path);
            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-teal-50 text-teal-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
                <span>{link.name}</span>
              </Link>
            );
          })}

          <div className="pt-3 border-t border-slate-100 space-y-2">
            {isAuthenticated ? (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500 font-medium">
                  Signed in as <strong>{rawUser?.name || role}</strong>
                </span>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="text-xs text-rose-600 font-bold hover:underline flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center text-xs font-bold py-2 border border-slate-200 rounded-lg text-slate-700"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center text-xs font-bold py-2 bg-teal-600 text-white rounded-lg"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
