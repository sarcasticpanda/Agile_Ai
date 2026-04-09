import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageShell } from '../components/layout/PageShell';
import { AlertCircle, Zap } from 'lucide-react';
import useProjectStore from '../store/projectStore';
import * as sprintsApi from '../api/sprints.api';
import * as aiApi from '../api/ai.api';
import { FullPageSpinner } from '../components/ui/Spinner';

export const AIInsightsPage = () => {
  const { activeProject } = useProjectStore();
  const [selectedSprintId, setSelectedSprintId] = useState('');

  const activeProjectId = typeof activeProject === 'string' ? activeProject : activeProject?._id;
  const activeProjectTitle = typeof activeProject === 'string' ? 'Selected Project' : (activeProject?.title || 'Selected Project');

  const { data: sprintsResponse, isLoading: isSprintsLoading } = useQuery({
    queryKey: ['ai-insights-sprints', activeProjectId],
    queryFn: () => sprintsApi.getSprints(activeProjectId),
    enabled: !!activeProjectId,
  });

  const sprints = sprintsResponse?.data || [];

  const resolvedSprintId = useMemo(() => {
    if (selectedSprintId) return selectedSprintId;
    const active = (sprints || []).find((s) => (s.status || '').toLowerCase() === 'active');
    return active?._id || (sprints?.[0]?._id || '');
  }, [selectedSprintId, sprints]);

  const { data: insightsResponse, isLoading: isInsightsLoading, error: insightsError } = useQuery({
    queryKey: ['ai-insights', resolvedSprintId],
    queryFn: () => aiApi.getSprintInsights(resolvedSprintId),
    enabled: !!resolvedSprintId,
    retry: false,
  });

  const payload = insightsResponse?.data;
  const riskScore = typeof payload?.riskScore === 'number' ? payload.riskScore : null;
  const riskLevel = (payload?.riskLevel || '').toLowerCase();

  const riskBadgeClass =
    riskLevel === 'high'
      ? 'bg-red-50 text-red-700 border-red-200'
      : riskLevel === 'medium'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : riskLevel === 'low'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-slate-50 text-slate-600 border-slate-200';

  if (!activeProjectId) {
    return (
      <PageShell title="AI Insights (Phase 2)">
        <div className="flex flex-col items-center justify-center p-16 text-center text-slate-500">
          <AlertCircle size={40} className="text-slate-300 mb-3" />
          <div className="text-lg font-bold text-slate-800">Select a project first</div>
          <div className="text-sm">Open Projects and pick an active project.</div>
        </div>
      </PageShell>
    );
  }

  if (isSprintsLoading) {
    return (
      <PageShell title="AI Insights (Phase 2)">
        <FullPageSpinner />
      </PageShell>
    );
  }

  return (
    <PageShell title="AI Insights (Phase 2)">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Project</div>
            <div className="text-lg font-extrabold text-slate-900">{activeProjectTitle}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sprint</div>
            <select
              value={resolvedSprintId}
              onChange={(e) => setSelectedSprintId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold outline-none"
            >
              {(sprints || []).map((s) => (
                <option key={s._id} value={s._id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Zap size={18} /> Sprint Risk (from AI service)
          </div>
          <div className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider ${riskBadgeClass}`}>
            {riskScore == null ? 'Not computed' : `${Math.round(riskScore)}%`}
            {riskLevel ? ` (${riskLevel})` : ''}
          </div>
        </div>

        {isInsightsLoading ? (
          <div className="text-slate-400">Loading insights...</div>
        ) : insightsError ? (
          <div className="text-sm text-red-600">Failed to load insights for this sprint.</div>
        ) : (
          <>
            <div className="text-xs text-slate-500 mb-4">
              Computed: {payload?.computedAt ? new Date(payload.computedAt).toLocaleString() : '—'}
            </div>

            <div className="mb-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Top Risk Factors</div>
              {Array.isArray(payload?.riskFactors) && payload.riskFactors.length > 0 ? (
                <div className="space-y-2">
                  {payload.riskFactors.slice(0, 5).map((f, idx) => (
                    <div key={`${f.factor}-${idx}`} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <div className="text-sm font-semibold text-slate-800">{f.factor}</div>
                      <div className="text-xs font-bold text-slate-600">
                        impact {typeof f.impact === 'number' ? f.impact.toFixed(2) : '—'} ({f.direction || '—'})
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic">No factors returned.</div>
              )}
            </div>

            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Feature Values</div>
              {payload?.features ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(payload.features).map(([k, v]) => (
                    <div key={k} className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-700">{k}</div>
                      <div className="text-xs font-bold text-slate-500">{typeof v === 'number' ? v.toFixed(3) : String(v)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic">No feature payload.</div>
              )}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
};
