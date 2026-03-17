import React, { useState } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import * as analyticsApi from '../api/analytics.api';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { Flame, Target, TrendingUp, Users } from 'lucide-react';
import { FullPageSpinner } from '../components/ui/Spinner';

export const AnalyticsPage = () => {
  const { projectId } = useParams();
  
  // Hardcoded for demo if not navigating from a specific project
  const activeProjectId = projectId || 'demo123';
  const dummySprintId = 'sprint456';

  const { data: burndownRes, isLoading: isLoadingBurndown } = useQuery({
    queryKey: ['analytics', 'burndown', dummySprintId],
    queryFn: () => analyticsApi.getBurndownData(dummySprintId),
  });

  const { data: velocityRes, isLoading: isLoadingVelocity } = useQuery({
    queryKey: ['analytics', 'velocity', activeProjectId],
    queryFn: () => analyticsApi.getVelocityData(activeProjectId),
  });

  const burndownData = burndownRes?.data || [
    { date: 'Mon', ideal: 50, actual: 50 },
    { date: 'Tue', ideal: 40, actual: 45 },
    { date: 'Wed', ideal: 30, actual: 35 },
    { date: 'Thu', ideal: 20, actual: 28 },
    { date: 'Fri', ideal: 10, actual: 15 },
  ];

  const velocityData = velocityRes?.data || [
    { sprint: 'Sprint 1', expected: 40, completed: 35 },
    { sprint: 'Sprint 2', expected: 45, completed: 45 },
    { sprint: 'Sprint 3', expected: 50, completed: 42 },
    { sprint: 'Sprint 4', expected: 45, completed: 48 },
  ];

  if (isLoadingBurndown || isLoadingVelocity) return <FullPageSpinner />;

  return (
    <PageShell title="Analytics & Reports">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-3">
             <div className="h-8 w-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
               <Flame size={18} />
             </div>
             <h3 className="font-semibold text-slate-700">Burndown Rate</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">85%</p>
          <p className="text-sm font-medium text-emerald-600 mt-1 flex items-center gap-1">
            <TrendingUp size={14} /> +5% from last sprint
          </p>
        </div>
        
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
           <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-3">
             <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
               <Target size={18} />
             </div>
             <h3 className="font-semibold text-slate-700">Avg Velocity</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">42 pts</p>
          <p className="text-sm font-medium text-slate-500 mt-1">per sprint average</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Burndown Chart */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 pb-8">
          <h3 className="font-bold text-lg text-slate-800 mb-6">Active Sprint Burndown</h3>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={burndownData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" name="Ideal Remaining" dataKey="ideal" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" name="Actual Remaining" dataKey="actual" stroke="#4f46e5" strokeWidth={3} dot={{ stroke: '#4f46e5', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Velocity Chart */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 pb-8">
          <h3 className="font-bold text-lg text-slate-800 mb-6">Historical Velocity</h3>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={velocityData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="sprint" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <Tooltip 
                   cursor={{fill: '#f1f5f9'}}
                   contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar name="Committed" dataKey="expected" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar name="Completed" dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </PageShell>
  );
};
