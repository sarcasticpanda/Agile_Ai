import React from 'react';
import { PageShell } from '../components/layout/PageShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../api/axiosInstance';
import useAuthStore from '../store/authStore';
import { Clock, MessageSquare, CheckCircle2, PlayCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { WorklogModal } from '../components/modals/WorklogModal';

export const MyTasksPage = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState(null);

  const { data: tasksRes, isLoading } = useQuery({
    queryKey: ['my-tasks', user?._id],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/tasks?assigneeId=${user?._id}`);
      return data;
    },
    enabled: !!user?._id,
  });

  const updateStatusStatus = useMutation({
    mutationFn: async ({ taskId, status }) => {
      const { data } = await axiosInstance.patch(`/tasks/${taskId}/status`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my-tasks', user?._id]);
      toast.success('Task status updated');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  });

  const tasks = tasksRes?.data || [];

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
        ) : tasks.length === 0 ? (
          <div className="text-center p-20 bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
            <CheckCircle2 size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">You're all caught up!</h3>
            <p className="text-slate-500">There are no tasks assigned to you right now.</p>
            <p className="text-slate-400 text-xs mt-4">If you think this is a mistake, verify with your Project Manager that you are assigned to an active sprint.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {tasks.map(task => (
              <div 
                key={task._id}
                className="bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row gap-4 justify-between items-start md:items-center"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(task.status)}`}>
                      {task.status?.replace('inprogress', 'In Progress') || 'Todo'}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                      {task.ticketKey || 'TASK'}
                    </span>
                    <span className="text-xs text-slate-500 capitalize">{task.type}</span>
                  </div>
                  <h3 className="text-base font-semibold mb-1">{task.title}</h3>
                  {task.description && (
                    <p className="text-sm text-slate-500 line-clamp-2 md:line-clamp-1">{task.description}</p>
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
                  
                  {/* Phase 5 hook for Worklog Model */}
                  <button
                    onClick={() => setSelectedTask(task)}
                    className="flex items-center gap-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <PlayCircle size={16} /> Worklog
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTask && (
        <WorklogModal 
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          task={selectedTask}
        />
      )}
    </PageShell>
  );
};

