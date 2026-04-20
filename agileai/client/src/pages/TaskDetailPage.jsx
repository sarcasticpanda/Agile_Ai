import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, MessageSquare, Clock, ArrowRight, Activity, Zap, History, CalendarDays, Send } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { getTaskPriorityColor, getTaskStatusColor } from '../utils/statusColors';
import { formatDate, formatTimeAgo } from '../utils/dateUtils';
import * as tasksApi from '../api/tasks.api';
import * as projectsApi from '../api/projects.api';
import { toast } from '../components/ui/Toast';
import useAuthStore from '../store/authStore';

export const TaskDetailSlideOver = ({ isOpen, onClose, taskId, projectId }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([]);
  const [currentAssigneeIds, setCurrentAssigneeIds] = useState([]);
  const isDevOnly = user?.role?.toLowerCase() === 'developer';

  const toIdString = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value._id) return String(value._id);
    if (typeof value.toString === 'function') return String(value.toString());
    return null;
  };

  const taskHasUserAssignment = (taskRecord, userId) => {
    if (!taskRecord || !userId) return false;
    const uid = String(userId);

    if (toIdString(taskRecord.assignee) === uid) return true;

    if (Array.isArray(taskRecord.assignees)) {
      const inAssignees = taskRecord.assignees.some((entry) => toIdString(entry?.user) === uid);
      if (inAssignees) return true;
    }

    if (Array.isArray(taskRecord.subtasks)) {
      const inSubtasks = taskRecord.subtasks.some((subtask) => toIdString(subtask?.assignee) === uid);
      if (inSubtasks) return true;
    }

    return false;
  };

  const { data: response, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.getTaskById(taskId),
    enabled: !!taskId && isOpen,
  });

  const { data: tasksListResponse } = useQuery({
    queryKey: ['tasks', projectId, 'for-blocked-by'],
    queryFn: () => tasksApi.getTasks({ projectId, sprintId: undefined }),
    enabled: !!projectId && isOpen,
  });

  const { data: projectMembersResponse } = useQuery({
    queryKey: ['project-members-task-detail', projectId],
    queryFn: () => projectsApi.getProjectMembers(projectId),
    enabled: !!projectId && isOpen && !isDevOnly,
  });

  const task = response?.data;
  const projectMembers = projectMembersResponse?.data || [];
  const assignableMembers = (projectMembers || []).filter((member) => member?.user && member.role !== 'pm');
  const allProjectTasks = tasksListResponse?.data || [];
  const blockedByIds = (task?.blockedBy || []).map((t) => (typeof t === 'string' ? t : t?._id || String(t)));
  const candidateBlockers = (allProjectTasks || [])
    .filter((t) => t?._id && t._id !== taskId)
    .filter((t) => !blockedByIds.includes(t._id));

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus) => tasksApi.updateTaskStatus({ id: taskId, status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      }
      toast.success('Task status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const addCommentMutation = useMutation({
    mutationFn: (text) => tasksApi.addComment({ id: taskId, text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setCommentText('');
      toast.success('Comment added');
    },
    onError: () => toast.error('Failed to add comment'),
  });

  const handleSaveComment = () => {
    if (!commentText.trim()) return toast.error('Comment cannot be empty');
    addCommentMutation.mutate(commentText.trim());
  };

  const updateBlockedByMutation = useMutation({
    mutationFn: (newBlockedByIds) => tasksApi.updateTask({ id: taskId, data: { blockedBy: newBlockedByIds } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId, 'for-blocked-by'] });
      }
      toast.success('Dependencies updated');
    },
    onError: () => toast.error('Failed to update dependencies'),
  });

  const updateAssigneesMutation = useMutation({
    mutationFn: (nextAssigneeIds) => {
      const normalizedIds = Array.from(new Set((nextAssigneeIds || []).filter(Boolean)));
      const payload = {
        assignee: normalizedIds[0] || null,
        assignees: normalizedIds.map((id) => ({
          user: id,
          contributionPercent: Number((100 / normalizedIds.length).toFixed(2)),
        })),
      };
      return tasksApi.updateTask({ id: taskId, data: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
        queryClient.invalidateQueries({ queryKey: ['my-tasks', user?._id] });
      }
      toast.success('Task assignment updated');
    },
    onError: () => toast.error('Failed to update task assignment'),
  });

  const handleAddBlocker = (blockerId) => {
    if (!blockerId) return;
    const next = Array.from(new Set([...(blockedByIds || []), blockerId]));
    updateBlockedByMutation.mutate(next);
  };

  const handleRemoveBlocker = (blockerId) => {
    const next = (blockedByIds || []).filter((id) => id !== blockerId);
    updateBlockedByMutation.mutate(next);
  };

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Reset comment when task changes
  useEffect(() => {
    setCommentText('');
  }, [taskId]);

  useEffect(() => {
    if (!task) {
      setSelectedAssigneeIds([]);
      setCurrentAssigneeIds([]);
      return;
    }

    const ids = new Set();

    if (task.assignee) {
      ids.add(typeof task.assignee === 'string' ? task.assignee : task.assignee._id);
    }

    if (Array.isArray(task.assignees)) {
      task.assignees.forEach((entry) => {
        const userId = entry?.user
          ? typeof entry.user === 'string'
            ? entry.user
            : entry.user._id
          : null;
        if (userId) ids.add(userId);
      });
    }

    const normalized = Array.from(ids);
    setSelectedAssigneeIds(normalized);
    setCurrentAssigneeIds(normalized);
  }, [task]);

  if (!isOpen) return null;

  const formatLifecycleDate = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const aiSp = typeof task?.aiEstimatedStoryPoints === 'number' ? task.aiEstimatedStoryPoints : null;
  const aiHours = typeof task?.aiEstimatedHours === 'number' ? task.aiEstimatedHours : null;
  const aiConfidence = typeof task?.aiEstimateConfidence === 'number' ? task.aiEstimateConfidence : null;
  const aiSpAt = task?.aiEstimatedStoryPointsAt || null;
  const aiHoursBaseline = typeof task?.aiHoursPerPointBaseline === 'number' ? task.aiHoursPerPointBaseline : null;
  const aiHoursSampleCount = typeof task?.aiHoursPerPointSampleCount === 'number' ? task.aiHoursPerPointSampleCount : null;
  const aiModel = task?.aiEffortModelVersion || null;
  const canCurrentUserUpdateStatus = !isDevOnly || taskHasUserAssignment(task, user?._id);
  const currentContributorNames =
    Array.isArray(task?.assignees) && task.assignees.length > 0
      ? task.assignees
          .map((entry) => entry?.user?.name)
          .filter(Boolean)
      : task?.assignee?.name
        ? [task.assignee.name]
        : [];
  const activeTimers = Array.isArray(task?.activeTimers) ? task.activeTimers : [];
  const worklogContributionSummary = (() => {
    const logs = Array.isArray(task?.worklogs) ? task.worklogs : [];
    const byUser = new Map();

    logs.forEach((log) => {
      const userName = log?.user?.name || 'Unknown';
      const hours = Number(log?.hours || 0);
      if (!Number.isFinite(hours) || hours <= 0) return;
      byUser.set(userName, (byUser.get(userName) || 0) + hours);
    });

    return Array.from(byUser.entries())
      .map(([userName, hours]) => ({ userName, hours: Number(hours.toFixed(2)) }))
      .sort((a, b) => b.hours - a.hours);
  })();

  const normalizeIdList = (ids = []) =>
    Array.from(new Set((ids || []).map((id) => String(id)).filter(Boolean))).sort();

  const hasAssignmentChanges =
    normalizeIdList(selectedAssigneeIds).join('|') !== normalizeIdList(currentAssigneeIds).join('|');

  const formatStatusLabel = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'todo') return 'To Do';
    if (value === 'inprogress') return 'In Progress';
    if (value === 'review') return 'In Review';
    if (value === 'done') return 'Done';
    return status || 'Unknown';
  };

  const toggleAssignee = (memberId) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const saveAssignees = () => {
    if (!hasAssignmentChanges) {
      toast.error('No assignment changes to save');
      return;
    }

    if (selectedAssigneeIds.length === 0) {
      toast.error('Select at least one contributor or use Unassign All explicitly');
      return;
    }

    const currentNames = assignableMembers
      .filter((member) => currentAssigneeIds.includes(member?.user?._id))
      .map((member) => member?.user?.name)
      .filter(Boolean);

    const nextNames = assignableMembers
      .filter((member) => selectedAssigneeIds.includes(member?.user?._id))
      .map((member) => member?.user?.name)
      .filter(Boolean);

    const proceed = window.confirm(
      `Update assignment?\n\nCurrent: ${currentNames.length > 0 ? currentNames.join(', ') : 'Unassigned'}\nNext: ${nextNames.join(', ')}`
    );

    if (!proceed) return;

    updateAssigneesMutation.mutate(selectedAssigneeIds, {
      onSuccess: () => {
        setCurrentAssigneeIds(Array.from(new Set(selectedAssigneeIds.map((id) => String(id)))));
      },
    });
  };

  const resetAssigneeSelection = () => {
    setSelectedAssigneeIds(currentAssigneeIds);
  };

  const clearAllAssignees = () => {
    const proceed = window.confirm('Unassign all contributors from this task?');
    if (!proceed) return;

    updateAssigneesMutation.mutate([], {
      onSuccess: () => {
        setCurrentAssigneeIds([]);
        setSelectedAssigneeIds([]);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-2xl transform bg-white shadow-2xl transition-transform animate-in slide-in-from-right-full duration-300">
          
          {isLoading || !task ? (
            <div className="flex h-full items-center justify-center p-8 text-slate-400">Loading details...</div>
          ) : (
            <div className="flex h-full flex-col">
              
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-500 tracking-widest">AGL-{task._id.substring(task._id.length - 4)}</span>
                  <Badge className="uppercase tracking-wider text-[10px]">{task.issueType || task.type || 'Task'}</Badge>
                </div>
                <div className="flex items-center gap-2">
                   <Button variant="ghost" size="icon" onClick={onClose}>
                      <X size={20} className="text-slate-400" />
                   </Button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                <h1 className="text-2xl font-bold text-slate-900 mb-6">{task.title}</h1>
                
                <div className="flex items-center gap-4 mb-8 flex-wrap">
                  <select 
                    value={task.status}
                    onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                    disabled={updateStatusMutation.isPending || !canCurrentUserUpdateStatus}
                    className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider outline-none cursor-pointer border border-transparent hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getTaskStatusColor(task.status)}`}
                  >
                    <option value="todo">TO DO</option>
                    <option value="inprogress">IN PROGRESS</option>
                    <option value="review">IN REVIEW</option>
                    <option value="done">DONE</option>
                  </select>
                  {isDevOnly && !canCurrentUserUpdateStatus && (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                      Only assigned contributors can change this status.
                    </span>
                  )}
                  <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${getTaskPriorityColor(task.priority)}`}>
                    {task.priority} Priority
                  </span>
                   {task.storyPoints > 0 && (
                     <span className="flex items-center gap-1 text-sm font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        <Zap size={14} className="text-indigo-500" /> {task.storyPoints} Pts
                     </span>
                   )}
                </div>

                <div className="prose prose-sm max-w-none text-slate-700 mb-10">
                  <h3 className="text-slate-900 font-semibold mb-2">Description</h3>
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 min-h-[80px]">
                     {task.description || <span className="text-slate-400 italic">No description provided.</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-10">
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Assignee</h3>
                     <div className="flex items-center gap-3">
                       <Avatar src={task.assignee?.avatar} fallback={task.assignee?.name || 'UA'} size="sm" />
                       <span className="text-sm font-medium text-slate-900">{task.assignee?.name || 'Unassigned'}</span>
                     </div>
                     {!isDevOnly && assignableMembers.length > 0 && (
                       <div className="mt-4 space-y-2">
                         <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reassign Contributors</p>
                         <p className="text-[11px] text-slate-500">
                           Current: {currentContributorNames.length > 0 ? currentContributorNames.join(', ') : 'Unassigned'}
                         </p>
                         <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                           {assignableMembers.map((member) => {
                             const memberId = member.user?._id;
                             const memberName = member.user?.name || 'Unknown';
                             const checked = selectedAssigneeIds.includes(memberId);
                             return (
                               <label key={memberId} className="flex items-center gap-2 text-sm text-slate-700">
                                 <input
                                   type="checkbox"
                                   className="rounded border-slate-300"
                                   checked={checked}
                                   disabled={updateAssigneesMutation.isPending}
                                   onChange={() => toggleAssignee(memberId)}
                                 />
                                 <span>{memberName}</span>
                               </label>
                             );
                           })}
                         </div>
                         <div className="flex items-center gap-2 pt-1">
                           <Button
                             size="sm"
                             variant="ghost"
                             onClick={resetAssigneeSelection}
                             disabled={updateAssigneesMutation.isPending || !hasAssignmentChanges}
                           >
                             Reset
                           </Button>
                           <Button
                             size="sm"
                             variant="outline"
                             onClick={clearAllAssignees}
                             disabled={updateAssigneesMutation.isPending || currentAssigneeIds.length === 0}
                           >
                             Unassign All
                           </Button>
                           <Button
                             size="sm"
                             onClick={saveAssignees}
                             disabled={updateAssigneesMutation.isPending || !hasAssignmentChanges || selectedAssigneeIds.length === 0}
                           >
                             {updateAssigneesMutation.isPending ? 'Saving...' : 'Save Assignment'}
                           </Button>
                         </div>
                       </div>
                     )}
                  </div>
                   <div>
                     <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Reporter</h3>
                     <div className="flex items-center gap-3">
                       <Avatar src={task.reporter?.avatar} fallback={task.reporter?.name || 'UA'} size="sm" />
                       <span className="text-sm font-medium text-slate-900">{task.reporter?.name || 'System'}</span>
                     </div>
                   </div>
                </div>

                {/* AI Effort Estimate (persisted) */}
                <div className="border-t border-slate-200 pt-6 mb-8">
                  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Zap size={18} /> AI Effort Estimate
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Predicted Story Points</span>
                      <span className="text-sm font-extrabold text-slate-800">
                        {aiSp == null ? '—' : aiSp.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Estimated Hours</span>
                      <span className="text-sm font-extrabold text-slate-800">
                        {aiHours == null ? 'Pending estimate' : `${aiHours.toFixed(1)}h ${aiConfidence != null ? `(${Math.round(aiConfidence * 100)}% confidence)` : ''}`}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {aiHoursBaseline == null
                          ? 'Hours baseline: not available yet'
                          : `Baseline: ${aiHoursBaseline.toFixed(2)} hrs/pt (n=${aiHoursSampleCount ?? 0})`}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    {aiSpAt ? `Computed: ${new Date(aiSpAt).toLocaleString()}` : 'Computed: —'}
                    {aiModel ? ` • Model: ${String(aiModel).slice(0, 12)}…` : ''}
                  </div>
                </div>

                {/* Dependencies / Blockers */}
                <div className="border-t border-slate-200 pt-6 mb-8">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Blocked by</h3>
                  {blockedByIds.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No blockers set.</p>
                  ) : (
                    <div className="space-y-2 mb-3">
                      {blockedByIds.map((id) => {
                        const blockerTask = (allProjectTasks || []).find((t) => t?._id === id);
                        const label = blockerTask
                          ? `${blockerTask.title} (AGL-${String(blockerTask._id).slice(-4)})`
                          : `AGL-${String(id).slice(-4)}`;

                        return (
                          <div key={id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                            <span className="text-sm text-slate-700 font-medium truncate">{label}</span>
                            {!isDevOnly && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveBlocker(id)}
                                disabled={updateBlockedByMutation.isPending}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!isDevOnly && (
                    <div className="flex items-center gap-3">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          handleAddBlocker(e.target.value);
                          e.target.value = '';
                        }}
                        disabled={updateBlockedByMutation.isPending || candidateBlockers.length === 0}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none"
                      >
                        <option value="" disabled>
                          {candidateBlockers.length === 0 ? 'No available tasks to add' : 'Add blocker task...'}
                        </option>
                        {candidateBlockers.map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.title} (AGL-{String(t._id).slice(-4)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {isDevOnly && (
                    <p className="text-xs text-slate-400 mt-2">Only PM/Admin can change dependencies.</p>
                  )}
                </div>

                {/* Lifecycle Dates */}
                <div className="border-t border-slate-200 pt-6 mb-8">
                  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <CalendarDays size={18} /> Lifecycle Dates
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Created</span>
                      <span className="text-xs font-semibold text-slate-700">{formatLifecycleDate(task.createdAt) || '—'}</span>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <span className="text-[10px] font-bold uppercase text-blue-400 block mb-1">Assigned</span>
                      <span className="text-xs font-semibold text-blue-700">{formatLifecycleDate(task.assignedAt) || '—'}</span>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <span className="text-[10px] font-bold uppercase text-amber-400 block mb-1">Started</span>
                      <span className="text-xs font-semibold text-amber-700">{formatLifecycleDate(task.startedAt) || '—'}</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <span className="text-[10px] font-bold uppercase text-emerald-400 block mb-1">Completed</span>
                      <span className="text-xs font-semibold text-emerald-700">{formatLifecycleDate(task.completedAt) || '—'}</span>
                    </div>
                    {task.reopenedAt && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 col-span-2">
                        <span className="text-[10px] font-bold uppercase text-red-400 block mb-1">Reopened</span>
                        <span className="text-xs font-semibold text-red-700">{formatLifecycleDate(task.reopenedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status History Timeline */}
                {task.statusHistory && task.statusHistory.length > 0 && (
                  <div className="border-t border-slate-200 pt-6 mb-8">
                    <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <History size={18} /> Status History
                    </h3>
                    <div className="space-y-3">
                      {[...task.statusHistory].reverse().map((entry, i) => (
                        <div key={`${entry?.changedAt || i}-${i}`} className="flex items-start gap-3 text-sm">
                          <div className="w-2 h-2 mt-1.5 rounded-full bg-indigo-500 flex-shrink-0"></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${getTaskStatusColor(entry.from)}`}>
                                {formatStatusLabel(entry.from)}
                              </span>
                              <ArrowRight size={12} className="text-slate-400 flex-shrink-0" />
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${getTaskStatusColor(entry.to)}`}>
                                {formatStatusLabel(entry.to)}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                by {entry?.changedBy?.name || 'System'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">{formatLifecycleDate(entry.changedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Worklogs */}
                {activeTimers.length > 0 && (
                  <div className="border-t border-slate-200 pt-6 mb-8">
                    <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Activity size={18} /> Active Work Sessions
                    </h3>
                    <div className="space-y-2">
                      {activeTimers.map((timer, i) => (
                        <div key={`${timer?.user?._id || timer?.user || i}-${i}`} className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-emerald-800">{timer?.user?.name || 'Contributor'}</span>
                            <span className="text-[10px] text-emerald-600">Started {formatLifecycleDate(timer?.startedAt)}</span>
                          </div>
                          <div className="text-[11px] text-emerald-700">
                            {(timer?.activityType || 'implementation').replace('-', ' ')}
                            {timer?.note ? ` • ${timer.note}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {worklogContributionSummary.length > 0 && (
                  <div className="border-t border-slate-200 pt-6 mb-8">
                    <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Clock size={18} /> Contribution Summary
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {worklogContributionSummary.map((entry) => (
                        <div key={entry.userName} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">{entry.userName}</span>
                          <span className="text-xs font-bold text-indigo-700">{entry.hours}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {task.worklogs && task.worklogs.length > 0 && (
                  <div className="border-t border-slate-200 pt-6 mb-8">
                    <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Clock size={18} /> Work Logs
                    </h3>
                    <div className="space-y-3">
                      {task.worklogs.map((log, i) => (
                        <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-700">{log.user?.name || 'User'}</span>
                            <span className="text-[10px] text-slate-400">{formatLifecycleDate(log.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                              {(log.activityType || 'implementation').replace('-', ' ')}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                              {log.outcome || 'progress'}
                            </span>
                            {log.progressDelta !== null && log.progressDelta !== undefined && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                Progress {Number(log.progressDelta) > 0 ? '+' : ''}{log.progressDelta}%
                              </span>
                            )}
                            {log.source === 'time-range' && log.startedAt && log.endedAt && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                {new Date(log.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {' - '}
                                {new Date(log.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">{log.hours}h</span>
                            <span>{log.description || 'No description'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity / Comments */}
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Activity size={18} /> Comments ({task.comments?.length || 0})
                  </h3>
                  
                  <div className="space-y-6">
                    {task.comments?.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">No comments yet.</p>
                    ) : (
                      task.comments?.map((comment, i) => (
                        <div key={i} className="flex gap-4">
                          <Avatar fallback={comment.user?.name || 'U'} size="sm" />
                          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <div className="flex items-center justify-between pl-1 mb-2">
                              <span className="text-xs font-bold text-slate-700">{comment.user?.name || 'User'}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{formatTimeAgo(comment.createdAt)}</span>
                            </div>
                            <p className="text-sm text-slate-600 pl-1">{comment.text}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* Comment input box — FIXED: now has state and onClick handler */}
                  <div className="flex gap-4 mt-6">
                    <Avatar fallback="ME" size="sm" />
                    <div className="flex-1">
                       <textarea 
                          className="w-full text-sm rounded-lg border border-slate-300 p-3 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none shadow-sm"
                          placeholder="Add a comment..."
                          rows={2}
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                              handleSaveComment();
                            }
                          }}
                       />
                       <div className="flex justify-end mt-2">
                         <Button 
                           size="sm" 
                           onClick={handleSaveComment}
                           disabled={addCommentMutation.isPending || !commentText.trim()}
                         >
                           <Send size={14} className="mr-1" />
                           {addCommentMutation.isPending ? 'Saving...' : 'Save Comment'}
                         </Button>
                       </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
