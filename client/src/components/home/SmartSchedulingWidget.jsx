import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Search,
  Calendar,
  Clock,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Star,
  Info
} from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import api, { getSmartRecommendations } from '../../services/api';

// Helper: 12-hour format
const format12Hour = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

// Helper: Friendly date format
const formatFriendlyDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
};

export const SmartSchedulingWidget = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [safetyNotice, setSafetyNotice] = useState(null);

  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);

  const sampleSuggestions = [
    'After 5 PM this week',
    'Earliest appointment tomorrow',
    'Cardiology this week in the evening',
    'Monday or Wednesday afternoon'
  ];

  const handleSearch = async (overrideQuery) => {
    const searchQuery = (overrideQuery || query || '').trim();
    if (!searchQuery) return;

    // Immediately clear previous results and reset states for clean sequential searching
    setResults(null);
    setSelectedSlotIndex(0);
    setLoading(true);
    setErrorMessage(null);
    setSafetyNotice(null);

    try {
      // Check authentication
      const token = localStorage.getItem('appointease_token');
      const currentRole = (localStorage.getItem('appointease_role') || '').toUpperCase();

      if (!token) {
        navigate(`/login?redirect=${encodeURIComponent('/?query=' + searchQuery)}`);
        return;
      }

      if (currentRole && !['PATIENT', 'ADMIN'].includes(currentRole)) {
        setErrorMessage('Smart Time Recommendation is designed for patient & admin accounts. Please sign in with a patient account.');
        setLoading(false);
        return;
      }

      const res = await getSmartRecommendations({ query: searchQuery });
      const data = res?.data;

      if (data?.safetyNotice) {
        setSafetyNotice(data.safetyNotice);
        setResults(null);
      } else if (data?.notice && (!data.recommendations || data.recommendations.length === 0)) {
        setErrorMessage(data.notice);
        setResults(null);
      } else {
        setResults(data);
      }
    } catch (err) {
      console.error('Smart scheduling notice:', err);
      if (err.statusCode === 429) {
        setErrorMessage("You're making requests a little too quickly. Please wait a moment and try again.");
      } else if (err.statusCode === 401 || err.statusCode === 403) {
        setErrorMessage('Please sign in with an authenticated patient account to use Smart Scheduling.');
      } else {
        setErrorMessage(
          'Smart recommendations are temporarily unavailable. You can still choose a provider, date, and time manually.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBookSlot = (slot) => {
    if (slot.bookingUrl) {
      navigate(slot.bookingUrl);
    } else {
      navigate(
        `/book?provider=${slot.provider.id || slot.provider._id}&service=${slot.service.id || slot.service._id}&date=${slot.date}&startTime=${slot.startTime}`
      );
    }
  };

  const recommendations = results?.recommendations || [];
  const bestMatch = recommendations.length > 0 ? recommendations[0] : null;
  const otherMatches = recommendations.length > 1 ? recommendations.slice(1) : [];

  return (
    <div className="max-w-4xl mx-auto my-8">
      <Card className="p-6 sm:p-8 bg-gradient-to-br from-teal-50/80 via-white to-sky-50/50 border-teal-200/80 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-teal-100 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100/70 text-teal-800 text-xs font-bold uppercase tracking-wider border border-teal-200">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Smart Time Recommendation</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Find a time that works for you
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Describe your schedule in natural language. We'll find real, verified open consultation slots.
            </p>
          </div>
        </div>

        {/* Input Bar */}
        <div className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What time works for you? (e.g., I need a cardiology appointment after 5 PM this week)"
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-800 shadow-2xs"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              icon={Sparkles}
              disabled={loading || !query.trim()}
              className="py-2.5 px-5 text-xs sm:text-sm font-bold shadow-md justify-center"
            >
              {loading ? 'Finding Times...' : 'Find My Best Times'}
            </Button>
          </form>

          {/* Quick Suggestions Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-slate-500 font-semibold text-[11px] mr-1">Try asking:</span>
            {sampleSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setQuery(suggestion);
                  handleSearch(suggestion);
                }}
                disabled={loading}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-slate-600 hover:text-teal-700 text-[11px] font-medium transition-colors shadow-2xs cursor-pointer"
              >
                "{suggestion}"
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-10 text-center space-y-3 bg-white/70 rounded-2xl border border-teal-100">
            <RefreshCw className="w-7 h-7 animate-spin text-teal-600 mx-auto" />
            <p className="text-sm font-bold text-slate-800">
              Finding times that match your schedule...
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Scanning real doctor shifts, service durations, and live clinical calendars.
            </p>
          </div>
        )}

        {/* Safety Medical Disclaimer */}
        {safetyNotice && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5 flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Medical Guidance Notice</p>
              <p className="text-amber-800">{safetyNotice}</p>
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate('/providers')}
                  className="text-xs"
                >
                  Browse Healthcare Specialists &rarr;
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Fallback / Notice */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{errorMessage}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/book')}
                className="mt-2 text-xs"
              >
                Go to Manual Booking &rarr;
              </Button>
            </div>
          </div>
        )}

        {/* Results View */}
        {!loading && results && (
          <div className="space-y-5 pt-2 border-t border-teal-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-teal-700">
                  Here are the best available times based on your preferences:
                </p>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                  Smart matches for: <span className="text-teal-900 italic">"{query}"</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setResults(null);
                  setQuery('');
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline self-start sm:self-auto"
              >
                Adjust Search
              </button>
            </div>

            {recommendations.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white text-center space-y-2 border border-slate-100">
                <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-bold text-slate-800">No exact times matched all filters</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Try asking for a wider window or browse doctors directly in the specialist catalog.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate('/providers')}
                  className="mt-2"
                >
                  Browse Doctor Directory
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Best Match (Requirement 11) */}
                {bestMatch && (
                  <div className="relative p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-teal-800 to-teal-950 text-white shadow-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-extrabold tracking-wide shadow-xs">
                        <Star className="w-3.5 h-3.5 fill-slate-950" />
                        Best Match
                      </span>
                      <span className="text-xs font-semibold text-teal-100 bg-teal-800/60 px-2.5 py-0.5 rounded-md">
                        ₹{bestMatch.service?.price || 500}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                      <div className="space-y-1">
                        <h3 className="text-lg sm:text-xl font-extrabold">{bestMatch.provider?.name}</h3>
                        <p className="text-xs text-teal-100 font-medium">
                          {bestMatch.provider?.specialty} • {bestMatch.service?.name}
                        </p>
                        <div className="flex items-center gap-3 text-xs pt-1.5 text-teal-50">
                          <span className="flex items-center font-bold">
                            <Calendar className="w-3.5 h-3.5 mr-1 text-teal-200" />
                            {formatFriendlyDate(bestMatch.date)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center font-bold font-mono">
                            <Clock className="w-3.5 h-3.5 mr-1 text-teal-200" />
                            {format12Hour(bestMatch.startTime)} – {format12Hour(bestMatch.endTime)}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => handleBookSlot(bestMatch)}
                        className="bg-white text-teal-900 hover:bg-teal-50 font-extrabold shadow-md border-0 sm:self-center"
                      >
                        Book This Time &rarr;
                      </Button>
                    </div>

                    {/* Why this matches */}
                    {bestMatch.explanationPoints && bestMatch.explanationPoints.length > 0 && (
                      <div className="pt-3 border-t border-teal-500/60 text-xs text-teal-100 flex flex-wrap items-center gap-3">
                        <span className="font-bold text-white text-[11px] uppercase tracking-wider">
                          Why this matches:
                        </span>
                        {bestMatch.explanationPoints.map((point, idx) => (
                          <span key={idx} className="flex items-center gap-1 bg-teal-800/50 px-2.5 py-0.5 rounded-full text-[11px]">
                            <CheckCircle2 className="w-3 h-3 text-teal-300" />
                            {point}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Other Matches */}
                {otherMatches.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Other Available Consultations:
                      </h4>
                      <span className="text-xs font-semibold text-slate-500">
                        {otherMatches.length} additional option{otherMatches.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {otherMatches.map((match, idx) => {
                        const isSelected = selectedSlotIndex === idx + 1;
                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedSlotIndex(idx + 1)}
                            className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 shadow-2xs cursor-pointer ${
                              isSelected
                                ? 'bg-teal-50/60 border-teal-500 ring-2 ring-teal-500/20'
                                : 'bg-white border-slate-200 hover:border-teal-400 hover:shadow-sm'
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-extrabold text-slate-900 text-sm">
                                    {match.provider?.name}
                                  </p>
                                  <p className="text-slate-600 text-xs font-semibold">
                                    {match.provider?.specialty} {match.service?.name ? `• ${match.service.name}` : ''}
                                  </p>
                                </div>
                                {match.score && (
                                  <span className="text-[11px] font-bold text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded-full whitespace-nowrap border border-teal-200/60">
                                    {match.score} pts
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                                <span className="font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                                  {formatFriendlyDate(match.date)}
                                </span>
                                <span className="font-bold text-slate-800 font-mono">
                                  {format12Hour(match.startTime)}
                                </span>
                              </div>

                              {match.reason && (
                                <p className="text-[11px] text-slate-600 font-medium line-clamp-1 pt-0.5">
                                  ✓ {match.reason}
                                </p>
                              )}
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-700">
                                ₹{match.service?.price || 500}
                              </span>
                              <Button
                                size="sm"
                                variant={isSelected ? 'primary' : 'secondary'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBookSlot(match);
                                }}
                                className="text-xs font-bold px-3 py-1"
                              >
                                Book Slot &rarr;
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default SmartSchedulingWidget;
