import React, { useEffect } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../api/axiosInstance';
import { 
  History, 
  CheckCircle2, 
  TrendingUp, 
  AlertCircle,
  Zap,
  Activity,
  Calendar,
  Plus,
  ArrowRight
} from 'lucide-react';
import useAuthStore from '../store/authStore';

export const DashboardPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isPM = user?.role?.toLowerCase() === 'pm';
  const isDev = user?.role?.toLowerCase() === 'developer';
  const canCreateProject = isAdmin || isPM;

  // Fetch real projects
  const { data: projectsRes } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/projects');
      return data;
    },
    staleTime: 30000,
  });

  // Fetch real sprints via all projects' sprints (simplified: use project list)
  const { data: sprintsRes } = useQuery({
    queryKey: ['all-sprints-dashboard'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/sprints');
      return data;
    },
    staleTime: 30000,
  });

  // Fetch tasks assigned specifically to the developer
  const { data: devTasksRes } = useQuery({
    queryKey: ['my-tasks-dashboard', user?._id],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/tasks?assigneeId=${user?._id}`);
      return data;
    },
    enabled: isDev,
    staleTime: 30000,
  });

  const projects = projectsRes?.data || [];
  const sprints = sprintsRes?.data || [];
  const myTasks = devTasksRes?.data || [];
  const activeSprints = sprints.filter(s => s.status?.toLowerCase() === 'active');
  const activeTasks = myTasks.filter(t => t.status !== 'done');

  // Keyboard shortcut handler
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'g' || e.key === 'G') navigate('/projects');
      if (e.key === 'c' || e.key === 'C') navigate('/projects');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  const stats = [
    { 
      title: isDev ? 'My Projects' : isAdmin ? 'All Projects' : 'Projects', 
      value: String(projects.length), 
      status: projects.length > 0 ? 'Active' : 'None', 
      icon: Activity, 
      color: 'text-primary',
      onClick: () => navigate('/projects'),
    },
    { 
      title: isDev ? 'My Pending Tasks' : 'Active Sprints', 
      value: isDev ? String(activeTasks.length) : String(activeSprints.length), 
      status: isDev ? (activeTasks.length > 0 ? 'Action Needed' : 'Caught Up') : 'Running', 
      icon: isDev ? CheckCircle2 : History, 
      color: isDev ? (activeTasks.length > 0 ? 'text-amber-500' : 'text-emerald-500') : 'text-slate-400',
      onClick: () => isDev ? navigate('/my-tasks') : navigate('/projects'),
    },
    ...(!isDev ? [{ 
      title: 'Current Health', 
      value: activeSprints.length > 0 ? 'Good' : 'N/A', 
      status: 'Status', 
      icon: TrendingUp, 
      color: 'text-emerald-500',
      onClick: null,
    }] : []),
  ];

  return (
    <PageShell title="AgileAI Dashboard">
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-8">
          
          {/* Welcome Banner */}
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl p-6 text-white shadow-lg shadow-indigo-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-200 text-sm font-medium mb-1">Welcome back</p>
                <h2 className="text-2xl font-bold mb-1">{user?.name || 'Team Member'} 👋</h2>
                <p className="text-indigo-200 text-sm capitalize">Role: <span className="font-semibold text-white">{user?.role}</span></p>
              </div>
              {canCreateProject && (
                <button
                  onClick={() => navigate('/projects')}
                  className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                >
                  <Plus size={16} /> New Project
                </button>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, idx) => (
              <div
                key={idx}
                onClick={stat.onClick || undefined}
                className={`bg-card-light dark:bg-card-dark p-5 border border-border-light dark:border-border-dark rounded-xl shadow-sm hover:shadow-md transition-shadow ${stat.onClick ? 'cursor-pointer hover:border-primary/30' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.title}</span>
                  <stat.icon size={18} className={stat.color} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{stat.value}</span>
                  <span className={`text-xs font-medium ${stat.status === 'Active' || stat.status === 'Good' ? 'text-emerald-500' : 'text-slate-400'}`}>
                    {stat.status}
                  </span>
                </div>
              </div>
            ))}

            {/* AI Risk Card */}
            {!isDev && (
              <div className="bg-red-500/10 dark:bg-red-500/5 p-5 border border-red-200 dark:border-red-900/30 rounded-xl relative overflow-hidden group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
                    <Zap size={14} /> AI Risk
                  </span>
                </div>
                <div className="flex items-baseline gap-2 relative z-10">
                  <span className="text-3xl font-bold text-red-600 dark:text-red-400">N/A</span>
                  <span className="text-xs text-red-400">Phase 2</span>
                </div>
                <div className="absolute -right-4 -bottom-4 text-red-500/10 dark:text-red-500/10 group-hover:scale-110 transition-transform">
                  <AlertCircle size={96} />
                </div>
              </div>
            )}
          </div>

          {/* Active Sprints or Pending Tasks Table */}
          <section className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">  
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {isDev ? 'My Active Tasks' : 'Active Sprint Cycles'}
              </h2>
              <button
                onClick={() => isDev ? navigate('/my-tasks') : navigate('/projects')}
                className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
              >
                View All <ArrowRight size={12} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/30">
                  <tr>
                    <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {isDev ? 'Task Title' : 'Sprint Name'}
                    </th>
                    <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {isDev ? 'Estimation' : 'Start Date'}
                    </th> 
                    <th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {isDev ? 'Type' : 'End Date'}
                    </th>   
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {isDev ? (
                    activeTasks.length > 0 ? activeTasks.slice(0, 5).map(t => (
                      <tr key={t._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 cursor-pointer transition-colors" onClick={() => navigate('/my-tasks')}>
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white truncate max-w-[200px]">{t.title}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${
                            t.status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {t.status.replace('-', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{t.estimatedHours ? `${t.estimatedHours}h` : '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-500 capitalize">{t.type}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <CheckCircle2 size={32} className="opacity-20" />
                            <p className="text-sm">No active tasks right now.</p>
                            <p className="text-xs">You're all caught up or waiting on assignment.</p>
                          </div>
                        </td>
                      </tr>
                    )
                  ) : (
                    activeSprints.length > 0 ? activeSprints.map(s => (
                      <tr key={s._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 cursor-pointer transition-colors" onClick={() => navigate(`/projects/${s.projectId}/sprints/${s._id}`)}>
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{s.title}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Active</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{s.startDate ? new Date(s.startDate).toLocaleDateString() : '—'}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center gap-2">
                            <Activity size={32} className="opacity-20" />
                            <p className="text-sm">No active sprints found</p>
                            <p className="text-xs">Create a project and start a sprint to see it here.</p>
                            <button
                              onClick={() => navigate('/projects')}
                              className="mt-2 px-4 py-1.5 bg-primary text-white text-xs rounded-lg font-semibold hover:opacity-90"
                            >
                              Go to Projects
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Sidebar */}
        {!isDev && (
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
                      <strong className="text-slate-900 dark:text-slate-100">System is stable.</strong>{' '}
                      {projects.length > 0 
                        ? `${projects.length} project(s) active.` 
                        : (isDev ? 'Waiting for a Project Manager to assign you to a team.' : 'Create your first project to enable real-time tracking.')
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/ai-insights')}
                    className="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-lg hover:opacity-90 transition-opacity active:scale-[0.98]"
                  >
                    View AI Insights →
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl flex-1 flex flex-col overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-border-light dark:border-border-dark">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Quick Links</h3>
              </div>
              <div className="p-5 flex flex-col gap-3">
                {[
                  { label: isAdmin ? 'All Projects' : 'My Projects', path: '/projects', icon: Activity },
                  { label: isAdmin ? 'Manage PMs & Devs' : 'Team Members', path: isAdmin ? '/admin' : '/team', icon: Calendar },
                  { label: 'Analytics & Reports', path: '/analytics', icon: TrendingUp },
                  { label: 'Profile Settings', path: '/profile', icon: CheckCircle2 },
                ].map(link => (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                  >
                    <link.icon size={16} className="text-slate-400" />
                    {link.label}
                    <ArrowRight size={14} className="ml-auto text-slate-300" />
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="fixed bottom-6 left-24 px-3 py-1.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-full shadow-lg flex items-center gap-4 text-[10px] text-slate-500 font-medium z-30 transition-colors duration-200">
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono">C</kbd>
          <span>Create Project</span>
        </div>
        <div className="w-px h-3 bg-slate-300 dark:bg-slate-700"></div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono">G</kbd>
          <span>Go to Projects</span>
        </div>
      </div>
    </PageShell>
  );
};
