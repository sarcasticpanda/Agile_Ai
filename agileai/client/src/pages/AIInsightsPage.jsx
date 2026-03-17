import React from 'react';
import { PageShell } from '../components/layout/PageShell';
import { Bot, Sparkles, AlertTriangle, Lightbulb, Zap } from 'lucide-react';

export const AIInsightsPage = () => {
  return (
    <PageShell title="AI Insights (Phase 2)">
      <div className="rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-10 text-center shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 opacity-10 pointer-events-none">
          <Bot size={200} className="text-indigo-600" />
        </div>
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl mb-6 shadow-indigo-200">
            <Sparkles size={40} />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">Intelligence Layer Inactive</h2>
          <p className="max-w-2xl text-lg text-slate-600 mb-8 leading-relaxed">
            The Python microservice containing our FastAPI prediction models will be linked here in Phase 2. This interface is structurally prepared to receive the analytical payloads.
          </p>
          <div className="flex gap-4">
             <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-medium text-indigo-700 shadow-sm border border-indigo-100">
               <Zap size={16} /> Python Ready
             </span>
             <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-medium text-purple-700 shadow-sm border border-purple-100">
               <Bot size={16} /> LangChain integration pending
             </span>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-slate-900 mb-6 px-1">Upcoming Capabilities</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm opacity-60">
           <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-red-500 mb-4">
             <AlertTriangle size={24} />
           </div>
           <h4 className="font-bold text-slate-900 mb-2">Sprint Risk Prediction</h4>
           <p className="text-sm text-slate-600">Uses historical velocity and complexity markers to flag sprints likely to miss deadlines.</p>
        </div>
        
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm opacity-60">
           <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500 mb-4">
             <Zap size={24} />
           </div>
           <h4 className="font-bold text-slate-900 mb-2">Effort Estimation</h4>
           <p className="text-sm text-slate-600">Automatically suggests story points based on task descriptions matched against past similar issues.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm opacity-60">
           <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-500 mb-4">
             <Lightbulb size={24} />
           </div>
           <h4 className="font-bold text-slate-900 mb-2">Workload Balancing</h4>
           <p className="text-sm text-slate-600">Identifies botlenecks in team assignments and intelligently suggests reassignment options.</p>
        </div>
      </div>
    </PageShell>
  );
};
