import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Star, Clock, MessageSquare } from 'lucide-react';

const getPriorityStyles = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'critical':
      return 'bg-red-500/10 text-red-600 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    case 'high':
      return 'bg-orange-500/10 text-orange-600 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
    case 'medium':
      return 'bg-amber-500/10 text-amber-600 border border-amber-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
    case 'low':
      return 'bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    default:
      return 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  }
};

const getTypeColor = (type) => {
  switch (type?.toLowerCase()) {
    case 'bug': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'story': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'epic': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  }
};

export const TaskCard = ({ task, onClick, isOverlay = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const priorityStyle = getPriorityStyles(task.priority);
  const assigneeName = task.assignee?.name || 'Unassigned';
  const assigneeInitial = task.assignee?.name?.charAt(0) || '?';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`task-card group flex flex-col gap-2 rounded-xl border bg-white dark:bg-surface-dark p-4 shadow-sm transition-all hover:shadow-lg hover:border-primary/30 cursor-grab active:cursor-grabbing
        ${isOverlay ? 'scale-[1.02] shadow-xl rotate-1 cursor-grabbing' : 'border-border-light dark:border-border-dark'}
      `}
    >
      {/* Top row: Type + Priority */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getTypeColor(task.type)}`}>
            {task.type || 'task'}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${priorityStyle}`}>
            {task.priority || 'Medium'}
          </span>
        </div>
        <GripVertical size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold leading-tight text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2">
        {task.title}
      </h4>

      {/* Bottom row: Assignee + Metadata */}
      <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-100 dark:border-slate-800/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-white dark:ring-surface-dark overflow-hidden">
              {task.assignee?.avatar ? <img src={task.assignee.avatar} alt="" className="w-full h-full object-cover" /> : assigneeInitial}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-surface-dark"></div>
          </div>
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate">{assigneeName}</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {task.storyPoints > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              <Star size={10} className={task.storyPoints > 5 ? 'fill-amber-400 text-amber-400' : ''} />
              {task.storyPoints}
            </span>
          )}
          {task.comments?.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
              <MessageSquare size={10} />
              {task.comments.length}
            </span>
          )}
          <span className="text-[9px] font-bold text-slate-400 tracking-wider font-mono" title={`Created: ${new Date(task.createdAt || Date.now()).toLocaleString()}`}>
             <Clock size={8} className="inline mr-0.5 mb-0.5" />
             {new Date(task.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
             <span className="mx-1">•</span>
             #{task._id.substring(task._id.length - 4).toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
};
