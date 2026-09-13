import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CalendarCheck,
  XCircle,
  Calendar,
  Clock,
  AlertCircle,
  CheckCheck
} from 'lucide-react';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../../services/api';

/**
 * Format timestamp in friendly format (e.g., "Just now", "5m ago", "12 Sep 10:30 AM")
 */
const formatTimeAgo = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

export const NotificationBell = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const popoverRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    // Skip completely if user is unauthenticated
    if (!localStorage.getItem('appointease_token')) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Skip polling when browser tab is inactive/hidden
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getNotifications({ limit: 10 });
      if (res?.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      // Gracefully handle unauthenticated or network error without throwing
      setError('Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  // Poll notifications periodically (45s) & on mount for authenticated users
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 45000); // 45s poll
    return () => clearInterval(interval);
  }, []);

  const toggleOpen = () => {
    if (!isOpen) {
      loadNotifications();
    }
    setIsOpen(!isOpen);
  };

  const handleMarkAsRead = async (e, id) => {
    e.stopPropagation();
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      try {
        await markNotificationAsRead(notif._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notif._id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {}
    }
    setIsOpen(false);
    navigate('/appointments');
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'APPOINTMENT_CONFIRMED':
        return <CalendarCheck className="w-4 h-4 text-emerald-600" />;
      case 'APPOINTMENT_CANCELLED':
        return <XCircle className="w-4 h-4 text-rose-600" />;
      case 'APPOINTMENT_RESCHEDULED':
        return <Calendar className="w-4 h-4 text-sky-600" />;
      default:
        return <Clock className="w-4 h-4 text-teal-600" />;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'APPOINTMENT_CONFIRMED':
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Confirmed
          </span>
        );
      case 'APPOINTMENT_CANCELLED':
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            Cancelled
          </span>
        );
      case 'APPOINTMENT_RESCHEDULED':
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
            Rescheduled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Bell Button */}
      <button
        onClick={toggleOpen}
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        aria-label="View notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-teal-600 text-white text-[10px] font-extrabold flex items-center justify-center rounded-full ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Popover Header */}
          <div className="p-3.5 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-900 tracking-tight">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-semibold text-teal-600 hover:text-teal-800 flex items-center space-x-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Popover Body */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Loading updates...</p>
              </div>
            )}

            {error && (
              <div className="p-4 text-center text-xs text-rose-600 space-y-1">
                <AlertCircle className="w-4 h-4 mx-auto" />
                <p>{error}</p>
                <button
                  onClick={loadNotifications}
                  className="text-teal-600 font-bold underline text-[11px]"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Bell className="w-8 h-8 mx-auto stroke-1 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No notifications yet</p>
                <p className="text-[11px] text-slate-400">
                  Updates on your confirmed, cancelled, or rescheduled appointments will appear here.
                </p>
              </div>
            )}

            {notifications.map((n) => (
              <div
                key={n._id}
                onClick={() => handleNotificationClick(n)}
                className={`p-3.5 transition-colors cursor-pointer flex items-start space-x-3 hover:bg-slate-50/80 ${
                  !n.read ? 'bg-teal-50/40' : 'bg-white'
                }`}
              >
                <div className="p-2 rounded-xl bg-slate-100 border border-slate-200/60 flex-shrink-0 mt-0.5">
                  {getTypeIcon(n.type)}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center space-x-1.5">
                      {getTypeBadge(n.type)}
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {n.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                      {formatTimeAgo(n.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-snug line-clamp-2">
                    {n.message}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-slate-400">
                      Ref: {n.appointmentId}
                    </span>

                    {!n.read && (
                      <button
                        onClick={(e) => handleMarkAsRead(e, n._id)}
                        className="text-[11px] text-teal-600 hover:text-teal-800 font-semibold flex items-center space-x-0.5"
                        title="Mark as read"
                      >
                        <Check className="w-3 h-3" />
                        <span>Read</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Popover Footer */}
          <div className="p-2 bg-slate-50 border-t border-slate-200 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/appointments');
              }}
              className="text-xs font-bold text-teal-700 hover:text-teal-900 py-1"
            >
              View My Appointments &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
