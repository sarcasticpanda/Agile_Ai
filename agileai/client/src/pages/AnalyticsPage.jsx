import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, TrendingUp, TrendingDown, Users, 
  Clock, CheckCircle, AlertTriangle, Flame, Target, 
  BarChart2, ChevronDown, Activity, PieChart as PieChartIcon
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';

import { PageShell } from '../components/layout/PageShell';
import { FullPageSpinner } from '../components/ui/Spinner';
import useAuthStore from '../store/authStore';

// API Imports
import * as analyticsApi from '../api/analytics.api';
import * as sprintsApi from '../api/sprints.api';
import * as projectsApi from '../api/projects.api';

export const AnalyticsPage = () => {
  const { projectId } = useParams();
  const { user } = useAuthStore();
  const [selectedSprintId, setSelectedSprintId] = useState('');

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isPM = user?.role?.toLowerCase() === 'pm';

  // --- DATA FETCHING ---

  // 1. Projects List (for overview or context)
  const { data: projectsRes } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getProjects,
  });
  const projects = projectsRes?.data || [];

  // 2. Sprints (project-specific)
  const { data: sprintsRes } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintsApi.getSprints(projectId),
    enabled: !!projectId,
  });
  const sprints = sprintsRes?.data || [];

  // 3. Burndown Data (project-specific)
  const { data: burndownRes, isLoading: isLoadingBurndown } = useQuery({
    queryKey: ['burndown', selectedSprintId],
    queryFn: () => analyticsApi.getBurndownData(selectedSprintId),
    enabled: !!selectedSprintId,
  });

  // 4. Velocity Data (project-specific)
  const { data: velocityRes, isLoading: isLoadingVelocity } = useQuery({
    queryKey: ['velocity', projectId],
    queryFn: () => analyticsApi.getVelocityData(projectId),
    enabled: !!projectId,
  });

  // 5. Team Stats (project-specific)
  const { data: teamStatsRes } = useQuery({
    queryKey: ['teamStats', projectId],
    queryFn: () => analyticsApi.getTeamStats(projectId),
    enabled: !!projectId,
  });

  const burndownData = burndownRes?.data || null;
  const velocityData = velocityRes?.data || [];
  const teamStats = teamStatsRes?.data || [];

  // --- DERIVED DATA ---

  const avgVelocity = velocityData.length > 0
    ? Math.round(velocityData.reduce((sum, s) => sum + (s.completed || s.velocity || 0), 0) / velocityData.length)
    : 0;

  // Mock Global Data for Overview (Phase 1 Stub)
  const globalStats = [
    { title: 'Total Velocity', value: '1,424', change: '+12%', type: 'pts', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { title: 'Completion Rate', value: '94%', change: '+5%', type: '', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Blockers', value: '7', change: '-2', type: '', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { title: 'Cycle Time', value: '3.2', change: '-8%', type: 'days', icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  // --- UI RENDER ---

  const renderOverview = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {globalStats.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-200 dark:border-border-dark shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} dark:bg-opacity-10 flex items-center justify-center ${stat.color}`}>
                <stat.icon size={22} />
              </div>
              <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${stat.change.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {stat.change}
              </span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">{stat.title}</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black text-slate-800 dark:text-white leading-none">{stat.value}</span>
              {stat.type && <span className="text-xs font-bold text-slate-400 uppercase">{stat.type}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-3xl p-8 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-800 dark:text-white">Organization Performance</h3>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div> Planned
                <div className="w-2 h-2 rounded-full bg-emerald-500 ml-2"></div> Delivered
              </div>
           </div>
           <div className="h-64 flex items-end gap-3">
             {/* Mock visual bars */}
             {[45, 60, 55, 80, 75, 90, 85].map((val, i) => (
               <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                 <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-t-lg h-[95%] absolute bottom-0"></div>
                 <div 
                   className="w-full bg-gradient-to-t from-indigo-500 to-indigo-400 rounded-t-lg relative z-10 transition-all duration-700 group-hover:from-indigo-600"
                   style={{ height: `${val}%` }}
                 >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-lg z-20">
                      {val}%
                    </div>
                 </div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3 whitespace-nowrap">W{i+1}</span>
               </div>
             ))}
           </div>
        </div>

        <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-3xl p-8 shadow-sm">
           <h3 className="text-xl font-black text-slate-800 dark:text-white mb-8">Project Health</h3>
           <div className="space-y-6">
             {projects.slice(0, 4).map((p, i) => (
               <div key={p._id} className="space-y-2">
                 <div className="flex justify-between items-center">
                   <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{p.title}</span>
                   <span className="text-xs font-black text-indigo-600">On Track</span>
                 </div>
                 <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-indigo-500 rounded-full" 
                     style={{ width: `${70 + (i * 5)}%`, backgroundColor: p.color }}
                   ></div>
                 </div>
               </div>
             ))}
           </div>
           <button className="w-full mt-8 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors border-t border-slate-100 dark:border-zinc-800">
             View All Projects
           </button>
        </div>
      </div>
    </div>
  );

  const renderProjectAnalysis = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Selected Sprint</label>
          <div className="relative">
            <select
              className="appearance-none bg-white border border-slate-200 dark:bg-card-dark dark:border-border-dark rounded-xl px-4 py-2.5 pr-10 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-primary/10 shadow-sm cursor-pointer"
              value={selectedSprintId}
              onChange={(e) => setSelectedSprintId(e.target.value)}
            >
              <option value="">— Select a sprint —</option>
              {sprints.map(s => (
                <option key={s._id} value={s._id}>{s.title} ({s.status})</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Velocity</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white">{avgVelocity} <span className="text-xs font-bold text-slate-400">PTS</span></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Burndown */}
        <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-3xl p-8 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <Flame className="text-orange-500" size={24} /> Sprint Burndown
              </h3>
           </div>
           
           {!selectedSprintId ? (
             <div className="h-72 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-slate-100 dark:border-zinc-800">
               <Activity size={48} className="mb-4 opacity-20" />
               <p className="text-xs font-black uppercase tracking-widest">Awaiting sprint selection</p>
             </div>
           ) : isLoadingBurndown ? (
             <div className="h-72 flex items-center justify-center text-slate-400 text-sm font-bold uppercase tracking-widest">Crunching numbers...</div>
           ) : !burndownData ? (
             <div className="h-72 flex items-center justify-center text-slate-400 text-sm">No data recorded for this sprint.</div>
           ) : (
             <div className="h-72 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={burndownData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-zinc-800" />
                   <XAxis dataKey="date" tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} axisLine={false} tickLine={false} />
                   <YAxis tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} axisLine={false} tickLine={false} />
                   <Tooltip 
                     contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', backgroundColor: '#1e293b', color: '#fff' }} 
                     itemStyle={{ color: '#fff' }}
                   />
                   <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }} />
                   <Line type="monotone" name="Ideal" dataKey="ideal" stroke="#94a3b8" strokeWidth={2} strokeDasharray="8 8" dot={false} />
                   <Line type="monotone" name="Actual" dataKey="actual" stroke="#4f46e5" strokeWidth={4} dot={{ r: 4, fill: '#4f46e5' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                 </LineChart>
               </ResponsiveContainer>
             </div>
           )}
        </div>

        {/* Velocity Bar Chart */}
        <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-3xl p-8 shadow-sm">
           <h3 className="text-xl font-black text-slate-800 dark:text-white mb-8 flex items-center gap-3">
             <Target className="text-emerald-500" size={24} /> Velocity Trends
           </h3>
           
           {isLoadingVelocity ? (
             <div className="h-72 flex items-center justify-center text-slate-400 text-sm font-bold uppercase tracking-widest">Profiling performance...</div>
           ) : (
             <div className="h-72 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={velocityData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-zinc-800" />
                   <XAxis dataKey="sprintName" tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} axisLine={false} tickLine={false} />
                   <YAxis tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} axisLine={false} tickLine={false} />
                   <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '16px', border: 'none', shadow: 'xl' }} />
                   <Bar name="Planned" dataKey="planned" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={24} />
                   <Bar name="Delivered" dataKey="completed" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={24} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
           )}
        </div>
      </div>

      {/* Team Breakdown */}
      <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-3xl p-8 shadow-sm">
        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-8">Resource Contribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {teamStats.map((stat, i) => (
            <div key={i} className="bg-slate-50 dark:bg-zinc-900/50 p-6 rounded-2xl flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full border-2 border-primary p-0.5 mb-3">
                <img src={stat.user.avatar || `https://ui-avatars.com/api/?name=${stat.user.name}&background=random`} className="w-full h-full rounded-full object-cover" />
              </div>
              <span className="text-sm font-black text-slate-800 dark:text-white">{stat.user.name}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase mt-1">Delivered: {stat.completedStoryPoints} PTS</span>
              <div className="w-full h-1 bg-slate-200 dark:bg-zinc-800 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${stat.completionRate}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <PageShell title="Project Intelligence">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">Analytics Hub</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {projectId ? 'Drill-down into project performance and resource allocation.' : 'Executive overview of organizational project metrics.'}
          </p>
        </div>
        {!projectId && (
          <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-2 shadow-sm font-bold text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Live System Overview
          </div>
        )}
      </div>

      {projectId ? renderProjectAnalysis() : renderOverview()}
    </PageShell>
  );
};
