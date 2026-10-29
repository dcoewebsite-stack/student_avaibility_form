'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Award, CheckCircle2, Trophy, Gift, Share2, Sparkles, Calendar, ChevronRight, User, Building, MapPin, Phone, Mail, AlertCircle, GraduationCap, X, Copy, Check, Search } from 'lucide-react';

const MODULES = [
  { id: 1, title: 'Industry 4.0 Technologies', desc: 'IoT, AI, automation & smart systems · 5-day hands-on' },
  { id: 2, title: 'Design Thinking & Methodology', desc: 'Human-centred problem solving · 5-day hands-on' },
  { id: 3, title: 'Ergonomics & Human Factors', desc: 'Design for people, safety & comfort · 5-day hands-on' },
  { id: 4, title: 'Aesthetics & Semiotics', desc: 'Visual language & product meaning · 5-day hands-on' },
  { id: 5, title: 'Design Prototyping', desc: 'Rapid prototyping & iteration · 5-day hands-on' },
  { id: 6, title: 'Mechanical Prototyping', desc: 'Hands-on fabrication & machining · 5-day hands-on' },
  { id: 7, title: 'Electronic Prototyping', desc: 'Circuits, sensors & embedded systems · 5-day hands-on' },
  { id: 8, title: 'Business Development & Entrepreneurship', desc: 'From idea to venture · 5-day hands-on' },
];

const REWARDS = [
  { 
    id: 'b1000000-0000-0000-0000-000000000001', 
    name: 'Priority Registration', 
    points: 50, 
    icon: '⚡',
    subtitle: 'Priority workshop seat' 
  },
  { 
    id: 'b1000000-0000-0000-0000-000000000005', 
    name: 'D-CoE Key Ring', 
    points: 125, 
    icon: '🔑',
    subtitle: 'Free · Collect manually in-person at D-CoE' 
  },
  { 
    id: 'b1000000-0000-0000-0000-000000000003', 
    name: 'D-CoE Merchandise Kit', 
    points: 150, 
    icon: '👕',
    subtitle: 'Official notebook & swag' 
  },
  { 
    id: 'b1000000-0000-0000-0000-000000000004', 
    name: 'Free 1-Day Workshop', 
    points: 200, 
    icon: '🎓',
    subtitle: '100% coupon code' 
  },
];

// Helper to generate upcoming Mondays for 5-day workshops grouped by month
function getUpcomingMondays(count = 48) {
  const groups: { monthYear: string; items: { value: string; label: string }[] }[] = [];
  const today = new Date();
  
  // Find next Monday
  const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
  const daysUntilMonday = (1 - dayOfWeek + 7) % 7 || 7;
  
  const current = new Date(today);
  current.setDate(today.getDate() + daysUntilMonday);
  current.setHours(0, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    const monday = new Date(current);
    const friday = new Date(current);
    friday.setDate(monday.getDate() + 4);

    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const day = String(monday.getDate()).padStart(2, '0');
    const value = `${year}-${month}-${day}`;

    const monthHeader = monday.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const monFormatted = monday.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const friFormatted = friday.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    const item = {
      value,
      label: `${monFormatted} → ${friFormatted}`,
    };

    let group = groups.find((g) => g.monthYear === monthHeader);
    if (!group) {
      group = { monthYear: monthHeader, items: [] };
      groups.push(group);
    }
    group.items.push(item);

    current.setDate(current.getDate() + 7);
  }

  return groups;
}

// Auto-calculate Monday to Friday range given a start Monday date string
function formatWorkshopBatch(startDateStr: string) {
  if (!startDateStr) return null;
  const parts = startDateStr.split('-').map(Number);
  if (parts.length !== 3) return null;
  const monday = new Date(parts[0], parts[1] - 1, parts[2]);
  const friday = new Date(parts[0], parts[1] - 1, parts[2] + 4);

  const monStr = monday.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const friStr = friday.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return `${monStr} — ${friStr} · 5 Days Full Workshop`;
}

