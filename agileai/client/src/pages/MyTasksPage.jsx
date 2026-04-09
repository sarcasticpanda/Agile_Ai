import React, { useMemo, useState } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../api/axiosInstance';
import useAuthStore from '../store/authStore';
import { Clock, MessageSquare, CheckCircle2, PlayCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { WorklogModal } from '../components/modals/WorklogModal';

export const MyTasksPage = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedActiveTimer, setSelectedActiveTimer] = useState(null);

  const invalidateAnalytics = () => {
    queryClient.invalidateQueries(['analyticsOverview']);
    queryClient.invalidateQueries(['velocity']);
    queryClient.invalidateQueries(['teamStats']);
    queryClient.invalidateQueries(['burndown']);
    queryClient.invalidateQueries(['sprints']);
  };

  const { data: tasksRes, isLoading } = useQuery({
    queryKey: ['my-tasks', user?._id],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/tasks?assigneeId=${user?._id}`);
      return data;
    },
    enabled: !!user?._id,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const updateStatusStatus = useMutation({
    mutationFn: async ({ taskId, status }) => {
      const { data } = await axiosInstance.patch(`/tasks/${taskId}/status`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my-tasks', user?._id]);
      invalidateAnalytics();
      toast.success('Task status updated');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  });

  const startTimerMutation = useMutation({
    mutationFn: async ({ taskId }) => {
      const { data } = await axiosInstance.post(`/tasks/${taskId}/worklog/start`, {
        activityType: 'implementation',
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my-tasks', user?._id]);
      queryClient.invalidateQueries(['tasks']);
      invalidateAnalytics();
      toast.success('Work session started. Task moved to In Progress.');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to start work session');
    }
  });

  const tasks = tasksRes?.data || [];

  const toIdString = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value._id) return String(value._id);
    if (typeof value.toString === 'function') return String(value.toString());
    return null;
  };

  const getCollaboratorNames = (task) => {
    const currentUserId = toIdString(user?._id);
    const names = new Set();

    if (Array.isArray(task?.assignees)) {
      task.assignees.forEach((entry) => {
        const memberId = toIdString(entry?.user?._id || entry?.user);
        const memberName = entry?.user?.name;
        if (memberName && memberId && memberId !== currentUserId) {
          names.add(memberName);
        }
      });
    }

    const primaryId = toIdString(task?.assignee?._id || task?.assignee);
    const primaryName = task?.assignee?.name;
    if (primaryName && primaryId && primaryId !== currentUserId) {
      names.add(primaryName);
    }

    return Array.from(names);
  };

  const getMyLoggedHours = (task) => {
    const currentUserId = toIdString(user?._id);
    const logs = Array.isArray(task?.worklogs) ? task.worklogs : [];

    return logs.reduce((sum, log) => {
      const logUserId = toIdString(log?.user?._id || log?.user);
      if (logUserId !== currentUserId) return sum;
      const value = Number(log?.hours || 0);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  };

  const getOtherContributions = (task) => {
    const currentUserId = toIdString(user?._id);
    const logs = Array.isArray(task?.worklogs) ? task.worklogs : [];
    const byUser = new Map();

    logs.forEach((log) => {
      const logUserId = toIdString(log?.user?._id || log?.user);
      const logUserName = log?.user?.name;
      const hours = Number(log?.hours || 0);
      if (!logUserId || logUserId === currentUserId || !logUserName) return;
      if (!Number.isFinite(hours) || hours <= 0) return;
      byUser.set(logUserName, (byUser.get(logUserName) || 0) + hours);
    });

    return Array.from(byUser.entries())
      .map(([name, loggedHours]) => ({
        name,
        loggedHours: Number(loggedHours.toFixed(2)),
      }))
      .sort((a, b) => b.loggedHours - a.loggedHours);
  };

  const getMyActiveTimer = (task) => {
    const currentUserId = toIdString(user?._id);
    const timers = Array.isArray(task?.activeTimers) ? task.activeTimers : [];

    return timers.find((timer) => {
      const timerUserId = toIdString(timer?.user?._id || timer?.user);
      return timerUserId === currentUserId;
    }) || null;
  };

  const sortedTasks = useMemo(() => {
    const statusPriority = {
      inprogress: 0,
      review: 1,
      todo: 2,
      done: 3,
    };

    return [...tasks].sort((a, b) => {
      const aHasActiveTimer = !!getMyActiveTimer(a);
      const bHasActiveTimer = !!getMyActiveTimer(b);
      if (aHasActiveTimer !== bHasActiveTimer) {
        return aHasActiveTimer ? -1 : 1;
      }

      const aStatus = String(a?.status || '').toLowerCase();
      const bStatus = String(b?.status || '').toLowerCase();
      const aPriority = statusPriority[aStatus] ?? 99;
      const bPriority = statusPriority[bStatus] ?? 99;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      const aUpdatedAt = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      const bUpdatedAt = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      return bUpdatedAt - aUpdatedAt;
    });
  }, [tasks, user?._id]);

  const formatElapsed = (startedAt) => {
    if (!startedAt) return '0m';
    const start = new Date(startedAt);
    if (isNaN(start.getTime())) return '0m';

    const diffMs = Date.now() - start.getTime();
    if (diffMs <= 0) return '0m';

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const handleStatusChange = (taskId, status) => {
    updateStatusStatus.mutate({ taskId, status });
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'todo': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      case 'inprogress': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'review': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'done': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <PageShell title="My Tasks">
      <div className="flex flex-col gap-6">
        <div className="mb-4">
          <p className="text-slate-500">View and manage tasks assigned directly to you.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="text-center p-20 bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
            <CheckCircle2 size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">You're all caught up!</h3>
            <p className="text-slate-500">There are no tasks assigned to you right now.</p>
            <p className="text-slate-400 text-xs mt-4">If you think this is a mistake, verify with your Project Manager that you are assigned to an active sprint.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sortedTasks.map(task => {
              const collaborators = getCollaboratorNames(task);
              const isSharedTask = collaborators.length > 0;
              const myLoggedHours = getMyLoggedHours(task);
              const activeTimer = getMyActiveTimer(task);
              const otherContributions = getOtherContributions(task);

              return (
              <div 
                key={task._id}
                className="bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row gap-4 justify-between items-start md:items-center"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(task.status)}`}>
                      {task.status?.replace('inprogress', 'In Progress') || 'Todo'}
                    </span>
                    {isSharedTask && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        Shared Task
                      </span>
                    )}
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                      {task.ticketKey || 'TASK'}
                    </span>
                    <span className="text-xs text-slate-500 capitalize">{task.type}</span>
                  </div>
                  <h3 className="text-base font-semibold mb-1">{task.title}</h3>
                  {task.description && (
                    <p className="text-sm text-slate-500 line-clamp-2 md:line-clamp-1">{task.description}</p>
                  )}

                  {isSharedTask && (
                    <p className="mt-2 text-xs text-slate-500">
                      Shared with: <span className="font-semibold text-slate-700 dark:text-slate-300">{collaborators.join(', ')}</span>
                    </p>
                  )}

                  {isSharedTask && (
                    <p className="mt-1 text-xs text-slate-500">
                      Your logged contribution: <span className="font-semibold text-slate-700 dark:text-slate-300">{myLoggedHours.toFixed(2)}h</span>
                    </p>
                  )}

                  {isSharedTask && otherContributions.length > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      Team contribution: <span className="font-semibold text-slate-700 dark:text-slate-300">{otherContributions.map((entry) => `${entry.name} ${entry.loggedHours}h`).join(', ')}</span>
                    </p>
                  )}

                  {activeTimer && (
                    <p className="mt-1 text-xs text-emerald-600 font-semibold">
                      Active session: {formatElapsed(activeTimer.startedAt)}
                    </p>
                  )}
                  
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5" title="Story Points">
                      <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-semibold text-[10px]">
                        {task.storyPoints || '-'}
                      </div> 
                      Points
                    </span>
                    {task.estimatedHours > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock size={14} /> Est: {task.estimatedHours}h
                      </span>
                    )}
                    {task.comments?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare size={14} /> {task.comments.length}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task._id, e.target.value)}
                    className="text-sm border border-border-light dark:border-border-dark rounded-md bg-transparent px-3 py-1.5 font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <option value="todo">Todo</option>
                    <option value="inprogress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </select>

                  {activeTimer ? (
                    <button
                      onClick={() => {
                        setSelectedTask(task);
                        setSelectedActiveTimer(activeTimer);
                      }}
                      className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                    >
                      <PlayCircle size={16} /> Stop & Log
                    </button>
                  ) : (
                    <button
                      onClick={() => startTimerMutation.mutate({ taskId: task._id })}
                      disabled={startTimerMutation.isPending}
                      className="flex items-center gap-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      <PlayCircle size={16} /> Start Work
                    </button>
                  )}
                  
                  {/* Phase 5 hook for Worklog Model */}
                  <button
                    onClick={() => {
                      setSelectedTask(task);
                      setSelectedActiveTimer(null);
                    }}
                    className="flex items-center gap-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <PlayCircle size={16} /> Worklog
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedTask && (
        <WorklogModal 
          isOpen={!!selectedTask}
          onClose={() => {
            setSelectedTask(null);
            setSelectedActiveTimer(null);
          }}
          task={selectedTask}
          activeTimer={selectedActiveTimer}
        />
      )}
    </PageShell>
  );
};

