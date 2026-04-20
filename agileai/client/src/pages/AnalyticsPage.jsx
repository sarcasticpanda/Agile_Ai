import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, TrendingUp, TrendingDown, Users, 
  Clock, CheckCircle, AlertTriangle, Flame, Target, 
  BarChart2, ChevronDown, Activity, PieChart as PieChartIcon, UserCheck
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';

import { PageShell } from '../components/layout/PageShell';
import { FullPageSpinner } from '../components/ui/Spinner';
import useAuthStore from '../store/authStore';
import useProjectStore from '../store/projectStore';

// API Imports
import * as analyticsApi from '../api/analytics.api';
import * as sprintsApi from '../api/sprints.api';
import * as projectsApi from '../api/projects.api';
import axiosInstance from '../api/axiosInstance';

export const AnalyticsPage = () => {
  const { projectId } = useParams();
  const { user } = useAuthStore();
  const { activeProject, setActiveProject } = useProjectStore();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [selectedPmScopeId, setSelectedPmScopeId] = useState('');

  const resolveProjectId = (projectLike) =>
    typeof projectLike === 'string' ? projectLike : projectLike?._id || '';

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isPM = user?.role?.toLowerCase() === 'pm';
  const activeProjectId = resolveProjectId(activeProject);
  const isAdminPmScopedMode = isAdmin && !projectId && Boolean(selectedPmScopeId);
  const shouldRenderProjectAnalysis = Boolean(projectId || isPM || isAdminPmScopedMode);
  const effectiveProjectId = projectId
    || (shouldRenderProjectAnalysis
      ? selectedProjectId || (isAdminPmScopedMode ? '' : activeProjectId)
      : '');

  // --- DATA FETCHING ---

  // 1. Projects List (for overview or context)
  const { data: projectsRes } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getProjects,
  });
  const projects = projectsRes?.data || [];

  const { data: pmScopesRes } = useQuery({
    queryKey: ['analyticsOverviewPmScopes'],
    queryFn: analyticsApi.getOverviewPms,
    enabled: isAdmin && !projectId,
  });
  const pmScopes = pmScopesRes?.data || [];

  const selectedPmScope = useMemo(
    () => pmScopes.find((pm) => pm?._id === selectedPmScopeId) || null,
    [pmScopes, selectedPmScopeId]
  );

  const selectedPmProjectIds = useMemo(
    () => new Set((selectedPmScope?.projects || []).map((project) => String(project?._id))),
    [selectedPmScope]
  );

  const effectiveProjectPool = useMemo(() => {
    if (!isAdminPmScopedMode) return projects;
    return projects.filter((project) => selectedPmProjectIds.has(String(project?._id)));
  }, [isAdminPmScopedMode, projects, selectedPmProjectIds]);

  // 1b. Overview Analytics (admin/pm only)
  const { data: overviewRes } = useQuery({
    queryKey: ['analyticsOverview', isAdmin ? selectedPmScopeId || 'all' : 'self'],
    queryFn: () => analyticsApi.getOverview(isAdmin && selectedPmScopeId ? selectedPmScopeId : undefined),
    enabled: !projectId && isAdmin && !selectedPmScopeId,
  });

  // 2. Sprints (project-specific)
  const { data: sprintsRes } = useQuery({
    queryKey: ['sprints', effectiveProjectId],
    queryFn: () => sprintsApi.getSprints(effectiveProjectId),
    enabled: shouldRenderProjectAnalysis && !!effectiveProjectId,
  });
  const sprints = sprintsRes?.data || [];

  const analyticsPollInterval = useMemo(() => {
    if (!shouldRenderProjectAnalysis || !effectiveProjectId) return false;
    const list = sprintsRes?.data || [];
    const hasActive = list.some((s) => String(s?.status || '').toLowerCase() === 'active');
    return hasActive ? 30000 : false;
  }, [shouldRenderProjectAnalysis, effectiveProjectId, sprintsRes]);

  const { data: healthRes } = useQuery({
    queryKey: ['apiHealth'],
    queryFn: async () => {
      const res = await axiosInstance.get('/health');
      return res.data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  // 3. Burndown Data (project-specific)
  const { data: burndownRes, isLoading: isLoadingBurndown } = useQuery({
    queryKey: ['burndown', selectedSprintId],
    queryFn: () => analyticsApi.getBurndownData(selectedSprintId),
    enabled: !!selectedSprintId,
    refetchInterval: analyticsPollInterval,
  });

  // 4. Velocity Data (project-specific)
  const { data: velocityRes, isLoading: isLoadingVelocity } = useQuery({
    queryKey: ['velocity', effectiveProjectId],
    queryFn: () => analyticsApi.getVelocityData(effectiveProjectId),
    enabled: shouldRenderProjectAnalysis && !!effectiveProjectId,
    refetchInterval: analyticsPollInterval,
  });

  // 5. Team Stats (project-specific)
  const { data: teamStatsRes } = useQuery({
    queryKey: ['teamStats', effectiveProjectId, selectedSprintId || 'all'],
    queryFn: () => analyticsApi.getTeamStats(effectiveProjectId, selectedSprintId || undefined),
    enabled: shouldRenderProjectAnalysis && !!effectiveProjectId,
    refetchInterval: analyticsPollInterval,
  });

  const overview = overviewRes?.data;
  const overviewStats = overview?.stats;
  const orgPerformance = overview?.orgPerformance || [];
  const projectHealth = overview?.projectHealth || [];

  const burndownData = burndownRes?.data?.data || null;
  const velocityPayload = velocityRes?.data;
  const velocityData = velocityPayload?.data || [];
  const hasVelocityHistory = velocityData.some(
    (point) => Number(point?.planned || 0) > 0 || Number(point?.completed || 0) > 0
  );
  const liveVelocitySprint = velocityPayload?.liveSprint || null;
  const velocitySeries = [...velocityData];
  if (liveVelocitySprint) {
    velocitySeries.push({
      sprintName: `${liveVelocitySprint.sprintName} (Live)`,
      planned: Number(liveVelocitySprint.planned || 0),
      completed: Number(liveVelocitySprint.completed || 0),
    });
  }
  const hasVelocitySeriesData = velocitySeries.some(
    (point) => Number(point?.planned || 0) > 0 || Number(point?.completed || 0) > 0
  );
  const teamStats = teamStatsRes?.data || [];

  useEffect(() => {
    if (!isAdmin || projectId) return;

    setSelectedProjectId('');
    setSelectedSprintId('');

    if (!selectedPmScopeId) {
      setActiveProject(null);
    }
  }, [isAdmin, projectId, selectedPmScopeId, setActiveProject]);

  useEffect(() => {
    if (projectId || effectiveProjectPool.length === 0) return;
    if (!shouldRenderProjectAnalysis) return;

    const candidateId = selectedProjectId || activeProjectId;
    const matchingCandidate = candidateId
      ? effectiveProjectPool.find((project) => project?._id === candidateId)
      : null;
    if (matchingCandidate) {
      if (!selectedProjectId) setSelectedProjectId(matchingCandidate._id);
      if (activeProjectId !== matchingCandidate._id) {
        setActiveProject(matchingCandidate);
      }
      return;
    }

    const firstProject = effectiveProjectPool[0];
    if (!firstProject) return;

    setSelectedProjectId(firstProject._id);
    if (activeProjectId !== firstProject._id) {
      setActiveProject(firstProject);
    }
  }, [
    projectId,
    effectiveProjectPool,
    shouldRenderProjectAnalysis,
    selectedProjectId,
    activeProjectId,
    setActiveProject,
  ]);

  useEffect(() => {
    setSelectedSprintId('');
  }, [effectiveProjectId]);

  // --- DERIVED DATA ---

  const avgVelocity =
    hasVelocityHistory || Number(velocityPayload?.averageVelocity || 0) > 0
      ? velocityPayload?.averageVelocity || 0
      : liveVelocitySprint
        ? Number(liveVelocitySprint.completed || 0)
        : null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const sprintRiskData = useMemo(
    () => {
      const teamOverallBurnoutAvg =
        teamStats.length > 0
          ? teamStats.reduce((sum, entry) => sum + Number(entry?.overallBurnoutScore || entry?.projectBurnoutScore || 0), 0) /
            teamStats.length
          : 0;

      return (sprints || []).map((s) => {
        const aiRiskScore = Number(s?.aiRiskScore);
        const planned = Number(s?.committedPoints || 0);
        const delivered = Number(s?.completedPoints || 0);
        const completionPenalty = planned > 0 ? clamp((1 - delivered / planned) * 100, 0, 100) : 0;
        const pressureRisk = Number((teamOverallBurnoutAvg * 0.7 + completionPenalty * 0.3).toFixed(1));
        const compositeRisk = Number.isFinite(aiRiskScore)
          ? Number((aiRiskScore * 0.75 + pressureRisk * 0.25).toFixed(1))
          : pressureRisk;

        return {
          sprint: s.title,
          riskScore: clamp(compositeRisk, 0, 100),
          aiRisk: Number.isFinite(aiRiskScore) ? aiRiskScore : null,
          pressureRisk,
        };
      });
    },
    [sprints, teamStats]
  );

  const sprintOutcomeData = useMemo(
    () => {
      if (hasVelocityHistory) {
        return velocityData.map((item) => {
          const planned = Number(item?.planned || 0);
          const delivered = Number(item?.completed || 0);

          if (planned > 0) {
            const passed = delivered >= planned * 0.8;
            return {
              sprint: item?.sprintName || 'Sprint',
              outcome: passed ? 1 : 0,
              outcomeKey: passed ? 'pass' : 'fail',
              outcomeLabel: passed ? 'Pass' : 'Fail',
              planned,
              delivered,
              thresholdUsed: 'Delivered >= 80% of planned points',
              rulePathLabel: 'Committed points threshold',
            };
          }

          if (delivered > 0) {
            return {
              sprint: item?.sprintName || 'Sprint',
              outcome: 1,
              outcomeKey: 'pass',
              outcomeLabel: 'Pass',
              planned,
              delivered,
              thresholdUsed: 'Delivered > 0 with no committed points',
              rulePathLabel: 'Velocity history fallback',
            };
          }

          return {
            sprint: item?.sprintName || 'Sprint',
            outcome: 0,
            outcomeKey: 'fail',
            outcomeLabel: 'Fail',
            planned,
            delivered,
            thresholdUsed: 'No planned points and no delivered points',
            rulePathLabel: 'Empty completed sprint treated as fail',
          };
        });
      }

      return (sprints || [])
        .filter((s) => String(s.status || '').toLowerCase() === 'completed')
        .map((s) => {
          const planned = Number(s.committedPoints || 0);
          const delivered = Number(s.completedPoints || 0);
          const sprintTasks = Array.isArray(s?.tasks) ? s.tasks : [];
          const totalTasks = sprintTasks.length;
          const doneTasks = sprintTasks.filter(
            (task) => String(task?.status || '').toLowerCase() === 'done'
          ).length;

          if (planned > 0) {
            const passed = delivered >= planned * 0.8;
            return {
              sprint: s.title,
              outcome: passed ? 1 : 0,
              outcomeKey: passed ? 'pass' : 'fail',
              outcomeLabel: passed ? 'Pass' : 'Fail',
              planned,
              delivered,
              thresholdUsed: 'Delivered >= 80% of planned points',
              rulePathLabel: 'Committed points threshold',
            };
          }

          if (totalTasks > 0) {
            const passed = doneTasks === totalTasks;
            return {
              sprint: s.title,
              outcome: passed ? 1 : 0,
              outcomeKey: passed ? 'pass' : 'fail',
              outcomeLabel: passed ? 'Pass' : 'Fail',
              planned,
              delivered,
              thresholdUsed: `Done tasks == total tasks (${doneTasks}/${totalTasks})`,
              rulePathLabel: 'Task completion fallback',
            };
          }

          return {
            sprint: s.title,
            outcome: 0,
            outcomeKey: 'fail',
            outcomeLabel: 'Fail',
            planned,
            delivered,
            thresholdUsed: 'No planned points and no sprint tasks',
            rulePathLabel: 'Empty completed sprint treated as fail',
          };
        });
    },
    [hasVelocityHistory, velocityData, sprints]
  );

  const passFailSummary = useMemo(() => {
    const pass = sprintOutcomeData.filter((s) => s.outcomeKey === 'pass').length;
    const fail = sprintOutcomeData.filter((s) => s.outcomeKey === 'fail').length;
    const unknown = sprintOutcomeData.filter((s) => s.outcomeKey === 'unknown').length;
    const evaluated = pass + fail;
    const passRate = evaluated > 0 ? Number(((pass / evaluated) * 100).toFixed(1)) : null;
    return { pass, fail, unknown, evaluated, passRate };
  }, [sprintOutcomeData]);

  const renderOutcomeTooltip = ({ active, payload, label }) => {
    if (!active || !Array.isArray(payload) || payload.length === 0) return null;
    const point = payload?.[0]?.payload;
    if (!point) return null;

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900">
        <p className="font-black text-slate-700 dark:text-slate-100">{label}</p>
        <p className="mt-1 font-semibold text-slate-600 dark:text-slate-200">Outcome: {point.outcomeLabel}</p>
        <p className="mt-1 text-slate-500 dark:text-slate-300">Planned: {point.planned}</p>
        <p className="text-slate-500 dark:text-slate-300">Delivered: {point.delivered}</p>
        <p className="text-slate-500 dark:text-slate-300">Threshold: {point.thresholdUsed}</p>
        <p className="text-slate-500 dark:text-slate-300">Rule Path: {point.rulePathLabel}</p>
      </div>
    );
  };

  const memberEffortBurnoutData = useMemo(
    () =>
      (teamStats || [])
        .filter((t) => String(t?.user?.role || '').toLowerCase() === 'developer')
        .map((t) => {
          const aiRaw = t?.aiBurnoutRiskScore;
          const hasAiBurnout = aiRaw !== null && aiRaw !== undefined && Number.isFinite(Number(aiRaw));
          const projectBurnout = Number(t?.projectBurnoutScore || 0);
          const globalBurnout = Number(t?.globalBurnoutScore || 0);
          const overallBurnout = Number(t?.overallBurnoutScore || t?.projectBurnoutScore || 0);
          const aiBurnout = hasAiBurnout ? Number(aiRaw) : 0;

          return {
            member: t?.user?.name || 'Unknown',
            effort: Number(t?.completedStoryPoints || 0),
            burnout: projectBurnout,
            globalBurnout,
            overallBurnout,
            aiBurnout,
            displayBurnout: hasAiBurnout ? aiBurnout : overallBurnout,
            displayBurnoutSource: hasAiBurnout ? 'AI' : 'Overall (fallback)',
            aiBurnoutTrendDelta: Number(t?.aiBurnoutTrendDelta || 0),
            burnoutHistorySamples: Number(t?.burnoutHistorySamples || 0),
            tasksAssigned: Number(t?.tasksAssigned || 0),
            overdueOpenTasks: Number(t?.overdueOpenTasks || 0),
            blockedOpenTasks: Number(t?.blockedOpenTasks || 0),
          };
        }),
    [teamStats]
  );

  const effortAxisMax = useMemo(() => {
    if (memberEffortBurnoutData.length === 0) return 1;
    const maxEffort = Math.max(
      ...memberEffortBurnoutData.map((entry) => Number(entry?.effort || 0))
    );
    return Math.max(1, Math.ceil(maxEffort));
  }, [memberEffortBurnoutData]);

  const fmtChangePct = (pct) => {
    if (pct === null || pct === undefined) return '—';
    const rounded = Math.round(pct);
    return `${rounded >= 0 ? '+' : ''}${rounded}%`;
  };

  const globalStats = useMemo(() => {
    const velocityChange = fmtChangePct(overviewStats?.velocityChangePct);
    const completionChange = fmtChangePct(overviewStats?.completionChangePct);

    const cycleDaysRaw = Number(overviewStats?.cycleTimeDays ?? 0);
    const hasCycle = Number.isFinite(cycleDaysRaw) && cycleDaysRaw > 0;
    const cycleHours = hasCycle ? Math.max(1, Math.round(cycleDaysRaw * 24)) : 0;
    const cycleDisplayValue = hasCycle && cycleDaysRaw < 1 ? String(cycleHours) : String(overviewStats?.cycleTimeDays ?? 0);
    const cycleDisplayType = hasCycle && cycleDaysRaw < 1 ? 'hrs' : 'days';

    return [
      {
        title: 'Total Velocity',
        value: String(overviewStats?.totalVelocity ?? 0),
        change: velocityChange,
        type: 'pts',
        icon: TrendingUp,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
      },
      {
        title: 'Completion Rate',
        value: `${overviewStats?.completionRate ?? 0}%`,
        change: completionChange,
        type: '',
        icon: CheckCircle,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
      },
      {
        title: 'Blockers',
        value: String(overviewStats?.blockers ?? 0),
        change: '—',
        type: '',
        icon: AlertTriangle,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
      },
      {
        title: 'Cycle Time',
        value: cycleDisplayValue,
        change: '—',
        type: cycleDisplayType,
        icon: Clock,
        color: 'text-purple-600',
        bg: 'bg-purple-50',
      },
    ];
  }, [overviewStats]);

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
              <span
                className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${
                  stat.change === '—'
                    ? 'bg-slate-100 text-slate-500'
                    : stat.change.startsWith('+')
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-red-50 text-red-600'
                }`}
              >
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
                <div className="w-2 h-2 rounded-full bg-slate-300"></div> Planned
                <div className="w-2 h-2 rounded-full bg-indigo-500 ml-2"></div> Delivered
              </div>
           </div>
           {orgPerformance.length === 0 ? (
             <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-slate-100 dark:border-zinc-800">
               <BarChart3 size={48} className="mb-4 opacity-20" />
               <p className="text-xs font-black uppercase tracking-widest">No completed sprints yet</p>
             </div>
           ) : (
             <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={orgPerformance}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-zinc-800" />
                   <XAxis dataKey="label" tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} axisLine={false} tickLine={false} />
                   <YAxis tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} axisLine={false} tickLine={false} />
                   <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '16px', border: 'none', shadow: 'xl' }} />
                   <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }} />
                   <Bar name="Planned" dataKey="planned" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={22} />
                   <Bar name="Delivered" dataKey="delivered" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={22} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
           )}
        </div>

        <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-3xl p-8 shadow-sm">
           <h3 className="text-xl font-black text-slate-800 dark:text-white mb-8">Project Health</h3>
           <div className="space-y-6">
             {projectHealth.length === 0 ? (
               <div className="text-slate-400 text-sm">No projects available.</div>
             ) : projectHealth.map((p) => (
               <div key={p.projectId} className="space-y-2">
                 <div className="flex justify-between items-center">
                   <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{p.title}</span>
                   <span className="text-xs font-black text-indigo-600">{p.status}</span>
                 </div>
                 <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-indigo-500 rounded-full" 
                     style={{ width: `${p.percent}%`, backgroundColor: p.color }}
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

  const renderAdminPmScopes = () => (
    <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-3xl p-8 shadow-sm">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <UserCheck className="text-indigo-500" size={22} /> PM Analytics Scopes
          </h3>
          <p className="text-xs text-slate-500 mt-2">
            Select a PM card to open the same project analytics perspective that PM sees.
          </p>
        </div>
      </div>

      {pmScopes.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
          No PM users are available for analytics scope selection.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setSelectedPmScopeId('')}
            className={`text-left rounded-2xl border p-4 transition-all ${
              !selectedPmScopeId
                ? 'border-indigo-300 bg-indigo-50/70 dark:bg-indigo-900/20 shadow-sm'
                : 'border-slate-200 dark:border-border-dark hover:border-indigo-200'
            }`}
          >
            <p className="text-sm font-black text-slate-800 dark:text-white">All PMs (Executive)</p>
            <p className="text-[11px] text-slate-500 mt-2">Organization-wide analytics overview across all active projects.</p>
          </button>

          {pmScopes.map((pm) => {
            const isSelected = selectedPmScopeId === pm?._id;
            return (
              <button
                key={pm?._id}
                type="button"
                onClick={() => setSelectedPmScopeId(pm?._id || '')}
                className={`text-left rounded-2xl border p-4 transition-all ${
                  isSelected
                    ? 'border-indigo-300 bg-indigo-50/70 dark:bg-indigo-900/20 shadow-sm'
                    : 'border-slate-200 dark:border-border-dark hover:border-indigo-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 flex items-center justify-center font-black text-sm">
                    {String(pm?.name || 'P').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 dark:text-white">{pm?.name || 'Unnamed PM'}</p>
                    <p className="text-[11px] text-slate-500">{pm?.email || 'No email'}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>{Number(pm?.projectCount || 0)} Projects</span>
                  <span>{Number(pm?.developerCount || 0)} Devs</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderProjectAnalysis = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      {!effectiveProjectId ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-slate-100 dark:border-zinc-800">
          <BarChart3 size={48} className="mb-4 opacity-20" />
          <p className="text-xs font-black uppercase tracking-widest">Select a project to begin analytics</p>
        </div>
      ) : null}

      {isAdminPmScopedMode && selectedPmScope ? (
        <div className="bg-indigo-50/70 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-4 py-3 text-sm text-indigo-900 dark:text-indigo-100">
          Viewing PM analytics scope for <span className="font-black">{selectedPmScope.name}</span>. Project list and team analytics are filtered to that PM's accessible projects.
        </div>
      ) : null}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {!projectId && (
            <>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Project</label>
              <div className="relative">
                <select
                  className="appearance-none bg-white border border-slate-200 dark:bg-card-dark dark:border-border-dark rounded-xl px-4 py-2.5 pr-10 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-primary/10 shadow-sm cursor-pointer"
                  value={selectedProjectId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedProjectId(nextId);
                    const selectedProject = effectiveProjectPool.find((project) => project?._id === nextId);
                    if (selectedProject) {
                      setActiveProject(selectedProject);
                    }
                  }}
                >
                  <option value="">— Select a project —</option>
                  {effectiveProjectPool.map((project) => (
                    <option key={project._id} value={project._id}>{project.title}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </>
          )}

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
            <span className="text-2xl font-black text-slate-800 dark:text-white">{avgVelocity == null ? '—' : avgVelocity} <span className="text-xs font-bold text-slate-400">PTS</span></span>
          </div>
        </div>
      </div>

      {effectiveProjectId && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-3xl p-8 shadow-sm">
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3">
              <TrendingUp className="text-indigo-500" size={22} /> Risk Score by Sprint
            </h3>
            {sprintRiskData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-slate-400 text-sm">No risk runs yet for this project.</div>
            ) : (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sprintRiskData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-zinc-800" />
                    <XAxis dataKey="sprint" tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value, name, payload) => {
                        if (name === 'riskScore') {
                          return [value, 'Composite Risk (AI 75% + Pressure 25%)'];
                        }
                        return [value, name];
                      }}
                      labelFormatter={(label, points) => {
                        const point = points?.[0]?.payload;
                        if (!point) return label;
                        const aiText = point.aiRisk == null ? 'n/a' : `${Number(point.aiRisk).toFixed(1)}`;
                        return `${label} • AI Model ${aiText} • Pressure ${Number(point.pressureRisk || 0).toFixed(1)}`;
                      }}
                    />
                    <Line type="monotone" dataKey="riskScore" stroke="#4f46e5" strokeWidth={3} dot={{ r: 3, fill: '#4f46e5' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-3xl p-8 shadow-sm">
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3">
              <CheckCircle className="text-emerald-500" size={22} /> Rule-Based Delivery Outcome
            </h3>
            {sprintOutcomeData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-slate-400 text-sm">No completed sprints yet.</div>
            ) : (
              <>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sprintOutcomeData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-zinc-800" />
                      <XAxis dataKey="sprint" tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} axisLine={false} tickLine={false} />
                      <YAxis
                        domain={[0, 1]}
                        ticks={[0, 0.5, 1]}
                        tickFormatter={(v) => {
                          if (v === 1) return 'Pass';
                          if (v === 0) return 'Fail';
                          return 'Unknown';
                        }}
                        tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={renderOutcomeTooltip} />
                      <Bar dataKey="outcome" radius={[6, 6, 0, 0]}>
                        {sprintOutcomeData.map((entry, idx) => (
                          <Cell
                            key={`outcome-${idx}`}
                            fill={
                              entry.outcomeKey === 'pass'
                                ? '#10b981'
                                : entry.outcomeKey === 'fail'
                                  ? '#ef4444'
                                  : '#94a3b8'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs font-black uppercase tracking-widest">
                  <span className="text-emerald-600">Pass: {passFailSummary.pass}</span>
                  <span className="text-red-600">Fail: {passFailSummary.fail}</span>
                  <span className="text-slate-500">Unknown: {passFailSummary.unknown}</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Deterministic rule outcome only. Pass/fail percentages exclude unknown rows. Current pass rate:{' '}
                  {passFailSummary.passRate == null ? 'n/a' : `${passFailSummary.passRate}%`}{' '}
                  ({passFailSummary.evaluated} evaluated sprint{passFailSummary.evaluated === 1 ? '' : 's'}).
                </p>
              </>
            )}
          </div>

          <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-3xl p-8 shadow-sm">
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-3">
              <Users className="text-amber-500" size={22} /> Member Effort + Burnout
            </h3>
            {memberEffortBurnoutData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-slate-400 text-sm">No team data for this project.</div>
            ) : (
              <>
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={memberEffortBurnoutData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-zinc-800" />
                      <XAxis dataKey="member" tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} axisLine={false} tickLine={false} />
                      <YAxis
                        yAxisId="effort"
                        tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, effortAxisMax]}
                      />
                      <YAxis
                        yAxisId="burnout"
                        orientation="right"
                        tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        formatter={(value, name, item) => {
                          if (name === 'Effort Credit (Completed SP)') {
                            return [`${Number(value || 0).toFixed(2)} SP`, name];
                          }
                          if (name === 'Burnout (AI preferred)') {
                            const source = item?.payload?.displayBurnoutSource || 'Unknown source';
                            return [`${Number(value || 0).toFixed(1)} (${source})`, name];
                          }
                          return [value, name];
                        }}
                      />
                      <Legend iconType="circle" />
                      <Bar
                        yAxisId="effort"
                        name="Effort Credit (Completed SP)"
                        dataKey="effort"
                        fill="#4f46e5"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        yAxisId="burnout"
                        name="Burnout (AI preferred)"
                        dataKey="displayBurnout"
                        fill="#f59e0b"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Combined member card: effort credit is calculated per developer even on shared tasks, and burnout uses AI first with overall fallback only when AI is missing.
                </p>
                <div className="mt-3 space-y-1">
                  {memberEffortBurnoutData.map((entry) => (
                    <div key={`effort-burnout-${entry.member}`} className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{entry.member}</span>
                      <span>
                        Effort {entry.effort.toFixed(2)} SP | Burnout {entry.displayBurnout.toFixed(1)} ({entry.displayBurnoutSource}) | AI {entry.aiBurnout.toFixed(1)} | Overall {entry.overallBurnout.toFixed(1)} | Trend {entry.aiBurnoutTrendDelta >= 0 ? '+' : ''}{entry.aiBurnoutTrendDelta.toFixed(1)} ({entry.burnoutHistorySamples})
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
           ) : !hasVelocitySeriesData ? (
             <div className="h-72 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-slate-100 dark:border-zinc-800 px-6 text-center">
               <Target size={40} className="mb-4 opacity-20" />
               <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No completed sprint history yet</p>
               <p className="text-xs mt-2">
                 Velocity = sprint committed points vs delivered points, calculated only from completed sprints.
               </p>
             </div>
           ) : (
             <>
               <div className="h-72 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={velocitySeries}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-zinc-800" />
                     <XAxis dataKey="sprintName" tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} axisLine={false} tickLine={false} />
                     <YAxis tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} axisLine={false} tickLine={false} />
                     <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '16px', border: 'none', shadow: 'xl' }} />
                     <Bar name="Planned" dataKey="planned" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={24} />
                     <Bar name={hasVelocityHistory ? 'Delivered' : 'Delivered (Live)'} dataKey="completed" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={24} />
                   </BarChart>
                 </ResponsiveContainer>
               </div>
               <p className="mt-2 text-[11px] text-slate-500">
                 Committed points are locked when sprint starts. Delivered points are done items in sprint scope. Avg Velocity uses completed sprint history; live mode appears when history is not yet available.
               </p>
             </>
           )}
        </div>
      </div>

      {/* Team Breakdown */}
      <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-3xl p-8 shadow-sm">
        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-8">Member Effort + Burnout Snapshot</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {teamStats.map((stat, i) => (
            <div key={i} className="bg-slate-50 dark:bg-zinc-900/50 p-6 rounded-2xl flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full border-2 border-primary p-0.5 mb-3">
                <img src={stat.user.avatar || `https://ui-avatars.com/api/?name=${stat.user.name}&background=random`} className="w-full h-full rounded-full object-cover" />
              </div>
              <span className="text-sm font-black text-slate-800 dark:text-white">{stat.user.name}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase mt-1">Effort: {stat.completedStoryPoints} PTS</span>
              <span className="text-[10px] font-black text-slate-400 uppercase mt-1">
                Burnout: {Number(stat.aiBurnoutRiskScore || stat.overallBurnoutScore || stat.projectBurnoutScore || 0).toFixed(1)}
              </span>
              <div className="w-full h-1 bg-slate-200 dark:bg-zinc-800 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${stat.completionRate}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAdminAnalytics = () => (
    <div className="space-y-8">
      {renderAdminPmScopes()}
      {isAdminPmScopedMode ? renderProjectAnalysis() : renderOverview()}
    </div>
  );

  const analyticsDescription = projectId
    ? 'Drill-down into project performance and resource allocation.'
    : isAdminPmScopedMode
      ? `Viewing PM-scoped analytics for ${selectedPmScope?.name || 'selected PM'}.`
      : 'Executive overview of organizational project metrics.';

  const showAiDegradedBanner =
    shouldRenderProjectAnalysis &&
    !!effectiveProjectId &&
    healthRes?.success === true &&
    healthRes?.data?.ai &&
    healthRes.data.ai.ok === false;

  return (
    <PageShell title="Project Intelligence">
      {showAiDegradedBanner && (
        <div
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          AI inference service is not reachable. Risk and burnout scores may be stale until the Python
          service is running and <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">AI_SERVICE_URL</code>{' '}
          matches your deployment.
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">Analytics Hub</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{analyticsDescription}</p>
        </div>
        {!projectId && (
          <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl px-4 py-2 shadow-sm font-bold text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Live System Overview
          </div>
        )}
      </div>

      {isAdmin && !projectId
        ? renderAdminAnalytics()
        : shouldRenderProjectAnalysis
          ? renderProjectAnalysis()
          : renderOverview()}
    </PageShell>
  );
};
