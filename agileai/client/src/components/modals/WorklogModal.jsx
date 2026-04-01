import React, { useState } from 'react';
import { X, Loader2, PlayCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

export const WorklogModal = ({ isOpen, onClose, task }) => {
  const queryClient = useQueryClient();
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');

  const addWorklog = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.post(`/tasks/${task._id}/worklog`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Worklog added successfully');
      queryClient.invalidateQueries(['my-tasks']);
      onClose();
      setHours('');
      setDescription('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to add worklog');
    }
  });

  if (!isOpen || !task) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hours || isNaN(hours) || Number(hours) <= 0) {
      return toast.error('Please enter valid hours');
    }
    
    addWorklog.mutate({
      hours: Number(hours),
      description
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div 
        className="bg-card-light dark:bg-card-dark w-full max-w-md rounded-2xl shadow-xl border border-border-light dark:border-border-dark overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-light dark:border-border-dark">
          <div>
            <h2 className="text-lg font-bold">Log Work</h2>
            <p className="text-sm text-slate-500">Task: {task.ticketKey}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Time Spent (Hours)</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full bg-transparent border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="e.g. 2.5"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">What did you work on?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
              className="w-full bg-transparent border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none"
              placeholder="Briefly describe your progress..."
              required
            />
          </div>

          <div className="flex gap-3 justify-end mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addWorklog.isPending}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-md shadow-primary/20 hover:bg-primary-hover disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {addWorklog.isPending ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
              Save Worklog
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};