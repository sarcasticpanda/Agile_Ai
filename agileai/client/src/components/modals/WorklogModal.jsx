import React, { useEffect, useState } from 'react';
import { X, Loader2, PlayCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../../api/axiosInstance';
import toast from 'react-hot-toast';

const toLocalInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  const tzOffsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
};

const addMinutes = (value, minutes) => {
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return new Date(date.getTime() + minutes * 60000);
};

export const WorklogModal = ({ isOpen, onClose, task, activeTimer = null }) => {
  const queryClient = useQueryClient();
  const isStoppingTimer = !!activeTimer;
  const [mode, setMode] = useState('hours');
  const [hours, setHours] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [endedAt, setEndedAt] = useState('');
  const [activityType, setActivityType] = useState('implementation');
  const [outcome, setOutcome] = useState('progress');
  const [progressDelta, setProgressDelta] = useState('');
  const [statusAfterStop, setStatusAfterStop] = useState('');
  const [description, setDescription] = useState('');

  const invalidateAnalytics = () => {
    queryClient.invalidateQueries(['analyticsOverview']);
    queryClient.invalidateQueries(['velocity']);
    queryClient.invalidateQueries(['teamStats']);
    queryClient.invalidateQueries(['burndown']);
    queryClient.invalidateQueries(['sprints']);
  };

  const resetForm = () => {
    setMode('hours');
    setHours('');
    setStartedAt('');
    setEndedAt('');
    setActivityType('implementation');
    setOutcome('progress');
    setProgressDelta('');
    setStatusAfterStop('');
    setDescription('');
  };

  useEffect(() => {
    if (!isOpen || !isStoppingTimer) return;

    const startedDate = activeTimer?.startedAt ? new Date(activeTimer.startedAt) : new Date();
    const now = new Date();
    const minEnd = addMinutes(startedDate, 1) || now;
    const defaultEnd = now > minEnd ? now : minEnd;
    const elapsedHours = Math.max(0.01, (defaultEnd.getTime() - startedDate.getTime()) / (1000 * 60 * 60));

    setMode('hours');
    setHours(elapsedHours.toFixed(2));
    setStartedAt(toLocalInputValue(startedDate));
    setEndedAt(toLocalInputValue(defaultEnd));
    setActivityType(activeTimer?.activityType || 'implementation');
    setOutcome('progress');
    setStatusAfterStop('');
    setDescription('Stopped active timer session.');
  }, [isOpen, isStoppingTimer, activeTimer?.startedAt, activeTimer?.activityType]);

  const addWorklog = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.post(`/tasks/${task._id}/worklog`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Worklog added successfully');
      queryClient.invalidateQueries(['my-tasks']);
      queryClient.invalidateQueries(['task', task?._id]);
      invalidateAnalytics();
      onClose();
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to add worklog');
    }
  });

  const stopWorklogTimer = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.post(`/tasks/${task._id}/worklog/stop`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Work timer stopped and log recorded');
      queryClient.invalidateQueries(['my-tasks']);
      queryClient.invalidateQueries(['task', task?._id]);
      queryClient.invalidateQueries(['tasks']);
      invalidateAnalytics();
      onClose();
      resetForm();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to stop work timer');
    }
  });

  if (!isOpen || !task) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    let parsedHours = Number(hours);
    const usingRange = mode === 'range';

    if (usingRange) {
      if (!startedAt || !endedAt) {
        return toast.error('Please provide both start and end time');
      }

      const start = new Date(startedAt);
      const end = new Date(endedAt);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        return toast.error('End time must be after start time');
      }

      parsedHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (parsedHours <= 0 || parsedHours > 24) {
        return toast.error('Calculated time must be between 0 and 24 hours');
      }
    } else if (!hours || isNaN(hours) || Number(hours) <= 0 || Number(hours) > 24) {
      return toast.error('Please enter valid hours between 0 and 24');
    }

    if (!description || description.trim().length < 5) {
      return toast.error('Please add a meaningful update (min 5 characters)');
    }

    const payload = {
      hours: Number(parsedHours.toFixed(2)),
      description: description.trim(),
      activityType,
      outcome,
    };

    if (usingRange) {
      payload.startedAt = startedAt;
      payload.endedAt = endedAt;
      payload.date = endedAt;
    }

    if (progressDelta !== '' && !isNaN(progressDelta)) {
      payload.progressDelta = Number(progressDelta);
    }

    if (isStoppingTimer && statusAfterStop) {
      payload.status = statusAfterStop;
    }
    
    if (isStoppingTimer) {
      stopWorklogTimer.mutate(payload);
      return;
    }

    addWorklog.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div 
        className="bg-white dark:bg-card-dark w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-border-dark overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-light dark:border-border-dark">
          <div>
            <h2 className="text-lg font-bold">{isStoppingTimer ? 'Stop Work Session' : 'Log Work'}</h2>
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
            <label className="block text-sm font-medium mb-1">Log Method</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('hours')}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  mode === 'hours'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border-light dark:border-border-dark text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Enter Hours
              </button>
              <button
                type="button"
                onClick={() => setMode('range')}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  mode === 'range'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border-light dark:border-border-dark text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Time Range
              </button>
            </div>
            {isStoppingTimer && (
              <p className="mt-1 text-[11px] text-slate-500">Stop session can use either manual duration or explicit start/end range.</p>
            )}
          </div>

          {mode === 'hours' ? (
            <div>
              <label className="block text-sm font-medium mb-1">Time Spent (Hours)</label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="e.g. 1.5"
                required
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={endedAt}
                  onChange={(e) => setEndedAt(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  required
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Activity Type</label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="implementation">Implementation</option>
                <option value="testing">Testing</option>
                <option value="code-review">Code Review</option>
                <option value="collaboration">Collaboration</option>
                <option value="debugging">Debugging</option>
                <option value="planning">Planning</option>
                <option value="documentation">Documentation</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Outcome</label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="progress">Progress</option>
                <option value="blocked">Blocked</option>
                <option value="handoff">Hand-off to teammate</option>
                <option value="completed">Completed work item</option>
              </select>
            </div>
          </div>

          {isStoppingTimer && (
            <div>
              <label className="block text-sm font-medium mb-1">Status After Stop</label>
              <select
                value={statusAfterStop}
                onChange={(e) => setStatusAfterStop(e.target.value)}
                className="w-full bg-white dark:bg-zinc-950 border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Keep current status</option>
                <option value="review">Move to Review</option>
                <option value="done">Move to Done</option>
                <option value="todo">Move back to Todo</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Progress Delta (%)</label>
            <input
              type="number"
              min="-100"
              max="100"
              step="1"
              value={progressDelta}
              onChange={(e) => setProgressDelta(e.target.value)}
              className="w-full bg-white dark:bg-zinc-950 border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="Optional, e.g. 20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">What did you work on?</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
              className="w-full bg-white dark:bg-zinc-950 border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none"
              placeholder="What changed, what was delivered, and what's next?"
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
              disabled={addWorklog.isPending || stopWorklogTimer.isPending}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-md shadow-primary/20 hover:bg-primary-hover disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {addWorklog.isPending || stopWorklogTimer.isPending ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
              {isStoppingTimer ? 'Stop & Save Log' : 'Save Worklog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};