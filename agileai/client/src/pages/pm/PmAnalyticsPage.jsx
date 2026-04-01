import React from 'react';
import { 
  BarChart3, TrendingUp, TrendingDown, Users, 
  Clock, CheckCircle, AlertTriangle 
} from 'lucide-react';

export const PmAnalyticsPage = () => {
  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto font-inter">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <BarChart3 className="text-primary" size={32} />
            Analytics & Reports
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Real-time insights across all active projects and team performance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg font-medium outline-none">
            <option>Last 30 Days</option>
            <option>Last Quarter</option>
            <option>Year to Date</option>
          </select>
          <button className="bg-primary hover:bg-primary-dark text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-sm">
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-200 dark:border-border-dark shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <TrendingUp size={20} />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full flex items-center gap-1">
              <TrendingUp size={10} /> 12%
            </span>
          </div>
          <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Average Velocity</span>
          <span className="text-3xl font-black text-slate-800 dark:text-white mt-1">42<span className="text-base text-slate-400 font-medium ml-1">pts/sprint</span></span>
        </div>

        <div className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-200 dark:border-border-dark shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={20} />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full flex items-center gap-1">
              <TrendingUp size={10} /> 5%
            </span>
          </div>
          <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Task Completion Rate</span>
          <span className="text-3xl font-black text-slate-800 dark:text-white mt-1">94<span className="text-base text-slate-400 font-medium ml-1">%</span></span>
        </div>

        <div className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-200 dark:border-border-dark shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle size={20} />
            </div>
            <span className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-full flex items-center gap-1">
              <TrendingUp size={10} /> 2
            </span>
          </div>
          <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Active Blockers</span>
          <span className="text-3xl font-black text-slate-800 dark:text-white mt-1">7</span>
        </div>

        <div className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-200 dark:border-border-dark shadow-sm flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Clock size={20} />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full flex items-center gap-1">
              <TrendingDown size={10} /> 8h
            </span>
          </div>
          <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Avg Cycle Time</span>
          <span className="text-3xl font-black text-slate-800 dark:text-white mt-1">3.2<span className="text-base text-slate-400 font-medium ml-1">days</span></span>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-2xl p-6 shadow-sm min-h-[400px] flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Sprint Burndown (Mock)</h3>
          <div className="flex-1 flex items-end gap-2 px-2 pb-8 border-b border-l border-slate-200 dark:border-border-dark relative">
            {/* Y axis labels */}
            <div className="absolute -left-6 bottom-[10%] text-xs text-slate-400">10</div>
            <div className="absolute -left-6 bottom-[50%] text-xs text-slate-400">30</div>
            <div className="absolute -left-6 bottom-[90%] text-xs text-slate-400">50</div>
            
            {/* Chart lines/bars */}
            {[50, 48, 40, 35, 30, 22, 18, 12, 5, 0].map((val, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end items-center group">
                <div 
                  className="w-full max-w-[20px] bg-primary/20 group-hover:bg-primary/40 rounded-t transition-all relative"
                  style={{ height: `${val * 2}%` }}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-xs font-bold text-primary transition-opacity">
                    {val}
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 mt-2 absolute -bottom-6">D{i+1}</div>
              </div>
            ))}
            
            {/* Ideal Line (SVG overlay) */}
            <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none">
              <line x1="0" y1="10%" x2="100%" y2="90%" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="5,5" className="dark:stroke-zinc-700" />
            </svg>
          </div>
        </div>

        <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-2xl p-6 shadow-sm min-h-[400px] flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Velocity History</h3>
          <div className="flex-1 flex items-end gap-4 px-2 pb-8 border-b border-slate-200 dark:border-border-dark">
            {[28, 32, 25, 38, 42].map((val, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                <div 
                  className="w-full bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t-lg shadow-sm group-hover:opacity-90 transition-all absolute bottom-0"
                  style={{ height: `${(val / 50) * 100}%` }}
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    {val}
                  </div>
                </div>
                <div className="text-xs font-medium text-slate-500 mt-2 absolute -bottom-6 whitespace-nowrap">Sprint {i+1}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};