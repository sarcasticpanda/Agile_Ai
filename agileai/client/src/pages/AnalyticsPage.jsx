import React, { useState } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import * as analyticsApi from '../api/analytics.api';
import * as sprintsApi from '../api/sprints.api';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { Flame, Target, TrendingUp, BarChart2, ChevronDown } from 'lucide-react';
import { FullPageSpinner } from '../components/ui/Spinner';

export const AnalyticsPage = () => {
  const { projectId } = useParams();

  // Fixed by GSD Task 7: real sprint selector instead of hardcoded dummy ID
  const [selectedSprintId, setSelectedSprintId] = useState('');

  // Fetch sprints for the selector
  const { data: sprintsRes } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintsApi.getSprints(projectId),
    enabled: !!projectId,
  });
  const sprints = sprintsRes?.data || [];

  // Fixed by GSD Task 7: burndown only runs when a sprint is selected
  const { data: burndownRes, isLoading: isLoadingBurndown } = useQuery({
    queryKey: ['burndown', selectedSprintId],
    queryFn: () => analyticsApi.getBurndownData(selectedSprintId),
    enabled: !!selectedSprintId,
    retry: 1,
  });

  // Fixed by GSD Task 7: velocity uses real projectId
  const { data: velocityRes, isLoading: isLoadingVelocity } = useQuery({
    queryKey: ['velocity', projectId],
    queryFn: () => analyticsApi.getVelocityData(projectId),
    enabled: !!projectId,
    retry: 1,
  });

  const burndownData = burndownRes?.data?.length ? burndownRes.data : null;
  const velocityData = velocityRes?.data?.length ? velocityRes.data : [];

  // Compute avg velocity from real data if available
  const avgVelocity = velocityRes?.data?.length
    ? Math.round(velocityRes.data.reduce((sum, s) => sum + (s.completed || s.velocity || 0), 0) / velocityRes.data.length)
    : null;

  if (!projectId) {
    return (
      <PageShell title="Analytics & Reports">
        <div className="flex flex-col items-center justify-center p-20 mt-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800">
          <BarChart2 size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
          <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Project Selected</h2>
          <p className="text-slate-500 text-sm mt-2 text-center max-w-md">Analytics are project-specific. Please choose a project from the sidebar to view velocity and burndown charts.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Analytics & Reports">
      {/* Fixed by GSD Task 7: Sprint selector at top */}
      <div className="flex items-center gap-4 mb-8">
        <label className="text-sm font-bold text-slate-600">Sprint:</label>
        <div className="relative">
          <select
            className="appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2 pr-8 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
            value={selectedSprintId}
            onChange={(e) => setSelectedSprintId(e.target.value)}
          >
            <option value="">— Select a sprint —</option>
            {sprints.map(s => (
              <option key={s._id} value={s._id}>{s.title} ({s.status})</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-3">
            <div className="h-8 w-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
              <Flame size={18} />
            </div>
            <h3 className="font-semibold text-slate-700">Burndown Rate</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">
            {burndownData ? `${burndownData.length > 0 ? '—' : '0'}%` : '—'}
          </p>
          <p className="text-sm font-medium text-slate-400 mt-1">
            {selectedSprintId ? 'Based on sprint data' : 'Select a sprint above'}
          </p>
        </div>
        
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-3">
            <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Target size={18} />
            </div>
            <h3 className="font-semibold text-slate-700">Avg Velocity</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">
            {avgVelocity !== null ? `${avgVelocity} pts` : '—'}
          </p>
          <p className="text-sm font-medium text-slate-500 mt-1">per sprint average</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Burndown Chart */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 pb-8">
          <h3 className="font-bold text-lg text-slate-800 mb-4">Active Sprint Burndown</h3>
          {!selectedSprintId ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <BarChart2 size={48} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">Select a sprint to view analytics</p>
            </div>
          ) : isLoadingBurndown ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>
          ) : !burndownData ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <p className="text-sm font-medium">No sprint data yet — complete a sprint to see trends</p>
            </div>
          ) : (
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={burndownData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" name="Ideal Remaining" dataKey="ideal" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" name="Actual Remaining" dataKey="actual" stroke="#4f46e5" strokeWidth={3} dot={{ stroke: '#4f46e5', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Velocity Chart */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 pb-8">
          <h3 className="font-bold text-lg text-slate-800 mb-4">Historical Velocity</h3>
          {isLoadingVelocity ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>
          ) : (
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocityData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="sprint" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar name="Committed" dataKey="expected" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar name="Completed" dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

    </PageShell>
  );
};
