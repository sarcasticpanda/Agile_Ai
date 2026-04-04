import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, MessageSquare, Clock, ArrowRight, Activity, Zap, History, CalendarDays, Send } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { getTaskPriorityColor, getTaskStatusColor } from '../utils/statusColors';
import { formatDate, formatTimeAgo } from '../utils/dateUtils';
import * as tasksApi from '../api/tasks.api';
import { toast } from '../components/ui/Toast';
import useAuthStore from '../store/authStore';

export const TaskDetailSlideOver = ({ isOpen, onClose, taskId, projectId }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');

  const { data: response, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.getTaskById(taskId),
    enabled: !!taskId && isOpen,
  });

  const task = response?.data;

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus) => tasksApi.updateTaskStatus({ id: taskId, status: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries(['task', taskId]);
      if (projectId) {
        queryClient.invalidateQueries(['tasks', projectId]);
      }
      toast.success('Task status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const addCommentMutation = useMutation({
    mutationFn: (text) => tasksApi.addComment({ id: taskId, text }),
    onSuccess: () => {
      queryClient.invalidateQueries(['task', taskId]);
      setCommentText('');
      toast.success('Comment added');
    },
    onError: () => toast.error('Failed to add comment'),
  });

  const handleSaveComment = () => {
    if (!commentText.trim()) return toast.error('Comment cannot be empty');
    addCommentMutation.mutate(commentText.trim());
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

  if (!isOpen) return null;

  const formatLifecycleDate = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
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
                    disabled={updateStatusMutation.isPending || (user?.role?.toLowerCase() === 'developer' && task.assignee?._id !== user?._id && task.assignee !== user?._id)}
                    className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider outline-none cursor-pointer border border-transparent hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getTaskStatusColor(task.status)}`}
                  >
                    <option value="todo">TO DO</option>
                    <option value="inprogress">IN PROGRESS</option>
                    <option value="review">IN REVIEW</option>
                    <option value="done">DONE</option>
                  </select>
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
                  </div>
                   <div>
                     <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Reporter</h3>
                     <div className="flex items-center gap-3">
                       <Avatar src={task.reporter?.avatar} fallback={task.reporter?.name || 'UA'} size="sm" />
                       <span className="text-sm font-medium text-slate-900">{task.reporter?.name || 'System'}</span>
                     </div>
                   </div>
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
                      {task.statusHistory.map((entry, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0"></div>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${getTaskStatusColor(entry.from)}`}>{entry.from}</span>
                          <ArrowRight size={12} className="text-slate-400 flex-shrink-0" />
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${getTaskStatusColor(entry.to)}`}>{entry.to}</span>
                          <span className="text-[10px] text-slate-400 ml-auto">{formatLifecycleDate(entry.changedAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Worklogs */}
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
