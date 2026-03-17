import React from 'react';
import { PageShell } from '../components/layout/PageShell';
import { 
  History, 
  CheckCircle2, 
  TrendingUp, 
  AlertCircle,
  Zap,
  Activity,
  Calendar,
  MousePointer2
} from 'lucide-react';
import useAuthStore from '../store/authStore';

export const DashboardPage = () => {
  const { user } = useAuthStore();

  const stats = [
    { title: 'Active Sprints', value: '0', status: 'Stable', icon: Activity, color: 'text-primary' },
    { title: 'In Progress', value: '0', status: 'Tasks', icon: History, color: 'text-slate-400' },
    { title: 'Sprint Health', value: '0%', status: 'N/A', icon: TrendingUp, color: 'text-emerald-500' },
  ];

  return (
    <PageShell title="AgileAI Dashboard">
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-8">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-card-light dark:bg-card-dark p-5 border border-border-light dark:border-border-dark rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.title}</span>
                  <stat.icon size={18} className={stat.color} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{stat.value}</span>
                  <span className={`text-xs font-medium ${stat.status === 'Stable' ? 'text-emerald-500' : 'text-slate-400'}`}>
                    {stat.status}
                  </span>
                </div>
              </div>
            ))}

            {/* AI Risk Card */}
            <div className="bg-red-500/10 dark:bg-red-500/5 p-5 border border-red-200 dark:border-red-900/30 rounded-xl relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
                  <Zap size={14} /> AI Risk
                </span>
              </div>
              <div className="flex items-baseline gap-2 relative z-10">
                <span className="text-3xl font-bold text-red-600 dark:text-red-400">N/A</span>
              </div>
              <div className="absolute -right-4 -bottom-4 text-red-500/10 dark:text-red-500/10 group-hover:scale-110 transition-transform">
                <AlertCircle size={96} />
              </div>
            </div>
          </div>

          {/* Table Section */}
          <section className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Current Sprint Cycle</h2>
              <button className="text-xs text-primary font-medium hover:underline">View All</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/30">
                  <tr>
                    <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Project Name</th>
                    <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Timeframe</th>
                    <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Completion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Activity size={32} className="opacity-20" />
                        <p className="text-sm">No active sprints found</p>
                        <p className="text-xs">Create a project and start a sprint to see it here.</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Sidebar */}
        <aside className="w-full lg:w-80 flex flex-col gap-6">
          <div className="ai-gradient-border rounded-2xl shadow-xl shadow-primary/10 p-px">
            <div className="bg-card-light dark:bg-card-dark rounded-[15px] p-6 h-full">
              <div className="flex items-center gap-2 mb-6 text-primary">
                <Zap size={18} fill="currentColor" />
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">AI Sprint Analytics</h3>
              </div>
              
              <div className="relative flex justify-center mb-6">
                <div className="w-32 h-32 rounded-full border-8 border-slate-100 dark:border-slate-800 flex items-center justify-center">
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-bold text-slate-300">0%</span>
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Risk</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-border-light dark:border-border-dark">
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-slate-100">Ready for Phase 1:</strong> System is stable. Create your first project to enable real-time tracking.
                  </p>
                </div>
                <button className="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-lg hover:opacity-90 transition-opacity active:scale-[0.98]">
                  Generate Analysis
                </button>
              </div>
            </div>
          </div>

          <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border-light dark:border-border-dark">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">System Logs</h3>
            </div>
            <div className="p-5 flex flex-col gap-5 overflow-y-auto">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
                <div>
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100">Workspace Init</p>
                  <p className="text-[10px] text-slate-500 mt-1">System ready for Phase 1 • Just now</p>
                </div>
              </div>
            </div>
            <div className="mt-auto p-4 border-t border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-800/20">
              <button className="w-full text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">View system audit log</button>
            </div>
          </div>
        </aside>

      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="fixed bottom-6 left-24 px-3 py-1.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-full shadow-lg flex items-center gap-4 text-[10px] text-slate-500 font-medium z-30 transition-colors duration-200">
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono">C</kbd>
          <span>Create Issue</span>
        </div>
        <div className="w-px h-3 bg-slate-300 dark:bg-slate-700"></div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono">G</kbd>
          <span>Go to...</span>
        </div>
        <div className="w-px h-3 bg-slate-300 dark:bg-slate-700"></div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono">?</kbd>
          <span>Help</span>
        </div>
      </div>
    </PageShell>
  );
};

