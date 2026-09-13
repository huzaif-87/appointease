import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Clock,
  Briefcase,
  User,
  LogOut,
  Menu,
  X,
  Stethoscope,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';

export const ProviderLayout = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const storedUserRaw = localStorage.getItem('appointease_user');
  const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : { name: 'Doctor User', email: 'doctor@appointease.com' };

  const navItems = [
    { name: 'Overview Dashboard', path: '/provider', icon: LayoutDashboard, exact: true },
    { name: 'My Appointments', path: '/provider/appointments', icon: Calendar },
    { name: 'Weekly Availability', path: '/provider/availability', icon: Clock },
    { name: 'Offered Services', path: '/provider/services', icon: Briefcase },
    { name: 'Doctor Profile', path: '/provider/profile', icon: User }
  ];

  const isItemActive = (item) => {
    if (item.exact) {
      return location.pathname === '/provider' || location.pathname === '/provider/';
    }
    return location.pathname.startsWith(item.path);
  };

  const currentNav = navItems.find(isItemActive) || navItems[0];

  const handleLogout = () => {
    localStorage.removeItem('appointease_token');
    localStorage.removeItem('appointease_role');
    localStorage.removeItem('appointease_user');
    navigate('/provider/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-slate-900 text-white flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-xs">
            AE
          </div>
          <span className="font-bold text-base tracking-tight">Provider Portal</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-300 hover:text-white focus:outline-none"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Drawer */}
      <aside
        className={`
          ${mobileMenuOpen ? 'block' : 'hidden'}
          md:flex md:flex-col md:w-64 bg-slate-900 text-slate-200 flex-shrink-0 z-30 shadow-lg
        `}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 hidden md:flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-xs">
              AE
            </div>
            <div>
              <h2 className="font-bold text-sm text-white tracking-tight">AppointEase</h2>
              <span className="text-[11px] text-blue-400 font-semibold flex items-center">
                <Stethoscope className="w-3.5 h-3.5 mr-1" />
                Doctor Console
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Clinical Operations
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all
                  ${active
                    ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Identity Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-800 border border-blue-500/50 flex items-center justify-center font-bold text-blue-100 text-xs shrink-0">
                {storedUser.name ? storedUser.name.slice(0, 2).toUpperCase() : 'DR'}
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs font-bold text-white truncate leading-tight">{storedUser.name}</div>
                <div className="text-[10px] text-blue-400 font-semibold truncate">Healthcare Practitioner</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out of Doctor Portal"
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <Link
            to="/"
            className="flex items-center justify-center space-x-1.5 w-full py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Public Home</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span>Doctor Portal</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-bold text-slate-900">{currentNav.name}</span>
          </div>

          <div className="flex items-center space-x-3 text-xs font-medium text-slate-600">
            <span className="hidden sm:inline">Signed in as: <strong className="text-slate-900">{storedUser.email}</strong></span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default ProviderLayout;
