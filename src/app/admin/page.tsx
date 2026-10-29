'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Users,
  Clock,
  ArrowRight,
  Search,
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
  Award,
  Filter,
  Download,
  Building2,
  CheckCircle2,
  ArrowUpRight,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';

interface StudentPreference {
  userId: string;
  name: string;
  preferredDate: string;
  alternativeDate?: string;
  email?: string;
  phone?: string;
  organization?: string;
  attendancePreference?: string;
  registeredAt?: string;
}

interface DateGroup {
  date: string;
  count: number;
  students: { name: string; email: string; organization: string }[];
}

interface ModuleData {
  id: number;
  title: string;
  desc: string;
  icon: string;
  totalStudents: number;
  dateGroups: DateGroup[];
  students: StudentPreference[];
}

interface MasterRegistration {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  organization: string;
  designation: string;
  city: string;
  attendance_preference: string;
  total_points: number;
  rewards_redeemed: string;
  already_done_modules: string;
  interested_modules_and_dates: string;
  created_at: string;
}

// Convert "2026-11-02" Monday to Monday -> Friday range
function formatBatchDate(dateStr: string) {
  if (!dateStr || dateStr === 'No Date Chosen') return 'No Date Chosen';
  try {
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3) return dateStr;
    const monday = new Date(parts[0], parts[1] - 1, parts[2]);
    const friday = new Date(parts[0], parts[1] - 1, parts[2] + 4);

    const monFormatted = monday.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const friFormatted = friday.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${monFormatted} → ${friFormatted}`;
  } catch (e) {
    return dateStr;
  }
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'modules' | 'master'>('modules');
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [stats, setStats] = useState<{ totalStudents: number; eligibleCount: number; totalModulePreferences: number }>({
    totalStudents: 0,
    eligibleCount: 0,
    totalModulePreferences: 0,
  });
  const [masterList, setMasterList] = useState<MasterRegistration[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [modulesRes, masterRes] = await Promise.all([
        fetch('/api/admin/modules'),
        fetch('/api/admin/master'),
      ]);

      const modulesData = await modulesRes.json();
      const masterData = await masterRes.json();

      if (modulesData.success) {
        setModules(modulesData.modules);
        setStats(modulesData.stats);
      }
      if (masterData.success) {
        setMasterList(masterData.registrations);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedModule = useMemo(() => {
    return modules.find((m) => m.id === selectedModuleId) || modules[0];
  }, [modules, selectedModuleId]);

  // Filter students within the selected module
  const filteredStudents = useMemo(() => {
    if (!selectedModule) return [];
    return selectedModule.students.filter((st) => {
      const matchesSearch =
        searchQuery === '' ||
        st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (st.preferredDate && st.preferredDate.includes(searchQuery));

      const matchesBatch =
        selectedBatchFilter === 'all' || st.preferredDate === selectedBatchFilter;

      return matchesSearch && matchesBatch;
    });
  }, [selectedModule, searchQuery, selectedBatchFilter]);

  // Filter master registrations
  const filteredMasterList = useMemo(() => {
    if (!searchQuery) return masterList;
    const q = searchQuery.toLowerCase();
    return masterList.filter(
      (r) =>
        r.full_name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.organization?.toLowerCase().includes(q) ||
        r.already_done_modules?.toLowerCase().includes(q) ||
        r.interested_modules_and_dates?.toLowerCase().includes(q)
    );
  }, [masterList, searchQuery]);

  // Export current module student list to CSV
  const handleExportCSV = () => {
    if (!selectedModule) return;
    const headers = ['#', 'Student Name', 'Preferred Date', 'Batch Window', 'Alternative Date'];
    const rows = filteredStudents.map((s, idx) => [
      idx + 1,
      `"${s.name}"`,
      s.preferredDate || 'N/A',
      `"${formatBatchDate(s.preferredDate)}"`,
      s.alternativeDate || 'N/A',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedModule.title.replace(/\s+/g, '_')}_Preferred_Dates.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50/50 via-[#f8fafc] to-slate-100 flex flex-col items-center justify-center p-6 text-slate-800">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-sky-100 rounded-full animate-pulse" />
          <div className="w-12 h-12 border-4 border-sky-600 border-t-transparent rounded-full animate-spin absolute inset-0" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mt-4 tracking-tight">Loading D-CoE Organizer Dashboard...</h2>
        <p className="text-xs text-slate-500 mt-1">Connecting to Neon PostgreSQL database</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/40 via-[#f8fafc] to-slate-100/90 text-slate-900 flex flex-col pb-20">
      {/* Top Header Floating Card */}
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 pt-6 sm:pt-8">
        <header className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-600 via-sky-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-sky-500/20">
              D
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Preferred Module Dates
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs">
                  Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center gap-1.5">
                <span>IISc Design Centre of Excellence</span>
                <span className="inline-block w-1 h-1 rounded-full bg-slate-300" />
                <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Neon DB
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* View Mode Toggle Pill */}
            <div className="bg-slate-100/90 p-1 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => setActiveTab('modules')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'modules'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                8 Modules
              </button>
              <button
                onClick={() => setActiveTab('master')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'master'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Master Sheet
              </button>
            </div>

            <button
              onClick={fetchData}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition active:scale-95"
              title="Refresh Live Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-600' : ''}`} />
            </button>

            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm text-xs font-bold transition flex items-center gap-1.5 hover:text-sky-600"
            >
              View Form
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </Link>
          </div>
        </header>
      </div>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 pt-6 flex-1 flex flex-col gap-6">
        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex items-center gap-4 transition hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-50 to-sky-100/80 border border-sky-200 flex items-center justify-center text-sky-600 shadow-xs">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Registered Students</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{stats.totalStudents}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex items-center gap-4 transition hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-50 to-emerald-100/80 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Module Date Choices</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{stats.totalModulePreferences}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex items-center gap-4 transition hover:shadow-md">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-50 to-amber-100/80 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Reward Qualified (≥125 pts)</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{stats.eligibleCount}</p>
            </div>
          </div>
        </div>

        {activeTab === 'modules' ? (
          <div className="space-y-6">
            {/* Step 1: 8 Modules Grid (Spacious 2-Column Layout matching Form!) */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3.5">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Step 1 of 8 Modules
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    Build Your Product & Innovation Path
                  </h2>
                </div>
                <span className="text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs self-start sm:self-auto">
                  Click any module below to inspect student dates
                </span>
              </div>

              {/* 2-Column Grid — Roomy, readable, identical to form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.map((mod) => {
                  const isSelected = mod.id === selectedModuleId;
                  return (
                    <div
                      key={mod.id}
                      onClick={() => {
                        setSelectedModuleId(mod.id);
                        setSelectedBatchFilter('all');
                      }}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer relative group ${
                        isSelected
                          ? 'bg-gradient-to-br from-sky-50/90 via-white to-sky-50/40 border-sky-500 shadow-md ring-2 ring-sky-500/20'
                          : 'bg-white hover:bg-slate-50/60 border-slate-200 hover:border-slate-300 shadow-[0_2px_10px_rgba(0,0,0,0.03)]'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2.5">
                        <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/60 shadow-2xs">
                          Module #{mod.id}
                        </span>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border transition ${
                            isSelected
                              ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                              : 'bg-sky-50 text-sky-700 border-sky-200'
                          }`}
                        >
                          {mod.totalStudents} {mod.totalStudents === 1 ? 'Student' : 'Students'}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-base group-hover:text-sky-700 transition">
                        {mod.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{mod.desc}</p>

                      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                        <span
                          className={`flex items-center gap-1.5 ${
                            isSelected ? 'text-sky-700 font-bold' : 'text-slate-500 group-hover:text-slate-800'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-sky-600" />
                              Viewing Date Preferences
                            </>
                          ) : (
                            'Click to view preferred dates'
                          )}
                        </span>
                        <ChevronRight
                          className={`w-4 h-4 transition-transform ${
                            isSelected ? 'text-sky-600 translate-x-1' : 'text-slate-400 group-hover:translate-x-1'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Selected Module Student Preferred Dates Panel */}
            {selectedModule && (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.06)] space-y-6">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-sky-50 text-sky-700 text-xs font-bold border border-sky-200">
                        Module #{selectedModule.id} Selected
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        • {selectedModule.totalStudents} total student preferences
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
                      {selectedModule.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">{selectedModule.desc}</p>
                  </div>

                  {/* Search & Export Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search student name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50/70 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 w-52 sm:w-56 transition shadow-2xs font-medium"
                      />
                    </div>

                    <button
                      onClick={handleExportCSV}
                      disabled={filteredStudents.length === 0}
                      className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      Export CSV
                    </button>
                  </div>
                </div>

                {/* Batch Date Filter Pills */}
                {selectedModule.dateGroups && selectedModule.dateGroups.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Filter by 5-Day Monday Workshop Batch:
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedBatchFilter('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs ${
                          selectedBatchFilter === 'all'
                            ? 'bg-sky-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        All Batches ({selectedModule.totalStudents})
                      </button>

                      {selectedModule.dateGroups.map((group) => (
                        <button
                          key={group.date}
                          onClick={() => setSelectedBatchFilter(group.date)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-2xs ${
                            selectedBatchFilter === group.date
                              ? 'bg-sky-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          <span>{formatBatchDate(group.date)}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                              selectedBatchFilter === group.date
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {group.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* The Core Table: Student Name & Preferred Date */}
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No student preferences found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchQuery
                        ? 'No student matches your search query.'
                        : 'No students have selected preferred dates for this module yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4 w-12 text-center text-slate-400">#</th>
                          <th className="py-3 px-4 font-bold text-slate-900">Student Name</th>
                          <th className="py-3 px-4 font-bold text-sky-800">Preferred Date (1st Choice)</th>
                          <th className="py-3 px-4 text-slate-500">Alternative Date (2nd Choice)</th>
                          <th className="py-3 px-4 text-slate-500">Attendance Mode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {filteredStudents.map((student, idx) => (
                          <tr key={student.userId + idx} className="hover:bg-sky-50/30 transition">
                            <td className="py-3.5 px-4 text-center text-slate-400 font-mono font-medium">
                              {idx + 1}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center text-xs font-extrabold uppercase shadow-xs">
                                {student.name ? student.name.charAt(0) : '?'}
                              </div>
                              <div>
                                <span className="text-sm font-bold text-slate-900">{student.name}</span>
                                {student.organization && (
                                  <span className="block text-[11px] text-slate-500 font-medium">
                                    {student.organization}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-medium">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 font-bold text-xs shadow-2xs">
                                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                                <span>{formatBatchDate(student.preferredDate)}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {student.alternativeDate ? (
                                <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>{formatBatchDate(student.alternativeDate)}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">None</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  student.attendancePreference === 'in-person'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                {student.attendancePreference === 'in-person' ? '🏛️ In-Person' : '💻 Online'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Master Sheet View in Elevated Light Theme */
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.06)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Master Registrations Table</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Direct live view of <code className="text-sky-700 font-semibold">v_master_registrations</code> from Neon DB
                </p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search student, email, module..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50/70 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 w-64 shadow-2xs font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[550px] overflow-y-auto shadow-2xs">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50/90 sticky top-0 text-slate-600 font-bold border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-3 px-3.5">#</th>
                    <th className="py-3 px-3.5 font-bold text-slate-900">Full Name</th>
                    <th className="py-3 px-3.5">Email</th>
                    <th className="py-3 px-3.5">Phone</th>
                    <th className="py-3 px-3.5">Organization</th>
                    <th className="py-3 px-3.5">City</th>
                    <th className="py-3 px-3.5 text-center">Points</th>
                    <th className="py-3 px-3.5">Rewards Redeemed</th>
                    <th className="py-3 px-3.5 text-emerald-700 font-bold">Already Done Modules</th>
                    <th className="py-3 px-3.5 text-sky-700 font-bold">Interested Modules & Preferred Dates</th>
                    <th className="py-3 px-3.5">Submitted At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {filteredMasterList.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3.5 text-slate-400 font-mono font-medium">{idx + 1}</td>
                      <td className="py-3 px-3.5 font-bold text-slate-900">{item.full_name}</td>
                      <td className="py-3 px-3.5 text-slate-500 font-mono text-[11px]">{item.email}</td>
                      <td className="py-3 px-3.5 text-slate-600">{item.phone || 'N/A'}</td>
                      <td className="py-3 px-3.5 text-slate-600">{item.organization || 'N/A'}</td>
                      <td className="py-3 px-3.5 text-slate-600">{item.city || 'N/A'}</td>
                      <td className="py-3 px-3.5 text-center">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-extrabold border border-amber-200 text-[11px] shadow-2xs">
                          {item.total_points}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        {item.rewards_redeemed && item.rewards_redeemed !== 'None' ? (
                          <span className="px-2.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-semibold shadow-2xs">
                            {item.rewards_redeemed}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 max-w-xs truncate text-emerald-700 font-medium" title={item.already_done_modules}>
                        {item.already_done_modules !== 'None' ? (
                          <span>{item.already_done_modules}</span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 max-w-sm truncate text-sky-700 font-medium" title={item.interested_modules_and_dates}>
                        {item.interested_modules_and_dates !== 'None' ? (
                          <span>{item.interested_modules_and_dates.replace(/\n/g, ' · ')}</span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 text-[11px] font-medium">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