export default function Home() {
  const [step, setStep] = useState<number>(0); // 0: Intro, 1: Modules, 2: Dates, 3: Contact, 4: Results
  const [moduleSelections, setModuleSelections] = useState<Record<number, 'interested' | 'completed'>>({});
  const [preferredDates, setPreferredDates] = useState<Record<number, string[]>>({});
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    organization: '',
    designation: '',
    city: '',
    attendance_preference: 'in-person',
    referral_code: '',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref) {
        setFormData(prev => ({ ...prev, referral_code: ref.trim().toUpperCase() }));
      }
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [claimMessage, setClaimMessage] = useState<string>('');
  const [submitError, setSubmitError] = useState<any>(null);

  // Returning Participant Lookup State
  const [showLookupModal, setShowLookupModal] = useState(false);
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Points Popup State
  const [popup, setPopup] = useState<{ value: number; id: number } | null>(null);
  const prevPointsRef = useRef<number>(10); // start bonus is 10

  // Local Live Point Estimate
  const calculateLivePoints = useCallback(() => {
    let pts = 10; // Start bonus
    Object.values(moduleSelections).forEach((status) => {
      if (status === 'interested') pts += 5;
      if (status === 'completed') pts += 10;
    });
    // Only count dates for modules marked 'interested'
    Object.entries(preferredDates).forEach(([modIdStr, dates]) => {
      const modId = parseInt(modIdStr);
      if (moduleSelections[modId] === 'interested' && dates) {
        pts += dates.filter(Boolean).length * 5;
      }
    });
    if (formData.attendance_preference === 'in-person') pts += 5;
    if (formData.first_name && formData.email) pts += 10;
    if (formData.referral_code && formData.referral_code.trim().toUpperCase().startsWith('DCOE-') && formData.referral_code.trim().length >= 7) {
      pts += 25; // Referral Welcome Bonus
    }
    return pts;
  }, [moduleSelections, preferredDates, formData.attendance_preference, formData.first_name, formData.email, formData.referral_code]);

  useEffect(() => {
    const currentPoints = calculateLivePoints();
    const diff = currentPoints - prevPointsRef.current;
    if (diff !== 0) {
      setPopup({ value: diff, id: Date.now() });
      const timer = setTimeout(() => setPopup(null), 1600);
      prevPointsRef.current = currentPoints;
      return () => clearTimeout(timer);
    }
    prevPointsRef.current = currentPoints;
  }, [calculateLivePoints]);

  const handleModuleToggle = (id: number, status: 'interested' | 'completed') => {
    setModuleSelections((prev) => {
      const next = { ...prev };
      if (next[id] === status) {
        delete next[id];
      } else {
        next[id] = status;
      }
      return next;
    });
    // Clean up dates if module is untoggled or marked as already done
    setPreferredDates((prev) => {
      if (prev[id] && (moduleSelections[id] === status || status === 'completed')) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return prev;
    });
  };

  const upcomingMondayGroups = useMemo(() => getUpcomingMondays(48), []);

  const handleDateChange = (moduleId: number, dateIndex: number, value: string) => {
    setPreferredDates((prev) => {
      const current = prev[moduleId] || ['', ''];
      const updated = [...current];
      updated[dateIndex] = value;
      return { ...prev, [moduleId]: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/forms/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          module_selections: moduleSelections,
          preferred_dates: Object.fromEntries(
            Object.entries(preferredDates).filter(([modIdStr]) => moduleSelections[parseInt(modIdStr)] === 'interested')
          ),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setResults(data);
        setStep(4);
      } else {
        if (data.alreadySubmitted) {
          setSubmitError({
            alreadySubmitted: true,
            email: formData.email,
            existingPoints: data.existingPoints,
            message: data.error,
          });
        } else {
          setSubmitError({ message: data.error || 'Submission failed' });
        }
      }
    } catch (err) {
      setSubmitError({ message: 'Unable to connect to the server. Please check your connection.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLookupUser = async (emailToLookup: string) => {
    if (!emailToLookup || !emailToLookup.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/user/status?email=${encodeURIComponent(emailToLookup.trim())}`);
      const data = await res.json();
      if (data.found) {
        setResults({
          userId: data.user.id,
          firstName: data.user.firstName,
          pointsEarned: 0,
          totalPoints: data.user.totalPoints,
          referralCode: data.referralStats.referralCode,
          referralUrl: data.referralStats.referralUrl,
          referralStats: data.referralStats,
          claimedRewards: data.claimedRewards || [],
          completedModuleCount: data.completedModuleCount,
          isReturningUser: true,
          pointBreakdown: [],
          badges: [
            { id: 'explorer', title: 'Explorer', description: 'You started building your D-CoE learning path.', icon: '🧭', unlocked: true },
            { id: 'pathfinder', title: 'Pathfinder', description: 'You told D-CoE when your learning journey could begin.', icon: '🎯', unlocked: true },
            { id: 'community_builder', title: 'Community Builder', description: 'Refer a friend to unlock this badge.', icon: '🤝', unlocked: data.referralStats.totalFriendsReferred > 0 },
          ],
        });
        setFormData((prev) => ({
          ...prev,
          first_name: data.user.firstName,
          last_name: data.user.lastName,
          email: data.user.email,
        }));
        setShowLookupModal(false);
        setStep(4);
      } else {
        setLookupError(`No registration found for "${emailToLookup}". Please verify your email or submit the form.`);
      }
    } catch (e) {
      setLookupError('Unable to connect to server. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleClaimReward = async (rewardId: string) => {
    if (!results?.userId) return;
    try {
      const res = await fetch('/api/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: results.userId, rewardId }),
      });
      const data = await res.json();
      if (res.ok) {
        setClaimMessage(data.message);
        if (data.claimCode) {
          setResults((prev: any) => ({
            ...prev,
            claimedRewards: [
              ...(prev?.claimedRewards || []),
              {
                rewardId,
                rewardName: data.rewardName,
                claimCode: data.claimCode,
                status: 'CLAIMED',
              },
            ],
          }));
        }
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Failed to claim reward');
    }
  };

  const interestedModules = MODULES.filter((m) => moduleSelections[m.id] === 'interested');
  const completedModules = MODULES.filter((m) => moduleSelections[m.id] === 'completed');
  const completedModuleCount = completedModules.length;
  const interestedModuleCount = interestedModules.length;
  const remainingModulesForCertificate = Math.max(0, 8 - completedModuleCount);

  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 w-full">

      {/* Floating Points Popup — Fixed Center of Screen */}
      {popup && (
        <div
          key={popup.id}
          className="points-popup fixed z-[9999] pointer-events-none"
          style={{ top: '50%', left: '50%' }}
        >
          <div
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl shadow-2xl font-black text-3xl border-2 ${
              popup.value > 0
                ? 'bg-emerald-500 text-white border-emerald-300'
                : 'bg-red-500 text-white border-red-300'
            }`}
          >
            <span>{popup.value > 0 ? `+${popup.value}` : popup.value}</span>
            <span className="text-2xl">{popup.value > 0 ? '⭐' : '💔'}</span>
          </div>
        </div>
      )}
      {/* Header Bar */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
        <div>
          <span className="text-xs font-bold tracking-wider text-sky-600">D-CoE @ IISc Bangalore</span>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-800">Preferred Module Dates</h1>
        </div>
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setShowLookupModal(true);
              setLookupError(null);
            }}
            className="text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition shadow-2xs"
            title="Already registered? Check points & referrals"
          >
            <User className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline">Already Registered?</span>
            <span>Check Points</span>
          </button>

          <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-1.5 rounded-full border border-amber-200 shadow-2xs">
            <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="font-bold text-amber-900 text-xs sm:text-sm">{calculateLivePoints()} Pts</span>
          </div>
        </div>
      </header>

      {/* Returning Participant Lookup Modal */}
      {showLookupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-150">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center font-bold text-sm shadow-2xs">
                  🏆
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Check Points & Referral Hub</h3>
                  <p className="text-[11px] text-slate-500">View points, referrals & redeem unlocked perks</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLookupModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookupUser(lookupEmail);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Enter Your Registered Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. name@example.com"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              {lookupError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                  {lookupError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLookupModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 disabled:opacity-50 transition active:scale-95"
                >
                  <Search className="w-3.5 h-3.5" />
                  {lookupLoading ? 'Checking...' : 'View My Points & Rewards'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STEP 0: WELCOME INTRO */}
      {step === 0 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-md border border-slate-100 text-center space-y-6">
          <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto text-sky-600">
            <Trophy className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Help us schedule workshops that work for you</h2>
            <p className="text-slate-600 max-w-lg mx-auto mt-2 text-sm sm:text-base">
              Tell D-CoE at IISc when you&apos;re free and which modules interest you. Takes 2 minutes. Earn points and redeem real perks.
            </p>
          </div>

          {formData.referral_code && formData.referral_code.trim().toUpperCase().startsWith('DCOE-') && (
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200 mx-auto">
              <span>🎉</span>
              <span>Referral Applied ({formData.referral_code.trim().toUpperCase()}) — +25 Points Bonus Active!</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left pt-2">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xl mb-1 block">⏱️ 2 Minutes</span>
              <p className="text-xs text-slate-500">Quick interactive preference form</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xl mb-1 block">🏆 Earn Points</span>
              <p className="text-xs text-slate-500">Instant points for every preference provided</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xl mb-1 block">🎁 Real Perks</span>
              <p className="text-xs text-slate-500">Free key rings, 1-day workshops & merchandise</p>
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            className="w-full sm:w-auto px-8 py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-sky-500/20 transition duration-200 flex items-center justify-center gap-2 mx-auto"
          >
            Start — Earn Your First 10 Points
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* STEP 1: MODULE SELECTION */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Step 1 of 3</span>
              <h2 className="text-xl font-bold text-slate-900">Build Your Product & Innovation Path</h2>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-slate-500 block">{Object.keys(moduleSelections).length} of 8 selected</span>
              {completedModuleCount > 0 && (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center justify-end gap-1 mt-0.5">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {remainingModulesForCertificate === 0
                    ? 'All 8 Done · Certificate Unlocked!'
                    : `${remainingModulesForCertificate} remaining to unlock Certificate`}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MODULES.map((m) => {
              const currentStatus = moduleSelections[m.id];
              return (
                <div
                  key={m.id}
                  className={`p-5 rounded-xl border transition-all ${
                    currentStatus === 'completed'
                      ? 'bg-emerald-50/40 border-emerald-300 shadow-sm'
                      : currentStatus === 'interested'
                      ? 'bg-sky-50/50 border-sky-300 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">Module #{m.id}</span>
                    {currentStatus === 'completed' ? (
                      <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                        ✓ Done (+10 pts)
                      </span>
                    ) : (
                      <span className="text-xs text-sky-600 font-semibold">+5 / +10 pts</span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-800 text-base">{m.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-2">{m.desc}</p>

                  {currentStatus === 'completed' && (
                    <div className="mb-3 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium flex items-center gap-1.5 animate-in fade-in duration-200">
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        {remainingModulesForCertificate === 0
                          ? '🎉 All 8 Done · Certificate Unlocked!'
                          : `${remainingModulesForCertificate} remaining module${remainingModulesForCertificate === 1 ? '' : 's'} to unlock Certificate`}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleModuleToggle(m.id, 'interested')}
                      className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg border transition ${
                        currentStatus === 'interested'
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {currentStatus === 'interested' ? '✓ Interested' : 'Want to Attend'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModuleToggle(m.id, 'completed')}
                      className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg border transition ${
                        currentStatus === 'completed'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {currentStatus === 'completed' ? '✓ Done' : 'Already Done'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-200">
            <button onClick={() => setStep(0)} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
              Back
            </button>
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-sm shadow flex items-center gap-1.5"
            >
              Next: Preferred Dates <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PREFERRED DATES */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Step 2 of 3</span>
            <h2 className="text-xl font-bold text-slate-900">When Can You Attend?</h2>
            <p className="text-xs text-slate-500">Select up to 2 preferred Monday 5-day batches for your interested modules (+5 pts per batch)</p>
          </div>

          {interestedModules.length === 0 && completedModules.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
              No modules selected in Step 1. Please go back and select at least one module.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Interested Modules Section — Interactive Monday Batch Selection */}
              {interestedModules.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Select 5-Day Monday Batches for Upcoming Modules ({interestedModules.length})
                    </span>
                  </div>
                  {interestedModules.map((mod) => {
                    const dates = preferredDates[mod.id] || ['', ''];
                    return (
                      <div key={mod.id} className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 text-xs font-bold">
                              Module #{mod.id}
                            </span>
                            {mod.title}
                          </h3>
                          <span className="text-xs text-sky-600 font-semibold">+5 pts / batch</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {[0, 1].map((idx) => {
                            const selectedVal = dates[idx] || '';
                            const batchCalculated = selectedVal ? formatWorkshopBatch(selectedVal) : null;
                            return (
                              <div key={idx} className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
                                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                  <span>{idx === 0 ? 'Option #1 (First Preference)' : 'Option #2 (Alternate Preference)'}</span>
                                  <span className="text-[10px] font-medium text-slate-400">Mon - Fri Batch</span>
                                </label>

                                <select
                                  value={selectedVal}
                                  onChange={(e) => handleDateChange(mod.id, idx, e.target.value)}
                                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                                >
                                  <option value="">-- Select Upcoming Monday Batch --</option>
                                  {upcomingMondayGroups.map((grp) => (
                                    <optgroup key={grp.monthYear} label={grp.monthYear}>
                                      {grp.items.map((m) => (
                                        <option key={m.value} value={m.value}>
                                          {m.label}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </select>

                                {/* Auto-calculated Monday to Friday Display */}
                                {batchCalculated ? (
                                  <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-xs font-semibold text-sky-900 flex items-center gap-2 animate-fadeIn">
                                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                                    <span>{batchCalculated}</span>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-slate-400 italic">
                                    Choose a Monday to view the 5-day workshop schedule.
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-emerald-950 text-sm">
                  <div className="font-bold flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    All Selected Modules Are Already Completed
                  </div>
                  <p className="text-xs text-emerald-700">
                    No start dates are needed for completed modules! Your credits are recorded toward your PG Certificate. Click &quot;Next: Contact Details&quot; to continue.
                  </p>
                </div>
              )}

              {/* Completed Modules Section — Read-Only Data */}
              {completedModules.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        Already Completed Modules ({completedModules.length})
                      </span>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                      {remainingModulesForCertificate === 0
                        ? '🎉 All 8 Done · Certificate Unlocked!'
                        : `${remainingModulesForCertificate} remaining module${remainingModulesForCertificate === 1 ? '' : 's'} to unlock Certificate`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {completedModules.map((mod) => (
                      <div
                        key={mod.id}
                        className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                            #{mod.id}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{mod.title}</h4>
                            <p className="text-[11px] text-emerald-600 font-medium">
                              {remainingModulesForCertificate === 0
                                ? 'Credited to Certificate · Unlocked!'
                                : `Credited · ${remainingModulesForCertificate} remaining module${remainingModulesForCertificate === 1 ? '' : 's'} to unlock Certificate`}
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                          ✓ Done (+10 pts)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-slate-200">
            <button onClick={() => setStep(1)} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-sm shadow flex items-center gap-1.5"
            >
              Next: Contact Details <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CONTACT DETAILS & SUBMIT */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Step 3 of 3</span>
            <h2 className="text-xl font-bold text-slate-900">Your Contact & Profile Information</h2>
            <p className="text-xs text-slate-500">Provide details to unlock your certificate tracking & rewards (+10 pts)</p>
          </div>

          {submitError && (
            submitError?.alreadySubmitted ? (
              <div className="p-5 bg-sky-50 border border-sky-300 rounded-2xl text-sky-950 text-sm space-y-3 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-sky-200 text-sky-800 flex items-center justify-center font-bold shrink-0 text-base shadow-xs">
                    👋
                  </div>
                  <div>
                    <div className="font-bold text-sky-950 text-base">You are already registered!</div>
                    <p className="text-xs text-sky-800 mt-0.5 leading-relaxed">
                      The email <strong className="font-mono text-sky-900">{submitError.email}</strong> is already registered with{' '}
                      <span className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                        {submitError.existingPoints} pts
                      </span>.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleLookupUser(submitError.email)}
                  disabled={lookupLoading}
                  className="w-full sm:w-auto px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  {lookupLoading ? 'Loading Your Profile...' : 'View My Points, Referrals & Rewards Hub →'}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3 shadow-sm">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-rose-900">Submission Notice</div>
                  <div className="text-xs text-rose-700 leading-relaxed">
                    {typeof submitError === 'object' ? submitError.message : submitError}
                  </div>
                </div>
              </div>
            )
          )}

          <div className="bg-white p-6 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">First Name *</label>
              <input
                required
                type="text"
                placeholder="Anwesha"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Last Name</label>
              <input
                type="text"
                placeholder="Roy"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address *</label>
              <input
                required
                type="email"
                placeholder="anwesha@example.com"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (submitError) setSubmitError(null);
                }}
                className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">WhatsApp Phone Number</label>
              <input
                type="tel"
                placeholder="+91 9876543210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">College / Organization</label>
              <input
                type="text"
                placeholder="IISc / Company"
                value={formData.organization}
                onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">City</label>
              <input
                type="text"
                placeholder="Bangalore"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-sky-700 flex items-center gap-1">
                  <Share2 className="w-3 h-3"/> Referral Code (Optional)
                </label>
                {formData.referral_code && formData.referral_code.trim().toUpperCase().startsWith('DCOE-') && formData.referral_code.trim().length >= 7 && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    ✓ +25 pts bonus active
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="DCOE-XXXXXX"
                value={formData.referral_code}
                onChange={(e) => setFormData({ ...formData, referral_code: e.target.value.toUpperCase() })}
                className="w-full text-sm p-2.5 rounded-lg border border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-sky-50 uppercase font-mono tracking-wider font-semibold"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Have a friend&apos;s invite code? Enter it to get an instant +25 points welcome bonus.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">Attendance Preference</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="attendance"
                    value="in-person"
                    checked={formData.attendance_preference === 'in-person'}
                    onChange={(e) => setFormData({ ...formData, attendance_preference: e.target.value })}
                  />
                  In-Person at IISc Campus (+5 bonus pts)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="attendance"
                    value="online"
                    checked={formData.attendance_preference === 'online'}
                    onChange={(e) => setFormData({ ...formData, attendance_preference: e.target.value })}
                  />
                  Fully Online
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setStep(2)} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Submitting & Syncing...' : 'Submit & Claim Points 🎉'}
            </button>
          </div>
        </form>
      )}

      {/* STEP 4: FINAL RESULTS & REWARDS DASHBOARD */}
      {step === 4 && results && (
        <div className="space-y-6">
          {/* Main Success Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-4">
            <div className="inline-block p-3 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30 mb-1">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">
              {results.isReturningUser ? `Welcome back, ${formData.first_name || 'Participant'}!` : `You're In, ${formData.first_name}!`}
            </h2>
            <p className="text-slate-300 text-sm max-w-md mx-auto">
              {results.isReturningUser
                ? 'Here is your active D-CoE points balance, referral earnings, and unlocked rewards.'
                : 'Your preferred workshop dates have been logged with D-CoE. Keep earning points by referring friends!'}
            </p>

            <div className="pt-2 flex justify-center items-center gap-6">
              <div className="bg-white/10 px-5 py-3 rounded-2xl border border-white/10 shadow-inner">
                <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">Total Points Balance</span>
                <span className="text-3xl font-black text-amber-400">{results.totalPoints} pts</span>
              </div>
            </div>
          </div>

          {/* Referral Earnings & Verification Tracker */}
          {results.referralStats && (
            <div className="bg-gradient-to-br from-sky-50 to-indigo-50/60 p-6 rounded-2xl border border-sky-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    🤝
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Referral Verification & Bonus Points</h3>
                    <p className="text-xs text-slate-500">Track friends who registered using your invite code</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-600 text-white font-bold text-xs rounded-full shadow-sm self-start sm:self-auto">
                  +{results.referralStats.totalReferralPoints} pts Earned from Referrals
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-white p-3.5 rounded-xl border border-sky-200/80 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Friends Joined</span>
                  <p className="text-2xl font-extrabold text-slate-900 mt-0.5">
                    {results.referralStats.totalFriendsReferred}
                  </p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-sky-200/80 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Referral Points Added</span>
                  <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">
                    +{results.referralStats.totalReferralPoints} pts
                  </p>
                </div>
              </div>

              {results.referralStats.referralHistory && results.referralStats.referralHistory.length > 0 ? (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-slate-700">Verified Referrals Log:</span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {results.referralStats.referralHistory.map((ref: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
                        <div className="flex items-center gap-2.5 font-semibold text-slate-800">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">✓</span>
                          <span>{ref.name} joined</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400 font-medium">
                            {ref.date ? new Date(ref.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-bold border border-emerald-200">
                            +{ref.points} pts
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-white/80 rounded-xl border border-sky-200/80 text-xs text-sky-800 leading-relaxed">
                  💡 No friends have registered with your code yet. Share your code below to earn <strong>+25 pts</strong> for each friend!
                </div>
              )}
            </div>
          )}

          {/* PG Certificate Progress Mechanic */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-xs font-bold text-sky-600 uppercase">Academic Milestone</span>
                <h3 className="text-lg font-bold text-slate-900">PG Certificate Journey</h3>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-sky-50 text-sky-700 rounded-lg">
                {results.completedModuleCount || completedModuleCount} / 8 Modules Done
              </span>
            </div>

            <div className="grid grid-cols-8 gap-2 py-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <div
                  key={num}
                  className={`h-3 rounded-full transition-all ${
                    num <= (results.completedModuleCount ?? completedModuleCount) ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                  title={`Module ${num}`}
                />
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Complete all 8 modules in-person at IISc campus to become eligible for the PG Certificate in Product Design & Innovation.
            </p>
          </div>

          {/* Badges Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Your Unlocked Badges
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {results.badges?.map((badge: any) => (
                <div
                  key={badge.id}
                  className={`p-4 rounded-xl border flex items-center gap-3 ${
                    badge.unlocked ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <span className="text-2xl">{badge.icon}</span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{badge.title}</h4>
                    <p className="text-xs text-slate-500">{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reward Redemption Ladder */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Gift className="w-5 h-5 text-sky-600" />
              Redeem Real Perks
            </h3>

            {claimMessage && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200">
                {claimMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {REWARDS.map((reward) => {
                const canClaim = results.totalPoints >= reward.points;
                const claimedItem = results.claimedRewards?.find((c: any) => c.rewardId === reward.id);
                return (
                  <div key={reward.id} className="p-4 rounded-xl border border-slate-200 flex justify-between items-center bg-slate-50 hover:bg-white hover:border-slate-300 transition shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{reward.icon}</span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{reward.name}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-semibold text-slate-500">{reward.points} points</span>
                          {reward.subtitle && (
                            <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                              {reward.subtitle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {claimedItem ? (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                          ✓ Claimed
                        </span>
                        <span className="block text-[11px] font-mono text-emerald-700 font-bold mt-0.5">
                          Code: {claimedItem.claimCode}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleClaimReward(reward.id)}
                        disabled={!canClaim}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                          canClaim
                            ? 'bg-sky-600 hover:bg-sky-700 text-white active:scale-95'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {canClaim ? 'Redeem' : 'Locked'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Referral & Invite Section */}
          {(() => {
            const activeReferralUrl =
              (typeof window !== 'undefined' && results.referralCode)
                ? `${window.location.origin}?ref=${results.referralCode}`
                : (results.referralUrl || '');

            const shareMessage = `Hey! I just submitted my preferred workshop dates at IISc D-CoE and earned points. Use my invite code ${results.referralCode} to get a +25 pts welcome bonus: ${activeReferralUrl}`;

            return (
              <div className="bg-sky-50 p-6 rounded-2xl border border-sky-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-sky-900 flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-sky-600" />
                    Invite Your Community & Earn +25 Points
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-100 text-sky-800 border border-sky-300">
                    {results.referralCode}
                  </span>
                </div>
                <p className="text-xs text-sky-700">
                  Share your unique referral link with friends. Earn <strong>+25 points</strong> every time someone submits using your code!
                </p>

                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={activeReferralUrl}
                      className="flex-1 text-xs p-2.5 rounded-lg border border-sky-300 bg-white text-slate-700 font-medium"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeReferralUrl);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition active:scale-95 shrink-0"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex gap-2 items-center mt-2">
                    <span className="text-xs text-sky-700 font-semibold">Share via:</span>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors flex items-center justify-center shadow-sm"
                      title="Share on WhatsApp"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    </a>
                    <a
                      href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(activeReferralUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors flex items-center justify-center shadow-sm"
                      title="Share on LinkedIn"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shareMessage);
                        alert('Referral text copied for Instagram/SMS!');
                      }}
                      className="p-2 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 hover:opacity-90 text-white rounded-full transition-opacity flex items-center justify-center shadow-sm"
                      title="Copy for Instagram/SMS"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Return button */}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setStep(0);
                setResults(null);
                setSubmitError(null);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              ← Back to Start
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
